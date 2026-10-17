import type { NextConfig } from "next";

// Zona /productos de Multi-Zones (ver docs/ARCHITECTURE.md): apps/nexo
// reescribe /productos/* hacia este deploy (PRODUCTOS_APP_URL) y este
// basePath tiene que coincidir con ese prefijo.
const panelHost = process.env.NEXO_PANEL_URL
  ? new URL(process.env.NEXO_PANEL_URL).host
  : undefined;

const nextConfig: NextConfig = {
  basePath: "/productos",
  transpilePackages: ["@nexo/permissions", "@nexo/ui"],
  experimental: {
    serverActions: {
      // Las Server Actions cruzan el rewrite del dominio público.
      allowedOrigins: [
        "nexo.materialesjcastillo.com",
        ...(panelHost ? [panelHost] : []),
      ],
      // La importación manda ~700 filas del Excel del ERP como JSON
      // (~1 MB); 4mb queda bajo el techo de 4.5 MB de Vercel Functions.
      bodySizeLimit: "4mb",
    },
  },
};

export default nextConfig;
