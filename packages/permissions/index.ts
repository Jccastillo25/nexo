// Motor de permisos unico de Nexo — norma v3.0 (DENY BY DEFAULT).
// Ver docs/PERMISSIONS.md para la guia completa de cuando y como usar esto.
//
// Contrato clave, distinto de la v2.0 de Gestor360: un permission_code que
// NO existe en core.permissions_catalog se trata como INVALIDO, no como
// "sin definir". hasPermission() y requirePermission() fallan cerrado
// (deniegan) en ese caso, en vez de dejar pasar por accidente. Esto es lo
// que hace que "olvidarse de registrar el permiso" == "la funcion no
// funciona para nadie", en vez de "la funcion queda abierta para todos".

export class PermissionNotRegisteredError extends Error {
  constructor(public readonly code: string) {
    super(
      `El permiso "${code}" no existe en core.permissions_catalog. ` +
        `Registralo primero (ver docs/PERMISSIONS.md) antes de llamar a ` +
        `requirePermission("${code}") — por diseño, un permiso no ` +
        `registrado se deniega, nunca se concede.`
    );
    this.name = "PermissionNotRegisteredError";
  }
}

export class PermissionDeniedError extends Error {
  constructor(public readonly code: string) {
    super(`Permiso denegado: "${code}".`);
    this.name = "PermissionDeniedError";
  }
}

/** Forma minima que necesitamos del cliente de Supabase, para no acoplar
 * este paquete a @nexo/supabase todavia (evita dependencia circular
 * mientras ese paquete se termina de construir). */
interface QueryClient {
  from(table: string): {
    select(columns: string): {
      eq(column: string, value: string): {
        maybeSingle(): Promise<{ data: unknown; error: unknown }>;
      };
    };
  };
}

export interface PermissionContext {
  supabase: QueryClient;
  userId: string;
  companyId: string;
  /** 'owner' | 'admin' | otro rol de negocio. Solo owners/admins tienen el
   * bypass heredado de la v2.0 (acceso total si no hay fila explicita). */
  role?: string;
}

/**
 * Verifica un permiso. Fail-closed en TODOS los casos ambiguos:
 * - Si el codigo no esta en core.permissions_catalog -> false (denegado).
 * - Si no hay fila en core.user_permissions para ese user+company+code:
 *     - owner/admin -> true (bypass heredado de Gestor360 v2.0)
 *     - cualquier otro rol -> false
 * - Si hay fila con granted=false -> false, sin excepcion para nadie.
 * - Si hay fila con granted=true -> true.
 */
export async function hasPermission(
  ctx: PermissionContext,
  code: string
): Promise<boolean> {
  const catalogEntry = await ctx.supabase
    .from("permissions_catalog")
    .select("code")
    .eq("code", code)
    .maybeSingle();

  if (catalogEntry.error || !catalogEntry.data) {
    // Codigo no registrado: denegar siempre, incluso para owners/admins.
    // Esto evita que un typo en el codigo ("rrhh.talento.emplados.crear")
    // se cuele como "sin definir = permitido".
    return false;
  }

  const grant = await ctx.supabase
    .from("user_permissions")
    .select("granted")
    .eq("user_id", ctx.userId)
    .maybeSingle();

  if (grant.error || !grant.data) {
    return ctx.role === "owner" || ctx.role === "admin";
  }

  return Boolean((grant.data as { granted?: boolean }).granted);
}

/**
 * Igual que hasPermission, pero lanza en vez de devolver false. Usar al
 * inicio de toda server action / route handler nueva:
 *
 *   await requirePermission(ctx, "flotilla.viajes.cancelar");
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
