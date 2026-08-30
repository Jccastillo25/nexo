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
      <p className="text-xs uppercase tracking-wide text-red-700">
        Ocurrió un error
      </p>
      <h1 className="text-xl font-semibold text-neutral-900">
        No se pudo completar la operación
      </h1>
      <p className="max-w-md text-sm text-neutral-500">
        {error.message || "Ocurrió un error inesperado. Intenta de nuevo."}
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
      >
        Reintentar
      </button>
    </div>
  );
}
