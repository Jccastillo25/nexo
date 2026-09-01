import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Cliente con service_role: bypassa RLS. Solo para uso server-side (Server
// Actions), nunca importar desde un Client Component. Mismo patron que
// apps/flotilla/lib/supabase/admin.ts. Se usa unicamente para subir el
// logo/imagen de fondo a Storage (bucket "platform-assets") — la escritura
// de core.platform_settings en si pasa por la RPC
// public.update_platform_settings, que valida el permiso adentro.
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // Mensaje explicito en vez de dejar que supabase-js tire su propio error
  // generico ("supabaseKey is required") — asi el problema se identifica
  // de una sola mirada en el error que le llega al usuario, sin tener que
  // ir a revisar logs de Vercel.
  if (!url || !key) {
    throw new Error(
      `Falta ${!url ? "NEXT_PUBLIC_SUPABASE_URL" : "SUPABASE_SERVICE_ROLE_KEY"} en las variables de entorno de este deploy.`
    );
  }

  return createSupabaseClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
