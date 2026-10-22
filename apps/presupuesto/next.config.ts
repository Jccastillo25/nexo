import type { NextConfig } from "next";
import { securityHeaders } from "@nexo/config/next-security";

// Zona de Multi-Zones (ver docs/ARCHITECTURE.md): esta app se sirve bajo
// nexo.materialesjcastillo.com/presupuesto, cosida ahí por los rewrites de la
// zona raíz (apps/nexo, PRESUPUESTO_APP_URL). basePath hace que todas las
// rutas y assets de esta app vivan bajo ese prefijo. Se despliega en el
// proyecto de Vercel que era del CRM (docs/plan/19-presupuesto.md §2).
const panelHost = process.env.NEXO_PANEL_URL
  ? new URL(process.env.NEXO_PANEL_URL).host
  : undefined;

const nextConfig: NextConfig = {
  basePath: "/presupuesto",
  // Los paquetes del workspace (kernel y kit) viven como fuente TS sin compilar.
  transpilePackages: ["@nexo/auth", "@nexo/permissions", "@nexo/supabase", "@nexo/ui"],
  experimental: {
    serverActions: {
      // Las Server Actions cruzan el rewrite del dominio público.
      allowedOrigins: [
        "nexo.materialesjcastillo.com",
        ...(panelHost ? [panelHost] : []),
      ],
      // Importar de AG Negocio manda lotes de 1000 facturas (~250 KB); 4mb
      // queda bajo el techo de 4.5 MB de Vercel Functions.
      bodySizeLimit: "4mb",
    },
  },

  // Rendimiento #1 (2026-10-20): la raíz /presupuesto va a
  // /presupuesto/dashboard aquí, en el borde, sin pasar por el proxy ni por
  // una función. `source: "/"` con basePath equivale a /presupuesto.
  async redirects() {
    return [{ source: "/", destination: "/dashboard", permanent: false }];
  },

  // Cabeceras de seguridad compartidas (N4, 2026-10-20), ver
  // packages/config/next-security.mjs.
  async headers() {
    return securityHeaders();
  },

  productionBrowserSourceMaps: false,
};

export default nextConfig;
