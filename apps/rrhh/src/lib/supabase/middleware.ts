import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Refresca la sesion de Supabase en cada peticion — mismo patron que
 * apps/crm/src/lib/supabase/middleware.ts.
 *
 * Login unico (SSO): esta zona NO tiene su propio formulario de login
 * (ver docs/ARCHITECTURE.md). Sin sesion valida, cualquier ruta de
 * /rrhh/(app)/* rebota al login central del panel (apps/nexo). Esto
 * funciona sin nada especial porque Multi-Zones sirve todo bajo el mismo
 * dominio publico — el navegador ve un solo origin, asi que las cookies
 * de sesion que pone el login del panel las lee tambien esta zona.
 *
 * IMPORTANTE — /kiosco queda FUERA de este chequeo (ver el matcher en
 * ../../proxy.ts): el kiosko fisico no requiere sesion de Supabase Auth,
 * el chofer se identifica con PIN + nombre_usuario contra
 * rrhh.fn_validar_acceso_operativo/registrar_marca_kiosko. Redirigirlo a
 * /login del panel lo dejaria inutilizable en una terminal sin usuario
 * administrativo logueado.
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
    // request.nextUrl.pathname ya viene sin el basePath ("/rrhh") — hay
    // que agregarlo a mano para que el panel sepa a donde rebotar de vuelta.
    loginUrl.searchParams.set("next", `/rrhh${request.nextUrl.pathname}`);
    return NextResponse.redirect(loginUrl);
  }

  return supabaseResponse;
}
