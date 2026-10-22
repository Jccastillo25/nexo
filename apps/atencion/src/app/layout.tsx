import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/next";
import { getPlatformSettings } from "@nexo/auth";
import "./globals.css";

// Misma tipografía, marca y shell de la suite.
const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export async function generateMetadata(): Promise<Metadata> {
  // Sin cookies y en caché: el favicon ya no vuelve dinámica cada ruta.
  const { faviconUrl } = await getPlatformSettings();
  return {
    title: "Atención · Nexo",
    description: "Turnos de sala de espera por sucursal.",
    robots: { index: false, follow: false },
    icons: faviconUrl ? { icon: faviconUrl } : undefined,
  };
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${inter.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-neutral-100 font-sans text-neutral-900">
        {children}
        <SpeedInsights />
        <Analytics />
      </body>
    </html>
  );
}
