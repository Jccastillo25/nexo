"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ConfirmDialog, FormTabs, useToast } from "@nexo/ui";
import type { Permisos } from "@/lib/permisos";
import type { Catalogos, Producto } from "@/lib/tipos";
import { descontinuarProducto, guardarProducto, sugerirCodigo } from "./actions";

const inputClass =
  "w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:bg-neutral-100 disabled:text-neutral-500";

interface Estado {
  codigo: string;
  codigoAuto: boolean;
  nombre: string;
  descripcion: string;
  notas: string;
  codigo_barras: string;
  peso: string;
  fecha_ingreso: string;
  es_servicio: boolean;
  inventariable: boolean;
  clase_id: string;
  tipo_id: string;
  categoria_id: string;
  marca_id: string;
  proveedor_id: string;
  unidad_id: string;
  existencia_minima: string;
  existencia_maxima: string;
  lote_por_vencimiento: boolean;
  plazo_vencimiento_dias: string;
  margen_dias_vencer: string;
  costo_moneda: "NIO" | "USD";
  costo_referencia: string;
  exento_ventas: boolean;
  exento_compras: boolean;
  cuenta_ingreso_id: string;
  cuenta_inventario_id: string;
  cuenta_costo_id: string;
  codigo_sac: string;
  centro_costo_id: string;
  centro_costo_unico: boolean;
  caracteristicas: Record<string, string>;
}

const t = (v: string | number | null | undefined) => (v === null || v === undefined ? "" : String(v));

function inicial(p: Producto | null, catalogos: Catalogos): Estado {
  const unidad = catalogos.unidades.find((u) => u.nombre === "UNIDAD")?.id ?? catalogos.unidades[0]?.id ?? "";
  return {
    codigo: p?.codigo ?? "",
    codigoAuto: !p,
    nombre: p?.nombre ?? "",
    descripcion: t(p?.descripcion),
    notas: t(p?.notas),
    codigo_barras: t(p?.codigo_barras),
    peso: t(p?.peso),
    fecha_ingreso: p?.fecha_ingreso ?? new Date().toISOString().slice(0, 10),
    es_servicio: p?.es_servicio ?? false,
    inventariable: p?.inventariable ?? true,
    clase_id: t(p?.clase_id),
    tipo_id: t(p?.tipo_id),
    categoria_id: t(p?.categoria_id),
    marca_id: t(p?.marca_id),
    proveedor_id: t(p?.proveedor_id),
    unidad_id: p?.unidad_id ?? unidad,
    existencia_minima: t(p?.existencia_minima ?? 0),
    existencia_maxima: t(p?.existencia_maxima ?? 0),
    lote_por_vencimiento: p?.lote_por_vencimiento ?? false,
    plazo_vencimiento_dias: t(p?.plazo_vencimiento_dias),
    margen_dias_vencer: t(p?.margen_dias_vencer),
    costo_moneda: p?.costo_moneda ?? "NIO",
    costo_referencia: t(p?.costo_referencia),
    exento_ventas: p?.exento_ventas ?? false,
    exento_compras: p?.exento_compras ?? false,
    cuenta_ingreso_id: t(p?.cuenta_ingreso_id),
    cuenta_inventario_id: t(p?.cuenta_inventario_id),
    cuenta_costo_id: t(p?.cuenta_costo_id),
    codigo_sac: t(p?.codigo_sac),
    centro_costo_id: t(p?.centro_costo_id),
    centro_costo_unico: p?.centro_costo_unico ?? false,
    caracteristicas: Object.fromEntries((p?.caracteristicas ?? []).map((c) => [c.caracteristica_id, c.valor])),
  };
}

function Campo({ label, help, children, full }: { label: string; help?: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div className={`flex min-w-0 flex-col gap-1.5 ${full ? "sm:col-span-2" : ""}`}>
      <span className="text-xs font-semibold text-neutral-700">{label}</span>
      {children}
      {help && <span className="text-xs text-neutral-500">{help}</span>}
    </div>
  );
}

function Check({ label, checked, disabled, onChange }: { label: string; checked: boolean; disabled?: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 text-sm text-neutral-700">
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

function Nota({ children }: { children: React.ReactNode }) {
  return <p className="rounded-md bg-neutral-100 px-3 py-2 text-xs text-neutral-600 sm:col-span-2">{children}</p>;
}

export default function FichaProducto({
  producto,
  catalogos,
  permisos,
  siguienteId,
}: {
  producto: Producto | null;
  catalogos: Catalogos;
  permisos: Permisos;
  siguienteId: number | null;
}) {
  const router = useRouter();
  const { show } = useToast();
  const nuevo = producto === null;
  const [e, setE] = useState<Estado>(() => inicial(producto, catalogos));
  const [sugerido, setSugerido] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmar, setConfirmar] = useState(false);
  const [isPending, startTransition] = useTransition();

  const general = nuevo ? permisos.crear : permisos.editar;
  const puedeGuardar = general || permisos.costoEditar || permisos.fiscal;
  const set = <K extends keyof Estado>(k: K, v: Estado[K]) => setE((prev) => ({ ...prev, [k]: v }));

  const clases = catalogos.clasificaciones.filter((c) => c.nivel === "clase" && (c.activa || c.id === e.clase_id));
  const tipos = catalogos.clasificaciones.filter((c) => c.nivel === "tipo" && c.padre_id === e.clase_id && (c.activa || c.id === e.tipo_id));
  const categorias = catalogos.clasificaciones.filter((c) => c.nivel === "categoria" && c.padre_id === e.tipo_id && (c.activa || c.id === e.categoria_id));
  const marcas = catalogos.marcas.filter(
    (m) => (m.activa || m.id === e.marca_id) && (m.clases.length === 0 || !e.clase_id || m.clases.includes(e.clase_id))
  );
  const cuentas = (tipo: "ingreso" | "inventario" | "costo") => catalogos.cuentas.filter((c) => c.tipo === tipo && c.activa);
  const prefijo = catalogos.clasificaciones.find((c) => c.id === e.categoria_id)?.prefijo ?? null;

  // Producto nuevo: vista previa del código generado al elegir la categoría.
  useEffect(() => {
    if (!nuevo || !e.categoria_id) return;
    let vigente = true;
    sugerirCodigo(e.categoria_id).then((c) => {
      if (vigente) setSugerido(c);
    });
    return () => {
      vigente = false;
    };
  }, [nuevo, e.categoria_id]);
  const sugeridoVigente = nuevo && e.categoria_id ? sugerido : null;
  const codigoMostrado = nuevo && e.codigoAuto ? sugeridoVigente ?? "" : e.codigo;

  const codigoCambiado = !nuevo && producto && e.codigo.trim() !== producto.codigo;

  function datos(): Record<string, unknown> {
    const d: Record<string, unknown> = {};
    if (general) {
      Object.assign(d, {
        codigo: nuevo && e.codigoAuto ? "" : e.codigo.trim(),
        nombre: e.nombre,
        descripcion: e.descripcion,
        notas: e.notas,
        codigo_barras: e.codigo_barras,
        peso: e.peso,
        fecha_ingreso: e.fecha_ingreso,
        es_servicio: e.es_servicio,
        inventariable: e.inventariable,
        clase_id: e.es_servicio ? "" : e.clase_id,
        tipo_id: e.es_servicio ? "" : e.tipo_id,
        categoria_id: e.es_servicio ? "" : e.categoria_id,
        marca_id: e.es_servicio ? "" : e.marca_id,
        proveedor_id: e.es_servicio ? "" : e.proveedor_id,
        unidad_id: e.unidad_id,
        existencia_minima: e.es_servicio ? "0" : e.existencia_minima,
        existencia_maxima: e.es_servicio ? "0" : e.existencia_maxima,
        lote_por_vencimiento: e.lote_por_vencimiento,
        plazo_vencimiento_dias: e.plazo_vencimiento_dias,
        margen_dias_vencer: e.margen_dias_vencer,
        caracteristicas: Object.entries(e.caracteristicas)
          .filter(([, valor]) => valor.trim())
          .map(([caracteristica_id, valor]) => ({ caracteristica_id, valor })),
      });
    }
    if (permisos.costoEditar) Object.assign(d, { costo_moneda: e.costo_moneda, costo_referencia: e.costo_referencia });
    if (permisos.fiscal) {
      Object.assign(d, {
        exento_ventas: e.exento_ventas,
        exento_compras: e.exento_compras,
        cuenta_ingreso_id: e.cuenta_ingreso_id,
        cuenta_inventario_id: e.cuenta_inventario_id,
        cuenta_costo_id: e.es_servicio ? "" : e.cuenta_costo_id,
        codigo_sac: e.codigo_sac,
        centro_costo_id: e.centro_costo_id,
        centro_costo_unico: e.centro_costo_unico,
      });
    }
    return d;
  }

  function guardar() {
    setError(null);
    if (!e.nombre.trim()) return setError("Escribe el nombre del producto.");
    if (nuevo && e.codigoAuto && !e.categoria_id) return setError("Escribe un código o elige clase, tipo y categoría para generarlo.");
    startTransition(async () => {
      const res = await guardarProducto(producto?.id ?? null, datos());
      if (!res.ok || !res.data) {
        setError(res.message ?? "No se pudo guardar el producto.");
        return;
      }
      if (nuevo) {
        show(`Producto creado con ID ${res.data.numero_id} y código ${res.data.codigo}.`, "success");
        router.push(`/catalogo/${res.data.id}`);
      } else {
        show(codigoCambiado ? `Código cambiado a ${res.data.codigo}. El ID ${res.data.numero_id} sigue igual.` : "Cambios guardados.", "success");
        router.refresh();
      }
    });
  }

  function descontinuar() {
    if (!producto) return;
    startTransition(async () => {
      const res = await descontinuarProducto(producto.id, !producto.descontinuado_ventas, !producto.descontinuado_ventas);
      setConfirmar(false);
      if (!res.ok) return show(res.message ?? "No se pudo cambiar el estado.", "error");
      show(producto.descontinuado_ventas ? "Producto reactivado." : "Producto descontinuado.", "success");
      router.refresh();
    });
  }

  const pestanaGeneral = (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Campo label="ID del producto" help={nuevo ? "Se asigna al guardar. No se puede cambiar." : "Asignado por el sistema. No se puede cambiar."}>
        <div className="flex items-center gap-2 rounded-md border border-dashed border-neutral-300 bg-neutral-50 px-3 py-2">
          <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4 text-neutral-400">
            <rect x="4" y="11" width="16" height="10" rx="2" />
            <path d="M8 11V7a4 4 0 0 1 8 0v4" />
          </svg>
          <span className="text-lg font-semibold tabular-nums text-neutral-800">
            {nuevo ? (siguienteId ?? "Al guardar") : producto.numero_id}
          </span>
        </div>
      </Campo>
      <Campo
        label="Código"
        help={
          nuevo
            ? e.codigoAuto
              ? e.categoria_id
                ? `Generado con ${prefijo ?? "la clasificación"} + consecutivo. Se confirma al guardar.`
                : "Elige clase, tipo y categoría para generarlo, o escríbelo."
              : "Escrito a mano. Debe ser único."
            : "Se puede cambiar; queda en la auditoría y el ID no cambia."
        }
      >
        <div className="flex gap-2">
          <input
            className={`${inputClass} font-mono`}
            value={codigoMostrado}
            disabled={!general}
            maxLength={40}
            placeholder={nuevo ? "Se genera con la clasificación" : ""}
            onChange={(ev) => setE((prev) => ({ ...prev, codigo: ev.target.value, codigoAuto: false }))}
          />
          {nuevo && !e.codigoAuto && e.categoria_id && (
            <button type="button" onClick={() => set("codigoAuto", true)} className="shrink-0 text-xs font-semibold text-blue-600 hover:text-blue-700">
              Usar generado
            </button>
          )}
        </div>
        {nuevo && e.categoria_id && (
          <div className="mt-1.5 flex flex-wrap items-center gap-1 text-xs text-neutral-500">
            {[e.clase_id, e.tipo_id, e.categoria_id].map((id) => {
              const c = catalogos.clasificaciones.find((x) => x.id === id);
              return c ? (
                <span key={id} className="flex items-center gap-1">
                  <span className="rounded bg-blue-50 px-1.5 py-0.5 font-mono font-semibold text-blue-700">{c.numero}</span>
                  {c.nombre}
                </span>
              ) : null;
            })}
            <span>+ consecutivo</span>
          </div>
        )}
      </Campo>
      {codigoCambiado && (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800 sm:col-span-2">
          Se guardará en la auditoría: <span className="font-mono">{producto?.codigo}</span> →{" "}
          <span className="font-mono">{e.codigo.trim()}</span>. Precios e inventario siguen ligados al ID {producto?.numero_id}.
        </p>
      )}
      <Campo label="Nombre del producto" full>
        <input className={inputClass} value={e.nombre} disabled={!general} maxLength={200} onChange={(ev) => set("nombre", ev.target.value)} />
      </Campo>
      <Campo label="Unidad de medida">
        <select className={inputClass} value={e.unidad_id} disabled={!general} onChange={(ev) => set("unidad_id", ev.target.value)}>
          <option value="">—</option>
          {catalogos.unidades.filter((u) => u.activa || u.id === e.unidad_id).map((u) => (
            <option key={u.id} value={u.id}>{u.nombre}</option>
          ))}
        </select>
      </Campo>
      <Campo label="Código de barras">
        <input className={inputClass} value={e.codigo_barras} disabled={!general} maxLength={60} onChange={(ev) => set("codigo_barras", ev.target.value)} />
      </Campo>
      <Campo label="Fecha de ingreso">
        <input type="date" className={inputClass} value={e.fecha_ingreso} disabled={!general} onChange={(ev) => set("fecha_ingreso", ev.target.value)} />
      </Campo>
      <div className="flex flex-col justify-end gap-2">
        <Check label="Es servicio" checked={e.es_servicio} disabled={!general} onChange={(v) => set("es_servicio", v)} />
        <Check label="Inventariable" checked={e.inventariable && !e.es_servicio} disabled={!general || e.es_servicio} onChange={(v) => set("inventariable", v)} />
      </div>
      <Campo label="Descripción" full>
        <textarea className={inputClass} rows={2} value={e.descripcion} disabled={!general} maxLength={2000} onChange={(ev) => set("descripcion", ev.target.value)} />
      </Campo>
      <Campo label="Notas" full>
        <textarea className={inputClass} rows={2} value={e.notas} disabled={!general} maxLength={2000} onChange={(ev) => set("notas", ev.target.value)} />
      </Campo>
      {e.es_servicio && <Nota>Un servicio no lleva clasificación, marca, proveedor, cuenta de costos ni existencias.</Nota>}
    </div>
  );

  const pestanaClasificacion = (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Campo label="Clase">
        <select className={inputClass} value={e.clase_id} disabled={!general || e.es_servicio}
          onChange={(ev) => setE((prev) => ({ ...prev, clase_id: ev.target.value, tipo_id: "", categoria_id: "" }))}>
          <option value="">—</option>
          {clases.map((c) => <option key={c.id} value={c.id}>{c.numero} · {c.nombre}</option>)}
        </select>
      </Campo>
      <Campo label="Tipo">
        <select className={inputClass} value={e.tipo_id} disabled={!general || !e.clase_id}
          onChange={(ev) => setE((prev) => ({ ...prev, tipo_id: ev.target.value, categoria_id: "" }))}>
          <option value="">—</option>
          {tipos.map((c) => <option key={c.id} value={c.id}>{c.numero} · {c.nombre}</option>)}
        </select>
      </Campo>
      <Campo label="Categoría">
        <select className={inputClass} value={e.categoria_id} disabled={!general || !e.tipo_id} onChange={(ev) => set("categoria_id", ev.target.value)}>
          <option value="">—</option>
          {categorias.map((c) => <option key={c.id} value={c.id}>{c.numero} · {c.nombre}</option>)}
        </select>
      </Campo>
      <Campo label="Marca" help="Solo las marcas permitidas en la clase elegida.">
        <select className={inputClass} value={e.marca_id} disabled={!general || e.es_servicio} onChange={(ev) => set("marca_id", ev.target.value)}>
          <option value="">—</option>
          {marcas.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
        </select>
      </Campo>
      <Campo label="Proveedor" full>
        <select className={inputClass} value={e.proveedor_id} disabled={!general || e.es_servicio} onChange={(ev) => set("proveedor_id", ev.target.value)}>
          <option value="">—</option>
          {catalogos.proveedores.filter((x) => x.activo || x.id === e.proveedor_id).map((x) => <option key={x.id} value={x.id}>{x.nombre}</option>)}
        </select>
      </Campo>
      {nuevo ? (
        <Nota>
          Con clase, tipo y categoría el código se genera solo{sugeridoVigente ? <>: <span className="font-mono font-semibold">{sugeridoVigente}</span></> : "."}{" "}
          ¿Falta una opción? Agrégala en <Link href="/clasificacion" className="font-semibold text-blue-600">Clasificación</Link>.
        </Nota>
      ) : (
        <Nota>Cambiar la clasificación no cambia el código. Si quieres otro código, edítalo en General.</Nota>
      )}
    </div>
  );

  const pestanaFiscal = (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {!permisos.fiscal && <Nota>Solo lectura: editar datos fiscales requiere el permiso “Editar datos fiscales”.</Nota>}
      <Check label="Exento de ventas" checked={e.exento_ventas} disabled={!permisos.fiscal} onChange={(v) => set("exento_ventas", v)} />
      <Check label="Exento de compras" checked={e.exento_compras} disabled={!permisos.fiscal} onChange={(v) => set("exento_compras", v)} />
      {(["ingreso", "inventario", "costo"] as const).map((tipo) => {
        const clave = `cuenta_${tipo}_id` as "cuenta_ingreso_id" | "cuenta_inventario_id" | "cuenta_costo_id";
        return (
          <Campo key={tipo} label={`Cuenta de ${tipo === "ingreso" ? "ingresos" : tipo === "costo" ? "costos" : "inventario"}`}>
            <select className={inputClass} value={e[clave]} disabled={!permisos.fiscal || (tipo === "costo" && e.es_servicio)} onChange={(ev) => set(clave, ev.target.value)}>
              <option value="">—</option>
              {cuentas(tipo).map((c) => <option key={c.id} value={c.id}>{c.codigo} / {c.nombre}</option>)}
            </select>
          </Campo>
        );
      })}
      <Campo label="Código SAC (arancel)">
        <input className={inputClass} value={e.codigo_sac} disabled={!permisos.fiscal} maxLength={40} onChange={(ev) => set("codigo_sac", ev.target.value)} />
      </Campo>
      <Campo label="Centro de costo">
        <select className={inputClass} value={e.centro_costo_id} disabled={!permisos.fiscal} onChange={(ev) => set("centro_costo_id", ev.target.value)}>
          <option value="">—</option>
          {catalogos.centros_costo.filter((c) => c.activo || c.id === e.centro_costo_id).map((c) => <option key={c.id} value={c.id}>{c.codigo} · {c.nombre}</option>)}
        </select>
      </Campo>
      <Check label="Centro de costo único" checked={e.centro_costo_unico} disabled={!permisos.fiscal} onChange={(v) => set("centro_costo_unico", v)} />
    </div>
  );

  const pestanaCosto = !permisos.costoVer ? (
    <Nota>No ves el costo: tu rol no incluye “Ver costo”.</Nota>
  ) : (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Campo label="Moneda del costo">
        <select className={inputClass} value={e.costo_moneda} disabled={!permisos.costoEditar} onChange={(ev) => set("costo_moneda", ev.target.value as "NIO" | "USD")}>
          <option value="NIO">C$ Córdobas</option>
          <option value="USD">US$ Dólares</option>
        </select>
      </Campo>
      <Campo label="Costo de referencia">
        <input type="number" min={0} step="0.0001" className={inputClass} value={e.costo_referencia} disabled={!permisos.costoEditar} onChange={(ev) => set("costo_referencia", ev.target.value)} />
      </Campo>
      {!permisos.costoEditar && <Nota>Puedes ver el costo pero no cambiarlo: falta el permiso “Editar costo”.</Nota>}
      <Nota>El precio de venta, el precio mínimo y los precios por clasificación de cliente se manejan en Listas de precios, que lee este producto por su ID.</Nota>
    </div>
  );

  const pestanaInventario = (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Campo label="Existencia mínima">
        <input type="number" min={0} className={inputClass} value={e.existencia_minima} disabled={!general || e.es_servicio} onChange={(ev) => set("existencia_minima", ev.target.value)} />
      </Campo>
      <Campo label="Existencia máxima" help="0 = sin tope.">
        <input type="number" min={0} className={inputClass} value={e.existencia_maxima} disabled={!general || e.es_servicio} onChange={(ev) => set("existencia_maxima", ev.target.value)} />
      </Campo>
      <Check label="Controlar lote por fecha de vencimiento" checked={e.lote_por_vencimiento} disabled={!general} onChange={(v) => set("lote_por_vencimiento", v)} />
      <Campo label="Peso (kg)">
        <input type="number" min={0} step="0.001" className={inputClass} value={e.peso} disabled={!general} onChange={(ev) => set("peso", ev.target.value)} />
      </Campo>
      {e.lote_por_vencimiento && (
        <>
          <Campo label="Plazo de vencimiento (días)">
            <input type="number" min={0} className={inputClass} value={e.plazo_vencimiento_dias} disabled={!general} onChange={(ev) => set("plazo_vencimiento_dias", ev.target.value)} />
          </Campo>
          <Campo label="Margen de días para vencer">
            <input type="number" min={0} className={inputClass} value={e.margen_dias_vencer} disabled={!general} onChange={(ev) => set("margen_dias_vencer", ev.target.value)} />
          </Campo>
        </>
      )}
      <Nota>Las existencias reales por bodega son del módulo Inventario.</Nota>
    </div>
  );

  const activas = catalogos.caracteristicas.filter((c) => c.activa || e.caracteristicas[c.id]);
  const pestanaCaracteristicas = activas.length === 0 ? (
    <Nota>No hay características configuradas. Se agregan en Catálogos.</Nota>
  ) : (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {activas.map((c) => (
        <Campo key={c.id} label={c.nombre}>
          <input
            className={inputClass}
            type={c.tipo === "numero" ? "number" : "text"}
            value={e.caracteristicas[c.id] ?? ""}
            disabled={!general}
            maxLength={200}
            onChange={(ev) => setE((prev) => ({ ...prev, caracteristicas: { ...prev.caracteristicas, [c.id]: ev.target.value } }))}
          />
        </Campo>
      ))}
    </div>
  );

  const tabs = [
    { key: "general", label: "General", content: pestanaGeneral },
    { key: "clasificacion", label: "Clasificación", content: pestanaClasificacion },
    { key: "fiscal", label: "Fiscal y contable", content: pestanaFiscal },
    { key: "costo", label: "Costo", content: pestanaCosto },
    { key: "inventario", label: "Inventario", content: pestanaInventario },
    { key: "caracteristicas", label: "Características", content: pestanaCaracteristicas },
  ];

  return (
    <div className="flex flex-col gap-4">
      {!puedeGuardar && (
        <p className="rounded-md bg-neutral-200/60 px-3 py-2 text-sm text-neutral-700">Solo lectura: tu rol no permite editar productos.</p>
      )}
      <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
        <FormTabs tabs={tabs} />
      </div>
      {error && <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <Link href="/catalogo" className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-50">
          Volver
        </Link>
        {puedeGuardar && (
          <button type="button" onClick={guardar} disabled={isPending}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">
            {isPending ? "Guardando…" : nuevo ? "Crear producto" : "Guardar cambios"}
          </button>
        )}
        {!nuevo && permisos.descontinuar && (
          <button type="button" onClick={() => setConfirmar(true)} disabled={isPending}
            className="ml-auto rounded-md border border-neutral-300 px-4 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-50">
            {producto.descontinuado_ventas ? "Reactivar" : "Descontinuar"}
          </button>
        )}
      </div>
      {!nuevo && (
        <ConfirmDialog
          open={confirmar}
          title={producto.descontinuado_ventas ? "Reactivar producto" : "Descontinuar producto"}
          description={
            producto.descontinuado_ventas
              ? "El producto vuelve a estar disponible para ventas y compras."
              : "El producto deja de estar disponible para ventas y compras. No se borra y se puede reactivar."
          }
          confirmLabel={producto.descontinuado_ventas ? "Reactivar" : "Descontinuar"}
          pending={isPending}
          onConfirm={descontinuar}
          onCancel={() => setConfirmar(false)}
        />
      )}
    </div>
  );
}
