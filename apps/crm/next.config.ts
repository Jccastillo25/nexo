import type { NextConfig } from "next";

// Zona de Multi-Zones (ver docs/ARCHITECTURE.md): esta app se sirve bajo
// nexo.materialesjcastillo.com/crm, cosida ahi por los rewrites de la zona
// raiz (apps/nexo). basePath hace que todas las rutas y assets de esta app
// vivan bajo ese prefijo.
const nextConfig: NextConfig = {
  basePath: "/crm",
  // @nexo/permissions vive como fuente TS sin compilar en el workspace.
  transpilePackages: ["@nexo/permissions"],
};

export default nextConfig;
