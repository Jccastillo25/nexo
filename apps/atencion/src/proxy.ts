import { type NextRequest } from "next/server";
import { updateSession } from "@nexo/supabase";

// Next.js 16: el archivo "middleware" se renombró a "proxy". Sin sesión,
// updateSession manda al login del panel con next=/atencion<ruta>, conservando
// las cookies y las cabeceras de caché que Supabase haya escrito.
export async function proxy(request: NextRequest) {
  const { response } = await updateSession(request, { basePath: "/atencion" });
  return response;
}

export const config = {
  matcher: [
    /*
     * Todas las rutas excepto assets estáticos y /pantalla/<id>: la pantalla
     * pública del televisor no tiene usuario (mismo criterio que el kiosco
     * de RRHH) y se identifica con el id del dispositivo.
     *
     * N12 (2026-10-20): la exclusión lleva la barra ("pantalla/"). Sin ella,
     * cualquier ruta que empezara por "pantalla" (p. ej. /pantallas) quedaba
     * sin pedir sesión. /pantalla sola, sin id, también pide sesión.
     */
    "/((?!_next/static|_next/image|favicon.ico|pantalla/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
