// @nexo/supabase/admin — cliente con service_role. Entrada aparte y
// `server-only`: si un Client Component lo importa, el build falla en vez de
// filtrar la clave al navegador.
import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Cliente con SUPABASE_SERVICE_ROLE_KEY: salta RLS y los permisos de las RPC.
 * Solo en el servidor, DESPUÉS de `requirePermission`, y justificando su uso
 * en un comentario (hoy: Storage del logo en el panel y URLs firmadas de RRHH).
 * Mismas opciones que las copias de apps/nexo y apps/rrhh.
 */
export function createServiceRoleClient<Db = any>() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // Mensaje explícito en vez del genérico de supabase-js ("supabaseKey is
  // required"): nombra la variable, nunca su valor.
  if (!url || !key) {
    throw new Error(
      `Falta ${!url ? "NEXT_PUBLIC_SUPABASE_URL" : "SUPABASE_SERVICE_ROLE_KEY"} en las variables de entorno de este deploy.`
    );
  }

  return createClient<Db>(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
