import Link from "next/link";
import type { Cliente } from "@/lib/supabase/database.types";

const TIPO_LABEL: Record<string, string> = {
  mayorista: "Mayorista",
  detal: "Detal",
};

export default function ClientesTable({ clientes }: { clientes: Cliente[] }) {
  if (clientes.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-neutral-300 px-4 py-12 text-center">
        <p className="text-sm text-neutral-500">
          No se encontraron clientes.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-neutral-200">
      <table className="w-full min-w-[640px] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-neutral-200 bg-neutral-50">
            <th className="px-3 py-2.5 text-xs font-medium uppercase tracking-wide text-neutral-500">
              N°
            </th>
            <th className="px-3 py-2.5 text-xs font-medium uppercase tracking-wide text-neutral-500">
              Nombre
            </th>
            <th className="px-3 py-2.5 text-xs font-medium uppercase tracking-wide text-neutral-500">
              Teléfono
            </th>
            <th className="px-3 py-2.5 text-xs font-medium uppercase tracking-wide text-neutral-500">
              RUC
            </th>
            <th className="px-3 py-2.5 text-xs font-medium uppercase tracking-wide text-neutral-500">
              Tipo
            </th>
          </tr>
        </thead>
        <tbody>
          {clientes.map((cliente) => (
            <tr key={cliente.id} className="border-b border-neutral-100 last:border-0">
              <td className="p-0">
                <Link
                  href={`/clientes/${cliente.id}`}
                  className="block px-3 py-2.5 text-neutral-500 hover:text-blue-600"
                >
                  #{cliente.numero_cliente}
                </Link>
              </td>
              <td className="p-0">
                <Link
                  href={`/clientes/${cliente.id}`}
                  className="block px-3 py-2.5 font-medium text-neutral-900 hover:text-blue-600"
                >
                  {cliente.nombre}
                </Link>
              </td>
              <td className="p-0">
                <Link
                  href={`/clientes/${cliente.id}`}
                  className="block px-3 py-2.5 text-neutral-500 hover:text-blue-600"
                >
                  {cliente.telefono || "—"}
                </Link>
              </td>
              <td className="p-0">
                <Link
                  href={`/clientes/${cliente.id}`}
                  className="block px-3 py-2.5 text-neutral-500 hover:text-blue-600"
                >
                  {cliente.ruc || "—"}
                </Link>
              </td>
              <td className="p-0">
                <Link
                  href={`/clientes/${cliente.id}`}
                  className="block px-3 py-2.5 text-neutral-500 hover:text-blue-600"
                >
                  {cliente.tipo_cliente ? TIPO_LABEL[cliente.tipo_cliente] ?? cliente.tipo_cliente : "—"}
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
