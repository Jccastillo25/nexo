export default function ContratoFichaLoading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <div className="h-7 w-48 animate-pulse rounded bg-neutral-200" />
        <div className="h-4 w-56 animate-pulse rounded bg-neutral-100" />
      </div>
      <div className="h-40 animate-pulse rounded-xl border border-neutral-200 bg-white" />
    </div>
  );
}
