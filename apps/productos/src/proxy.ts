import { type NextRequest } from "next/server";
import { updateSession } from "@nexo/supabase";

// Next.js 16: el archivo "middleware" se renombró a "proxy". Sin sesión,
// updateSession manda al login del panel con next=/productos<ruta>.
export async function proxy(request: NextRequest) {
  const { response } = await updateSession(request, { basePath: "/productos" });
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
