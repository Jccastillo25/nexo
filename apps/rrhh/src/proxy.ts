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
  if (request.nextUrl.pathname.startsWith("/kiosco")) {
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
