import type { NextConfig } from "next";

// Zona de Multi-Zones (ver docs/ARCHITECTURE.md): esta app se sirve bajo
// nexo.materialesjcastillo.com/rrhh, cosida ahi por los rewrites de la
// zona raiz (apps/nexo). basePath hace que todas las rutas y assets de
// esta app vivan bajo ese prefijo — mismo patron que apps/crm/next.config.ts.
const nextConfig: NextConfig = {
  basePath: "/rrhh",
  // @nexo/permissions y @nexo/ui viven como fuente TS sin compilar en el workspace.
  transpilePackages: ["@nexo/permissions", "@nexo/ui"],

  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },

  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },

  productionBrowserSourceMaps: false,
};

export default nextConfig;
