import Link from "next/link";

export default function ClienteNotFound() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 py-16 text-center">
      <h1 className="font-display text-xl text-acero">Cliente no encontrado</h1>
      <p className="font-mono text-sm text-acero-medio">
        Puede que ya haya sido eliminado.
      </p>
      <Link
        href="/clientes"
        className="mt-2 rounded-sm bg-naranja px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-naranja/90"
      >
        Volver al listado
      </Link>
    </div>
  );
}
