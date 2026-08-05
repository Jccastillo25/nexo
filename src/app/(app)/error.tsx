"use client";

import { useEffect } from "react";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 py-16 text-center">
      <p className="font-mono text-xs uppercase tracking-wide text-red-800">
        Ocurrió un error
      </p>
      <h1 className="font-display text-xl text-acero">
        No se pudo completar la operación
      </h1>
      <p className="max-w-md font-mono text-sm text-acero-medio">
        {error.message || "Ocurrió un error inesperado. Intenta de nuevo."}
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-2 rounded-sm bg-naranja px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-naranja/90"
      >
        Reintentar
      </button>
    </div>
  );
}
