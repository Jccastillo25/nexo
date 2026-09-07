import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/next";
import { createClient } from "@/lib/supabase/server";
import { getPlatformSettings } from "@/lib/platform-settings";
import "./globals.css";

// Tipografia del chrome de Nexo (shell bar + panel) — ver
// docs/planning/DISENO_UX_UI.md seccion 2. Neutral a proposito: cada
// modulo (ej. el CRM) mantiene su propia identidad tipografica puertas
// adentro, sin heredar esta.
const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

/**
 * Favicon dinamico (Configuración > Marca, Nexo Enterprise UI 2026-09-07):
 * `generateMetadata` en vez de un `export const metadata` estatico porque
 * el favicon viene de core.platform_settings, no de un archivo fijo en
 * /public. Sin favicon configurado, cae al favicon.ico por defecto de
 * Next (no se rompe nada si nadie lo subio todavia). Fuente recomendada
 * 512x512 — se sirve el mismo archivo para todos los tamaños, sin generar
 * variantes 16/32/48/180/192 por separado (ver migración
 * 20260907223910_nexo_enterprise_ui_favicon.sql).
 */
export async function generateMetadata(): Promise<Metadata> {
  const supabase = await createClient();
  const settings = await getPlatformSettings(supabase);

  return {
    title: "Nexo",
    description: "Panel central de Nexo — Materiales J Castillo / Grupo CT.",
    robots: { index: false, follow: false },
    icons: settings.faviconUrl ? { icon: settings.faviconUrl } : undefined,
  };
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full bg-neutral-100 font-sans text-neutral-900">
        {children}
        <SpeedInsights />
        <Analytics />
      </body>
    </html>
  );
}
