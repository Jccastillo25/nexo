import "server-only";

/**
 * Helpers de SERVIDOR de Planilla para páginas, Server Actions y Route
 * Handlers. Toda la lógica de cálculo y la autorización real están en las RPC
 * `public.planilla_*` (security definer, core.fn_exigir_permiso, 42501/P0001)
 * para que Nexo Mobile use las mismas; aquí solo se adapta:
 *
 * - `companyId` sale SIEMPRE del servidor (contextoActual → NEXO_COMPANY_ID):
 *   `rpcPlanilla` lo pone al final de los argumentos, así ningún argumento
 *   que venga del cliente lo puede reemplazar.
 * - Cada Server Action empieza con `prepararAccion` (requirePermission ANTES
 *   de cualquier efecto); cada Route Handler con `exigirEnRuta`.
 * - Errores: P0001 de la RPC (escrito para el usuario) tal cual; 42501 →
 *   "Tu rol no permite realizar esta acción."; cualquier otro → genérico y
 *   console.error (mensajeDeError de @nexo/permissions).
 *
 * Mientras database.types.ts no tenga las RPC `planilla_*`, `rpcPlanilla`
 * las llama sin tipos de Supabase y el resultado se tipa con lib/planilla/tipos.ts.
 */
import { NextResponse } from "next/server";
import { contextoActual, sesionActual, type Contexto } from "@nexo/auth";
import {
  MENSAJE_GENERICO,
  MENSAJE_SIN_PERMISO,
  PermissionDeniedError,
  mensajeDeError,
  requirePermission,
  type PermissionContext,
} from "@nexo/permissions";
import { P, type CodigoRrhh } from "@/lib/permisos-rrhh";
import type { ActionFallo, ActionResult, ContratoOpcionRpc, ErrorRpc, OpcionContrato, Resultado } from "./tipos";

export { ayudaDeError, type AyudaError } from "./rutas";
export type { ActionFallo, ActionResult, Resultado } from "./tipos";

/** Contexto de servidor (cliente con la sesión + empresa). Acepta el de contextoActual con o sin tipos. */
export interface ContextoPlanilla {
  supabase: unknown;
  companyId: string;
}

/** RPC de Planilla (PL2a, PL2b y PL2c). Un nombre fuera de esta lista no compila. */
export type RpcPlanilla =
  // PL2a: motor
  | "planilla_crear"
  | "planilla_calcular"
  | "planilla_aprobar"
  | "planilla_pagar"
  | "planilla_anular"
  | "planilla_novedad_crear"
  | "planilla_novedad_anular"
  | "planilla_regimen_cambiar"
  | "planilla_regimen_aviso_descartar"
  | "planilla_contrato_antiguedad_fijar"
  | "planilla_parametro_vigencia_nueva"
  | "planilla_liquidacion_simular"
  // PL2b: prestaciones
  | "planilla_vacaciones_registrar"
  | "planilla_vacaciones_aprobar"
  | "planilla_vacaciones_rechazar"
  | "planilla_vacaciones_anular"
  | "planilla_vacaciones_saldos"
  | "planilla_vacaciones_movimientos"
  | "planilla_prestamo_crear"
  | "planilla_prestamo_anular"
  | "planilla_prestamo_cancelar"
  | "planilla_prestamos_saldos"
  | "planilla_prestamo_cuotas"
  | "planilla_embargo_crear"
  | "planilla_embargo_terminar"
  | "planilla_embargos_saldos"
  | "planilla_liquidacion_crear"
  | "planilla_liquidacion_recalcular"
  | "planilla_liquidacion_aprobar"
  | "planilla_liquidacion_pagar"
  | "planilla_liquidacion_anular"
  | "planilla_liquidaciones_listado"
  | "planilla_liquidacion_detalle"
  | "planilla_pasivo_laboral"
  | "planilla_provisiones_generar"
  // PL2c: listados, reportes y configuración
  | "planilla_detalle"
  | "planilla_comparar"
  | "planilla_contratos_opciones"
  | "planilla_novedades_listado"
  | "planilla_regimen_listado"
  | "planilla_simular_regimen"
  | "planilla_concepto_guardar"
  | "planilla_tipo_guardar"
  | "planilla_ir_tabla_nueva"
  | "planilla_declaracion_inss"
  | "planilla_declaracion_inatec"
  | "planilla_declaracion_ir"
  | "planilla_asistencia_propuesta"
  | "planilla_asistencia_importar";

/** Forma mínima del cliente para llamar una RPC sin los tipos generados. */
interface ClienteRpcSuelto {
  rpc(fn: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: unknown }>;
}

/**
 * Llama una RPC de Planilla con `p_company_id` del servidor (no se puede
 * reemplazar desde `args`). No lanza: un fallo de red vuelve como `error`.
 * Nunca muestres `error.message` tal cual: pásalo por `falloDeRpc` o
 * `mensajeDeError` (o usa `consultarRpc`/`accionRpc`, que ya lo hacen).
 */
export async function rpcPlanilla<T>(
  ctx: ContextoPlanilla,
  nombre: RpcPlanilla,
  args: Readonly<Record<string, unknown>> = {}
): Promise<{ data: T | null; error: ErrorRpc | null }> {
  const cliente = ctx.supabase as ClienteRpcSuelto;
  try {
    const { data, error } = await cliente.rpc(nombre, { ...args, p_company_id: ctx.companyId });
    return { data: (data ?? null) as T | null, error: (error ?? null) as ErrorRpc | null };
  } catch (err) {
    return { data: null, error: { message: err instanceof Error ? err.message : String(err) } };
  }
}

/** Traduce el error de una RPC a un `Resultado` fallido (ver tipos.ts). */
export function falloDeRpc(
  error: unknown,
  contexto: string,
  generico: string = MENSAJE_GENERICO
): Extract<Resultado<never>, { ok: false }> {
  const mensaje = mensajeDeError(error, contexto, generico);
  const code = typeof error === "object" && error !== null ? (error as ErrorRpc).code : undefined;
  const motivo = mensaje === MENSAJE_SIN_PERMISO ? "denegado" : code === "P0001" ? "negocio" : "error";
  return { ok: false, motivo, mensaje };
}

/**
 * Lectura para una página: `Resultado<T>` que distingue denegado (EmptyState
 * no-access), negocio (Alert warning con el texto de la RPC) y error
 * (EmptyState error). Una RPC `returns table` sin filas da `[]`, nunca null.
 */
export async function consultarRpc<T>(
  ctx: ContextoPlanilla,
  nombre: RpcPlanilla,
  args: Readonly<Record<string, unknown>>,
  contexto: string,
  generico?: string
): Promise<Resultado<T>> {
  const { data, error } = await rpcPlanilla<T>(ctx, nombre, args);
  if (error) return falloDeRpc(error, contexto, generico);
  return { ok: true, valor: data as T };
}

/**
 * La RPC de una Server Action ya autorizada (después de `prepararAccion`):
 * `{ ok: true, data }` o `{ ok: false, message }` con el mensaje seguro.
 * Ejemplo:
 *   const prep = await prepararAccion(P.planillaAprobar, "aprobarPlanilla");
 *   if (!prep.ok) return prep;
 *   const r = await accionRpc(prep.ctx, "planilla_aprobar", { p_planilla_id: id }, "aprobarPlanilla",
 *     "No se pudo aprobar la planilla. Intenta de nuevo.");
 *   if (r.ok) revalidatePath(RUTA.detalle(id));
 *   return r;
 */
export async function accionRpc<T = void>(
  ctx: ContextoPlanilla,
  nombre: RpcPlanilla,
  args: Readonly<Record<string, unknown>>,
  contexto: string,
  generico?: string
): Promise<ActionResult<T>> {
  const { data, error } = await rpcPlanilla<T>(ctx, nombre, args);
  if (error) return { ok: false, message: mensajeDeError(error, contexto, generico) };
  return { ok: true, data } as unknown as ActionResult<T>;
}

/**
 * Primer paso de TODA Server Action de Planilla: contexto del servidor y
 * requirePermission de cada código (en paralelo) ANTES de validar o llamar a
 * la RPC. Ante una denegación devuelve `{ ok: false, message }` listo para
 * retornar. Otros errores (red, NEXO_COMPANY_ID) se propagan, como en el
 * resto de las acciones de RRHH.
 */
export async function prepararAccion(
  codigo: CodigoRrhh | readonly CodigoRrhh[],
  contexto: string
): Promise<{ ok: true; ctx: Contexto } | ActionFallo> {
  const ctx = await contextoActual();
  const ctxPermiso: PermissionContext = { supabase: ctx.supabase, companyId: ctx.companyId };
  const codigos = typeof codigo === "string" ? [codigo] : [...codigo];
  try {
    await Promise.all(codigos.map((c) => requirePermission(ctxPermiso, c)));
  } catch (err) {
    if (err instanceof PermissionDeniedError) return { ok: false, message: mensajeDeError(err, contexto) };
    throw err;
  }
  return { ok: true, ctx };
}

/**
 * uuid del usuario de la sesión (para separación de funciones: comparar con
 * generada_por/calculada_por). Reutiliza la sesión ya cacheada del layout.
 */
export async function usuarioActualId(): Promise<string | null> {
  const { user } = await sesionActual();
  return user?.id ?? null;
}

/** Error JSON `{ message }` sin caché para Route Handlers (la pantalla lo muestra en un toast). */
export function respuestaError(status: number, message: string): Response {
  return NextResponse.json({ message }, { status, headers: { "Cache-Control": "no-store" } });
}

async function tienePermiso(ctx: PermissionContext, codigo: string): Promise<boolean> {
  try {
    await requirePermission(ctx, codigo);
    return true;
  } catch (err) {
    if (err instanceof PermissionDeniedError) return false;
    throw err;
  }
}

/**
 * Primer paso de TODO Route Handler de Planilla (CSV). Valida sesión,
 * `rrhh.ver_modulo` (siempre, aunque no venga en la lista) y cada código con
 * requirePermission en el servidor, nunca con la lista cacheada de la UI.
 * Falla con JSON: 401 sin sesión, 403 sin permiso, 500 inesperado.
 */
export async function exigirEnRuta(
  codigos: readonly CodigoRrhh[],
  mensajes: { sinPermiso?: string } = {}
): Promise<{ ok: true; ctx: Contexto; userId: string } | { ok: false; respuesta: Response }> {
  try {
    const ctx = await contextoActual();
    const { supabase, companyId } = ctx;
    const ctxPermiso: PermissionContext = { supabase, companyId };
    const lista = [...new Set<CodigoRrhh>([P.modulo, ...codigos])];
    const [{ data }, ...resultados] = await Promise.all([
      supabase.auth.getUser(),
      ...lista.map((c) => tienePermiso(ctxPermiso, c)),
    ] as const);
    const permitido = resultados as boolean[];
    if (!data.user) {
      return { ok: false, respuesta: respuestaError(401, "Tu sesión expiró. Vuelve a iniciar sesión e intenta de nuevo.") };
    }
    if (!permitido[0]) {
      return { ok: false, respuesta: respuestaError(403, "No tienes acceso a RRHH. Pide acceso a tu administrador.") };
    }
    if (permitido.some((ok) => !ok)) {
      return {
        ok: false,
        respuesta: respuestaError(403, mensajes.sinPermiso ?? "No tienes permiso para esta acción. Pide acceso a tu administrador."),
      };
    }
    return { ok: true, ctx, userId: data.user.id };
  } catch (err) {
    console.error("Planilla: no se pudo validar el acceso a la ruta", err);
    return { ok: false, respuesta: respuestaError(500, MENSAJE_GENERICO) };
  }
}

/** "Nombre · N.º 12" y, si terminó, " (finalizado)". */
export function etiquetaContrato(c: Pick<ContratoOpcionRpc, "empleado_nombre" | "numero_contrato" | "estado">): string {
  return `${c.empleado_nombre} · N.º ${c.numero_contrato}${c.estado === "finalizado" ? " (finalizado)" : ""}`;
}

/**
 * Contratos activos y finalizados para los selectores de persona (sin
 * salario). Lo permite cualquiera de: movimientos.crear, vacaciones.registrar,
 * prestamos.gestionar, liquidaciones.calcular o regimen.ver. Si falla o se
 * deniega, la pantalla oculta el selector y no rompe.
 */
export async function contratosOpciones(ctx: ContextoPlanilla): Promise<Resultado<OpcionContrato[]>> {
  const r = await consultarRpc<ContratoOpcionRpc[]>(ctx, "planilla_contratos_opciones", {}, "planilla_contratos_opciones");
  if (!r.ok) return r;
  // Sin error, una RPC `returns table` siempre da un arreglo (vacío si no hay contratos).
  const filas = Array.isArray(r.valor) ? r.valor : [];
  return { ok: true, valor: filas.map((c) => ({ ...c, etiqueta: etiquetaContrato(c) })) };
}
