import type { NextConfig } from "next";
import { securityHeaders } from "@nexo/config/next-security";

const panelHost = process.env.NEXO_PANEL_URL
  ? new URL(process.env.NEXO_PANEL_URL).host
  : undefined;

const nextConfig: NextConfig = {
  basePath: "/agencia",
  transpilePackages: ["@nexo/auth", "@nexo/permissions", "@nexo/supabase", "@nexo/ui"],
  experimental: {
    serverActions: {
      // El cierre de sesión cruza el rewrite. Incluir también el Preview
      // concreto del panel configurado para esa rama, sin comodines.
      allowedOrigins: [
        "nexo.materialesjcastillo.com",
        ...(panelHost ? [panelHost] : []),
      ],
    },
  },
  // Rendimiento #1 (2026-10-20): la raíz /agencia va a /agencia/dashboard
  // aquí, en el borde, sin pasar por el proxy ni por una función. `source: "/"`
  // con basePath equivale a /agencia.
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
