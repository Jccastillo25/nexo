"use client";

import { ErrorState } from "@nexo/ui";

// Error inesperado en una página del módulo. ErrorState nunca muestra
// error.message: solo la referencia (digest) para buscar en el log.
export default function AppError(props: {
  error: Error & { digest?: string };
  retry?: () => void;
  reset?: () => void;
}) {
  return <ErrorState {...props} homeHref="/dashboard" />;
}
