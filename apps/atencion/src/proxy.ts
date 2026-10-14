import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

// Next.js 16: el archivo "middleware" se renombró a "proxy".
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Todas las rutas excepto assets estáticos y /pantalla: la pantalla
     * pública del televisor no tiene usuario (mismo criterio que el kiosco
     * de RRHH) y se identifica con el id del dispositivo.
     */
    "/((?!_next/static|_next/image|favicon.ico|pantalla|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
