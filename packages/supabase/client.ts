// @nexo/supabase/client — cliente del navegador. Entrada aparte porque la
// principal importa `next/headers`, que no puede llegar a un Client Component.

import { createBrowserClient as crearClienteNavegador } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { urlYClavePublica } from "./entorno";

/**
 * Cliente de Supabase para Client Components. Lee la sesión de las cookies del
 * login central (SSO). Úsalo solo para lo que exige el navegador (Realtime,
 * subir a Storage con URL firmada); los datos van por Server Components/RPC.
 */
export function createBrowserClient<Db = any>() {
  const { url, clave } = urlYClavePublica();
  return crearClienteNavegador<Db>(url, clave);
}

/**
 * Cliente anónimo para Client Components públicos (la pantalla de TV de
 * Atención): sin sesión, sin cookies y sin refrescar tokens. Solo llega a las
 * RPC ejecutables por `anon`.
 */
export function createAnonBrowserClient<Db = any>() {
  const { url, clave } = urlYClavePublica();
  return createClient<Db>(url, clave, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
