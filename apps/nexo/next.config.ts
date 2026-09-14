import type { NextConfig } from "next";

// Zona raiz de Multi-Zones (ver docs/ARCHITECTURE.md). Esta app posee el
// dominio nexo.materialesjcastillo.com y "cose" cada modulo bajo su ruta
// mediante rewrites hacia el deploy real de ese modulo. Cada modulo fija su
// propio basePath (ver apps/crm/next.config.ts) — por eso el rewrite de
// aqui y el basePath de alla tienen que coincidir en el prefijo.
//
// `/crm` y `/rrhh` ya estan conectados (Fase 3 y estructura nativa de RRHH
// respectivamente). flotilla se agrega aqui cuando le toque su fase — ver
// docs/ROADMAP.md. Agregar un rewrite para un modulo que todavia no tiene
// basePath configurado rompe ese modulo, no lo actives antes de tiempo.
const CRM_APP_URL = process.env.CRM_APP_URL ?? "http://localhost:3001";
const RRHH_APP_URL = process.env.RRHH_APP_URL ?? "http://localhost:3002";

const nextConfig: NextConfig = {
  transpilePackages: ["@nexo/permissions", "@nexo/ui"],
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
  async rewrites() {
    return [
      {
        source: "/crm",
        destination: `${CRM_APP_URL}/crm`,
      },
      {
        source: "/crm/:path*",
        destination: `${CRM_APP_URL}/crm/:path*`,
      },
      {
        source: "/rrhh",
        destination: `${RRHH_APP_URL}/rrhh`,
      },
      {
        source: "/rrhh/:path*",
        destination: `${RRHH_APP_URL}/rrhh/:path*`,
      },
    ];
  },
};

export default nextConfig;
