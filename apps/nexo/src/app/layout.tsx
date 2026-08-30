import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

// Tipografia del chrome de Nexo (shell bar + panel) — ver
// docs/planning/DISENO_UX_UI.md seccion 2. Neutral a proposito: cada
// modulo (ej. el CRM) mantiene su propia identidad tipografica puertas
// adentro, sin heredar esta.
const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "Nexo",
  description: "Panel central de Nexo — Materiales J Castillo / Grupo CT.",
  robots: { index: false, follow: false },
};

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
