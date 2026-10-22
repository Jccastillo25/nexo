"use client";

import { Inter } from "next/font/google";
import { ErrorState } from "@nexo/ui";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

/**
 * Error en el layout raíz o en un layout de grupo (p. ej. `(app)/layout.tsx`),
 * que los `error.tsx` de su mismo nivel no capturan. Reemplaza al layout raíz
 * mientras está activo, por eso lleva su propio <html> y <body> (Next 16).
 * ErrorState nunca muestra error.message: solo la referencia (digest).
 */
export default function GlobalError(props: {
  error: Error & { digest?: string };
  retry?: () => void;
  reset?: () => void;
}) {
  return (
    <html lang="es" className={`${inter.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col items-center justify-center bg-[var(--nexo-enterprise-bg)] p-6 font-sans text-neutral-900">
        <title>Error · RRHH</title>
        <main className="w-full max-w-xl">
          <ErrorState {...props} homeHref="/" />
        </main>
      </body>
    </html>
  );
}
