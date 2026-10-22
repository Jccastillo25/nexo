"use client";

import { ErrorState } from "@nexo/ui";

/**
 * Error de cualquier pantalla de RRHH (Nexo Enterprise UI v2). ErrorState
 * nunca muestra el mensaje técnico: solo la referencia (digest) para buscar
 * en el log del servidor, "Intentar de nuevo" y el enlace al Dashboard.
 */
export default function RrhhError(props: {
  error: Error & { digest?: string };
  retry?: () => void;
  reset?: () => void;
}) {
  return <ErrorState {...props} homeHref="/dashboard" homeLabel="Ir al Dashboard" />;
}
