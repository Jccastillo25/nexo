import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "./database.types";

/**
 * Cliente de Supabase para usar en Server Components, Server Actions y Route
 * Handlers. Lee/escribe la sesión desde las cookies de la petición.
 *
 * Apunta al proyecto unificado nexo-core. Schema por defecto "public"
 * (para el RPC has_permission); las queries a clientes usan
 * `.schema("crm").from("clientes")` explicito. Ver docs/DATABASE.md.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Se llama desde un Server Component (no puede escribir cookies).
            // El middleware se encarga de refrescar la sesión en ese caso.
          }
        },
      },
    }
  );
}
