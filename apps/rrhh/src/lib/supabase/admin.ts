import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Cliente con service_role: bypassa RLS. Solo para uso server-side (Server
// Actions), nunca importar desde un Client Component. Mismo patron que
// apps/nexo/src/lib/supabase/admin.ts. Fase 4 (2026-09-16, bloque pre-F1.5):
// se usa unicamente para crear/leer URLs firmadas del bucket privado
// rrhh-documentos-privados (createSignedUploadUrl/createSignedUrl) --
// nunca para subir el archivo en si desde el servidor (eso es exactamente
// lo que el bug P0 del 2026-09-14 demostro que choca con el techo de
// 4.5MB de Vercel Functions). El insert de metadata en
// rrhh.empleado_documentos SI pasa por el cliente autenticado normal
// (RLS + requirePermission), no por este cliente admin.
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

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
