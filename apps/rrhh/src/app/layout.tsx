import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

// Tipografia unica de toda la suite (ver docs/planning/NORMA_DISENO_UNIVERSAL.md
// §1.3) — mismo criterio que apps/crm.
const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "RRHH · Materiales J Castillo",
  description: "Recursos Humanos de Materiales J Castillo — acceso restringido.",
  robots: { index: false, follow: false },
};

/**
 * Nexo Enterprise UI (2026-09-07): reversion del `dark` forzado en <html>
 * y el fondo/texto oscuro del <body> (regla anterior de 2026-09-02, ver
 * docs/DESIGN_SYSTEM.md actualizado) — Light es ahora el tema empresarial
 * por defecto. El kiosko (pantalla inmersiva) sigue oscuro porque
 * kiosk-client.tsx pinta su propio fondo `bg-[var(--nexo-bg)]` a pantalla
 * completa, independiente de este layout.
 *
 * El `<Toaster>` de sonner que vivía acá se retiró: ahora lo monta
 * `NexoShell` (ver packages/ui/Toast.tsx) una sola vez, para toda la
 * suite — evita dos sistemas de toast compitiendo dentro de (app).
 */
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${inter.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-[var(--nexo-enterprise-bg)] font-sans text-neutral-900">
        {children}
        {/* Regla obligatoria (CLAUDE.md): Speed Insights + Analytics en
            toda app desplegada en Vercel. */}
        <SpeedInsights />
        <Analytics />
      </body>
    </html>
  );
}
