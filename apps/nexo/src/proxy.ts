import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

// Next.js 16: el archivo "middleware" se renombro a "proxy".
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    // Corre en todas las rutas de la zona raiz, EXCEPTO:
    // - assets estaticos / imagenes
    // - /crm/* — esa zona tiene su propio middleware de auth (apps/crm);
    //   si el de aca tambien corriera, pisaria el flujo de login del CRM.
    "/((?!_next/static|_next/image|favicon.ico|crm|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
