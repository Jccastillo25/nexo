"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Field, FormSection, Input, Select, StatusBadge, useToast } from "@nexo/ui";
import type { Permisos } from "@/lib/permisos";
import type { Catalogos } from "@/lib/tipos";
import type { CatalogoRuta } from "@/lib/catalogos-ruta";
import { guardarCatalogo, type TipoCatalogo } from "./actions";

interface Fila {
  id: string;
  titulo: string;
  detalle?: string;
  activo: boolean;
  datos: Record<string, unknown>;
}

interface CampoDef {
  clave: string;
  etiqueta: string;
  tipo?: "texto" | "select";
  opciones?: { valor: string; etiqueta: string }[];
  /** Ancho desde sm (en móvil, todo el ancho): clase completa, p. ej. "sm:w-40". */
  ancho?: string;
  soloAlCrear?: boolean;
}

function Panel({
  catalogo,
  titulo,
  descripcion,
  filas,
  campos,
  puedeGestionar,
  extra,
}: {
  catalogo: TipoCatalogo;
  titulo: string;
  descripcion: string;
  filas: Fila[];
  campos: CampoDef[];
  puedeGestionar: boolean;
  extra?: (borrador: Record<string, unknown>, set: (d: Record<string, unknown>) => void) => React.ReactNode;
}) {
  const router = useRouter();
  const { show } = useToast();
  const [borrador, setBorrador] = useState<{ id: string | null; datos: Record<string, unknown> } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function guardar() {
    if (!borrador) return;
    startTransition(async () => {
      const res = await guardarCatalogo(catalogo, borrador.id, borrador.datos);
      if (!res.ok) return setError(res.message ?? "No se pudo guardar.");
      show("Guardado.", "success");
      setBorrador(null);
      router.refresh();
    });
  }

  const nuevoBorrador = () => {
    setError(null);
    setBorrador({
      id: null,
      datos: Object.fromEntries(campos.map((c) => [c.clave, c.tipo === "select" ? c.opciones?.[0]?.valor ?? "" : ""])),
    });
  };

  return (
    <FormSection title={titulo} description={descripcion}>
      <ul className="divide-y divide-neutral-100 rounded-lg border border-neutral-200">
        {filas.map((f) => (
          <li key={f.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-2 text-sm">
            <div className="flex min-w-0 items-center gap-3">
              <span className={`font-medium ${f.activo ? "text-neutral-900" : "text-neutral-400"}`}>{f.titulo}</span>
              {f.detalle && <span className="text-xs text-neutral-500">{f.detalle}</span>}
              {!f.activo && <StatusBadge label="Inactivo" tone="neutral" />}
            </div>
            {puedeGestionar && (
              <Button
                variant="link"
                aria-label={`Editar ${f.titulo}`}
                onClick={() => {
                  setError(null);
                  setBorrador({ id: f.id, datos: { ...f.datos, activo: f.activo } });
                }}
              >
                Editar
              </Button>
            )}
          </li>
        ))}
        {filas.length === 0 && <li className="px-4 py-4 text-sm text-neutral-500">Todavía no hay registros. Se crean al importar o a mano.</li>}
      </ul>

      {puedeGestionar &&
        (borrador ? (
          <div className="flex flex-col gap-3 rounded-lg border border-neutral-200 p-4">
            <div className="flex flex-wrap items-end gap-3">
              {campos
                .filter((c) => !(c.soloAlCrear && borrador.id))
                .map((c) => (
                  <Field key={c.clave} label={c.etiqueta} className={`w-full ${c.ancho ?? "sm:w-56"}`}>
                    {c.tipo === "select" ? (
                      <Select
                        value={String(borrador.datos[c.clave] ?? "")}
                        onChange={(e) => setBorrador({ ...borrador, datos: { ...borrador.datos, [c.clave]: e.target.value } })}
                      >
                        {c.opciones?.map((o) => <option key={o.valor} value={o.valor}>{o.etiqueta}</option>)}
                      </Select>
                    ) : (
                      <Input
                        value={String(borrador.datos[c.clave] ?? "")}
                        onChange={(e) => setBorrador({ ...borrador, datos: { ...borrador.datos, [c.clave]: e.target.value } })}
                      />
                    )}
                  </Field>
                ))}
              {borrador.id && (
                <label className="flex h-9 items-center gap-2 text-sm text-neutral-700">
                  <input
                    type="checkbox"
                    checked={borrador.datos.activo !== false}
                    onChange={(e) => setBorrador({ ...borrador, datos: { ...borrador.datos, activo: e.target.checked } })}
                  />
                  Activo
                </label>
              )}
            </div>
            {extra?.(borrador.datos, (d) => setBorrador({ ...borrador, datos: d }))}
            {error ? <Alert tone="error">{error}</Alert> : null}
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => setBorrador(null)}>
                Cancelar
              </Button>
              <Button onClick={guardar} loading={isPending}>
                {isPending ? "Guardando…" : "Guardar"}
              </Button>
            </div>
          </div>
        ) : (
          <div>
            <Button variant="secondary" onClick={nuevoBorrador}>
              Agregar
            </Button>
          </div>
        ))}
    </FormSection>
  );
}

const TIPO_CUENTA = [
  { valor: "ingreso", etiqueta: "Ingresos" },
  { valor: "inventario", etiqueta: "Inventario" },
  { valor: "costo", etiqueta: "Costos" },
];

const TIPO_CARACTERISTICA = [
  { valor: "texto", etiqueta: "Texto" },
  { valor: "numero", etiqueta: "Número" },
  { valor: "si_no", etiqueta: "Sí / No" },
];

/** Un catálogo por ruta (/configuracion/<solo>), como en el menú lateral. */
export default function PanelesCatalogos({ catalogos, permisos, solo }: { catalogos: Catalogos; permisos: Permisos; solo: CatalogoRuta }) {
  const clases = catalogos.clasificaciones.filter((c) => c.nivel === "clase");
  const nombreClase = (id: string) => clases.find((c) => c.id === id)?.nombre ?? "";

  const paneles = [
    permisos.marca && {
      key: "marcas",
      label: "Marcas",
      content: (
        <Panel
          catalogo="marca"
          titulo="Marcas"
          descripcion="Una marca sin clases marcadas vale para cualquier clase."
          puedeGestionar
          campos={[{ clave: "nombre", etiqueta: "Nombre" }]}
          filas={catalogos.marcas.map((m) => ({
            id: m.id,
            titulo: m.nombre,
            detalle: m.clases.length ? m.clases.map(nombreClase).join(", ") : "Todas las clases",
            activo: m.activa,
            datos: { nombre: m.nombre, clases: m.clases },
          }))}
          extra={(d, set) => (
            <fieldset className="flex flex-wrap gap-3 text-sm text-neutral-700">
              <legend className="mb-1 text-xs text-neutral-500">Clases permitidas</legend>
              {clases.map((c) => {
                const actuales = (d.clases as string[] | undefined) ?? [];
                return (
                  <label key={c.id} className="flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={actuales.includes(c.id)}
                      onChange={(e) => set({ ...d, clases: e.target.checked ? [...actuales, c.id] : actuales.filter((x) => x !== c.id) })}
                    />
                    {c.numero} · {c.nombre}
                  </label>
                );
              })}
            </fieldset>
          )}
        />
      ),
    },
    permisos.unidad && {
      key: "unidades",
      label: "Unidades",
      content: (
        <Panel
          catalogo="unidad"
          titulo="Unidades de medida"
          descripcion="Se guardan en mayúsculas, como en el ERP (UNIDAD, GALON, QQ…)."
          puedeGestionar
          campos={[{ clave: "nombre", etiqueta: "Nombre", ancho: "sm:w-40" }, { clave: "simbolo", etiqueta: "Símbolo", ancho: "sm:w-24" }]}
          filas={catalogos.unidades.map((u) => ({ id: u.id, titulo: u.nombre, detalle: u.simbolo ?? undefined, activo: u.activa, datos: { nombre: u.nombre, simbolo: u.simbolo ?? "" } }))}
        />
      ),
    },
    permisos.proveedor && {
      key: "proveedores",
      label: "Proveedores",
      content: (
        <Panel
          catalogo="proveedor"
          titulo="Proveedores"
          descripcion="Pasarán al módulo de Compras cuando exista."
          puedeGestionar
          campos={[{ clave: "nombre", etiqueta: "Nombre", ancho: "sm:w-80" }]}
          filas={catalogos.proveedores.map((x) => ({ id: x.id, titulo: x.nombre, activo: x.activo, datos: { nombre: x.nombre } }))}
        />
      ),
    },
    permisos.caracteristica && {
      key: "caracteristicas",
      label: "Características",
      content: (
        <Panel
          catalogo="caracteristica"
          titulo="Características de producto"
          descripcion="Datos extra de la ficha (peso, color, calibre…)."
          puedeGestionar
          campos={[
            { clave: "nombre", etiqueta: "Nombre" },
            { clave: "tipo", etiqueta: "Tipo", tipo: "select", opciones: TIPO_CARACTERISTICA },
          ]}
          filas={catalogos.caracteristicas.map((x) => ({
            id: x.id,
            titulo: x.nombre,
            detalle: TIPO_CARACTERISTICA.find((t) => t.valor === x.tipo)?.etiqueta,
            activo: x.activa,
            datos: { nombre: x.nombre, tipo: x.tipo },
          }))}
        />
      ),
    },
    permisos.contable && {
      key: "cuentas",
      label: "Cuentas contables",
      content: (
        <div className="flex flex-col gap-6">
          <Panel
            catalogo="cuenta"
            titulo="Cuentas contables"
            descripcion="Mismo código que en el ERP (ej. 411-01 / Ingreso por ventas de productos)."
            puedeGestionar
            campos={[
              { clave: "codigo", etiqueta: "Código", ancho: "sm:w-28" },
              { clave: "nombre", etiqueta: "Nombre", ancho: "sm:w-72" },
              { clave: "tipo", etiqueta: "Tipo", tipo: "select", opciones: TIPO_CUENTA, soloAlCrear: true },
            ]}
            filas={catalogos.cuentas.map((x) => ({
              id: x.id,
              titulo: `${x.codigo} / ${x.nombre}`,
              detalle: TIPO_CUENTA.find((t) => t.valor === x.tipo)?.etiqueta,
              activo: x.activa,
              datos: { codigo: x.codigo, nombre: x.nombre },
            }))}
          />
          <Panel
            catalogo="centro_costo"
            titulo="Centros de costo"
            descripcion="Código y nombre del centro de costo."
            puedeGestionar
            campos={[{ clave: "codigo", etiqueta: "Código", ancho: "sm:w-28" }, { clave: "nombre", etiqueta: "Nombre", ancho: "sm:w-72" }]}
            filas={catalogos.centros_costo.map((x) => ({ id: x.id, titulo: `${x.codigo} · ${x.nombre}`, activo: x.activo, datos: { codigo: x.codigo, nombre: x.nombre } }))}
          />
        </div>
      ),
    },
  ].filter(Boolean) as { key: string; label: string; content: React.ReactNode }[];

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
      {paneles.find((p) => p.key === solo)?.content}
    </div>
  );
}
