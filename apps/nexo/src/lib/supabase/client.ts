import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./database.types";

/** Cliente de Supabase para Client Components. Apunta a nexo-core, schema
 * por defecto "public" (donde viven los RPC has_permission/get_visible_apps). */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
