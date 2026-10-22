import type { Metadata } from "next";
import { contextoActual } from "@nexo/auth";
import { ButtonLink, DataTable, EmptyState, NexoIcon, PageHeader, StatusBadge } from "@nexo/ui";
import { permisosDe } from "@/lib/permisos-rrhh";
import { RUTA } from "@/lib/planilla/rutas";
import { METODO_CONCEPTO, TIPO_CONCEPTO, esClaveDe, etiqueta } from "@/lib/planilla/etiquetas";
import type { Concepto, TipoConcepto } from "@/lib/planilla/tipos";
import { PaginaFallo, PaginaSinAcceso, type AccesoPantalla } from "../_compartido/estados";
import { leerFilas, primero } from "../_compartido/lectura";
import { FiltrosConceptos } from "./filtros";

export const metadata: Metadata = {
  title: "Conceptos · RRHH",
};

const ACCESO: AccesoPantalla = {
  titulo: "Conceptos",
  pantalla: "los conceptos de planilla",
  permiso: "Ver conceptos de planilla",
};

type ConceptoFila = Pick<
  Concepto,
  | "id"
  | "codigo"
  | "nombre"
  | "tipo"
  | "metodo"
  | "afecta_inss"
  | "afecta_ir"
  | "afecta_inatec"
  | "cuenta_aguinaldo"
  | "cuenta_vacaciones"
  | "cuenta_indemnizacion"
  | "en_colilla"
  | "permite_novedad"
  | "es_sistema"
  | "orden"
  | "activo"
>;

function lista(partes: (string | false)[]): string {
  const xs = partes.filter((p): p is string => Boolean(p));
  return xs.length > 0 ? xs.join(", ") : "—";
}

const CANDADO = "Concepto legal: solo cambian el nombre, la colilla y la cuenta contable.";

/**
 * A8. Catálogo de conceptos de planilla (rrhh.conceptos, RLS conceptos.ver):
 * ingresos, deducciones, aportes y provisiones. Los del sistema llevan
 * candado: sus reglas no se editan; solo cambian el nombre, la colilla y la
 * cuenta contable. "Nuevo concepto" y la edición exigen conceptos.gestionar.
 */
export default async function ConceptosPage({ searchParams }: PageProps<"/planillas/configuracion/conceptos">) {
  const [ctx, permisos, params] = await Promise.all([contextoActual(), permisosDe(), searchParams]);
  if (!permisos.conceptosVer) return <PaginaSinAcceso {...ACCESO} />;

  const tipoParam = primero(params.tipo);
  const tipo: TipoConcepto | "" = esClaveDe(TIPO_CONCEPTO, tipoParam) ? tipoParam : "";
  const estadoParam = primero(params.estado);
  const estado = estadoParam === "activo" || estadoParam === "inactivo" ? estadoParam : "";

  let consulta = ctx.supabase
    .schema("rrhh")
    .from("conceptos")
    .select(
      "id, codigo, nombre, tipo, metodo, afecta_inss, afecta_ir, afecta_inatec, cuenta_aguinaldo, cuenta_vacaciones, cuenta_indemnizacion, en_colilla, permite_novedad, es_sistema, orden, activo"
    )
    .eq("company_id", ctx.companyId);
  if (tipo) consulta = consulta.eq("tipo", tipo);
  if (estado) consulta = consulta.eq("activo", estado === "activo");

  const resultado = await leerFilas<ConceptoFila>(
    consulta.order("orden").order("codigo"),
    "conceptos: listado",
    "No se pudieron cargar los conceptos. Intenta de nuevo."
  );
  if (!resultado.ok) return <PaginaFallo acceso={ACCESO} fallo={resultado} que="los conceptos" />;

  const puedeGestionar = permisos.conceptosGestionar;
  const nuevo = puedeGestionar ? (
    <ButtonLink href={RUTA.conceptoNuevo()} icon={<NexoIcon name="plus" />}>
      Nuevo concepto
    </ButtonLink>
  ) : null;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Conceptos"
        description="Ingresos, deducciones, aportes y provisiones de la planilla. Un concepto ya usado en una planilla aprobada no cambia en ella: las líneas guardan una copia de sus reglas."
        actions={nuevo}
      />

      <DataTable
        rows={resultado.valor}
        rowKey={(c) => c.id}
        rowHref={(c) => RUTA.concepto(c.id)}
        caption="Conceptos de planilla"
        toolbar={<FiltrosConceptos tipo={tipo} estado={estado} />}
        empty={
          tipo || estado ? (
            <EmptyState
              bare
              variant="no-results"
              title="No hay conceptos con estos filtros"
              action={
                <ButtonLink href={RUTA.conceptos()} variant="secondary">
                  Quitar filtros
                </ButtonLink>
              }
            />
          ) : (
            <EmptyState
              bare
              title="Todavía no hay conceptos"
              description="Los conceptos legales se cargan con la puesta en marcha de Planilla. Crea aquí los propios de la empresa."
              action={nuevo}
            />
          )
        }
        columns={[
          {
            key: "codigo",
            header: "Código",
            render: (c) => <span className="break-all">{c.codigo}</span>,
          },
          { key: "nombre", header: "Nombre", render: (c) => c.nombre },
          { key: "tipo", header: "Tipo", render: (c) => etiqueta(TIPO_CONCEPTO, c.tipo) },
          { key: "metodo", header: "Método", render: (c) => etiqueta(METODO_CONCEPTO, c.metodo) },
          {
            key: "afecta",
            header: "Afecta",
            render: (c) => lista([c.afecta_inss && "INSS", c.afecta_ir && "IR", c.afecta_inatec && "INATEC"]),
          },
          {
            key: "cuenta",
            header: "Cuenta para",
            render: (c) =>
              lista([
                c.cuenta_aguinaldo && "Aguinaldo",
                c.cuenta_vacaciones && "Vacaciones",
                c.cuenta_indemnizacion && "Indemnización",
              ]),
          },
          { key: "colilla", header: "En colilla", render: (c) => (c.en_colilla ? "Sí" : "No") },
          { key: "novedad", header: "Admite novedades", render: (c) => (c.permite_novedad ? "Sí" : "No") },
          { key: "orden", header: "Orden", numeric: true, render: (c) => c.orden },
          {
            key: "estado",
            header: "Estado",
            render: (c) => <StatusBadge label={c.activo ? "Activo" : "Inactivo"} tone={c.activo ? "positive" : "neutral"} />,
          },
          {
            key: "sistema",
            header: <span className="sr-only">Concepto legal</span>,
            width: "3rem",
            render: (c) =>
              c.es_sistema ? (
                <span title={CANDADO} className="inline-flex text-neutral-500">
                  <NexoIcon name="lock" className="size-4" />
                  <span className="sr-only">{CANDADO}</span>
                </span>
              ) : null,
          },
        ]}
      />
    </div>
  );
}
