"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Field, Input, Select } from "@nexo/ui";
import { capitalizar, diasEntre, MESES } from "@/lib/metas/periodo";

/**
 * Filtros del listado de facturas (gerente): rango de fechas, vendedor y
 * búsqueda. Va en la barra superior (toolbar) del DataTable.
 */
export function FiltrosFacturas({
  desde,
  hasta,
  vendedor,
  q,
  vendedores,
}: {
  desde: string;
  hasta: string;
  vendedor: string;
  q: string;
  vendedores: { id: string; etiqueta: string }[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const d = String(fd.get("desde") ?? "");
    const h = String(fd.get("hasta") ?? "");
    if (!d || !h) return setError("Elige las dos fechas: desde y hasta.");
    if (h < d) return setError("La fecha final no puede ser anterior a la inicial.");
    if (diasEntre(d, h) > 400) return setError("El rango máximo es de 400 días. Acorta las fechas.");
    setError(null);
    const sp = new URLSearchParams({ desde: d, hasta: h });
    const v = String(fd.get("vendedor") ?? "");
    const b = String(fd.get("q") ?? "").trim();
    if (v) sp.set("vendedor", v);
    if (b) sp.set("q", b);
    startTransition(() => router.push(`/facturas?${sp.toString()}`));
  }

  return (
    <form onSubmit={enviar} className="flex w-full flex-col gap-2" noValidate>
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Desde" className="w-40">
          <Input name="desde" type="date" defaultValue={desde} invalid={!!error} aria-describedby={error ? "f-error" : undefined} />
        </Field>
        <Field label="Hasta" className="w-40">
          <Input name="hasta" type="date" defaultValue={hasta} invalid={!!error} aria-describedby={error ? "f-error" : undefined} />
        </Field>
        <Field label="Vendedor" className="w-56 max-w-full">
          <Select name="vendedor" defaultValue={vendedor}>
            <option value="">Todos</option>
            {vendedores.map((v) => (
              <option key={v.id} value={v.id}>
                {v.etiqueta}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Buscar" className="flex-1 basis-56">
          <Input name="q" type="search" defaultValue={q} placeholder="N.º de factura o cliente" />
        </Field>
        <Button type="submit" variant="secondary" loading={isPending}>
          {isPending ? "Filtrando…" : "Filtrar"}
        </Button>
      </div>
      {error ? (
        <p id="f-error" role="alert" className="text-sm text-red-700">
          {error}
        </p>
      ) : null}
    </form>
  );
}

/** Filtros de "Mis facturas" (vendedor): año y mes, o todo el año. */
export function FiltrosMisFacturas({ anio, mes, anios }: { anio: number; mes: number | null; anios: number[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function ir(a: number, m: number | null) {
    const sp = new URLSearchParams({ anio: String(a), mes: m === null ? "0" : String(m) });
    startTransition(() => router.push(`/facturas?${sp.toString()}`));
  }

  return (
    <div className="flex flex-wrap items-end gap-3" aria-busy={isPending}>
      <Field label="Año" className="w-28">
        <Select value={anio} onChange={(e) => ir(Number(e.target.value), mes)}>
          {anios.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Mes" className="w-40">
        <Select value={mes ?? 0} onChange={(e) => ir(anio, Number(e.target.value) || null)}>
          <option value={0}>Todo el año</option>
          {MESES.map((m, i) => (
            <option key={m} value={i + 1}>
              {capitalizar(m)}
            </option>
          ))}
        </Select>
      </Field>
      {isPending ? (
        <span role="status" className="pb-2.5 text-xs text-neutral-500">
          Cargando…
        </span>
      ) : null}
    </div>
  );
}
