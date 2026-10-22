import { createServerClient as crearClienteSsr } from "@supabase/ssr";
import type { User } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { urlYClavePublica } from "./entorno";

// Sesión de Supabase en el `proxy.ts` de cada zona de Multi-Zones.
//
// Login único (SSO, ver CLAUDE.md): ningún módulo tiene login propio. Sin
// sesión válida, la zona rebota al login del panel (apps/nexo). Funciona sin
// nada especial porque Multi-Zones sirve todo bajo el mismo dominio público:
// las cookies que pone el login del panel las lee cada zona.
// `request.nextUrl.origin` ya es ese dominio en producción (Vercel reescribe
// preservando el host); NEXO_PANEL_URL solo hace falta en desarrollo local
// (cada zona en su puerto) o al entrar directo al *.vercel.app de un módulo.

/** Cabeceras que @supabase/ssr pide al refrescar el token (evitan que una CDN guarde la cookie). */
const CABECERAS_DE_CACHE = ["Cache-Control", "Expires", "Pragma"] as const;

export interface OpcionesSesion {
  /** basePath de la zona, con barra inicial y sin barra final ("/productos"). Sin él, la zona es el panel. */
  basePath?: string;
  /**
   * Rutas (sin el basePath) que no exigen sesión. Texto: la ruta exacta o
   * cualquier subruta ("/login" cubre "/login/x", no "/login-admin"). RegExp:
   * se prueba contra la ruta. Distingue mayúsculas. La sesión se refresca
   * igual; para no tocar Auth en absoluto, no llames a updateSession.
   */
  rutasPublicas?: Array<string | RegExp>;
  /** Reemplaza el destino por defecto cuando no hay sesión. */
  loginUrl?: (request: NextRequest) => URL;
}

export interface ResultadoSesion {
  /** Respuesta que el proxy debe devolver (continúa o redirige al login, con las cookies ya copiadas). */
  response: NextResponse;
  /** Usuario validado contra Supabase Auth, o null. */
  user: User | null;
}

/** Redirección que conserva las cookies de sesión y las cabeceras de caché que Supabase haya escrito en `respuestaDeSesion`. */
export function redirigirConSesion(
  respuestaDeSesion: NextResponse,
  destino: Parameters<typeof NextResponse.redirect>[0]
): NextResponse {
  const respuesta = NextResponse.redirect(destino);
  respuestaDeSesion.cookies.getAll().forEach((cookie) => respuesta.cookies.set(cookie));
  for (const cabecera of CABECERAS_DE_CACHE) {
    const valor = respuestaDeSesion.headers.get(cabecera);
    if (valor) respuesta.headers.set(cabecera, valor);
  }
  return respuesta;
}

function esRutaPublica(ruta: string, rutas: Array<string | RegExp> = []): boolean {
  return rutas.some((r) => {
    if (typeof r !== "string") {
      r.lastIndex = 0; // una RegExp con /g o /y guarda estado entre llamadas
      return r.test(ruta);
    }
    const base = r !== "/" && r.endsWith("/") ? r.slice(0, -1) : r;
    return ruta === base || (base !== "/" && ruta.startsWith(`${base}/`));
  });
}

/** Login del panel con `next` = ruta pedida, con basePath (request.nextUrl.pathname viene sin él). */
function urlDeLoginPorDefecto(request: NextRequest, basePath?: string): URL {
  // El panel (sin basePath) va a su propio /login; una zona, al del panel.
  const origen = basePath ? process.env.NEXO_PANEL_URL || request.nextUrl.origin : request.nextUrl.origin;
  const url = new URL("/login", origen);
  url.searchParams.set("next", `${basePath ?? ""}${request.nextUrl.pathname}`);
  return url;
}

/**
 * Refresca la sesión de Supabase en cada petición y, sin usuario válido en
 * una ruta no pública, redirige al login (por defecto
 * `${NEXO_PANEL_URL || origin}/login?next=<basePath><ruta>`).
 *
 * La redirección SIEMPRE lleva las cookies que Supabase haya escrito y sus
 * cabeceras Cache-Control/Expires/Pragma (antes Nexo, RRHH y Presupuesto las
 * perdían). Uso en `src/proxy.ts`:
 *
 *   const { response } = await updateSession(request, { basePath: "/productos" });
 *   return response;
 */
export async function updateSession(request: NextRequest, opciones: OpcionesSesion = {}): Promise<ResultadoSesion> {
  const { url, clave } = urlYClavePublica();
  let respuesta = NextResponse.next({ request });

  const supabase = crearClienteSsr(url, clave, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        respuesta = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => respuesta.cookies.set(name, value, options));
        Object.entries(headers).forEach(([nombre, valor]) => respuesta.headers.set(nombre, valor));
      },
    },
  });

  // IMPORTANTE: no eliminar. getUser() revalida el token contra Supabase Auth
  // (una sesión revocada se detecta al instante). No cambiar a getClaims():
  // es una decisión de seguridad pendiente del usuario.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && !esRutaPublica(request.nextUrl.pathname, opciones.rutasPublicas)) {
    const destino = opciones.loginUrl ? opciones.loginUrl(request) : urlDeLoginPorDefecto(request, opciones.basePath);
    return { response: redirigirConSesion(respuesta, destino), user: null };
  }

  return { response: respuesta, user };
}
