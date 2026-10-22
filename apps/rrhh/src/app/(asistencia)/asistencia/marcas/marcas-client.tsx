"use client";

import { useRef, useState } from "react";
import {
  Alert,
  Button,
  DataTable,
  EmptyState,
  Field,
  FilterBar,
  Input,
  Select,
  StatusBadge,
  SubmitButton,
  fechaHora,
} from "@nexo/ui";
import { consultarMarcas } from "./actions";
import type { MarcaRow, MarcasResult } from "./consulta";
import { TAMANO_PAGINA_MARCAS, type EstadoMarca, type FiltrosMarcas } from "./filtros";

type Tono = "neutral" | "info" | "warning";
// Orden del filtro y del StatusBadge (P4c, 2026-10-17).
const estados: Record<EstadoMarca, { label: string; tone: Tono }> = {
  registrada: { label: "Registrada", tone: "neutral" },
  entrada_abierta_hoy: { label: "En jornada", tone: "info" },
  en_descanso_hoy: { label: "En descanso", tone: "info" },
  falta_salida: { label: "Falta salida", tone: "warning" },
  descanso_sin_cerrar: { label: "Descanso sin cerrar", tone: "warning" },
  sin_descanso_marcado: { label: "Sin descanso marcado", tone: "neutral" },
};
const tipos: Record<string, string> = {
  entrada: "Entrada", inicio_descanso: "Inicio de descanso", fin_descanso: "Fin de descanso", salida: "Salida",
};
// Un estado desconocido se muestra tal cual y en advertencia, nunca como "Registrada".
function estadoDe(estado: string): { label: string; tone: Tono } { return estados[estado as EstadoMarca] ?? { label: estado, tone: "warning" }; }
function tipoDe(tipo: string) { return tipos[tipo] ?? tipo; }

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
  const offset = applied.offset ?? 0;
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
    <form aria-label="Filtros de marcas" onSubmit={event => { event.preventDefault(); void load({ ...draft, offset: 0 }); }}>
      <FilterBar>
        <Field label="Desde" required className="w-full sm:w-40">
          <Input required type="date" value={draft.desde} onChange={e => update("desde", e.target.value)} />
        </Field>
        <Field label="Hasta" required className="w-full sm:w-40">
          <Input required type="date" value={draft.hasta} onChange={e => update("hasta", e.target.value)} />
        </Field>
        <Field label="Empleado" className="w-full sm:w-56">
          <Select value={draft.empleadoId} onChange={e => update("empleadoId", e.target.value)}>
            <option value="">Todos</option>
            {empleados.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
          </Select>
        </Field>
        <Field label="Contrato" className="w-full sm:w-44">
          <Select value={draft.contratoId} onChange={e => update("contratoId", e.target.value)}>
            <option value="">Todos</option>
            {contratos.map(([id, numero]) => <option key={id} value={id}>Contrato {numero}</option>)}
          </Select>
        </Field>
        <Field label="Estado" className="w-full sm:w-52">
          <Select value={draft.estado} onChange={e => update("estado", e.target.value)}>
            <option value="">Todos</option>
            {Object.entries(estados).map(([key, { label }]) => <option key={key} value={key}>{label}</option>)}
          </Select>
        </Field>
        <SubmitButton loading={loading} pendingLabel="Consultando…">Consultar</SubmitButton>
      </FilterBar>
    </form>
    <p className="text-xs text-neutral-500">Los selectores incluyen empleados y contratos de las marcas ya consultadas. Consulta primero el rango de fechas que necesitas.</p>
    {!result.ok ? <Alert tone="error">{result.message}</Alert> : <>
      {rows.length === 0 ? <EmptyState variant="no-results" title="Sin marcas registradas" description="No hay marcas que coincidan con los filtros." /> : <DataTable<MarcaRow>
        rows={rows} rowKey={r => r.marca_id + r.marcado_en} caption="Marcas registradas"
        columns={[
          { key: "empleado", header: "Empleado", render: r => r.empleado_label },
          { key: "contrato", header: "Contrato", render: r => r.contrato_numero },
          { key: "tipo", header: "Tipo", render: r => tipoDe(r.tipo) },
          { key: "hora", header: "Fecha y hora", className: "whitespace-nowrap tabular-nums", render: r => fechaHora(r.marcado_en) },
          { key: "estado", header: "Estado", render: r => <StatusBadge label={estadoDe(r.estado).label} tone={estadoDe(r.estado).tone} /> },
          { key: "detalle", header: "Detalle", render: r => <Button variant="link" size="sm" onClick={() => setDetail(r)} aria-label={`Ver detalle de la marca de ${r.empleado_label}`}>Ver detalle</Button> },
        ]}
      />}
      <nav aria-label="Paginación de marcas" className="flex flex-wrap items-center gap-3 text-sm text-neutral-600">
        <Button variant="secondary" size="sm" disabled={loading || dirty || offset === 0} onClick={() => void load({ ...applied, offset: Math.max(0, offset - TAMANO_PAGINA_MARCAS) })}>Anterior</Button>
        <span className="tabular-nums">Página {Math.floor(offset / TAMANO_PAGINA_MARCAS) + 1}</span>
        <Button variant="secondary" size="sm" disabled={loading || dirty || rows.length < TAMANO_PAGINA_MARCAS} onClick={() => void load({ ...applied, offset: offset + TAMANO_PAGINA_MARCAS })}>Siguiente</Button>
      </nav>
    </>}
    {detail && <section className="flex flex-col gap-2 rounded-xl border border-neutral-200 bg-white p-4 shadow-xs" aria-labelledby="detalle-marca-titulo">
      <h2 id="detalle-marca-titulo" className="text-sm font-semibold text-neutral-900">Detalle de marca</h2>
      <p className="text-sm text-neutral-700">{detail.empleado_label} · Contrato {detail.contrato_numero}</p>
      <p className="text-sm text-neutral-700 tabular-nums">{tipoDe(detail.tipo)} · {fechaHora(detail.marcado_en)}</p>
      <div><StatusBadge label={estadoDe(detail.estado).label} tone={estadoDe(detail.estado).tone} /></div>
      <div><Button variant="secondary" size="sm" onClick={() => setDetail(null)}>Cerrar detalle</Button></div>
    </section>}
    <p className="text-sm text-neutral-500">Para reportar un error en una marca, escribe al correo corporativo de RRHH indicando código de empleado, fecha y hora. Nunca incluyas tu PIN.</p>
  </div>;
}
