"use client";

import { ErrorState } from "@nexo/ui";

// Error inesperado en una pantalla del panel. ErrorState nunca muestra
// error.message (puede traer texto de Postgres/PostgREST): solo la
// referencia (digest) para buscar en el log del servidor.
export default function ErrorDelPanel(props: {
  error: Error & { digest?: string };
  retry?: () => void;
  reset?: () => void;
}) {
  return <ErrorState {...props} homeHref="/" />;
}
