import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Refresca la sesion de Supabase en cada peticion.
 *
 * Login unico (SSO): esta zona ya NO tiene su propio formulario de login
 * (ver docs/ARCHITECTURE.md). Sin sesion valida, cualquier ruta de /crm/*
 * rebota al login central del panel (apps/nexo). Esto funciona sin nada
 * especial porque Multi-Zones sirve todo bajo el mismo dominio publico
 * (nexo.materialesjcastillo.com) — el navegador ve un solo origin, asi que
 * las cookies de sesion que pone el login del panel las lee tambien esta
 * zona. `request.nextUrl.origin` ya refleja ese dominio publico (Vercel
 * reescribe preservando el host), por eso alcanza sin variable de entorno
 * en produccion; NEXO_PANEL_URL solo hace falta si se accede directo al
 * deployment *.vercel.app de este modulo (sin pasar por el rewrite) o en
 * desarrollo local, donde cada zona corre en un puerto distinto.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANTE: no eliminar. getUser() revalida el token contra Supabase Auth.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const panelBaseUrl = process.env.NEXO_PANEL_URL || request.nextUrl.origin;
    const loginUrl = new URL("/login", panelBaseUrl);
    // request.nextUrl.pathname ya viene sin el basePath ("/crm") — hay que
    // agregarlo a mano para que el panel sepa a donde rebotar de vuelta.
    loginUrl.searchParams.set("next", `/crm${request.nextUrl.pathname}`);
    return NextResponse.redirect(loginUrl);
  }

  return supabaseResponse;
}
