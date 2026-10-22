import type { ReactNode } from "react";
import { DataTable, moneda } from "@nexo/ui";
import { decimal, tarifa } from "@/lib/planilla/formato";

export interface FilaLinea {
  clave: string;
  concepto: string;
  /** Texto bajo el concepto (p. ej. "Desde 01/01/2026" en el aguinaldo). */
  detalle?: string | null;
  articulo: string | null;
  dias: number | null;
  diario: number | null;
  monto: number;
}

/**
 * Tabla de líneas de una liquidación (simulada o guardada): Concepto ·
 * Artículo · Días · Diario · Monto, con el total de la RPC en el pie (no se
 * suma en la vista). Sin "use client".
 */
export function TablaLineas({
  titulo,
  id,
  caption,
  filas,
  totalLabel,
  total,
  vacio,
}: {
  titulo: string;
  id: string;
  caption: string;
  filas: FilaLinea[];
  totalLabel: string;
  /** Total que devolvió la RPC. */
  total: number;
  vacio?: ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3">
      <h2 id={id} className="text-base font-semibold text-neutral-900">
        {titulo}
      </h2>
      <DataTable
        caption={caption}
        rows={filas}
        rowKey={(f) => f.clave}
        density="compact"
        empty={vacio}
        footer={
          <div className="flex items-center justify-between gap-4 text-sm font-semibold text-neutral-900">
            <span>{totalLabel}</span>
            <span className="tabular-nums">{moneda(total)}</span>
          </div>
        }
        columns={[
          {
            key: "concepto",
            header: "Concepto",
            render: (f) => (
              <span className="flex min-w-0 flex-col">
                <span className="font-medium text-neutral-900">{f.concepto}</span>
                {f.detalle ? <span className="text-xs text-neutral-500">{f.detalle}</span> : null}
              </span>
            ),
          },
          { key: "articulo", header: "Artículo", render: (f) => f.articulo ?? "—" },
          { key: "dias", header: "Días", numeric: true, render: (f) => decimal(f.dias, 4) },
          { key: "diario", header: "Diario", numeric: true, render: (f) => tarifa(f.diario) },
          { key: "monto", header: "Monto", numeric: true, render: (f) => moneda(f.monto) },
        ]}
      />
    </section>
  );
}
