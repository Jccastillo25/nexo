// Skeleton de /expedientes/[id] — ficha del Expediente General (solo
// persona, P2 2026-09-14: ya no incluye contratos/compensacion/jornada,
// ver page.tsx y contratacion/contratos/[id] para el ciclo contractual).
export default function ExpedienteDetalleLoading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <div className="h-7 w-64 animate-pulse rounded bg-neutral-200" />
        <div className="h-4 w-40 animate-pulse rounded bg-neutral-100" />
      </div>
      <div className="flex gap-1 border-b border-neutral-200 pb-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-6 w-28 animate-pulse rounded bg-neutral-100" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 rounded-xl border border-neutral-200 bg-white p-5 sm:grid-cols-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-1.5">
            <div className="h-3 w-24 animate-pulse rounded bg-neutral-100" />
            <div className="h-4 w-40 animate-pulse rounded bg-neutral-100" />
          </div>
        ))}
      </div>
      <div className="h-32 animate-pulse rounded-xl border border-neutral-200 bg-white" />
    </div>
  );
}
