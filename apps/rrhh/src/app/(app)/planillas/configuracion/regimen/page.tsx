import type { Metadata } from "next";
import { contextoActual } from "@nexo/auth";
import { Alert, ButtonLink, DataTable, EmptyState, PageHeader, StatusBadge, fechaCorta } from "@nexo/ui";
import { permisosDe } from "@/lib/permisos-rrhh";
import { ESTADO_CONTRATO } from "@/lib/contratos";
import { consultarRpc } from "@/lib/planilla/servidor";
import { RUTA } from "@/lib/planilla/rutas";
import { AVISO_REGIMEN, NO_ASESORIA, estadoVisual } from "@/lib/planilla/estados";
import { REGIMEN, REGIMEN_INSS, etiqueta, etiquetaIr, etiquetaPrestaciones } from "@/lib/planilla/etiquetas";
import type { RegimenFila } from "@/lib/planilla/tipos";
import { PaginaFallo, PaginaSinAcceso, type AccesoPantalla } from "../_compartido/estados";
import { primero } from "../_compartido/lectura";
import { FiltrosRegimen, type FiltroRegimen } from "./filtros";

export const metadata: Metadata = {
  title: "Régimen por contrato · RRHH",
};

const ACCESO: AccesoPantalla = {
  titulo: "Régimen por contrato",
  pantalla: "el régimen por contrato",
  permiso: "Ver régimen de contratación",
};

function leerRegimen(valor: string | undefined): FiltroRegimen | "" {
  return valor === "laboral" || valor === "servicios_profesionales" || valor === "sin" ? valor : "";
}

/** ¿El contrato tiene un aviso de régimen vigente sin descartar? */
function conAviso(f: RegimenFila): boolean {
  return f.tiene_aviso && !f.aviso_descartado_en;
}

/**
 * A1. Régimen de contratación de cada contrato (laboral o servicios
 * profesionales, con vigencia), desde `planilla_regimen_listado`
 * (regimen.ver). Filtros en la URL, aplicados en el servidor. Toda la fila
 * abre la ficha del contrato, donde están las acciones (cambiar, descartar
 * aviso, fijar antigüedad).
 */
export default async function RegimenPage({ searchParams }: PageProps<"/planillas/configuracion/regimen">) {
  const [ctx, permisos, params] = await Promise.all([contextoActual(), permisosDe(), searchParams]);
  if (!permisos.regimenVer) return <PaginaSinAcceso {...ACCESO} />;

  const resultado = await consultarRpc<RegimenFila[]>(
    ctx,
    "planilla_regimen_listado",
    {},
    "planilla_regimen_listado",
    "No se pudo cargar el régimen de los contratos. Intenta de nuevo."
  );
  if (!resultado.ok) {
    return <PaginaFallo acceso={ACCESO} fallo={resultado} que="el régimen de los contratos" />;
  }

  const soloAviso = primero(params.aviso) === "1";
  const regimen = leerRegimen(primero(params.regimen));
  const incluirFinalizados = primero(params.estado) === "todos";
  const hayFiltros = soloAviso || regimen !== "" || incluirFinalizados;

  const filas = Array.isArray(resultado.valor) ? resultado.valor : [];
  const visibles = filas.filter(
    (f) =>
      (incluirFinalizados || f.estado_contrato !== "finalizado") &&
      (!soloAviso || conAviso(f)) &&
      (regimen === "" || (regimen === "sin" ? f.regimen_id === null : f.regimen === regimen))
  );
  const activosSinRegimen = filas.filter((f) => f.estado_contrato === "activo" && f.regimen_id === null).length;
  const conAvisoTotal = filas.filter(conAviso).length;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Régimen por contrato"
        description="Si cada contrato es laboral o de servicios profesionales, desde cuándo y con qué deducciones y prestaciones."
      />

      <Alert tone="info">{NO_ASESORIA}</Alert>

      {activosSinRegimen > 0 ? (
        <Alert
          tone="warning"
          title={
            activosSinRegimen === 1
              ? "1 contrato activo no tiene régimen."
              : `${activosSinRegimen} contratos activos no tienen régimen.`
          }
          action={
            regimen !== "sin" ? (
              <ButtonLink href={RUTA.regimen({ regimen: "sin" })} variant="secondary" size="sm">
                Ver contratos sin régimen
              </ButtonLink>
            ) : null
          }
        >
          La planilla no se puede calcular hasta asignarlo. Abre el contrato y usa «Asignar régimen».
        </Alert>
      ) : null}

      {conAvisoTotal > 0 && !soloAviso ? (
        <Alert
          tone="warning"
          title={
            conAvisoTotal === 1 ? "1 contrato con aviso de régimen" : `${conAvisoTotal} contratos con aviso de régimen`
          }
          action={
            <ButtonLink href={RUTA.regimen({ aviso: true })} variant="secondary" size="sm">
              Ver contratos con aviso
            </ButtonLink>
          }
        >
          {AVISO_REGIMEN}: son de servicios profesionales y tienen jornada asignada o marcas en el kiosco.
        </Alert>
      ) : null}

      <DataTable
        rows={visibles}
        rowKey={(f) => f.contrato_id}
        rowHref={(f) => RUTA.regimenContrato(f.contrato_id)}
        caption="Régimen de contratación de cada contrato"
        toolbar={<FiltrosRegimen aviso={soloAviso} regimen={regimen} incluirFinalizados={incluirFinalizados} />}
        empty={
          hayFiltros && filas.length > 0 ? (
            <EmptyState
              bare
              variant="no-results"
              title="No hay contratos con estos filtros"
              action={
                <ButtonLink href={RUTA.regimen()} variant="secondary">
                  Quitar filtros
                </ButtonLink>
              }
            />
          ) : filas.length > 0 ? (
            <EmptyState
              bare
              variant="no-results"
              title="No hay contratos activos ni en borrador"
              description="Marca «Incluir finalizados» para ver los contratos que ya terminaron."
            />
          ) : (
            <EmptyState
              bare
              title="Todavía no hay contratos"
              description="El régimen se asigna a cada contrato. Crea los contratos en Contratación → Contratos."
              action={
                permisos.contratosVer ? (
                  <ButtonLink href="/contratacion/contratos" variant="secondary">
                    Ir a Contratos
                  </ButtonLink>
                ) : null
              }
            />
          )
        }
        columns={[
          {
            key: "persona",
            header: "Persona",
            render: (f) => (
              <span className="flex min-w-0 flex-col">
                <span>{f.empleado_nombre}</span>
                <span className="text-xs font-normal text-neutral-500 tabular-nums">N.º {f.numero_contrato}</span>
              </span>
            ),
          },
          {
            key: "contrato",
            header: "Contrato",
            render: (f) => {
              const e = estadoVisual(ESTADO_CONTRATO, f.estado_contrato);
              return <StatusBadge label={e.label} tone={e.tone} />;
            },
          },
          {
            key: "regimen",
            header: "Régimen",
            render: (f) =>
              f.regimen_id === null || f.regimen === null ? (
                <StatusBadge label="Sin régimen" tone="negative" />
              ) : (
                etiqueta(REGIMEN, f.regimen)
              ),
          },
          { key: "inss", header: "INSS", render: (f) => etiqueta(REGIMEN_INSS, f.regimen_inss) },
          { key: "ir", header: "IR", render: (f) => etiquetaIr(f) },
          { key: "prestaciones", header: "Prestaciones", render: (f) => etiquetaPrestaciones(f) },
          {
            key: "vigente",
            header: "Vigente desde",
            render: (f) => <span className="tabular-nums">{fechaCorta(f.vigente_desde)}</span>,
          },
          {
            key: "antiguedad",
            header: "Antigüedad desde",
            render: (f) => (
              <span className="tabular-nums">
                {fechaCorta(f.fecha_antiguedad ?? f.fecha_inicio)}
                {f.fecha_antiguedad && f.fecha_inicio && f.fecha_antiguedad !== f.fecha_inicio ? (
                  <span className="ml-1 text-xs text-neutral-500">(fijada)</span>
                ) : null}
              </span>
            ),
          },
          {
            key: "aviso",
            header: "Aviso",
            render: (f) =>
              conAviso(f) ? (
                <StatusBadge label={AVISO_REGIMEN} tone="warning" />
              ) : f.aviso_descartado_en ? (
                <StatusBadge label={`Aviso descartado el ${fechaCorta(f.aviso_descartado_en)}`} tone="neutral" />
              ) : (
                "—"
              ),
          },
        ]}
      />
    </div>
  );
}
