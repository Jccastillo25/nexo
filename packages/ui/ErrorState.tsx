"use client";

// Pantalla de error para los error.tsx de cada app (Nexo Enterprise UI v2,
// 2026-10-20). Nunca muestra error.message: en produccion Next ya lo oculta
// para errores de servidor, pero un error de cliente o de desarrollo puede
// traer texto de Postgres/PostgREST o codigos internos. Solo muestra el
// `digest` como referencia para buscar en el log del servidor.
//
//   // app/(app)/error.tsx
//   "use client";
//   import { ErrorState } from "@nexo/ui";
//   export default function Error(props: { error: Error & { digest?: string }; retry?: () => void; reset?: () => void }) {
//     return <ErrorState {...props} />;
//   }
//
// "Intentar de nuevo" usa retry() (Next 16: vuelve a pedir y renderizar el
// segmento); si solo llega reset() (API anterior), refresca la ruta y
// reinicia el boundary dentro de una transicion. Tambien sirve fuera de un
// error.tsx (p. ej. una RPC que fallo): sin retry ni reset, refresca la ruta.
import { useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, ButtonLink } from "./Button";
import { EmptyState } from "./EmptyState";
import { NexoIcon } from "./nexo-icons";

export interface ErrorStateProps {
  error?: Error & { digest?: string };
  /** Next 16: reintenta pidiendo de nuevo el segmento. Preferido. */
  retry?: () => void;
  /** API anterior de error.tsx: reinicia el boundary. */
  reset?: () => void;
  title?: string;
  description?: string;
  /** Enlace secundario (p. ej. el dashboard del modulo). */
  homeHref?: string;
  homeLabel?: string;
  /** Sin tarjeta propia (dentro de otra seccion). */
  bare?: boolean;
}

export function ErrorState({
  error,
  retry,
  reset,
  title = "No se pudo cargar esta pantalla",
  description = "Ocurrió un error inesperado. Intenta de nuevo; si el problema sigue, avisa a soporte.",
  homeHref,
  homeLabel = "Ir al inicio",
  bare = false,
}: ErrorStateProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    // El detalle va a la consola (y al log del servidor via digest), nunca a la pantalla.
    if (error) console.error(error);
  }, [error]);

  function intentar() {
    if (retry) {
      retry();
      return;
    }
    startTransition(() => {
      router.refresh();
      reset?.();
    });
  }

  return (
    <EmptyState
      variant="error"
      bare={bare}
      title={title}
      description={
        <>
          <p>{description}</p>
          {error?.digest ? (
            <p className="mt-2 font-mono text-xs text-neutral-500">Referencia: {error.digest}</p>
          ) : null}
        </>
      }
      action={
        <Button onClick={intentar} loading={pending} icon={<NexoIcon name="refresh" />}>
          Intentar de nuevo
        </Button>
      }
      secondaryAction={
        homeHref ? (
          <ButtonLink href={homeHref} variant="secondary">
            {homeLabel}
          </ButtonLink>
        ) : null
      }
    />
  );
}
