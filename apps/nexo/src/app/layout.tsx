import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Nexo",
  description: "Panel central de Nexo — Materiales J Castillo / Grupo CT.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="min-h-full bg-neutral-50 text-neutral-900">
        {children}
      </body>
    </html>
  );
}
