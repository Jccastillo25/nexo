import Link from "next/link";

export default function ClienteNotFound() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 py-16 text-center">
      <h1 className="text-xl font-semibold text-neutral-900">Cliente no encontrado</h1>
      <p className="text-sm text-neutral-500">
        Puede que ya haya sido eliminado.
      </p>
      <Link
        href="/clientes"
        className="mt-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
      >
        Volver al listado
      </Link>
    </div>
  );
}
