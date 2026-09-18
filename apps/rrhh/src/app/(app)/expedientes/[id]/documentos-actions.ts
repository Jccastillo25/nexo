"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { requirePermission, PermissionDeniedError } from "@nexo/permissions";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCompanyId } from "@/lib/company";

const BUCKET = "rrhh-documentos-privados";
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_MIME = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);
const TIPOS = ["cedula", "curriculum", "titulo", "contrato_firmado", "otro"] as const;
export type TipoDocumento = (typeof TIPOS)[number];

export interface ActionResult {
  ok: boolean;
  message?: string;
}

export interface PedirSubidaInput {
  nombreOriginal: string;
  mimeType: string;
  tamanoBytes: number;
  tipoDocumento: TipoDocumento;
}

export interface PedirSubidaResult extends ActionResult {
  /** URL firmada de subida directa navegador -> Storage — nunca pasa el archivo por esta Server Action. */
  signedUrl?: string;
  token?: string;
  path?: string;
}

/**
 * Nombre de archivo saneado: solo alfanumerico/guion/punto, sin separadores
 * de ruta -- evita path traversal aunque el nombre original venga de un
 * input de usuario no confiable.
 */
function sanearNombre(nombre: string): string {
  const base = nombre.trim().replace(/[^a-zA-Z0-9._-]+/g, "_").slice(-100);
  return base || "documento";
}

/**
 * Fase 4 (2026-09-16, bloque pre-F1.5): paso 1 de 2 de la subida. Valida
 * permiso + metadata (tipo MIME, tamaño, tipo de documento) ANTES de emitir
 * la URL firmada -- el archivo en si nunca pasa por esta Server Action (a
 * diferencia de apps/nexo/.../marca/actions.ts), evita el techo de 4.5MB
 * de Vercel Functions que ya causo el bug P0 del 2026-09-14 con imagenes
 * de marca. El navegador sube directo a Storage con el token devuelto
 * (uploadToSignedUrl) y despues llama confirmarDocumentoSubido.
 */
export async function pedirUrlSubidaDocumento(
  empleadoId: string,
  input: PedirSubidaInput
): Promise<PedirSubidaResult> {
  const supabase = await createClient();
  const companyId = getCompanyId();

  try {
    await requirePermission({ supabase, companyId }, "rrhh.expedientes.documentos.subir");
  } catch (err) {
    if (err instanceof PermissionDeniedError) return { ok: false, message: err.message };
    throw err;
  }

  if (!TIPOS.includes(input.tipoDocumento)) {
    return { ok: false, message: "Tipo de documento inválido." };
  }
  if (!ALLOWED_MIME.has(input.mimeType)) {
    return { ok: false, message: "Formato no permitido. Usá PDF, JPG, PNG o Word (.docx)." };
  }
  if (input.tamanoBytes <= 0 || input.tamanoBytes > MAX_BYTES) {
    return { ok: false, message: `El archivo supera el máximo permitido de ${MAX_BYTES / (1024 * 1024)} MB.` };
  }

  // El empleado debe existir en esta empresa -- evita construir un path
  // valido para un empleado ajeno solo con adivinar un uuid.
  const { data: empleado } = await supabase
    .schema("rrhh")
    .from("empleados")
    .select("id")
    .eq("id", empleadoId)
    .eq("company_id", companyId)
    .maybeSingle();
  if (!empleado) return { ok: false, message: "Empleado no encontrado en esta empresa." };

  const path = `${companyId}/empleados/${empleadoId}/${randomUUID()}-${sanearNombre(input.nombreOriginal)}`;

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch (err) {
    return {
      ok: false,
      message: `No se pudo inicializar el cliente de Storage: ${(err as Error).message}.`,
    };
  }

  const { data, error } = await admin.storage.from(BUCKET).createSignedUploadUrl(path);
  if (error || !data) {
    return { ok: false, message: error?.message ?? "No se pudo generar la URL de subida." };
  }

  return { ok: true, signedUrl: data.signedUrl, token: data.token, path: data.path };
}

export interface ConfirmarSubidaInput extends PedirSubidaInput {
  path: string;
}

/**
 * Paso 2 de 2: el navegador ya subio el archivo directo a Storage con el
 * token de pedirUrlSubidaDocumento -- esto crea la fila de metadata (RLS/
 * requirePermission de nuevo, por si el token se uso pero esta accion se
 * llama con datos manipulados).
 *
 * 2026-09-17 (hallazgo de seguridad, bloque pre-F1.5): hasta ahora esto
 * insertaba `mime_type`/`tamano_bytes` directo desde `input`, es decir,
 * confiaba en metadata que el NAVEGADOR reporta sobre su propio archivo --
 * un cliente manipulado podia declarar "10KB / PDF" y subir en realidad
 * algo mas grande o de otro tipo (Storage ya lo hubiera rechazado si el
 * bucket tuviera limites configurados, pero la fila de metadata igual
 * hubiera quedado con datos falsos). Ahora se lee el objeto REAL desde
 * Storage (list() sobre la carpeta, con el nombre exacto) y se valida/
 * persiste su tamaño y mimetype reales -- nunca los que mando el cliente.
 */
export async function confirmarDocumentoSubido(
  empleadoId: string,
  input: ConfirmarSubidaInput
): Promise<ActionResult> {
  const supabase = await createClient();
  const companyId = getCompanyId();

  try {
    await requirePermission({ supabase, companyId }, "rrhh.expedientes.documentos.subir");
  } catch (err) {
    if (err instanceof PermissionDeniedError) return { ok: false, message: err.message };
    throw err;
  }

  const prefix = `${companyId}/empleados/${empleadoId}/`;
  if (!input.path.startsWith(prefix)) {
    return { ok: false, message: "Ruta de archivo inválida." };
  }

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch (err) {
    return {
      ok: false,
      message: `No se pudo inicializar el cliente de Storage: ${(err as Error).message}.`,
    };
  }

  const folder = input.path.slice(0, input.path.lastIndexOf("/"));
  const filename = input.path.slice(input.path.lastIndexOf("/") + 1);
  const { data: listado, error: listError } = await admin.storage
    .from(BUCKET)
    .list(folder, { search: filename });
  if (listError) return { ok: false, message: `No se pudo verificar la subida: ${listError.message}` };

  const objetoReal = listado?.find((f) => f.name === filename);
  if (!objetoReal || !objetoReal.metadata) {
    return {
      ok: false,
      message: "El archivo no se encontró en Storage — la subida pudo fallar o todavía no terminó.",
    };
  }

  const tamanoReal = Number(objetoReal.metadata.size);
  const mimeReal = String(objetoReal.metadata.mimetype ?? "");

  if (!Number.isFinite(tamanoReal) || tamanoReal <= 0 || tamanoReal > MAX_BYTES) {
    return { ok: false, message: `El archivo supera el máximo permitido de ${MAX_BYTES / (1024 * 1024)} MB.` };
  }
  if (!ALLOWED_MIME.has(mimeReal)) {
    return { ok: false, message: "Formato no permitido. Usá PDF, JPG, PNG o Word (.docx)." };
  }
  if (!TIPOS.includes(input.tipoDocumento)) {
    return { ok: false, message: "Tipo de documento inválido." };
  }

  const { error } = await supabase.schema("rrhh").from("empleado_documentos").insert({
    company_id: companyId,
    empleado_id: empleadoId,
    tipo_documento: input.tipoDocumento,
    storage_path: input.path,
    nombre_original: input.nombreOriginal,
    mime_type: mimeReal,
    tamano_bytes: tamanoReal,
  });

  if (error) return { ok: false, message: error.message };

  revalidatePath(`/expedientes/${empleadoId}`);
  return { ok: true };
}

export interface PedirDescargaResult extends ActionResult {
  signedUrl?: string;
}

/**
 * URL firmada de LECTURA de corta duracion (60s -- alcanza para que el
 * navegador dispare la descarga/apertura inmediatamente). Nunca se
 * persiste esta URL como fuente de verdad, solo storage_path.
 */
export async function pedirUrlDescargaDocumento(documentoId: string): Promise<PedirDescargaResult> {
  const supabase = await createClient();
  const companyId = getCompanyId();

  try {
    await requirePermission({ supabase, companyId }, "rrhh.expedientes.documentos.descargar");
  } catch (err) {
    if (err instanceof PermissionDeniedError) return { ok: false, message: err.message };
    throw err;
  }

  const { data: doc, error: docError } = await supabase
    .schema("rrhh")
    .from("empleado_documentos")
    .select("storage_path")
    .eq("id", documentoId)
    .eq("company_id", companyId)
    .is("eliminado_at", null)
    .maybeSingle();

  if (docError) return { ok: false, message: docError.message };
  if (!doc) return { ok: false, message: "Documento no encontrado." };

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch (err) {
    return { ok: false, message: `No se pudo inicializar el cliente de Storage: ${(err as Error).message}.` };
  }

  const { data, error } = await admin.storage.from(BUCKET).createSignedUrl(doc.storage_path, 60);
  if (error || !data) return { ok: false, message: error?.message ?? "No se pudo generar la URL de descarga." };

  return { ok: true, signedUrl: data.signedUrl };
}

/**
 * Soft delete -- nunca DELETE fisico (conserva el rastro de auditoria de
 * que hubo un documento). El archivo real en Storage tampoco se borra en
 * este bloque -- limpieza fisica queda fuera de alcance (mismo criterio
 * conservador que las columnas deprecadas de otras tablas del proyecto).
 */
export async function eliminarDocumento(empleadoId: string, documentoId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const companyId = getCompanyId();

  try {
    await requirePermission({ supabase, companyId }, "rrhh.expedientes.documentos.eliminar");
  } catch (err) {
    if (err instanceof PermissionDeniedError) return { ok: false, message: err.message };
    throw err;
  }

  const { data: userData } = await supabase.auth.getUser();

  const { error } = await supabase
    .schema("rrhh")
    .from("empleado_documentos")
    .update({ eliminado_at: new Date().toISOString(), eliminado_por: userData.user?.id ?? null })
    .eq("id", documentoId)
    .eq("company_id", companyId);

  if (error) return { ok: false, message: error.message };

  revalidatePath(`/expedientes/${empleadoId}`);
  return { ok: true };
}
