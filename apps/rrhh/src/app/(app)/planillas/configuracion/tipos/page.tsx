import type { Metadata } from "next";
import { contextoActual } from "@nexo/auth";
import { ButtonLink, DataTable, EmptyState, NexoIcon, PageHeader, StatusBadge } from "@nexo/ui";
import { permisosDe } from "@/lib/permisos-rrhh";
import { RUTA } from "@/lib/planilla/rutas";
import { CLASE_PLANILLA, FRECUENCIA, etiqueta } from "@/lib/planilla/etiquetas";
import { PaginaFallo, PaginaSinAcceso, type AccesoPantalla } from "../_compartido/estados";
import { leerFilas } from "../_compartido/lectura";
import type { TipoEditable } from "./tipo-form";

export const metadata: Metadata = {
  title: "Tipos de planilla · RRHH",
};

const ACCESO: AccesoPantalla = {
  titulo: "Tipos de planilla",
  pantalla: "los tipos de planilla",
  permiso: "Ver conceptos de planilla",
};

/**
 * A9. Tipos de planilla de la empresa (rrhh.planilla_tipos, RLS
 * conceptos.ver): ordinarias por frecuencia y la de aguinaldo. Crear y editar
 * exigen conceptos.gestionar.
 */
export default async function TiposPage() {
  const [ctx, permisos] = await Promise.all([contextoActual(), permisosDe()]);
  if (!permisos.conceptosVer) return <PaginaSinAcceso {...ACCESO} />;

  const resultado = await leerFilas<TipoEditable>(
    ctx.supabase
      .schema("rrhh")
      .from("planilla_tipos")
      .select("id, nombre, clase, frecuencia, centro_costo, activo")
      .eq("company_id", ctx.companyId)
      .order("clase")
      .order("nombre"),
    "planilla_tipos: listado",
    "No se pudieron cargar los tipos de planilla. Intenta de nuevo."
  );
  if (!resultado.ok) return <PaginaFallo acceso={ACCESO} fallo={resultado} que="los tipos de planilla" />;

  const nuevo = permisos.conceptosGestionar ? (
    <ButtonLink href={RUTA.tipoNuevo()} icon={<NexoIcon name="plus" />}>
      Nuevo tipo de planilla
    </ButtonLink>
  ) : null;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Tipos de planilla"
        description="Solo puede haber un tipo activo por clase y frecuencia: un contrato entra en la planilla ordinaria de su misma frecuencia de pago."
        actions={nuevo}
      />
      <DataTable
        rows={resultado.valor}
        rowKey={(t) => t.id}
        rowHref={(t) => RUTA.tipo(t.id)}
        caption="Tipos de planilla de la empresa"
        empty={
          <EmptyState
            bare
            title="Todavía no hay tipos de planilla"
            description="Crea al menos la planilla ordinaria de la frecuencia de pago de los contratos."
            action={nuevo}
          />
        }
        columns={[
          { key: "nombre", header: "Nombre", render: (t) => t.nombre },
          { key: "clase", header: "Clase", render: (t) => etiqueta(CLASE_PLANILLA, t.clase) },
          { key: "frecuencia", header: "Frecuencia", render: (t) => etiqueta(FRECUENCIA, t.frecuencia) },
          { key: "centro", header: "Centro de costo", render: (t) => t.centro_costo ?? "—" },
          {
            key: "estado",
            header: "Estado",
            render: (t) => <StatusBadge label={t.activo ? "Activo" : "Inactivo"} tone={t.activo ? "positive" : "neutral"} />,
          },
        ]}
      />
    </div>
  );
}
