export default function ContenidoPendiente({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-md border border-dashed border-naranja/50 bg-naranja/5 px-5 py-6 font-mono text-sm text-acero-medio">
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-naranja">
        Contenido pendiente
      </p>
      {children}
    </div>
  );
}
