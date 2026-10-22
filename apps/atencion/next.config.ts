import type { NextConfig } from "next";
import { securityHeaders } from "@nexo/config/next-security";

// Zona /atencion de Multi-Zones (ver docs/ARCHITECTURE.md): apps/nexo
// reescribe /atencion/* hacia este deploy (ATENCION_APP_URL) y este basePath
// tiene que coincidir con ese prefijo.
const panelHost = process.env.NEXO_PANEL_URL
  ? new URL(process.env.NEXO_PANEL_URL).host
  : undefined;

const nextConfig: NextConfig = {
  basePath: "/atencion",
  transpilePackages: ["@nexo/auth", "@nexo/permissions", "@nexo/supabase", "@nexo/ui"],
  experimental: {
    serverActions: {
      // Las Server Actions cruzan el rewrite del dominio público.
      allowedOrigins: [
        "nexo.materialesjcastillo.com",
        ...(panelHost ? [panelHost] : []),
      ],
    },
  },
  // Rendimiento #1 (2026-10-20): la raíz /atencion va a /atencion/dashboard
  // aquí, en el borde, sin pasar por el proxy ni por una función. `source: "/"`
  // con basePath equivale a /atencion.
  async redirects() {
    return [{ source: "/", destination: "/dashboard", permanent: false }];
  },
  // Cabeceras de seguridad compartidas (N4, 2026-10-20), ver
  // packages/config/next-security.mjs.
  async headers() {
    return securityHeaders();
  },
};

export default nextConfig;
