import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

// Next.js 16: el archivo "middleware" se renombro a "proxy". Ver
// node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md
// (mismo hallazgo que documenta apps/crm/src/proxy.ts).
export async function proxy(request: NextRequest) {
  // /kiosco queda fuera del guard de sesion: es una terminal fisica sin
  // usuario administrativo logueado — se autentica por PIN, no por
  // sesion de Supabase Auth (ver comentario en lib/supabase/middleware.ts).
  // request.nextUrl.pathname ya viene sin el basePath ("/rrhh").
  //
  // 2026-10-20: el usuario reportó que el kiosco lo mandaba al login en un
  // iPad sin sesión. "/rrhh/Kiosco" (con mayúscula) pasaba por el guard y
  // terminaba en el login. Ahora cualquier variante de mayúsculas se lleva a
  // "/kiosco" sin pedir sesión, y solo se exime la ruta exacta (antes
  // también "/kioscoLoQueSea").
  const ruta = request.nextUrl.pathname;
  const minuscula = ruta.toLowerCase();
  if (minuscula === "/kiosco" || minuscula.startsWith("/kiosco/")) {
    if (ruta !== minuscula) {
      const destino = request.nextUrl.clone();
      destino.pathname = minuscula;
      return NextResponse.redirect(destino);
    }
    return NextResponse.next();
  }

  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Corre en todas las rutas excepto assets estaticos e imagenes.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
