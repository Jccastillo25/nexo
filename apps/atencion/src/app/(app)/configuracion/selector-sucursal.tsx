"use client";

import { useRouter } from "next/navigation";

export default function SelectorSucursal({
  sucursales,
  actual,
}: {
  sucursales: { id: string; nombre: string }[];
  actual: string;
}) {
  const router = useRouter();
  if (sucursales.length < 2) {
    return <p className="text-sm text-neutral-600">Sucursal: <span className="font-medium">{sucursales[0]?.nombre}</span></p>;
  }
  return (
    <label className="flex items-center gap-2 text-sm text-neutral-600">
      Sucursal
      <select
        value={actual}
        onChange={(e) => router.push(`/configuracion?sucursal=${e.target.value}`)}
        className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900"
      >
        {sucursales.map((s) => (
          <option key={s.id} value={s.id}>
            {s.nombre}
          </option>
        ))}
      </select>
    </label>
  );
}
