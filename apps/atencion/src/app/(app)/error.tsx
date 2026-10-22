"use client";

import { ErrorState } from "@nexo/ui";

// Nunca muestra error.message: ErrorState solo enseña la referencia (digest)
// y deja el detalle en la consola y en el log del servidor.
export default function ErrorAtencion(props: {
  error: Error & { digest?: string };
  retry?: () => void;
  reset?: () => void;
}) {
  return <ErrorState {...props} homeHref="/dashboard" />;
}
