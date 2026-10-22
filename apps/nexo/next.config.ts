import type { NextConfig } from "next";
import { securityHeaders } from "@nexo/config/next-security";

// Zona raiz de Multi-Zones (ver docs/ARCHITECTURE.md). Esta app posee el
// dominio nexo.materialesjcastillo.com y "cose" cada modulo bajo su ruta
// mediante rewrites hacia el deploy real de ese modulo. Cada modulo fija su
// propio basePath (ver apps/rrhh/next.config.ts) — por eso el rewrite de
// aqui y el basePath de alla tienen que coincidir en el prefijo.
//
// `/rrhh` ya esta conectado; `/agencia` se configura por AGENCIA_APP_URL en
// el ticket #18. flotilla se agrega al llegar su fase — ver docs/ROADMAP.md.
// Agregar un rewrite para un modulo que todavia no tiene basePath
// configurado rompe ese modulo, no lo actives antes de tiempo.
// `/crm` se retiro el 2026-10-20: el CRM se borro para replicar AG Negocio
// en la app ERP (docs/plan/18-replica-ag-negocio.md).
const RRHH_APP_URL = process.env.RRHH_APP_URL ?? "http://localhost:3002";
// Se configura por entorno antes de activar el módulo. Sin destino no se
// publica un rewrite hacia una app inexistente.
const AGENCIA_APP_URL = process.env.AGENCIA_APP_URL;
// Atención (plan 13): mismo criterio, sin destino no hay rewrite.
const ATENCION_APP_URL = process.env.ATENCION_APP_URL;
// Productos (plan 14): mismo criterio, sin destino no hay rewrite.
const PRODUCTOS_APP_URL = process.env.PRODUCTOS_APP_URL;
// Presupuesto (plan 19): mismo criterio. En producción apunta al proyecto de
// Vercel que era del CRM.
const PRESUPUESTO_APP_URL = process.env.PRESUPUESTO_APP_URL;

const nextConfig: NextConfig = {
  // Kernel compartido (2026-10-20): sesión, empresa, marca y permisos viven en
  // @nexo/auth, @nexo/supabase y @nexo/permissions (TypeScript sin compilar).
  transpilePackages: ["@nexo/auth", "@nexo/supabase", "@nexo/permissions", "@nexo/ui"],
  // P0 (2026-09-14): el limite por defecto de Next.js para el body de un
  // Server Action es 1 MB — el formulario de /configuracion/marca sube
  // hasta 3 imagenes (logo/fondo/favicon) en el mismo Server Action y
  // superaba ese limite con cualquier imagen de fondo real, tumbando la
  // pantalla completa (confirmado con get_runtime_errors de Vercel:
  // "Body exceeded 1 MB limit.", statusCode 413, antes de tocar codigo).
  //
  // El techo real no es este numero: Vercel Functions tiene un limite de
  // payload de 4.5 MB a nivel de infraestructura, fijo, que NO se puede
  // levantar desde next.config/vercel.json (ver
  // https://vercel.com/docs/functions/limitations). 4mb queda por debajo
  // de ese techo con margen para el peor caso real (subir logo + fondo +
  // favicon juntos, cada uno hasta 1.25 MB — mismo limite validado en el
  // cliente y en el propio Server Action, ver actions.ts). Si esto se
  // vuelve insuficiente, la solucion correcta no es subir este numero sino
  // subir el archivo directo del navegador a Supabase Storage (signed
  // upload URL) y mandar solo la URL resultante por el Server Action.
  experimental: {
    serverActions: {
      bodySizeLimit: "4mb",
    },
  },
  // 2026-10-20: accesos cortos al kiosco de marcación. Un equipo sin sesión
  // que abre /kiosco caía en el login, porque esa ruta es del panel. Las
  // redirecciones de next.config corren antes del proxy: no piden sesión.
  async redirects() {
    return [
      { source: "/kiosco", destination: "/rrhh/kiosco", permanent: false },
      { source: "/asistencia/kiosco", destination: "/rrhh/kiosco", permanent: false },
    ];
  },
  // Cabeceras de seguridad compartidas (N4, 2026-10-20): un solo helper para
  // las 6 zonas, ver packages/config/next-security.mjs.
  async headers() {
    return securityHeaders();
  },
  async rewrites() {
    return [
      {
        source: "/rrhh",
        destination: `${RRHH_APP_URL}/rrhh`,
      },
      {
        source: "/rrhh/:path*",
        destination: `${RRHH_APP_URL}/rrhh/:path*`,
      },
      ...(AGENCIA_APP_URL
        ? [
            { source: "/agencia", destination: `${AGENCIA_APP_URL}/agencia` },
            { source: "/agencia/:path*", destination: `${AGENCIA_APP_URL}/agencia/:path*` },
          ]
        : []),
      ...(ATENCION_APP_URL
        ? [
            { source: "/atencion", destination: `${ATENCION_APP_URL}/atencion` },
            { source: "/atencion/:path*", destination: `${ATENCION_APP_URL}/atencion/:path*` },
          ]
        : []),
      ...(PRODUCTOS_APP_URL
        ? [
            { source: "/productos", destination: `${PRODUCTOS_APP_URL}/productos` },
            { source: "/productos/:path*", destination: `${PRODUCTOS_APP_URL}/productos/:path*` },
          ]
        : []),
      ...(PRESUPUESTO_APP_URL
        ? [
            { source: "/presupuesto", destination: `${PRESUPUESTO_APP_URL}/presupuesto` },
            { source: "/presupuesto/:path*", destination: `${PRESUPUESTO_APP_URL}/presupuesto/:path*` },
          ]
        : []),
    ];
  },
};

export default nextConfig;
