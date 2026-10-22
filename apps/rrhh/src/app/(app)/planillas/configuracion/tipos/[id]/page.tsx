import type { Metadata } from "next";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { contextoActual } from "@nexo/auth";
import { FormSection, PageHeader, StatusBadge } from "@nexo/ui";
import { permisosDe } from "@/lib/permisos-rrhh";
import { RUTA, esUuid } from "@/lib/planilla/rutas";
import { CLASE_PLANILLA, FRECUENCIA, etiqueta } from "@/lib/planilla/etiquetas";
import { PaginaFallo, PaginaSinAcceso, type AccesoPantalla } from "../../_compartido/estados";
import { leerFila } from "../../_compartido/lectura";
import { TipoForm, type TipoEditable } from "../tipo-form";

export const metadata: Metadata = {
  title: "Tipo de planilla · RRHH",
};

const ACCESO: AccesoPantalla = {
  titulo: "Tipo de planilla",
  pantalla: "los tipos de planilla",
  permiso: "Ver conceptos de planilla",
};

function Dato({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="text-xs font-medium text-neutral-500">{label}</dt>
      <dd className="text-sm break-words text-neutral-900">{children}</dd>
    </div>
  );
}

/**
 * A9. Un tipo de planilla: formulario de edición con conceptos.gestionar;
 * ficha de solo lectura con conceptos.ver.
 */
export default async function TipoPage({ params }: PageProps<"/planillas/configuracion/tipos/[id]">) {
  const { id } = await params;
  if (!esUuid(id)) notFound();

  const [ctx, permisos] = await Promise.all([contextoActual(), permisosDe()]);
  if (!permisos.conceptosVer) return <PaginaSinAcceso {...ACCESO} />;

  const volver = { href: RUTA.tipos(), label: "Tipos de planilla" };
  const resultado = await leerFila<TipoEditable>(
    ctx.supabase
      .schema("rrhh")
      .from("planilla_tipos")
      .select("id, nombre, clase, frecuencia, centro_costo, activo")
      .eq("company_id", ctx.companyId)
      .eq("id", id)
      .maybeSingle(),
    "planilla_tipos: detalle",
    "No se pudo cargar el tipo de planilla. Intenta de nuevo."
  );
  if (!resultado.ok) return <PaginaFallo acceso={ACCESO} fallo={resultado} que="el tipo de planilla" back={volver} />;
  const t = resultado.valor;
  if (!t) notFound();

  const estado = <StatusBadge label={t.activo ? "Activo" : "Inactivo"} tone={t.activo ? "positive" : "neutral"} />;
  const descripcion = `${etiqueta(CLASE_PLANILLA, t.clase)} · ${etiqueta(FRECUENCIA, t.frecuencia)}`;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t.nombre} description={descripcion} back={volver} meta={estado} />
      {permisos.conceptosGestionar ? (
        <TipoForm tipo={t} />
      ) : (
        <FormSection title="Datos del tipo de planilla">
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Dato label="Clase">{etiqueta(CLASE_PLANILLA, t.clase)}</Dato>
            <Dato label="Frecuencia">{etiqueta(FRECUENCIA, t.frecuencia)}</Dato>
            <Dato label="Centro de costo">{t.centro_costo ?? "—"}</Dato>
            <Dato label="Estado">{t.activo ? "Activo" : "Inactivo"}</Dato>
          </dl>
        </FormSection>
      )}
    </div>
  );
}
