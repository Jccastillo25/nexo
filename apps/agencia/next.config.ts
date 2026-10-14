import type { NextConfig } from "next";

const panelHost = process.env.NEXO_PANEL_URL
  ? new URL(process.env.NEXO_PANEL_URL).host
  : undefined;

const nextConfig: NextConfig = {
  basePath: "/agencia",
  transpilePackages: ["@nexo/permissions", "@nexo/ui"],
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
};

export default nextConfig;
