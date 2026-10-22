import type { Metadata } from "next";
import { contextoActual } from "@nexo/auth";
import { Alert, ButtonLink, EmptyState, PageHeader, fechaHora } from "@nexo/ui";
import { hoyManagua } from "@/lib/fecha-managua";
import { permisosDe } from "@/lib/permisos-rrhh";
import { periodoSiguiente } from "@/lib/planilla/periodos";
import { RUTA, esUuid } from "@/lib/planilla/rutas";
import type { PlanillaFila } from "@/lib/planilla/tipos";
import { ErrorDeCarga, SinAccesoPlanilla } from "../compartido";
import { conteoDe, filasDe, tablasRrhh, tiposDePlanilla, ultimoPeriodoDelTipo } from "../datos";
import { NuevaPlanillaForm, type TipoOpcion } from "./nueva-planilla-form";

export const metadata: Metadata = {
  title: "Nueva planilla · RRHH",
};

const TITULO = "Nueva planilla";

type Anulada = Pick<PlanillaFila, "id" | "planilla_tipo_id" | "periodo_inicio" | "periodo_fin" | "estado" | "anulada_en" | "motivo_anulacion">;

/**
 * Nueva planilla (B3, planilla.generar). El formulario solo deja enviar
 * períodos válidos para la frecuencia del tipo (quincena, mes, semana de 7
 * días o año del aguinaldo); el valor propuesto es el período que sigue a la
 * última planilla no anulada de ese tipo, o el que contiene hoy. La RPC
 * `planilla_crear` vuelve a validar todo (período, duplicados, reemplazo).
 *
 * Modo reemplazo (`?reemplaza=<id>`): solo una planilla anulada que todavía
 * no tenga reemplazo y cuyo tipo siga activo (si no, un aviso en lugar del
 * formulario); bloquea tipo y período.
 *
 * Los tipos se leen de `rrhh.planilla_tipos`, que exige conceptos.ver.
 */
export default async function NuevaPlanillaPage({ searchParams }: PageProps<"/planillas/periodos/nueva">) {
  const [ctx, permisos, sp] = await Promise.all([contextoActual(), permisosDe(), searchParams]);
  if (!permisos.planillaGenerar) {
    return <SinAccesoPlanilla titulo={TITULO} pantalla="a crear planillas" permiso="Generar planillas" />;
  }

  const volver = { href: RUTA.periodos(), label: "Planillas" };

  if (!permisos.conceptosVer) {
    return (
      <div className="flex max-w-6xl flex-col gap-6">
        <PageHeader title={TITULO} back={volver} />
        <Alert tone="warning" title="No puedes elegir el tipo de planilla">
          Tu rol no permite ver los tipos de planilla. Pide el permiso «Ver conceptos de planilla».
        </Alert>
      </div>
    );
  }

  const reemplazaParam = Array.isArray(sp.reemplaza) ? sp.reemplaza[0] : sp.reemplaza;
  const reemplazaId = esUuid(reemplazaParam) ? reemplazaParam : null;
  const db = tablasRrhh(ctx);

  const [tipos, anuladaRes, reemplazosRes] = await Promise.all([
    tiposDePlanilla(ctx),
    reemplazaId
      ? db
          .from("planillas")
          .select("id, planilla_tipo_id, periodo_inicio, periodo_fin, estado, anulada_en, motivo_anulacion")
          .eq("company_id", ctx.companyId)
          .eq("id", reemplazaId)
          .limit(1)
      : Promise.resolve(null),
    reemplazaId
      ? db
          .from("planillas")
          .select("id", { count: "exact", head: true })
          .eq("company_id", ctx.companyId)
          .eq("reemplaza_a", reemplazaId)
      : Promise.resolve(null),
  ]);

  if (!tipos.ok) return <ErrorDeCarga titulo={TITULO} que="los tipos de planilla" />;

  // Modo reemplazo: la planilla debe estar anulada y sin reemplazo.
  let reemplazo: Anulada | null = null;
  let reemplazoInvalido = false;
  if (reemplazaParam !== undefined) {
    if (!reemplazaId || !anuladaRes || !reemplazosRes) {
      reemplazoInvalido = true;
    } else {
      const anulada = filasDe<Anulada>(anuladaRes, "nueva planilla: planilla a reemplazar");
      const reemplazos = conteoDe(reemplazosRes, "nueva planilla: reemplazos");
      if (!anulada.ok || !reemplazos.ok) return <ErrorDeCarga titulo={TITULO} que="la planilla a reemplazar" />;
      const fila = anulada.valor[0];
      if (!fila || fila.estado !== "anulada" || reemplazos.valor > 0) reemplazoInvalido = true;
      else reemplazo = fila;
    }
  }

  if (reemplazoInvalido) {
    return (
      <div className="flex max-w-6xl flex-col gap-6">
        <PageHeader title={TITULO} back={volver} />
        <Alert
          tone="warning"
          title="Esa planilla no se puede reemplazar"
          action={
            <>
              {reemplazaId ? (
                <ButtonLink href={RUTA.detalle(reemplazaId)} size="sm" variant="secondary">
                  Volver a la planilla
                </ButtonLink>
              ) : null}
              <ButtonLink href={RUTA.nuevaPlanilla()} size="sm" variant="secondary">
                Crear otra planilla
              </ButtonLink>
            </>
          }
        >
          Solo se reemplaza una planilla anulada que todavía no tenga reemplazo.
        </Alert>
      </div>
    );
  }

  // planilla_crear exige un tipo activo: con el tipo inactivo el reemplazo no se puede generar.
  if (reemplazo) {
    const tipoReemplazo = tipos.valor.find((t) => t.id === reemplazo.planilla_tipo_id);
    if (!tipoReemplazo || !tipoReemplazo.activo) {
      return (
        <div className="flex max-w-6xl flex-col gap-6">
          <PageHeader
            title="Planilla de reemplazo"
            back={{ href: RUTA.detalle(reemplazo.id), label: "Planilla anulada" }}
          />
          <Alert
            tone="warning"
            title="No se puede generar el reemplazo"
            action={
              permisos.conceptosGestionar ? (
                <ButtonLink href={RUTA.tipos()} size="sm" variant="secondary">
                  Ir a Tipos de planilla
                </ButtonLink>
              ) : null
            }
          >
            {tipoReemplazo
              ? "El tipo de planilla está inactivo: actívalo en Configuración → Tipos de planilla para generar el reemplazo."
              : "No se encontró el tipo de la planilla anulada. Revísalo en Configuración → Tipos de planilla."}
          </Alert>
        </div>
      );
    }
  }

  const hoy = hoyManagua();
  const activos = tipos.valor.filter((t) => t.activo);
  const sugeridos = await Promise.all(activos.map((t) => ultimoPeriodoDelTipo(ctx, t.id)));
  const opciones: TipoOpcion[] = activos.map((t, i) => {
    const ultimo = sugeridos[i];
    const propuesto = periodoSiguiente(ultimo.ok ? ultimo.valor : null, t.frecuencia, hoy);
    return { id: t.id, nombre: t.nombre, clase: t.clase, frecuencia: t.frecuencia, propuesto };
  });

  if (opciones.length === 0) {
    return (
      <div className="flex max-w-6xl flex-col gap-6">
        <PageHeader title={TITULO} back={volver} />
        <EmptyState
          title="No hay tipos de planilla activos"
          description="Activa o crea un tipo de planilla (quincenal, mensual, semanal o aguinaldo) para poder crear una planilla."
          action={
            permisos.conceptosGestionar ? (
              <ButtonLink href={RUTA.tipos()} variant="secondary">
                Ir a Tipos de planilla
              </ButtonLink>
            ) : null
          }
        />
      </div>
    );
  }

  return (
    <div className="flex max-w-6xl flex-col gap-6">
      <PageHeader
        title={reemplazo ? "Planilla de reemplazo" : TITULO}
        description="La planilla se crea en borrador. Después registra las novedades del período y calcúlala."
        back={reemplazo ? { href: RUTA.detalle(reemplazo.id), label: "Planilla anulada" } : volver}
      />
      {reemplazo ? (
        <Alert tone="info" title="Planilla de reemplazo">
          Reemplaza a la planilla anulada el {fechaHora(reemplazo.anulada_en)}.
          {reemplazo.motivo_anulacion ? ` Motivo: ${reemplazo.motivo_anulacion}` : ""}
        </Alert>
      ) : null}
      <NuevaPlanillaForm
        tipos={opciones}
        hoy={hoy}
        reemplazo={
          reemplazo
            ? {
                id: reemplazo.id,
                tipoId: reemplazo.planilla_tipo_id,
                periodo: { inicio: reemplazo.periodo_inicio, fin: reemplazo.periodo_fin },
              }
            : null
        }
      />
    </div>
  );
}
