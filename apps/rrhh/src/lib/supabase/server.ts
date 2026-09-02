import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "./database.types";

/**
 * Cliente de Supabase para usar en Server Components, Server Actions y
 * Route Handlers autenticados. Lee/escribe la sesion desde las cookies de
 * la peticion — mismo patron que apps/crm.
 *
 * Apunta al proyecto unificado nexo-core. Schema por defecto "public"
 * (para has_permission y los RPCs de RRHH); las queries a tablas de rrhh
 * usan `.schema("rrhh").from(...)` explicito.
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
            // Se llama desde un Server Component (no puede escribir
            // cookies). El proxy (middleware) se encarga de refrescar la
            // sesion en ese caso.
          }
        },
      },
    }
  );
}

/**
 * Cliente ANONIMO (sin cookies de sesion) para el kiosko: la pantalla
 * /kiosco no requiere que el chofer tenga sesion de Supabase Auth — el
 * PIN + nombre_usuario/kiosko_id ES la credencial, validada por los RPCs
 * security definer (registrar_marca_kiosko, validar_acceso_operativo),
 * anon-callable a proposito (ver supabase/migrations/20260902000006 y
 * 20260902000008). Usar este cliente en vez de createClient() ahi evita
 * arrastrar cookies de una sesion administrativa que pueda estar abierta
 * en el mismo navegador del kiosko fisico.
 */
export function createAnonClient() {
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return [];
        },
        setAll() {
          // No-op a proposito: este cliente nunca persiste sesion.
        },
      },
    }
  );
}
