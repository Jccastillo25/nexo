import { createBrowserClient } from "@supabase/ssr";

/**
 * Cliente de Supabase para el navegador. Lee la sesión de las cookies del
 * login central (SSO). Hoy solo se usa para Realtime: los datos siguen
 * llegando por Server Actions/RPC con permisos.
 */
export function createClient() {
  return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}
