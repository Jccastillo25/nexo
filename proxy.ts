import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isDriverRoute = pathname.startsWith("/driver");
  const isAdminRoute = pathname.startsWith("/admin");
  const isLoginRoute = pathname === "/login";
  const isRootRoute = pathname === "/";

  // /supadmin es un area aislada, con su propio login: no comparte
  // logica de redirect con /login, /admin ni /driver.
  const isSupadminRoute = pathname.startsWith("/supadmin");
  const isSupadminLoginRoute = pathname === "/supadmin/login";

  if (isSupadminRoute) {
    if (!user) {
      if (isSupadminLoginRoute) return response;
      const url = request.nextUrl.clone();
      url.pathname = "/supadmin/login";
      return NextResponse.redirect(url);
    }

    const { data: platformAdmin } = await supabase
      .from("platform_admins")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!platformAdmin) {
      if (isSupadminLoginRoute) return response;
      const url = request.nextUrl.clone();
      url.pathname = "/supadmin/login";
      return NextResponse.redirect(url);
    }

    if (isSupadminLoginRoute) {
      const url = request.nextUrl.clone();
      url.pathname = "/supadmin";
      return NextResponse.redirect(url);
    }

    return response;
  }

  if ((isDriverRoute || isAdminRoute) && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (isRootRoute && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && (isLoginRoute || isRootRoute || isAdminRoute)) {
    // admins y drivers son tablas independientes (nunca se mezclan):
    // pertenecer a una nunca implica pertenecer a la otra.
    const { data: adminProfile } = await supabase
      .from("admins")
      .select("id")
      .eq("id", user.id)
      .maybeSingle();
    const isAdmin = Boolean(adminProfile);

    if (isLoginRoute || isRootRoute) {
      const url = request.nextUrl.clone();
      url.pathname = isAdmin ? "/admin" : "/driver";
      return NextResponse.redirect(url);
    }

    if (isAdminRoute && !isAdmin) {
      const url = request.nextUrl.clone();
      url.pathname = "/driver";
      return NextResponse.redirect(url);
    }
  }

  return response;
}

export const config = {
  matcher: ["/", "/driver/:path*", "/admin/:path*", "/login", "/supadmin/:path*"],
};
