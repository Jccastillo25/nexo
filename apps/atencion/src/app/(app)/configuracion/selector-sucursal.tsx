"use client";

import { useRouter } from "next/navigation";
import { Field, Select } from "@nexo/ui";

/** Sucursal que se está configurando; la elección queda en la URL (?sucursal=). */
export default function SelectorSucursal({
  sucursales,
  actual,
}: {
  sucursales: { id: string; nombre: string }[];
  actual: string;
}) {
  const router = useRouter();
  if (sucursales.length < 2) {
    return (
      <p className="text-sm text-neutral-600">
        Sucursal: <span className="font-medium text-neutral-900">{sucursales[0]?.nombre}</span>
      </p>
    );
  }
  return (
    <Field label="Sucursal" className="max-w-xs">
      <Select
        value={actual}
        onChange={(e) => router.push(`/configuracion?sucursal=${encodeURIComponent(e.target.value)}`)}
      >
        {sucursales.map((s) => (
          <option key={s.id} value={s.id}>
            {s.nombre}
          </option>
        ))}
      </Select>
    </Field>
  );
}
