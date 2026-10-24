import { type NextRequest } from "next/server";
import { redirigirConSesion, updateSession } from "@nexo/supabase";

// Next.js 16: el archivo "middleware" se renombró a "proxy".
//
// Sesión con el kernel compartido (@nexo/supabase, 2026-10-20). Sin sesión,
// updateSession manda al /login de este mismo panel con next=<ruta> (el
// panel no tiene basePath) y conserva las cookies que Supabase haya escrito.
// Con sesión, /login vuelve al Launcher. La contraseña temporal no se revisa
// aquí: la exigen el layout autenticado y el Launcher (lib/perfil.ts).
export async function proxy(request: NextRequest) {
  const { response, user } = await updateSession(request, { rutasPublicas: ["/login"] });

  if (user && request.nextUrl.pathname === "/login") {
    return redirigirConSesion(response, new URL("/", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    // Corre en todas las rutas de la zona raiz, EXCEPTO:
    // - assets estaticos / imagenes
    // - /rrhh/* — apps/rrhh tiene su propio guard
    //   (apps/rrhh/src/proxy.ts), que excluye /rrhh/kiosco por ser la
    //   terminal publica del kiosko (sin sesion, autenticada por PIN).
    // - /agencia/* — pertenece exclusivamente a la app Agencia; no crear
    //   páginas de esa zona dentro de Nexo aunque falte AGENCIA_APP_URL.
    // - /atencion/* — apps/atencion tiene su propio guard (redirige al login
    //   de este panel) y deja pública /atencion/pantalla, el televisor sin
    //   sesión. Si este proxy corriera ahí, mandaría la pantalla (y sus
    //   /atencion/_next/static/*) al login.
    // - /productos/* — apps/productos tiene su propio guard (mismo login de
    //   este panel); sus /productos/_next/static/* no deben pasar por aquí.
    // - /presupuesto/* — apps/presupuesto, mismo caso que Productos.
    // - /flotilla/* — apps/flotilla, mismo caso (2026-10-23). Sin esta
    //   exclusión, cada /flotilla/_next/static/* refrescaba la sesión aquí y
    //   en la zona a la vez: con el token vencido, Supabase respondió 429 y
    //   la sesión local se perdió.
    "/((?!_next/static|_next/image|favicon.ico|rrhh(?:/|$)|agencia(?:/|$)|atencion(?:/|$)|productos(?:/|$)|presupuesto(?:/|$)|flotilla(?:/|$)|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
