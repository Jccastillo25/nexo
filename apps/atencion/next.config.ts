import type { NextConfig } from "next";

// Zona /atencion de Multi-Zones (ver docs/ARCHITECTURE.md): apps/nexo
// reescribe /atencion/* hacia este deploy (ATENCION_APP_URL) y este basePath
// tiene que coincidir con ese prefijo.
const panelHost = process.env.NEXO_PANEL_URL
  ? new URL(process.env.NEXO_PANEL_URL).host
  : undefined;

const nextConfig: NextConfig = {
  basePath: "/atencion",
  transpilePackages: ["@nexo/permissions", "@nexo/ui"],
  experimental: {
    serverActions: {
      // Las Server Actions cruzan el rewrite del dominio público.
      allowedOrigins: [
        "nexo.materialesjcastillo.com",
        ...(panelHost ? [panelHost] : []),
      ],
    },
  },
};

export default nextConfig;
