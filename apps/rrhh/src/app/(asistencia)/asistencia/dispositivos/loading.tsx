export default function DispositivosLoading() {
  return (
    <div className="flex flex-col gap-6" role="status" aria-label="Cargando los dispositivos">
      <div className="flex flex-col gap-2">
        <div className="h-7 w-64 animate-pulse rounded bg-neutral-200 motion-reduce:animate-none" />
        <div className="h-4 w-80 max-w-full animate-pulse rounded bg-neutral-100 motion-reduce:animate-none" />
      </div>
      <div className="flex flex-col gap-2 rounded-xl border border-neutral-200 bg-white p-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-8 animate-pulse rounded bg-neutral-100 motion-reduce:animate-none" />
        ))}
      </div>
    </div>
  );
}
