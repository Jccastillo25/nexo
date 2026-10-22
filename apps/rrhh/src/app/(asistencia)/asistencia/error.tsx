"use client";

import { ErrorState } from "@nexo/ui";

/**
 * Error inesperado en cualquier pantalla de Asistencia. Queda dentro del
 * shell (el layout de este segmento no lo envuelve). ErrorState nunca muestra
 * error.message, solo la referencia (digest) para buscar en el log.
 */
export default function AsistenciaError(props: {
  error: Error & { digest?: string };
  retry?: () => void;
  reset?: () => void;
}) {
  return <ErrorState {...props} homeHref="/asistencia/dashboard" homeLabel="Ir al Dashboard" />;
}
