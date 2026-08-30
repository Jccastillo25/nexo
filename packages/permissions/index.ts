// Motor de permisos unico de Nexo — norma v3.0 (DENY BY DEFAULT).
// Ver docs/PERMISSIONS.md para la guia completa.
//
// Toda la logica de la norma vive en UNA sola funcion SQL,
// core.has_permission() (ver supabase/migrations/20260830000001_core_schema.sql),
// expuesta via el wrapper public.has_permission(). Este paquete es solo un
// wrapper delgado sobre esa RPC — no duplica la logica en TypeScript, para
// que nunca se desincronice de lo que de verdad hacen las policies de RLS.

export class PermissionDeniedError extends Error {
  constructor(public readonly code: string) {
    super(`Permiso denegado: "${code}".`);
    this.name = "PermissionDeniedError";
  }
}

/** Forma minima que necesitamos del cliente de Supabase. */
interface RpcClient {
  rpc(
    fn: "has_permission",
    args: { p_company_id: string; p_code: string }
  ): Promise<{ data: unknown; error: unknown }>;
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
