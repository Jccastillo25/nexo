import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@nexo/supabase";

// Next.js 16: el archivo "middleware" se renombró a "proxy". Ver
// node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md
export async function proxy(request: NextRequest) {
  // /kiosco queda fuera del guard de sesión y ni siquiera toca Supabase
  // Auth: es una terminal física sin usuario administrativo logueado. La
  // terminal se identifica con su token de enrolamiento (cookie httpOnly) y
  // el empleado con su PIN, contra registrar_marca_terminal. Redirigirlo al
  // login del panel lo dejaría inutilizable.
  // request.nextUrl.pathname ya viene sin el basePath ("/rrhh").
  //
  // 2026-10-20: el usuario reportó que el kiosco lo mandaba al login en un
  // iPad sin sesión. "/rrhh/Kiosco" (con mayúscula) pasaba por el guard y
  // terminaba en el login. Ahora cualquier variante de mayúsculas se lleva a
  // "/kiosco" sin pedir sesión, y solo se exime la ruta exacta (antes
  // también "/kioscoLoQueSea").
  //
  // Revisión de seguridad (2026-10-20): tampoco las subrutas ("/kiosco/x"
  // pasaba sin sesión). El kiosco es una sola página (app/kiosco/page.tsx) y
  // sus Server Actions hacen POST a esa misma ruta; la barra final
  // ("/kiosco/") la quita Next con su redirección antes del proxy.
  const ruta = request.nextUrl.pathname;
  const minuscula = ruta.toLowerCase();
  if (minuscula === "/kiosco") {
    if (ruta !== minuscula) {
      const destino = request.nextUrl.clone();
      destino.pathname = minuscula;
      return NextResponse.redirect(destino);
    }
    return NextResponse.next();
  }

  // Kernel (2026-10-20): sin sesión, updateSession manda al login central
  // del panel con next=/rrhh<ruta>, conservando las cookies y cabeceras de
  // caché que Supabase haya escrito al refrescar el token.
  const { response } = await updateSession(request, { basePath: "/rrhh" });
  return response;
}

export const config = {
  matcher: [
    /*
     * Corre en todas las rutas excepto assets estaticos e imagenes.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
