import type { NextConfig } from "next";

// Zona raiz de Multi-Zones (ver docs/ARCHITECTURE.md). Esta app posee el
// dominio nexo.materialesjcastillo.com y "cose" cada modulo bajo su ruta
// mediante rewrites hacia el deploy real de ese modulo. Cada modulo fija su
// propio basePath (ver apps/crm/next.config.ts) — por eso el rewrite de
// aqui y el basePath de alla tienen que coincidir en el prefijo.
//
// Solo `/crm` esta conectado por ahora: es el unico modulo ya adaptado
// (Fase 3). rrhh y flotilla se agregan aqui cuando les toque su fase — ver
// docs/ROADMAP.md. Agregar un rewrite para un modulo que todavia no tiene
// basePath configurado rompe ese modulo, no lo actives antes de tiempo.
const CRM_APP_URL = process.env.CRM_APP_URL ?? "http://localhost:3001";

const nextConfig: NextConfig = {
  transpilePackages: ["@nexo/permissions"],
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
    ];
  },
};

export default nextConfig;
