"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Field, Input, Select } from "@nexo/ui";

/**
 * Filtros de Clientes: búsqueda, orden y, para gerencia, vendedor. El vendedor
 * sin factura.ver no recibe la lista de vendedores (la RPC lo limita a lo suyo).
 * Va en la barra superior (toolbar) del DataTable.
 */
export function FiltrosClientes({
  q,
  orden,
  vendedor,
  vendedores,
}: {
  q: string;
  orden: string;
  vendedor: string;
  vendedores: { id: string; etiqueta: string }[] | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const sp = new URLSearchParams();
    const b = String(fd.get("q") ?? "").trim();
    const o = String(fd.get("orden") ?? "");
    const v = String(fd.get("vendedor") ?? "");
    if (b) sp.set("q", b);
    if (o && o !== "reciente") sp.set("orden", o);
    if (v) sp.set("vendedor", v);
    const qs = sp.toString();
    startTransition(() => router.push(qs ? `/clientes?${qs}` : "/clientes"));
  }

  return (
    <form onSubmit={enviar} className="flex w-full flex-wrap items-end gap-3">
      <Field label="Buscar cliente" className="flex-1 basis-56">
        <Input name="q" type="search" defaultValue={q} maxLength={100} placeholder="Nombre del cliente" />
      </Field>
      {vendedores ? (
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
      ) : null}
      <Field label="Ordenar por" className="w-44">
        <Select name="orden" defaultValue={orden}>
          <option value="reciente">Última factura</option>
          <option value="monto">Total facturado</option>
          <option value="nombre">Nombre</option>
        </Select>
      </Field>
      <Button type="submit" variant="secondary" loading={isPending}>
        {isPending ? "Buscando…" : "Aplicar"}
      </Button>
    </form>
  );
}
