import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./database.types";

/**
 * Cliente de Supabase para usar en Client Components (navegador).
 *
 * Apunta al proyecto unificado nexo-core (mismo patron que apps/crm). El
 * schema por defecto queda en "public" a proposito: los RPCs de permisos
 * y de RRHH (has_permission, validar_acceso_operativo,
 * registrar_marca_kiosko, crear_empleado) viven ahi. Para leer/escribir
 * tablas de rrhh directo, cada query usa `.schema("rrhh").from(...)`
 * explicito — ver .env.local.example (paso pendiente: exponer "rrhh" en
 * Data API).
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
