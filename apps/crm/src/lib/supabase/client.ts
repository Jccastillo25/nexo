import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./database.types";

/**
 * Cliente de Supabase para usar en Client Components (navegador).
 *
 * Apunta al proyecto unificado nexo-core. Se deja el schema por defecto en
 * "public" (no "crm") a proposito: el RPC de permisos (has_permission) vive
 * en public, y este mismo cliente lo llama. Para leer/escribir clientes,
 * cada query usa `.schema("crm").from("clientes")` explicito — ver
 * docs/DATABASE.md.
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
