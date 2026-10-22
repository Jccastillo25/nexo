import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { contextoActual } from "@nexo/auth";
import { Alert, ButtonLink, DataTable, NexoIcon, PageHeader, moneda } from "@nexo/ui";
import { AvisosPlanilla } from "@/components/planilla/avisos-planilla";
import { permisosDe } from "@/lib/permisos-rrhh";
import { AVISO_REGIMEN } from "@/lib/planilla/estados";
import { REGIMEN, REGIMEN_INSS, etiqueta, etiquetaIr } from "@/lib/planilla/etiquetas";
import { cantidadConUnidad, decimal, diasTexto, porcentajeExacto, tarifa } from "@/lib/planilla/formato";
import { RUTA, esUuid } from "@/lib/planilla/rutas";
import type { Linea, Renglon, TipoConcepto } from "@/lib/planilla/tipos";
import { ErrorDeCarga, SinAccesoPlanilla } from "../../../compartido";
import { detallePlanilla } from "../../../datos";
import { tituloPlanilla } from "../../encabezado";

export const metadata: Metadata = {
  title: "Detalle por persona · Planilla · RRHH",
};

const TITULO = "Detalle por persona";

/** Las cuatro tablas del renglón, en el orden de la colilla; los aportes y provisiones no salen en ella. */
const SECCIONES: { tipo: TipoConcepto; titulo: string; total: (r: Renglon) => number; etiquetaTotal: string }[] = [
  { tipo: "devengado", titulo: "Ingresos", total: (r) => r.devengado, etiquetaTotal: "Total de ingresos" },
  { tipo: "deduccion", titulo: "Deducciones", total: (r) => r.deducciones, etiquetaTotal: "Total de deducciones" },
  {
    tipo: "aporte_patronal",
    titulo: "Aportes patronales (no salen en la colilla)",
    total: (r) => r.aportes,
    etiquetaTotal: "Total de aportes patronales",
  },
  {
    tipo: "provision",
    titulo: "Provisiones (no salen en la colilla)",
    total: (r) => r.provisiones,
    etiquetaTotal: "Total de provisiones",
  },
];

/** Tasa de una línea: porcentaje si la unidad es porcentaje, factor si hay tasa, "—" si no hay. */
function textoTasa(l: Linea): string {
  if (l.tasa === null || l.tasa === undefined) return "—";
  return l.unidad === "porcentaje" ? porcentajeExacto(l.tasa) : `× ${decimal(l.tasa, 4)}`;
}

/**
 * Detalle de una persona en la planilla (B5, planilla.ver): salario, diario
 * (4 decimales), días pagados, avisos del renglón y sus líneas por tipo. Los
 * totales del pie son los campos del renglón (`devengado`, `deducciones`,
 * `aportes`, `provisiones`) que guardó la RPC: la vista no suma.
 */
export default async function PlanillaPersonaPage({ params }: PageProps<"/planillas/periodos/[id]/contratos/[contratoId]">) {
  const { id, contratoId } = await params;
  if (!esUuid(id) || !esUuid(contratoId)) notFound();

  const [ctx, permisos] = await Promise.all([contextoActual(), permisosDe()]);
  if (!permisos.planillaVer) {
    return <SinAccesoPlanilla titulo={TITULO} pantalla="a las planillas" permiso="Ver planillas" />;
  }

  const r = await detallePlanilla(ctx, id);
  if (r === "no-encontrada") notFound();
  if (!r.ok) {
    if (r.motivo === "denegado") return <SinAccesoPlanilla titulo={TITULO} pantalla="a las planillas" permiso="Ver planillas" />;
    if (r.motivo === "negocio") {
      return (
        <div className="flex max-w-6xl flex-col gap-6">
          <PageHeader title={TITULO} back={{ href: RUTA.detalle(id), label: "Planilla" }} />
          <Alert tone="warning">{r.mensaje}</Alert>
        </div>
      );
    }
    return <ErrorDeCarga titulo={TITULO} que="la planilla" />;
  }

  const { planilla: p } = r.valor;
  const renglon = r.valor.renglones.find((x) => x.contrato_id === contratoId);
  if (!renglon) notFound();

  const periodo = tituloPlanilla(p);
  const imprimible = p.estado === "aprobada" || p.estado === "pagada";
  const avisoRegimen = renglon.avisos.some((a) => a.toLowerCase().includes(AVISO_REGIMEN.toLowerCase()));

  return (
    <div className="flex max-w-6xl flex-col gap-6">
      <PageHeader
        title={renglon.empleado_nombre}
        description={`Contrato N.º ${renglon.numero_contrato} · ${etiqueta(REGIMEN, renglon.regimen)} · ${periodo}`}
        back={{ href: RUTA.detalle(p.id), label: periodo }}
        actions={
          imprimible ? (
            <ButtonLink
              href={RUTA.imprimir.colillas(p.id, renglon.contrato_id)}
              target="_blank"
              prefetch={false}
              variant="secondary"
              icon={<NexoIcon name="file" />}
            >
              Imprimir colilla
              <span className="sr-only"> (se abre en otra pestaña)</span>
            </ButtonLink>
          ) : null
        }
      />

      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 rounded-xl border border-neutral-200 bg-white px-5 py-4 text-sm shadow-xs sm:grid-cols-3 lg:grid-cols-6">
        <div className="flex flex-col gap-0.5">
          <dt className="text-neutral-500">Salario mensual</dt>
          <dd className="font-medium text-neutral-900 tabular-nums">{moneda(renglon.salario_mensual)}</dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className="text-neutral-500">Salario diario</dt>
          <dd className="font-medium text-neutral-900 tabular-nums">{tarifa(renglon.salario_diario)}</dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className="text-neutral-500">Días pagados</dt>
          <dd className="font-medium text-neutral-900 tabular-nums">{diasTexto(renglon.dias_pagados, 4)}</dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className="text-neutral-500">INSS</dt>
          <dd className="font-medium text-neutral-900">{etiqueta(REGIMEN_INSS, renglon.regimen_inss)}</dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className="text-neutral-500">IR</dt>
          <dd className="font-medium text-neutral-900">{etiquetaIr(renglon)}</dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className="text-neutral-500">Neto</dt>
          <dd className="font-semibold text-neutral-900 tabular-nums">{moneda(renglon.neto)}</dd>
        </div>
      </dl>

      {renglon.avisos.length > 0 ? (
        <div className="flex flex-col gap-2">
          <AvisosPlanilla avisos={renglon.avisos} titulo="Avisos de esta persona" />
          {avisoRegimen && permisos.regimenVer ? (
            <div>
              <ButtonLink href={RUTA.regimenContrato(renglon.contrato_id)} variant="secondary" size="sm">
                Revisar régimen
              </ButtonLink>
            </div>
          ) : null}
        </div>
      ) : null}

      {SECCIONES.map((s) => {
        const lineas = renglon.lineas
          .filter((l) => l.tipo === s.tipo)
          .sort((a, b) => a.orden - b.orden)
          .map((l, i) => ({ ...l, clave: `${s.tipo}-${i}` }));
        if (lineas.length === 0) return null;
        const idTitulo = `seccion-${s.tipo}`;
        return (
          <section key={s.tipo} aria-labelledby={idTitulo} className="flex flex-col gap-3">
            <h2 id={idTitulo} className="text-base font-semibold text-neutral-900">
              {s.titulo}
            </h2>
            <DataTable
              rows={lineas}
              rowKey={(l) => l.clave}
              caption={s.titulo}
              density="compact"
              columns={[
                {
                  key: "concepto",
                  header: "Concepto",
                  render: (l) => (
                    <span className="flex flex-col">
                      <span className="text-neutral-900">{l.concepto_nombre}</span>
                      {l.articulo ? <span className="text-xs text-neutral-500">{l.articulo}</span> : null}
                    </span>
                  ),
                },
                { key: "cantidad", header: "Cantidad", numeric: true, render: (l) => cantidadConUnidad(l.cantidad, l.unidad) },
                { key: "base", header: "Base", numeric: true, render: (l) => tarifa(l.base) },
                { key: "tasa", header: "Tasa", numeric: true, render: (l) => textoTasa(l) },
                { key: "monto", header: "Monto", numeric: true, render: (l) => moneda(l.monto) },
              ]}
              footer={
                <p className="flex items-center justify-between gap-3 text-sm">
                  <span className="font-medium text-neutral-700">{s.etiquetaTotal}</span>
                  <span className="font-semibold text-neutral-900 tabular-nums">{moneda(s.total(renglon))}</span>
                </p>
              }
            />
          </section>
        );
      })}
    </div>
  );
}
