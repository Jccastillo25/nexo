// @nexo/supabase — clientes de Supabase compartidos por todas las zonas de
// Nexo (proyecto nexo-core) y la sesión del proxy. Entrada de SERVIDOR: usa
// `next/headers`, así que no se importa desde un archivo "use client".
//
// Entradas:
//   "@nexo/supabase"        → createServerClient, createAnonClient, updateSession, redirigirConSesion
//   "@nexo/supabase/client" → createBrowserClient (Client Components)
//   "@nexo/supabase/admin"  → createServiceRoleClient (server-only, salta RLS)
//
// Los tipos `Db` son solo de TypeScript (database.types.ts de cada app); el
// cliente en ejecución es el mismo. Sin tipos, `any`, como hace supabase-js.

import { createServerClient as crearClienteSsr } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { urlYClavePublica } from "./entorno";

export type { SupabaseClient, User } from "@supabase/supabase-js";
export { updateSession, redirigirConSesion, type OpcionesSesion, type ResultadoSesion } from "./proxy";

/**
 * Cliente con la sesión del usuario (cookies de la petición) para Server
 * Components, Server Actions y Route Handlers. En un Server Component no se
 * pueden escribir cookies: si Supabase refresca el token, lo persiste el proxy.
 * En páginas y layouts conviene `sesionActual()`/`contextoActual()` de
 * @nexo/auth, que reutilizan un solo cliente por request.
 */
export async function createServerClient<Db = any>() {
  const { url, clave } = urlYClavePublica();
  const cookieStore = await cookies();

  return crearClienteSsr<Db>(url, clave, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Llamado desde un Server Component: el proxy refresca la sesión.
        }
      },
    },
  });
}

/**
 * Cliente anónimo, sin cookies ni sesión, para RPC ejecutables por `anon`
 * (get_platform_settings, kiosco). No arrastra la sesión de un usuario que
 * tenga el navegador abierto, y se puede usar dentro de `unstable_cache`.
 */
export function createAnonClient<Db = any>() {
  const { url, clave } = urlYClavePublica();
  return createClient<Db>(url, clave, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
