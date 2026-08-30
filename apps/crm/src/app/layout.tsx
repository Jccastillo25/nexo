import type { Metadata } from "next";
import { Archivo_Black, Work_Sans, IBM_Plex_Mono } from "next/font/google";
import { Toaster } from "sonner";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const archivoBlack = Archivo_Black({
  variable: "--font-display",
  subsets: ["latin"],
  weight: "400",
});

const workSans = Work_Sans({
  variable: "--font-body",
  subsets: ["latin"],
});

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Panel de clientes · Materiales J Castillo",
  description: "CRM interno de Materiales J Castillo — acceso restringido.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      className={`${archivoBlack.variable} ${workSans.variable} ${ibmPlexMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <SpeedInsights />
        <Analytics />
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: "#22262B",
              color: "#E9E6DE",
              border: "1px solid #545C66",
              fontFamily: "var(--font-body)",
            },
          }}
        />
      </body>
    </html>
  );
}
