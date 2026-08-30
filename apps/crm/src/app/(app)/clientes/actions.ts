"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermission, PermissionDeniedError } from "@nexo/permissions";
import { createClient } from "@/lib/supabase/server";
import { getCompanyId } from "@/lib/company";
import type { ClienteInsert, ClienteUpdate, Json } from "@/lib/supabase/database.types";

export type ClienteFormState = {
  error: string | null;
  success?: boolean;
};

const TIPOS_VALIDOS = ["mayorista", "detal"] as const;

/**
 * Extrae y valida los campos comunes del formulario de cliente.
 * Trata FormData como no confiable: valida antes de tocar la base de datos.
 */
function parseClienteForm(
  formData: FormData
): { data: Omit<ClienteInsert, "id"> } | { error: string } {
  const nombre = String(formData.get("nombre") ?? "").trim();
  if (!nombre) {
    return { error: "El nombre es requerido." };
  }

  const telefono = String(formData.get("telefono") ?? "").trim() || null;
  const direccion = String(formData.get("direccion") ?? "").trim() || null;
  const ruc = String(formData.get("ruc") ?? "").trim() || null;
  const notas = String(formData.get("notas") ?? "").trim() || null;

  const tipoRaw = String(formData.get("tipo_cliente") ?? "").trim();
  if (tipoRaw && !TIPOS_VALIDOS.includes(tipoRaw as (typeof TIPOS_VALIDOS)[number])) {
    return { error: "Tipo de cliente inválido." };
  }
  const tipo_cliente = tipoRaw || null;

  const datosExtraRaw = String(formData.get("datos_extra_json") ?? "{}");
  let datos_extra: Json;
  try {
    const parsed = JSON.parse(datosExtraRaw);
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      Array.isArray(parsed)
    ) {
      throw new Error("no es un objeto");
    }
    datos_extra = parsed;
  } catch {
    return { error: "Los datos adicionales tienen un formato inválido." };
  }

  return {
    data: { nombre, telefono, direccion, ruc, notas, tipo_cliente, datos_extra },
  };
}

export async function createCliente(
  _prevState: ClienteFormState,
  formData: FormData
): Promise<ClienteFormState> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Tu sesión expiró. Vuelve a iniciar sesión." };
  }

  try {
    await requirePermission({ supabase, companyId: getCompanyId() }, "crm.clientes.crear");
  } catch (e) {
    if (e instanceof PermissionDeniedError) {
      return { error: "No tienes permiso para crear clientes." };
    }
    throw e;
  }

  const parsed = parseClienteForm(formData);
  if ("error" in parsed) return { error: parsed.error };

  const { data, error } = await supabase
    .schema("crm")
    .from("clientes")
    .insert(parsed.data)
    .select("id")
    .single();

  if (error) {
    return { error: `No se pudo crear el cliente: ${error.message}` };
  }

  revalidatePath("/clientes");
  redirect(`/clientes/${data.id}`);
}

export async function updateCliente(
  id: string,
  _prevState: ClienteFormState,
  formData: FormData
): Promise<ClienteFormState> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Tu sesión expiró. Vuelve a iniciar sesión." };
  }

  try {
    await requirePermission({ supabase, companyId: getCompanyId() }, "crm.clientes.editar");
  } catch (e) {
    if (e instanceof PermissionDeniedError) {
      return { error: "No tienes permiso para editar clientes." };
    }
    throw e;
  }

  const parsed = parseClienteForm(formData);
  if ("error" in parsed) return { error: parsed.error };

  const update: ClienteUpdate = parsed.data;
  const { error } = await supabase.schema("crm").from("clientes").update(update).eq("id", id);

  if (error) {
    return { error: `No se pudo guardar el cliente: ${error.message}` };
  }

  revalidatePath("/clientes");
  revalidatePath(`/clientes/${id}`);
  return { error: null, success: true };
}

export type DeleteState = { error: string | null };

export async function deleteCliente(
  id: string,
  _prevState: DeleteState
): Promise<DeleteState> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Tu sesión expiró. Vuelve a iniciar sesión." };
  }

  try {
    await requirePermission({ supabase, companyId: getCompanyId() }, "crm.clientes.eliminar");
  } catch (e) {
    if (e instanceof PermissionDeniedError) {
      return { error: "No tienes permiso para eliminar clientes." };
    }
    throw e;
  }

  const { error } = await supabase.schema("crm").from("clientes").delete().eq("id", id);

  if (error) {
    return { error: `No se pudo eliminar el cliente: ${error.message}` };
  }

  revalidatePath("/clientes");
  redirect("/clientes");
}
