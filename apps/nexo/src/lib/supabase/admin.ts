import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Cliente con service_role: bypassa RLS. Solo para uso server-side (Server
// Actions), nunca importar desde un Client Component. Mismo patron que
// apps/flotilla/lib/supabase/admin.ts. Se usa unicamente para subir el
// logo/imagen de fondo a Storage (bucket "platform-assets") — la escritura
// de core.platform_settings en si pasa por la RPC
// public.update_platform_settings, que valida el permiso adentro.
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
