import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "sonner";
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

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${inter.variable} dark h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-[var(--nexo-bg)] font-sans text-[var(--nexo-shell-fg)]">
        {children}
        {/* Regla obligatoria (CLAUDE.md): Speed Insights + Analytics en
            toda app desplegada en Vercel. */}
        <SpeedInsights />
        <Analytics />
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: "var(--nexo-bg-elevated)",
              color: "var(--nexo-shell-fg)",
              border: "1px solid var(--nexo-border)",
            },
          }}
        />
      </body>
    </html>
  );
}
