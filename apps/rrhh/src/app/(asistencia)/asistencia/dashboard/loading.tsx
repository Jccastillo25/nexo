export default function AsistenciaDashboardLoading() {
  return (
    <div className="flex flex-col gap-6" role="status" aria-label="Cargando el dashboard de Asistencia">
      <div className="h-7 w-48 animate-pulse rounded bg-neutral-200 motion-reduce:animate-none" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="h-24 animate-pulse rounded-xl border border-neutral-200 bg-white motion-reduce:animate-none"
          />
        ))}
      </div>
    </div>
  );
}
