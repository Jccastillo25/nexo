import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "sonner";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

// Tipografia unica de toda la suite (ver docs/planning/NORMA_DISENO_UNIVERSAL.md
// §1.3) — el CRM ya no tiene tipografia de marca propia (Archivo Black/Work
// Sans/IBM Plex Mono): decisión explícita del usuario de unificar tambien el
// CONTENIDO de los modulos, no solo la barra superior.
const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "Panel de clientes · Materiales J Castillo",
  description: "CRM interno de Materiales J Castillo — acceso restringido.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${inter.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-neutral-100 font-sans text-neutral-900">
        {children}
        <SpeedInsights />
        <Analytics />
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: "#171717",
              color: "#FAFAFA",
              border: "1px solid #404040",
            },
          }}
        />
      </body>
    </html>
  );
}
