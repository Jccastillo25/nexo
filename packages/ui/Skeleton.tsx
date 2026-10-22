// Esqueletos de carga (Nexo Enterprise UI v2, 2026-10-20) para los
// loading.tsx de cada app — reemplaza los bloques animate-pulse armados a
// mano en cada ruta. Respetan prefers-reduced-motion (sin pulso).
//
//   // app/(app)/expedientes/loading.tsx
//   import { PageSkeleton } from "@nexo/ui";
//   export default function Cargando() { return <PageSkeleton variant="table" />; }
//
// Sin "use client": usable desde Server Components.

/** Bloque gris decorativo; el tamano va en `className` (p. ej. "h-4 w-40"). */
export function Skeleton({ className = "h-4 w-full" }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse rounded-md bg-neutral-200/80 motion-reduce:animate-none ${className}`}
    />
  );
}

export interface PageSkeletonProps {
  /** dashboard: KPIs + panel · table: barra + filas · form: secciones con campos. */
  variant?: "dashboard" | "table" | "form";
  /** Texto para lectores de pantalla. */
  label?: string;
}

const CARD = "rounded-xl border border-neutral-200 bg-white shadow-xs";

export function PageSkeleton({ variant = "dashboard", label = "Cargando…" }: PageSkeletonProps) {
  return (
    <div role="status" aria-live="polite" className="flex w-full flex-col gap-6">
      <span className="sr-only">{label}</span>
      <div className="flex flex-col gap-2" aria-hidden="true">
        <Skeleton className="h-7 w-56 max-w-full" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>

      {variant === "dashboard" ? (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-hidden="true">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className={`${CARD} flex flex-col gap-3 px-5 py-4`}>
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-8 w-32" />
                <Skeleton className="h-3 w-40 max-w-full" />
              </div>
            ))}
          </div>
          <div className={`${CARD} flex flex-col gap-4 p-5`} aria-hidden="true">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-56 w-full" />
          </div>
        </>
      ) : null}

      {variant === "table" ? (
        <div className={`${CARD} overflow-hidden`} aria-hidden="true">
          <div className="flex flex-wrap items-center gap-3 border-b border-neutral-200 px-4 py-3">
            <Skeleton className="h-9 w-64 max-w-full" />
            <Skeleton className="h-9 w-32" />
          </div>
          <div className="border-b border-neutral-200 bg-neutral-50 px-4 py-2.5">
            <Skeleton className="h-3 w-1/2" />
          </div>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center gap-4 border-b border-neutral-100 px-4 py-3 last:border-0">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-4 w-1/4" />
              <Skeleton className="ml-auto h-4 w-16" />
            </div>
          ))}
        </div>
      ) : null}

      {variant === "form" ? (
        <div className="flex flex-col gap-6" aria-hidden="true">
          {[0, 1].map((s) => (
            <div key={s} className={`${CARD} flex flex-col gap-5 p-5`}>
              <Skeleton className="h-4 w-40" />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="flex flex-col gap-1.5">
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-9 w-full" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
