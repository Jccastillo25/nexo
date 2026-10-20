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

  // 2026-10-17: Marcas se movió a la app Asistencia (mismo deploy). El
  // basePath /rrhh se aplica solo: /rrhh/marcas → /rrhh/asistencia/marcas.
  // Temporal (no permanente) para no fijar la ruta en cachés del navegador.
  // 2026-10-20: el kiosco pertenece a Asistencia, así que quien escriba
  // /rrhh/asistencia/kiosco en el equipo llega a la terminal. Las redirecciones
  // de next.config corren antes del proxy: no pide sesión.
  async redirects() {
    return [
      { source: "/marcas", destination: "/asistencia/marcas", permanent: false },
      { source: "/asistencia/kiosco", destination: "/kiosco", permanent: false },
    ];
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
