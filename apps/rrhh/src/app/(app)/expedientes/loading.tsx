// Skeleton de la ruta /expedientes — Next.js lo muestra automaticamente
// (Suspense boundary del segmento) mientras el Server Component de
// page.tsx resuelve sus queries, para que la navegacion de un click del
// sidebar de feedback inmediato en vez de una pantalla en blanco. No
// reemplaza la optimizacion real de queries (ver page.tsx) — es feedback
// visual, no una forma de esconder latencia real.
export default function ExpedientesLoading() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="h-7 w-40 animate-pulse rounded bg-neutral-200" />
        <div className="h-9 w-36 animate-pulse rounded-lg bg-neutral-200" />
      </div>
      <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
        <div className="border-b border-neutral-200 px-4 py-3">
          <div className="h-3 w-full max-w-md animate-pulse rounded bg-neutral-100" />
        </div>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 border-b border-neutral-100 px-4 py-3 last:border-0">
            <div className="h-4 w-40 animate-pulse rounded bg-neutral-100" />
            <div className="h-4 w-28 animate-pulse rounded bg-neutral-100" />
            <div className="h-4 w-32 animate-pulse rounded bg-neutral-100" />
            <div className="ml-auto h-4 w-20 animate-pulse rounded bg-neutral-100" />
          </div>
        ))}
      </div>
    </div>
  );
}
