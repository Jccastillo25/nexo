import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Refresca la sesion de Supabase en cada peticion. Login unico (SSO): sin
 * sesion valida, cualquier ruta de /productos/* rebota al login central del
 * panel (apps/nexo). Mismo patron que apps/atencion/src/lib/supabase/middleware.ts.
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
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
          Object.entries(headers).forEach(([key, value]) => supabaseResponse.headers.set(key, value));
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
    // request.nextUrl.pathname viene sin el basePath ("/productos").
    loginUrl.searchParams.set("next", `/productos${request.nextUrl.pathname}`);
    const response = NextResponse.redirect(loginUrl);
    supabaseResponse.cookies.getAll().forEach((cookie) => response.cookies.set(cookie));
    for (const header of ["Cache-Control", "Expires", "Pragma"]) {
      const value = supabaseResponse.headers.get(header);
      if (value) response.headers.set(header, value);
    }
    return response;
  }

  return supabaseResponse;
}
