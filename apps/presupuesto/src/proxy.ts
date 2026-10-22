import { type NextRequest } from "next/server";
import { updateSession } from "@nexo/supabase";

// Next.js 16: el archivo "middleware" se renombró a "proxy". Sin sesión,
// updateSession manda al login del panel con next=/presupuesto<ruta> y
// conserva las cookies y cabeceras de caché que Supabase haya escrito.
export async function proxy(request: NextRequest) {
  const { response } = await updateSession(request, { basePath: "/presupuesto" });
  return response;
}

export const config = {
  matcher: [
    /*
     * Corre en todas las rutas excepto assets estáticos e imágenes.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
