import type { Metadata } from "next";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { contextoActual } from "@nexo/auth";
import { Alert, FormSection, NexoIcon, PageHeader, StatusBadge } from "@nexo/ui";
import { permisosDe } from "@/lib/permisos-rrhh";
import { RUTA, esUuid } from "@/lib/planilla/rutas";
import { METODO_CONCEPTO, TIPO_CONCEPTO, etiqueta } from "@/lib/planilla/etiquetas";
import type { Concepto } from "@/lib/planilla/tipos";
import { PaginaFallo, PaginaSinAcceso, type AccesoPantalla } from "../../_compartido/estados";
import { leerFila } from "../../_compartido/lectura";
import { ConceptoForm, type ConceptoEditable } from "../concepto-form";

export const metadata: Metadata = {
  title: "Concepto · RRHH",
};

const ACCESO: AccesoPantalla = {
  titulo: "Concepto",
  pantalla: "los conceptos de planilla",
  permiso: "Ver conceptos de planilla",
};

type ConceptoDetalle = ConceptoEditable & Pick<Concepto, "es_sistema" | "articulo">;

function Dato({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="text-xs font-medium text-neutral-500">{label}</dt>
      <dd className="text-sm break-words text-neutral-900">{children}</dd>
    </div>
  );
}

function siNo(v: boolean): string {
  return v ? "Sí" : "No";
}

function lista(partes: (string | false)[]): string {
  const xs = partes.filter((p): p is string => Boolean(p));
  return xs.length > 0 ? xs.join(", ") : "Ninguno";
}

/** Texto del candado de un concepto legal (también en el listado). */
const SOLO_CAMBIAN = "Concepto legal: solo cambian el nombre, la colilla y la cuenta contable.";

/**
 * Datos del concepto en solo lectura. Con `soloFijos` (concepto del sistema
 * con el formulario reducido arriba) se omiten el nombre, la colilla y la
 * cuenta contable, que ya están en el formulario.
 */
function DatosConcepto({ c, soloFijos = false }: { c: ConceptoDetalle; soloFijos?: boolean }) {
  return (
    <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <Dato label="Tipo">{etiqueta(TIPO_CONCEPTO, c.tipo)}</Dato>
      <Dato label="Método">{etiqueta(METODO_CONCEPTO, c.metodo)}</Dato>
      <Dato label="Afecta">{lista([c.afecta_inss && "INSS", c.afecta_ir && "IR", c.afecta_inatec && "INATEC"])}</Dato>
      <Dato label="Cuenta para">
        {lista([c.cuenta_aguinaldo && "Aguinaldo", c.cuenta_vacaciones && "Vacaciones", c.cuenta_indemnizacion && "Indemnización"])}
      </Dato>
      {soloFijos ? null : <Dato label="En colilla">{siNo(c.en_colilla)}</Dato>}
      <Dato label="Admite novedades">{siNo(c.permite_novedad)}</Dato>
      <Dato label="Orden">
        <span className="tabular-nums">{c.orden}</span>
      </Dato>
      {soloFijos ? <Dato label="Estado">{c.activo ? "Activo" : "Inactivo"}</Dato> : null}
      {soloFijos ? null : <Dato label="Cuenta contable">{c.cuenta_contable ?? "—"}</Dato>}
    </dl>
  );
}

/**
 * A8. Un concepto:
 * - propio, con conceptos.gestionar: formulario de edición completo;
 * - del sistema, con conceptos.gestionar: candado, aviso y formulario
 *   reducido (nombre, colilla y cuenta contable; el resto se reenvía sin
 *   cambios), más las reglas fijas en solo lectura;
 * - sin conceptos.gestionar: ficha de solo lectura.
 */
export default async function ConceptoPage({ params }: PageProps<"/planillas/configuracion/conceptos/[id]">) {
  const { id } = await params;
  if (!esUuid(id)) notFound();

  const [ctx, permisos] = await Promise.all([contextoActual(), permisosDe()]);
  if (!permisos.conceptosVer) return <PaginaSinAcceso {...ACCESO} />;

  const volver = { href: RUTA.conceptos(), label: "Conceptos" };
  const resultado = await leerFila<ConceptoDetalle>(
    ctx.supabase
      .schema("rrhh")
      .from("conceptos")
      .select(
        "id, codigo, nombre, tipo, metodo, afecta_inss, afecta_ir, afecta_inatec, cuenta_aguinaldo, cuenta_vacaciones, cuenta_indemnizacion, en_colilla, permite_novedad, orden, cuenta_contable, activo, es_sistema, articulo"
      )
      .eq("company_id", ctx.companyId)
      .eq("id", id)
      .maybeSingle(),
    "conceptos: detalle",
    "No se pudo cargar el concepto. Intenta de nuevo."
  );
  if (!resultado.ok) return <PaginaFallo acceso={ACCESO} fallo={resultado} que="el concepto" back={volver} />;
  const c = resultado.valor;
  if (!c) notFound();

  const gestionar = permisos.conceptosGestionar;
  const estado = <StatusBadge label={c.activo ? "Activo" : "Inactivo"} tone={c.activo ? "positive" : "neutral"} />;
  const copia = (
    <p className="text-xs text-neutral-500">
      Un concepto ya usado en una planilla aprobada no cambia en ella: las líneas guardan una copia de sus reglas.
    </p>
  );

  if (gestionar && !c.es_sistema) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title={c.nombre} description={`Código ${c.codigo}`} back={volver} meta={estado} />
        <ConceptoForm concepto={c} />
      </div>
    );
  }

  const encabezado = (
    <PageHeader
      title={c.nombre}
      description={`Código ${c.codigo}`}
      back={volver}
      meta={
        <>
          {estado}
          {c.es_sistema ? <StatusBadge label="Concepto legal" tone="info" /> : null}
        </>
      }
    />
  );
  const avisoLegal = c.es_sistema ? (
    <Alert tone="info" icon={<NexoIcon name="lock" className="size-5" />} title={SOLO_CAMBIAN}>
      Lo calcula el motor de planilla según la ley{c.articulo ? ` (${c.articulo})` : ""}.
    </Alert>
  ) : null;

  if (gestionar && c.es_sistema) {
    return (
      <div className="flex flex-col gap-6">
        {encabezado}
        {avisoLegal}
        <ConceptoForm concepto={c} sistema />
        <FormSection title="Datos fijos" description="Los fija la ley o el motor de planilla: no cambian en un concepto legal.">
          <DatosConcepto c={c} soloFijos />
          {copia}
        </FormSection>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {encabezado}
      {avisoLegal}
      <FormSection title="Datos del concepto">
        <DatosConcepto c={c} />
        {copia}
      </FormSection>
    </div>
  );
}
