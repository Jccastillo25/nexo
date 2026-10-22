"use client";

import { ErrorState } from "@nexo/ui";

// Error inesperado en una página del módulo. ErrorState nunca muestra
// error.message (puede traer texto de Postgres/PostgREST): solo la referencia
// (digest), que sirve para buscar el detalle en el log del servidor.
export default function AppError(props: {
  error: Error & { digest?: string };
  retry?: () => void;
  reset?: () => void;
}) {
  return <ErrorState {...props} homeHref="/dashboard" homeLabel="Ir al Dashboard" />;
}
