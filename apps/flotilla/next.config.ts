import type { NextConfig } from "next";
import { securityHeaders } from "@nexo/config/next-security";

// Zona /flotilla de Multi-Zones (ver docs/ARCHITECTURE.md): apps/nexo
// reescribe /flotilla/* hacia este deploy (FLOTILLA_APP_URL) y este
// basePath tiene que coincidir con ese prefijo.
const panelHost = process.env.NEXO_PANEL_URL
  ? new URL(process.env.NEXO_PANEL_URL).host
  : undefined;

const nextConfig: NextConfig = {
  basePath: "/flotilla",
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
  // La raíz /flotilla va al dashboard en el borde, sin pasar por el proxy.
  async redirects() {
    return [{ source: "/", destination: "/dashboard", permanent: false }];
  },
  // Cabeceras de seguridad compartidas, ver packages/config/next-security.mjs.
  async headers() {
    return securityHeaders();
  },
};

export default nextConfig;
