// Motor de permisos unico de Nexo — norma v3.0 (DENY BY DEFAULT).
// Ver docs/PERMISSIONS.md para la guia completa.
//
// Toda la logica de la norma vive en UNA sola funcion SQL,
// core.has_permission() (ver supabase/migrations/20260830000001_core_schema.sql),
// expuesta via el wrapper public.has_permission() y, en lote, via
// public.mis_permisos() (20261021164649). Este paquete es solo un wrapper
// delgado sobre esas RPC — no duplica la logica en TypeScript, para que nunca
// se desincronice de lo que de verdad hacen las policies de RLS.
//
// CUÁNDO USAR CADA UNO
// - requirePermission(ctx, código): al inicio de TODA Server Action / Route
//   Handler que muta o lee datos sensibles, antes de cualquier efecto. Nunca
//   se reemplaza por un permiso cacheado: cada acción es un endpoint público.
// - misPermisos(códigos) de @nexo/auth: para la UI (ocultar/deshabilitar
//   controles, armar el menú) en layouts y páginas. Una sola consulta por
//   request, compartida entre layout y página.
// - getPermisos(ctx, códigos): la consulta en lote sin caché que usa
//   misPermisos. Directo solo fuera del render de React (p. ej. un Route
//   Handler que necesita varios permisos a la vez).
// - hasPermission(ctx, código): un permiso suelto. Para varios, getPermisos.

export { mensajeDeError, MENSAJE_SIN_PERMISO, MENSAJE_GENERICO } from "./errores";

export class PermissionDeniedError extends Error {
  constructor(public readonly code: string) {
    super(`Permiso denegado: "${code}".`);
    this.name = "PermissionDeniedError";
  }
}

/** OJO: `supabase.rpc(...)` no devuelve un `Promise` en sentido estricto —
 * devuelve un `PostgrestFilterBuilder`, que es "thenable" (se puede
 * `await`) pero no implementa toda la interfaz de `Promise` (le faltan
 * `catch`/`finally`/etc a nivel de tipos). Usar `Promise<...>` aca rompe
 * el chequeo de tipos en cualquier app que pase su cliente real de
 * supabase-js — `PromiseLike` es el tipo correcto para algo "awaitable". */
type RespuestaRpc = PromiseLike<{ data: unknown; error: unknown }>;

interface ArgsHasPermission {
  p_company_id: string;
  p_code: string;
}

interface ArgsMisPermisos {
  p_company_id: string;
  p_codigos: string[];
}

/**
 * Forma mínima del cliente de Supabase: las dos RPC del motor,
 * has_permission (un código) y mis_permisos (lote). Los clientes tipados de
 * Nexo, RRHH, Atención y Agencia (database.types.ts sin mis_permisos) siguen
 * siendo compatibles: comprobado con su typecheck el 2026-10-20.
 */
export interface RpcClient {
  rpc(fn: "has_permission", args: ArgsHasPermission): RespuestaRpc;
  rpc(fn: "mis_permisos", args: ArgsMisPermisos): RespuestaRpc;
}

export interface PermissionContext {
  supabase: RpcClient;
  companyId: string;
}

/**
 * Verifica un permiso llamando a public.has_permission (RPC), que a su vez
 * llama a core.has_permission(auth.uid(), companyId, code) del lado del
 * servidor. El user_id sale de la sesion autenticada, nunca de un parametro
 * que el llamador pueda falsear.
 *
 * Fail-closed: cualquier error de red/RPC, o el codigo no registrado en
 * core.permissions_catalog, deniega. Nunca "permite por las dudas".
 */
export async function hasPermission(
  ctx: PermissionContext,
  code: string
): Promise<boolean> {
  const { data, error } = await ctx.supabase.rpc("has_permission", {
    p_company_id: ctx.companyId,
    p_code: code,
  });

  if (error) return false;
  return Boolean(data);
}

/**
 * Igual que hasPermission, pero lanza en vez de devolver false. Usar al
 * inicio de toda server action / route handler nueva:
 *
 *   await requirePermission({ supabase, companyId }, "flotilla.viajes.cancelar");
 *   // ... el resto de la funcion solo corre si no lanzo
 */
export async function requirePermission(
  ctx: PermissionContext,
  code: string
): Promise<void> {
  const ok = await hasPermission(ctx, code);
  if (!ok) {
    throw new PermissionDeniedError(code);
  }
}

/** Tope de códigos por llamada que acepta public.mis_permisos (lanza 22023 por encima). */
const LOTE_MAXIMO = 300;

/** RPC inexistente: PostgREST no la tiene en su caché (PGRST202) o Postgres no la encuentra (42883). */
const CODIGOS_RPC_INEXISTENTE = new Set(["PGRST202", "42883"]);

let avisoDeRespaldoEmitido = false;

function codigoDeError(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null) return undefined;
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" ? code : undefined;
}

async function permisosDeLote(ctx: PermissionContext, lote: string[]): Promise<string[]> {
  let data: unknown;
  let error: unknown;
  try {
    ({ data, error } = await ctx.supabase.rpc("mis_permisos", { p_company_id: ctx.companyId, p_codigos: lote }));
  } catch (err) {
    error = err;
  }

  if (!error) {
    if (!Array.isArray(data)) return [];
    // Solo se aceptan códigos que se pidieron.
    const pedidos = new Set(lote);
    return data.filter((c): c is string => typeof c === "string" && pedidos.has(c));
  }

  const codigo = codigoDeError(error);
  if (codigo && CODIGOS_RPC_INEXISTENTE.has(codigo)) {
    // mis_permisos aún no aplicada en esta base: un has_permission por código.
    if (!avisoDeRespaldoEmitido) {
      avisoDeRespaldoEmitido = true;
      console.warn(`getPermisos: public.mis_permisos no existe (${codigo}); se usa has_permission por código.`);
    }
    const valores = await Promise.all(lote.map((c) => hasPermission(ctx, c).catch(() => false)));
    return lote.filter((_, i) => valores[i]);
  }

  console.error("getPermisos: mis_permisos falló", error);
  return [];
}

/**
 * Devuelve, de `codigos`, los que tiene el usuario de la sesión, en UNA
 * llamada a public.mis_permisos (en lotes de 300 si hay más). Sin caché: la
 * caché por request la pone misPermisos() de @nexo/auth.
 *
 * - Si la RPC todavía no existe (PGRST202/42883), cae a has_permission por
 *   código, en paralelo.
 * - Ante cualquier otro error (sin sesión, red, permiso) devuelve los códigos
 *   de ese lote como denegados: fail-closed.
 */
export async function getPermisos(
  ctx: PermissionContext,
  codigos: readonly string[]
): Promise<Set<string>> {
  const unicos = [...new Set(codigos.filter((c) => typeof c === "string" && c.length > 0))];
  if (unicos.length === 0) return new Set();

  const lotes: string[][] = [];
  for (let i = 0; i < unicos.length; i += LOTE_MAXIMO) lotes.push(unicos.slice(i, i + LOTE_MAXIMO));

  const resultados = await Promise.all(lotes.map((lote) => permisosDeLote(ctx, lote)));
  return new Set(resultados.flat());
}
