import type { NextConfig } from "next";
import { securityHeaders } from "@nexo/config/next-security";

// Zona /productos de Multi-Zones (ver docs/ARCHITECTURE.md): apps/nexo
// reescribe /productos/* hacia este deploy (PRODUCTOS_APP_URL) y este
// basePath tiene que coincidir con ese prefijo.
const panelHost = process.env.NEXO_PANEL_URL
  ? new URL(process.env.NEXO_PANEL_URL).host
  : undefined;

const nextConfig: NextConfig = {
  basePath: "/productos",
  transpilePackages: ["@nexo/auth", "@nexo/permissions", "@nexo/supabase", "@nexo/ui"],
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
  // Rendimiento #1 (2026-10-20): la raíz /productos va a /productos/dashboard
  // aquí, en el borde, sin pasar por el proxy ni por una función. `source: "/"`
  // con basePath equivale a /productos.
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
