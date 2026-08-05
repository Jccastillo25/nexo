import Link from "next/link";
import type { Cliente } from "@/lib/supabase/database.types";

const TIPO_LABEL: Record<string, string> = {
  mayorista: "Mayorista",
  detal: "Detal",
};

export default function ClientesTable({ clientes }: { clientes: Cliente[] }) {
  if (clientes.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-acero-medio/30 px-4 py-12 text-center">
        <p className="font-mono text-sm text-acero-medio">
          No se encontraron clientes.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-md border border-acero-medio/20">
      <table className="w-full min-w-[640px] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-acero-medio/20 bg-acero-medio/5">
            <th className="px-3 py-2.5 font-mono text-xs font-medium uppercase tracking-wide text-acero-medio">
              N°
            </th>
            <th className="px-3 py-2.5 font-mono text-xs font-medium uppercase tracking-wide text-acero-medio">
              Nombre
            </th>
            <th className="px-3 py-2.5 font-mono text-xs font-medium uppercase tracking-wide text-acero-medio">
              Teléfono
            </th>
            <th className="px-3 py-2.5 font-mono text-xs font-medium uppercase tracking-wide text-acero-medio">
              RUC
            </th>
            <th className="px-3 py-2.5 font-mono text-xs font-medium uppercase tracking-wide text-acero-medio">
              Tipo
            </th>
          </tr>
        </thead>
        <tbody>
          {clientes.map((cliente) => (
            <tr key={cliente.id} className="border-b border-acero-medio/10 last:border-0">
              <td className="p-0">
                <Link
                  href={`/clientes/${cliente.id}`}
                  className="block px-3 py-2.5 font-mono text-acero-medio hover:text-naranja"
                >
                  #{cliente.numero_cliente}
                </Link>
              </td>
              <td className="p-0">
                <Link
                  href={`/clientes/${cliente.id}`}
                  className="block px-3 py-2.5 font-medium text-acero hover:text-naranja"
                >
                  {cliente.nombre}
                </Link>
              </td>
              <td className="p-0">
                <Link
                  href={`/clientes/${cliente.id}`}
                  className="block px-3 py-2.5 font-mono text-acero-medio hover:text-naranja"
                >
                  {cliente.telefono || "—"}
                </Link>
              </td>
              <td className="p-0">
                <Link
                  href={`/clientes/${cliente.id}`}
                  className="block px-3 py-2.5 font-mono text-acero-medio hover:text-naranja"
                >
                  {cliente.ruc || "—"}
                </Link>
              </td>
              <td className="p-0">
                <Link
                  href={`/clientes/${cliente.id}`}
                  className="block px-3 py-2.5 text-acero-medio hover:text-naranja"
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
