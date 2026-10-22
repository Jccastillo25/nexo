import type { Metadata } from "next";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { contextoActual } from "@nexo/auth";
import { Alert, DataTable, EmptyState, PageHeader, StatusBadge, fechaCorta, fechaHora } from "@nexo/ui";
import { permisosDe } from "@/lib/permisos-rrhh";
import { ESTADO_CONTRATO } from "@/lib/contratos";
import { consultarRpc } from "@/lib/planilla/servidor";
import { RUTA, esUuid } from "@/lib/planilla/rutas";
import { AVISO_REGIMEN, NO_ASESORIA, estadoVisual } from "@/lib/planilla/estados";
import { REGIMEN, REGIMEN_INSS, etiqueta, etiquetaIr, etiquetaPrestaciones } from "@/lib/planilla/etiquetas";
import type { ContratoRegimen, RegimenFila } from "@/lib/planilla/tipos";
import { BloqueFallo, PaginaFallo, PaginaSinAcceso, type AccesoPantalla } from "../../_compartido/estados";
import { leerFilas } from "../../_compartido/lectura";
import { RegimenFicha, type RegimenActual } from "./regimen-ficha";

export const metadata: Metadata = {
  title: "Régimen del contrato · RRHH",
};

const ACCESO: AccesoPantalla = {
  titulo: "Régimen del contrato",
  pantalla: "el régimen por contrato",
  permiso: "Ver régimen de contratación",
};

type HistorialFila = Pick<
  ContratoRegimen,
  | "id"
  | "regimen"
  | "regimen_inss"
  | "metodo_ir"
  | "porcentaje_ir"
  | "paga_vacaciones"
  | "paga_aguinaldo"
  | "paga_indemnizacion"
  | "vigente_desde"
  | "vigente_hasta"
  | "motivo"
  | "aviso_descartado_en"
  | "aviso_motivo"
>;

function Dato({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="text-xs font-medium text-neutral-500">{label}</dt>
      <dd className="text-sm text-neutral-900">{children}</dd>
    </div>
  );
}

/**
 * A2. Ficha de régimen de un contrato: régimen vigente (fila de
 * planilla_regimen_listado), historial (rrhh.contrato_regimen, RLS
 * regimen.ver) y las acciones según el permiso: cambiar o asignar régimen y
 * descartar el aviso (regimen.cambiar), fijar la antigüedad
 * (liquidaciones.aprobar). Un gestor o una consulta ven la ficha sin botones.
 */
export default async function FichaRegimenPage({ params }: PageProps<"/planillas/configuracion/regimen/[contratoId]">) {
  const { contratoId } = await params;
  if (!esUuid(contratoId)) notFound();

  const [ctx, permisos] = await Promise.all([contextoActual(), permisosDe()]);
  if (!permisos.regimenVer) return <PaginaSinAcceso {...ACCESO} />;

  const [listado, historial] = await Promise.all([
    consultarRpc<RegimenFila[]>(
      ctx,
      "planilla_regimen_listado",
      {},
      "planilla_regimen_listado",
      "No se pudo cargar el régimen del contrato. Intenta de nuevo."
    ),
    leerFilas<HistorialFila>(
      ctx.supabase
        .schema("rrhh")
        .from("contrato_regimen")
        .select(
          "id, regimen, regimen_inss, metodo_ir, porcentaje_ir, paga_vacaciones, paga_aguinaldo, paga_indemnizacion, vigente_desde, vigente_hasta, motivo, aviso_descartado_en, aviso_motivo"
        )
        .eq("company_id", ctx.companyId)
        .eq("contrato_id", contratoId)
        .order("vigente_desde", { ascending: false }),
      "contrato_regimen: historial"
    ),
  ]);

  const volver = { href: RUTA.regimen(), label: "Régimen por contrato" };
  if (!listado.ok) {
    return <PaginaFallo acceso={ACCESO} fallo={listado} que="el régimen del contrato" back={volver} />;
  }
  const fila = (Array.isArray(listado.valor) ? listado.valor : []).find((f) => f.contrato_id === contratoId);
  if (!fila) notFound();

  const sinRegimen = fila.regimen_id === null || fila.regimen === null;
  const avisoVigente = fila.tiene_aviso && !fila.aviso_descartado_en;
  const estado = estadoVisual(ESTADO_CONTRATO, fila.estado_contrato);
  const antiguedadFijada =
    fila.fecha_antiguedad !== null && fila.fecha_inicio !== null && fila.fecha_antiguedad !== fila.fecha_inicio;

  const actual: RegimenActual = {
    contratoId: fila.contrato_id,
    estadoContrato: fila.estado_contrato,
    fechaInicio: fila.fecha_inicio,
    fechaAntiguedad: fila.fecha_antiguedad,
    regimen: sinRegimen ? null : fila.regimen,
    regimenInss: fila.regimen_inss,
    metodoIr: fila.metodo_ir,
    porcentajeIr: fila.porcentaje_ir,
    pagaVacaciones: fila.paga_vacaciones,
    pagaAguinaldo: fila.paga_aguinaldo,
    pagaIndemnizacion: fila.paga_indemnizacion,
    tieneAviso: avisoVigente,
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={fila.empleado_nombre}
        description={`Contrato N.º ${fila.numero_contrato} · ${estado.label} · Inicio ${fechaCorta(fila.fecha_inicio)}`}
        back={volver}
        meta={
          sinRegimen ? (
            <StatusBadge label="Sin régimen" tone="negative" />
          ) : (
            <StatusBadge label={etiqueta(REGIMEN, fila.regimen)} tone="info" />
          )
        }
      />

      <Alert tone="info">{NO_ASESORIA}</Alert>

      {sinRegimen ? (
        <Alert tone="warning" title="Este contrato no tiene régimen">
          La planilla no se puede calcular hasta asignarlo.
        </Alert>
      ) : null}
      {avisoVigente ? (
        <Alert tone="warning" title={AVISO_REGIMEN}>
          Es un contrato de servicios profesionales con jornada asignada o marcas en el kiosco. Revisa con el contador si
          corresponde el régimen laboral.
        </Alert>
      ) : null}

      <RegimenFicha
        actual={actual}
        puedeCambiar={permisos.regimenCambiar}
        puedeFijarAntiguedad={permisos.liquidacionesAprobar}
      />

      <section
        aria-labelledby="regimen-vigente"
        className="flex flex-col gap-4 rounded-xl border border-neutral-200 bg-white p-5 shadow-xs"
      >
        <h2 id="regimen-vigente" className="text-sm font-semibold text-neutral-900">
          Régimen vigente
        </h2>
        {sinRegimen ? (
          <p className="text-sm text-neutral-500">Sin régimen asignado.</p>
        ) : (
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Dato label="Régimen">{etiqueta(REGIMEN, fila.regimen)}</Dato>
            <Dato label="INSS">{etiqueta(REGIMEN_INSS, fila.regimen_inss)}</Dato>
            <Dato label="IR">{etiquetaIr(fila)}</Dato>
            <Dato label="Prestaciones">{etiquetaPrestaciones(fila)}</Dato>
            <Dato label="Vigente desde">
              <span className="tabular-nums">{fechaCorta(fila.vigente_desde)}</span>
            </Dato>
            <Dato label="Motivo">{fila.motivo ?? "—"}</Dato>
          </dl>
        )}
        <dl className="grid grid-cols-1 gap-4 border-t border-neutral-100 pt-4 sm:grid-cols-2 lg:grid-cols-3">
          <Dato label="Antigüedad desde">
            <span className="tabular-nums">{fechaCorta(fila.fecha_antiguedad ?? fila.fecha_inicio)}</span>{" "}
            <span className="text-xs text-neutral-500">
              {antiguedadFijada ? "(fijada)" : "(inicio del contrato)"}
            </span>
          </Dato>
          <Dato label="Aviso de régimen">
            {avisoVigente
              ? AVISO_REGIMEN
              : fila.aviso_descartado_en
                ? `Descartado el ${fechaHora(fila.aviso_descartado_en)}`
                : "Sin aviso"}
          </Dato>
        </dl>
      </section>

      <section aria-labelledby="historial-regimen" className="flex flex-col gap-3">
        <h2 id="historial-regimen" className="text-base font-semibold text-neutral-900">
          Historial
        </h2>
        <DataTable
          rows={historial.ok ? historial.valor : []}
          rowKey={(h) => h.id}
          caption="Historial de régimen del contrato"
          density="compact"
          error={
            historial.ok ? undefined : (
              <BloqueFallo
                fallo={historial}
                que="el historial de régimen"
                acceso={{ pantalla: "el historial de régimen", permiso: ACCESO.permiso }}
              />
            )
          }
          empty={<EmptyState bare title="Sin vigencias de régimen" description="Todavía no se asignó un régimen a este contrato." />}
          columns={[
            {
              key: "desde",
              header: "Vigente desde",
              render: (h) => <span className="tabular-nums">{fechaCorta(h.vigente_desde)}</span>,
            },
            {
              key: "hasta",
              header: "Hasta",
              render: (h) =>
                h.vigente_hasta ? <span className="tabular-nums">{fechaCorta(h.vigente_hasta)}</span> : "Vigente",
            },
            { key: "regimen", header: "Régimen", render: (h) => etiqueta(REGIMEN, h.regimen) },
            { key: "inss", header: "INSS", render: (h) => etiqueta(REGIMEN_INSS, h.regimen_inss) },
            { key: "ir", header: "IR", render: (h) => etiquetaIr(h) },
            { key: "prestaciones", header: "Prestaciones", render: (h) => etiquetaPrestaciones(h) },
            { key: "motivo", header: "Motivo", width: "16rem", render: (h) => <span className="break-words">{h.motivo}</span> },
            {
              key: "aviso",
              header: "Aviso descartado",
              width: "14rem",
              render: (h) =>
                h.aviso_descartado_en ? (
                  <span className="flex flex-col">
                    <span className="tabular-nums">{fechaHora(h.aviso_descartado_en)}</span>
                    {h.aviso_motivo ? <span className="text-xs text-neutral-500">{h.aviso_motivo}</span> : null}
                  </span>
                ) : (
                  "—"
                ),
            },
          ]}
        />
      </section>
    </div>
  );
}
