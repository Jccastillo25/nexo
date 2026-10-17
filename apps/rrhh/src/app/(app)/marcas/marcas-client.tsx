"use client";

import { useRef, useState } from "react";
import { DataTable, FilterBar, StatusBadge, EmptyState } from "@nexo/ui";
import { consultarMarcas, type MarcaRow, type MarcasResult } from "./actions";
import type { FiltrosMarcas } from "./filtros";

const estados: Record<string, string> = { registrada: "Registrada", entrada_abierta_hoy: "Entrada abierta hoy", falta_salida: "Falta salida" };
const control = "rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-800";

export default function MarcasClient({ hoy, initial }: { hoy: string; initial: MarcasResult }) {
  const base = { desde: hoy, hasta: hoy, empleadoId: "", contratoId: "", estado: "", offset: 0 };
  const [draft, setDraft] = useState<FiltrosMarcas>(base);
  const [applied, setApplied] = useState<FiltrosMarcas>(base);
  const [result, setResult] = useState(initial);
  const [known, setKnown] = useState<MarcaRow[]>(initial.ok ? initial.rows : []);
  const [detail, setDetail] = useState<MarcaRow | null>(null);
  const [loading, setLoading] = useState(false);
  const sequence = useRef(0);
  const rows = result.ok ? result.rows : [];
  const empleados = [...new Map(known.map(r => [r.empleado_id, r.empleado_label])).entries()];
  const contratos = [...new Map(known.filter(r => !draft.empleadoId || r.empleado_id === draft.empleadoId).map(r => [r.contrato_id, r.contrato_numero])).entries()];
  const dirty = JSON.stringify({ ...draft, offset: 0 }) !== JSON.stringify({ ...applied, offset: 0 });
  async function load(filtros: FiltrosMarcas) {
    const current = ++sequence.current;
    setLoading(true); setDetail(null);
    try {
      const response = await consultarMarcas(filtros);
      if (current !== sequence.current) return;
      setResult(response);
      if (response.ok) {
        setApplied(filtros);
        setKnown(old => [...new Map([...old, ...response.rows].map(row => [row.marca_id, row])).values()]);
      }
    } catch {
      if (current === sequence.current) setResult({ ok: false, message: "No se pudieron consultar las marcas. Intenta de nuevo." });
    } finally { if (current === sequence.current) setLoading(false); }
  }
  function update(key: keyof FiltrosMarcas, value: string) { setDraft(old => ({ ...old, [key]: value, ...(key === "empleadoId" ? { contratoId: "" } : {}) })); }
  return <div className="flex flex-col gap-4">
    <form onSubmit={event => { event.preventDefault(); void load({ ...draft, offset: 0 }); }}>
      <FilterBar>
        <label className="flex flex-col gap-1 text-sm">Desde<input required type="date" className={control} value={draft.desde} onChange={e => update("desde", e.target.value)} /></label>
        <label className="flex flex-col gap-1 text-sm">Hasta<input required type="date" className={control} value={draft.hasta} onChange={e => update("hasta", e.target.value)} /></label>
        <label className="flex flex-col gap-1 text-sm">Empleado<select className={control} value={draft.empleadoId} onChange={e => update("empleadoId", e.target.value)}><option value="">Todos</option>{empleados.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
        <label className="flex flex-col gap-1 text-sm">Contrato<select className={control} value={draft.contratoId} onChange={e => update("contratoId", e.target.value)}><option value="">Todos</option>{contratos.map(([id, numero]) => <option key={id} value={id}>Contrato {numero}</option>)}</select></label>
        <label className="flex flex-col gap-1 text-sm">Estado<select className={control} value={draft.estado} onChange={e => update("estado", e.target.value)}><option value="">Todos</option>{Object.entries(estados).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
        <button disabled={loading} className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50" type="submit">{loading ? "Consultando…" : "Consultar"}</button>
      </FilterBar>
    </form>
    <p className="text-xs text-neutral-500">Los selectores incluyen empleados y contratos de las marcas ya consultadas. Consulta primero el rango de fechas que necesitas.</p>
    {!result.ok ? <div role="alert" className="rounded-xl border border-neutral-200 bg-white p-4">{result.message}</div> : <>
      {rows.length === 0 ? <EmptyState title="Sin marcas registradas" description="No hay marcas que coincidan con los filtros." /> : <DataTable<MarcaRow>
        rows={rows} rowKey={r => r.marca_id + r.marcado_en}
        columns={[
          { key: "empleado", header: "Empleado", render: r => r.empleado_label },
          { key: "contrato", header: "Contrato", render: r => r.contrato_numero },
          { key: "tipo", header: "Tipo", render: r => r.tipo === "entrada" ? "Entrada" : "Salida" },
          { key: "hora", header: "Fecha y hora", render: r => new Date(r.marcado_en).toLocaleString("es-NI", { timeZone: "America/Managua" }) },
          { key: "estado", header: "Estado", render: r => <StatusBadge label={estados[r.estado] ?? "Registrada"} tone={r.estado === "falta_salida" ? "warning" : "neutral"} /> },
          { key: "detalle", header: "Detalle", render: r => <button type="button" onClick={() => setDetail(r)} className="font-medium text-blue-600">Ver detalle</button> },
        ]}
      />}
      <div className="flex items-center gap-4 text-sm">
        <button disabled={loading || dirty || (applied.offset ?? 0) === 0} onClick={() => void load({ ...applied, offset: Math.max(0, (applied.offset ?? 0) - 50) })} className="disabled:opacity-40">Anterior</button>
        <span>Página {Math.floor((applied.offset ?? 0) / 50) + 1}</span>
        <button disabled={loading || dirty || rows.length < 50} onClick={() => void load({ ...applied, offset: (applied.offset ?? 0) + 50 })} className="disabled:opacity-40">Siguiente</button>
      </div>
    </>}
    {detail && <section className="rounded-xl border border-neutral-200 bg-white p-4" aria-label="Detalle de marca">
      <h2 className="font-semibold">Detalle de marca</h2>
      <p>{detail.empleado_label} · Contrato {detail.contrato_numero}</p>
      <p>{detail.tipo === "entrada" ? "Entrada" : "Salida"} · {new Date(detail.marcado_en).toLocaleString("es-NI", { timeZone: "America/Managua" })}</p>
      <p>{estados[detail.estado]}</p>
      <button className="mt-2 text-sm font-medium text-blue-600" onClick={() => setDetail(null)}>Cerrar detalle</button>
    </section>}
    <p className="text-sm text-neutral-500">Para reportar un error en una marca, escribe al correo corporativo de RRHH indicando código de empleado, fecha y hora. Nunca incluyas tu PIN.</p>
  </div>;
}
