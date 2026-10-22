/**
 * Cabeceras de seguridad HTTP compartidas por todas las zonas de Nexo
 * (hallazgo N4 de la revisión integral del 2026-10-20, ver
 * docs/status-log/2026-10-20-revision-integral.md).
 *
 * Es JS ESM plano a propósito: lo importa el `next.config.ts` de cada app, y
 * Next carga ese archivo en Node antes de compilar la app. Por eso no pasa por
 * `transpilePackages` y no puede ser TypeScript. Los tipos salen del JSDoc.
 *
 * Uso en `next.config.ts`:
 *
 *   import { securityHeaders } from "@nexo/config/next-security";
 *   const nextConfig: NextConfig = {
 *     async headers() {
 *       return securityHeaders();
 *     },
 *   };
 *
 * Con `basePath` (los módulos), Next antepone el prefijo a `source` solo.
 *
 * Qué cubre cada cabecera:
 * - Strict-Transport-Security: el navegador recuerda por 2 años que el dominio
 *   va solo por HTTPS. Sin `preload` a propósito: entrar a la lista de
 *   precarga es difícil de revertir y es una decisión aparte.
 * - X-Frame-Options + CSP `frame-ancestors 'none'`: ninguna pantalla de la
 *   suite se puede meter en un iframe de otro sitio (clickjacking del login).
 *   X-Frame-Options queda para navegadores viejos que no entienden la CSP.
 * - CSP `base-uri 'self'`, `object-src 'none'` y `form-action 'self'`: un
 *   <base>, un <object>/<embed> o un formulario inyectado no pueden apuntar a
 *   otro origen.
 * - X-Content-Type-Options: sin adivinar el tipo MIME.
 * - Referrer-Policy: a otros sitios solo viaja el origen, nunca la ruta ni la
 *   query (que pueden llevar ids o filtros).
 * - Permissions-Policy: ninguna app de la suite usa cámara, micrófono,
 *   ubicación, pagos ni USB. La síntesis de voz de la pantalla de Atención no
 *   es una función restringible y sigue funcionando. Flotilla, que sí usa la
 *   ubicación, todavía no está adaptada a Nexo ni usa este helper.
 *
 * Pendiente (deuda documentada): una CSP completa con `script-src` basada en
 * nonces. Requiere generar el nonce por solicitud en el `proxy.ts` de cada
 * zona, y antes inventariar lo que cada app carga: el script de Vercel
 * Analytics y Speed Insights, las conexiones a Supabase (REST y el WebSocket
 * de Realtime en `connect-src`), las imágenes de Storage (`img-src`) y el
 * video embebido de la pantalla de Atención (`frame-src`). Hasta entonces la
 * CSP no restringe scripts; solo las directivas de arriba.
 */

/** @typedef {{ key: string, value: string }} CabeceraHttp */
/** @typedef {{ source: string, headers: CabeceraHttp[] }} ReglaDeCabeceras */

const CONTENT_SECURITY_POLICY = [
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'",
  "form-action 'self'",
].join("; ");

/** @type {ReadonlyArray<Readonly<CabeceraHttp>>} */
const CABECERAS = Object.freeze([
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: CONTENT_SECURITY_POLICY },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  },
]);

/**
 * Reglas para `headers()` de `next.config.ts`: todas las rutas de la zona
 * reciben las mismas cabeceras. Devuelve copias nuevas en cada llamada.
 *
 * @returns {ReglaDeCabeceras[]}
 */
export function securityHeaders() {
  return [
    {
      source: "/(.*)",
      headers: CABECERAS.map((cabecera) => ({ key: cabecera.key, value: cabecera.value })),
    },
  ];
}
