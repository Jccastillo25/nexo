import type { Metadata } from "next";
import Link from "next/link";
import { contextoActual, type Contexto } from "@nexo/auth";
import {
  Alert,
  ButtonLink,
  DataTable,
  EmptyState,
  MetricCard,
  NexoIcon,
  PageHeader,
  entero,
  fechaCorta,
  moneda,
  porcentaje,
  type MetricCardDelta,
} from "@nexo/ui";
import { AvisosPlanilla } from "@/components/planilla/avisos-planilla";
import { SelectorMes } from "@/components/planilla/selector-mes";
import { hoyManagua } from "@/lib/fecha-managua";
import { permisosDe } from "@/lib/permisos-rrhh";
import { AVISO_REGIMEN } from "@/lib/planilla/estados";
import { sumarMontos, variacion } from "@/lib/planilla/formato";
import { etiquetaMes, etiquetaPeriodo, leerMes, mesAnterior, periodoSiguiente, rangoMes } from "@/lib/planilla/periodos";
import { RUTA } from "@/lib/planilla/rutas";
import { consultarRpc } from "@/lib/planilla/servidor";
import type { PasivoFila, RegimenFila, Resultado, VacacionMovimiento } from "@/lib/planilla/tipos";
import { CeldaPeriodo, ErrorDeCarga, EstadoPlanillaBadge, SinAccesoPlanilla } from "../periodos/compartido";
import {
  COLUMNAS_LISTA,
  conteoDe,
  filasDe,
  tablasRrhh,
  tiposDePlanilla,
  ultimoPeriodoDelTipo,
  type PlanillaLista,
  type TipoPlanillaResumen,
} from "../periodos/datos";
import { totalesDelMes, type FilaResumen } from "./totales";

export const metadata: Metadata = {
  title: "Resumen de planilla · RRHH",
};

const TITULO = "Resumen de planilla";

/** Comparación con el mes anterior (tono neutral: subir o bajar el costo no es bueno ni malo por sí solo). */
function deltaMensual(actual: number, anterior: number, mesPrevio: string): MetricCardDelta | undefined {
  const v = variacion(actual, anterior);
  if (v === null) return undefined;
  const plano = Math.abs(v) < 0.0005;
  return {
    value: porcentaje(v, { signo: true }),
    direction: plano ? "flat" : v > 0 ? "up" : "down",
    tone: "neutral",
    label: `vs. ${etiquetaMes(mesPrevio).toLowerCase()}`,
  };
}

/** Conteo de un pendiente: el número, o "—" si la fuente falló. */
function valorConteo(r: Resultado<number> | null): { value: string; tone: "warning" | "neutral" | "pending"; hint?: string } {
  if (!r || !r.ok) return { value: "—", tone: "pending", hint: "No disponible" };
  return { value: entero(r.valor), tone: r.valor > 0 ? "warning" : "neutral" };
}

interface Proximo {
  tipo: TipoPlanillaResumen;
  texto: string;
}

/**
 * Aviso de siguiente paso: el período que sigue a la última planilla no
 * anulada de cada tipo ordinario activo (o el que contiene hoy). Sin tipos
 * (sin permiso o si fallaron), ninguno.
 */
async function proximosPeriodos(ctx: Contexto, tipos: Resultado<TipoPlanillaResumen[]> | null, hoy: string): Promise<Proximo[]> {
  if (!tipos || !tipos.ok) return [];
  const ordinarios = tipos.valor.filter((t) => t.activo && t.clase === "ordinaria");
  const siguientes = await Promise.all(
    ordinarios.map(async (t): Promise<Proximo | null> => {
      const ultimo = await ultimoPeriodoDelTipo(ctx, t.id);
      if (!ultimo.ok) return null;
      const p = periodoSiguiente(ultimo.valor, t.frecuencia, hoy);
      return { tipo: t, texto: etiquetaPeriodo(p.inicio, p.fin, t.frecuencia, t.clase) };
    })
  );
  return siguientes.filter((s): s is Proximo => s !== null);
}

/**
 * Resumen de planilla (B1, planilla.ver): ¿cuánto cuesta la planilla del mes
 * y cuánto cambió?, ¿qué falta aprobar o pagar?, ¿cuánto se debe en
 * prestaciones? Pirámide: costo del empleador (hero) → neto, aportes,
 * provisiones y pasivo → pendientes → avisos y últimas planillas.
 *
 * Fuentes reales: `rrhh.planillas.totales` (lo que guardó la RPC al
 * calcular), `planilla_pasivo_laboral`, `planilla_vacaciones_movimientos`
 * (con vacaciones.ver) y `planilla_regimen_listado` (con regimen.ver). Las
 * sumas son de presentación (`totalesDelMes`, con `sumarMontos`). Un mes sin
 * planillas calculadas muestra "—", nunca C$ 0.00. El costo del empleador no
 * suma la planilla de aguinaldo (ya se provisiona cada mes); el neto sí, y el
 * aguinaldo del mes se informa debajo del costo.
 */
export default async function ResumenPlanillaPage({ searchParams }: PageProps<"/planillas/resumen">) {
  const [ctx, permisos, sp] = await Promise.all([contextoActual(), permisosDe(), searchParams]);
  if (!permisos.planillaVer) {
    return <SinAccesoPlanilla titulo={TITULO} pantalla="al resumen de planilla" permiso="Ver planillas" />;
  }

  const hoy = hoyManagua();
  const mes = leerMes(sp.mes, hoy);
  const previo = mesAnterior(mes);
  const db = tablasRrhh(ctx);
  const { companyId } = ctx;

  // Los tipos (conceptos.ver) deciden qué planilla es de aguinaldo y los próximos
  // períodos; estos se piden en cuanto llegan los tipos, en paralelo con el resto.
  const tiposPromesa = permisos.conceptosVer ? tiposDePlanilla(ctx) : Promise.resolve(null);
  const proximosPromesa = permisos.planillaGenerar
    ? tiposPromesa.then((t) => proximosPeriodos(ctx, t, hoy))
    : Promise.resolve<Proximo[]>([]);

  const [mesesRes, porAprobarRes, porPagarRes, ultimasRes, ultimaCalcRes, pasivo, vacaciones, regimen, tipos, proximos] =
    await Promise.all([
      db
        .from("planillas")
        .select("id, planilla_tipo_id, periodo_fin, estado, totales")
        .eq("company_id", companyId)
        .in("estado", ["calculada", "aprobada", "pagada"])
        .gte("periodo_fin", rangoMes(previo).inicio)
        .lte("periodo_fin", rangoMes(mes).fin),
      db.from("planillas").select("id", { count: "exact", head: true }).eq("company_id", companyId).eq("estado", "calculada"),
      db.from("planillas").select("id", { count: "exact", head: true }).eq("company_id", companyId).eq("estado", "aprobada"),
      db
        .from("planillas")
        .select(COLUMNAS_LISTA)
        .eq("company_id", companyId)
        .order("periodo_fin", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(5),
      db
        .from("planillas")
        .select(COLUMNAS_LISTA)
        .eq("company_id", companyId)
        .in("estado", ["calculada", "aprobada"])
        .order("periodo_fin", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(1),
      consultarRpc<PasivoFila[]>(ctx, "planilla_pasivo_laboral", {}, "planilla_pasivo_laboral"),
      permisos.vacacionesVer
        ? consultarRpc<VacacionMovimiento[]>(
            ctx,
            "planilla_vacaciones_movimientos",
            { p_estado: "solicitada" },
            "planilla_vacaciones_movimientos"
          )
        : Promise.resolve(null),
      permisos.regimenVer
        ? consultarRpc<RegimenFila[]>(ctx, "planilla_regimen_listado", {}, "planilla_regimen_listado")
        : Promise.resolve(null),
      tiposPromesa,
      proximosPromesa,
    ]);

  const meses = filasDe<FilaResumen>(mesesRes, "resumen: planillas del mes");
  const ultimas = filasDe<PlanillaLista>(ultimasRes, "resumen: últimas planillas");
  if (!meses.ok || !ultimas.ok) {
    return <ErrorDeCarga titulo={TITULO} que="las planillas" />;
  }

  const listaTipos: TipoPlanillaResumen[] = tipos && tipos.ok ? tipos.valor : [];
  const tipoPorId = new Map(listaTipos.map((t) => [t.id, t]));

  if (ultimas.valor.length === 0) {
    return (
      <div className="flex max-w-6xl flex-col gap-6">
        <PageHeader title={TITULO} description={etiquetaMes(mes)} />
        <EmptyState
          title="Todavía no hay planillas"
          description="Crea la primera para el período actual."
          action={
            permisos.planillaGenerar ? (
              <ButtonLink href={RUTA.nuevaPlanilla()} icon={<NexoIcon name="plus" />}>
                Nueva planilla
              </ButtonLink>
            ) : null
          }
        />
      </div>
    );
  }

  // Sin los tipos, la clase no se conoce (null): la planilla cuenta como ordinaria y se avisa.
  const claseDe = (f: FilaResumen) => tipoPorId.get(f.planilla_tipo_id)?.clase ?? null;
  const actual = totalesDelMes(meses.valor, mes, claseDe);
  const anterior = totalesDelMes(meses.valor, previo, claseDe);
  const costoActual = actual && actual.ordinarias > 0 ? actual : null;
  const costoAnterior = anterior && anterior.ordinarias > 0 ? anterior : null;
  const sinPlanillas = `Sin planillas calculadas en ${etiquetaMes(mes).toLowerCase()}`;
  const sinComparar = "Sin datos del mes anterior para comparar";

  const filasPasivo = pasivo.ok ? (Array.isArray(pasivo.valor) ? pasivo.valor : []) : null;
  const porAprobar = valorConteo(conteoDe(porAprobarRes, "resumen: planillas por aprobar"));
  const porPagar = valorConteo(conteoDe(porPagarRes, "resumen: planillas por pagar"));
  const vacacionesPendientes = vacaciones
    ? valorConteo(vacaciones.ok ? { ok: true, valor: Array.isArray(vacaciones.valor) ? vacaciones.valor.length : 0 } : vacaciones)
    : null;
  const avisosRegimen = regimen
    ? valorConteo(
        regimen.ok
          ? {
              ok: true,
              valor: (Array.isArray(regimen.valor) ? regimen.valor : []).filter((r) => r.tiene_aviso && !r.aviso_descartado_en)
                .length,
            }
          : regimen
      )
    : null;

  const ultimaCalc = filasDe<PlanillaLista>(ultimaCalcRes, "resumen: última planilla calculada");
  const ultimaConAvisos = ultimaCalc.ok ? ultimaCalc.valor[0] : undefined;

  return (
    <div className="flex max-w-6xl flex-col gap-6">
      <PageHeader
        title={TITULO}
        description={`${etiquetaMes(mes)} · Datos de las planillas calculadas, aprobadas y pagadas`}
        actions={<SelectorMes mes={mes} label="Mes del resumen" />}
      />

      {proximos.length > 0 ? (
        <Alert
          tone="info"
          title={
            proximos.length === 1
              ? `Próximo período: ${proximos[0].texto}`
              : `Próximos períodos: ${proximos.map((p) => `${p.texto} (${p.tipo.nombre})`).join(" · ")}`
          }
          action={
            <ButtonLink href={RUTA.nuevaPlanilla()} size="sm" variant="secondary" icon={<NexoIcon name="plus" />}>
              Nueva planilla
            </ButtonLink>
          }
        />
      ) : null}

      <section aria-labelledby="resumen-costos" className="flex flex-col gap-4">
        <h2 id="resumen-costos" className="sr-only">
          Costos del mes
        </h2>
        <MetricCard
          size="hero"
          label="Costo del empleador del mes"
          value={costoActual ? moneda(costoActual.costo) : "—"}
          delta={costoActual && costoAnterior ? deltaMensual(costoActual.costo, costoAnterior.costo, previo) : undefined}
          href={RUTA.periodos({ mes })}
          hint={
            actual ? (
              <>
                <span className="block">
                  {entero(actual.planillas)} {actual.planillas === 1 ? "planilla" : "planillas"} · {entero(actual.sinAprobar)} sin
                  aprobar
                </span>
                <span className="block">
                  {costoActual
                    ? `Devengado + aportes patronales + provisiones${actual.aguinaldo ? ", sin el aguinaldo" : ""}`
                    : `Sin planillas ordinarias calculadas en ${etiquetaMes(mes).toLowerCase()}`}
                </span>
                {actual.aguinaldo ? (
                  <span className="block">
                    {actual.aguinaldo.pagado ? "Además se pagó aguinaldo" : "Además hay aguinaldo por pagar"}:{" "}
                    <span className="tabular-nums">{moneda(actual.aguinaldo.neto)}</span>
                  </span>
                ) : null}
                {actual.claseDesconocida ? (
                  <span className="block">Puede incluir aguinaldo: no se pudieron leer los tipos de planilla.</span>
                ) : null}
                {costoActual && !costoAnterior ? <span className="block">{sinComparar}</span> : null}
              </>
            ) : (
              sinPlanillas
            )
          }
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Neto a pagar"
            value={actual ? moneda(actual.neto) : "—"}
            hint={actual ? `Pagado: ${moneda(actual.netoPagado)}` : sinPlanillas}
            href={RUTA.periodos({ mes })}
          />
          <MetricCard
            label="Aportes patronales"
            value={actual ? moneda(actual.aportes) : "—"}
            delta={actual && anterior ? deltaMensual(actual.aportes, anterior.aportes, previo) : undefined}
            hint={actual ? (anterior ? "INSS patronal e INATEC" : `INSS patronal e INATEC · ${sinComparar}`) : sinPlanillas}
          />
          <MetricCard
            label="Provisiones"
            value={actual ? moneda(actual.provisiones) : "—"}
            hint={actual ? "Vacaciones, aguinaldo e indemnización" : sinPlanillas}
          />
          {filasPasivo === null ? (
            <MetricCard label="Pasivo laboral a hoy" value="—" tone="pending" hint="No disponible" />
          ) : (
            <MetricCard
              label="Pasivo laboral a hoy"
              value={filasPasivo.length > 0 ? moneda(sumarMontos(filasPasivo.map((f) => f.total))) : "—"}
              hint={filasPasivo.length > 0 ? `Al ${fechaCorta(hoy)}, con el salario actual` : "Sin contratos activos con prestaciones"}
              href={RUTA.pasivo()}
            />
          )}
        </div>
      </section>

      <section aria-labelledby="resumen-pendientes" className="flex flex-col gap-3">
        <h2 id="resumen-pendientes" className="text-base font-semibold text-neutral-900">
          Pendientes
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Planillas por aprobar"
            value={porAprobar.value}
            tone={porAprobar.tone}
            hint={porAprobar.hint ?? "Calculadas, esperando aprobación"}
            href={RUTA.periodos({ estado: "calculada" })}
          />
          <MetricCard
            label="Planillas por pagar"
            value={porPagar.value}
            tone={porPagar.tone}
            hint={porPagar.hint ?? "Aprobadas, sin marcar como pagadas"}
            href={RUTA.periodos({ estado: "aprobada" })}
          />
          {vacacionesPendientes ? (
            <MetricCard
              label="Vacaciones por aprobar"
              value={vacacionesPendientes.value}
              tone={vacacionesPendientes.tone}
              hint={vacacionesPendientes.hint ?? "Solicitudes registradas"}
              href={RUTA.vacacionesMovimientos({ estado: "solicitada" })}
            />
          ) : null}
          {avisosRegimen ? (
            <MetricCard
              label="Contratos con aviso de régimen"
              value={avisosRegimen.value}
              tone={avisosRegimen.tone}
              hint={avisosRegimen.hint ?? AVISO_REGIMEN}
              href={RUTA.regimen({ aviso: true })}
            />
          ) : null}
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section aria-labelledby="resumen-avisos" className="flex min-w-0 flex-col gap-3">
          <h2 id="resumen-avisos" className="text-base font-semibold text-neutral-900">
            Avisos de la última planilla
          </h2>
          {!ultimaCalc.ok ? (
            <EmptyState bare variant="error" title="No se pudieron cargar los avisos" />
          ) : ultimaConAvisos ? (
            <div className="flex flex-col gap-3 rounded-xl border border-neutral-200 bg-white p-4 shadow-xs">
              <p className="text-sm text-neutral-600">
                <Link
                  href={RUTA.detalle(ultimaConAvisos.id)}
                  className="rounded-sm font-medium text-blue-600 hover:text-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                >
                  {etiquetaPeriodo(
                    ultimaConAvisos.periodo_inicio,
                    ultimaConAvisos.periodo_fin,
                    tipoPorId.get(ultimaConAvisos.planilla_tipo_id)?.frecuencia ?? null,
                    tipoPorId.get(ultimaConAvisos.planilla_tipo_id)?.clase ?? null
                  )}
                </Link>
                {tipoPorId.get(ultimaConAvisos.planilla_tipo_id) ? ` · ${tipoPorId.get(ultimaConAvisos.planilla_tipo_id)?.nombre}` : ""}
              </p>
              {Array.isArray(ultimaConAvisos.totales?.avisos) && ultimaConAvisos.totales.avisos.length > 0 ? (
                <AvisosPlanilla avisos={ultimaConAvisos.totales?.avisos} />
              ) : (
                <p className="text-sm text-neutral-500">Esta planilla no tiene avisos.</p>
              )}
            </div>
          ) : (
            <EmptyState bare title="No hay planillas calculadas ni aprobadas" description="Los avisos aparecen al calcular una planilla." />
          )}
        </section>

        <section aria-labelledby="resumen-ultimas" className="flex min-w-0 flex-col gap-3">
          <h2 id="resumen-ultimas" className="text-base font-semibold text-neutral-900">
            Últimas planillas
          </h2>
          <DataTable
            rows={ultimas.valor}
            rowKey={(p) => p.id}
            rowHref={(p) => RUTA.detalle(p.id)}
            caption="Últimas planillas"
            density="compact"
            columns={[
              {
                key: "periodo",
                header: "Período",
                render: (p) => (
                  <CeldaPeriodo
                    inicio={p.periodo_inicio}
                    fin={p.periodo_fin}
                    frecuencia={tipoPorId.get(p.planilla_tipo_id)?.frecuencia ?? null}
                    clase={tipoPorId.get(p.planilla_tipo_id)?.clase ?? null}
                  />
                ),
              },
              { key: "estado", header: "Estado", render: (p) => <EstadoPlanillaBadge estado={p.estado} /> },
              { key: "neto", header: "Neto", numeric: true, render: (p) => moneda(p.totales?.neto) },
              { key: "costo", header: "Costo del empleador", numeric: true, render: (p) => moneda(p.totales?.costo_total) },
            ]}
            footer={
              <ButtonLink href={RUTA.periodos()} variant="link">
                Ver todas las planillas
              </ButtonLink>
            }
          />
        </section>
      </div>
    </div>
  );
}
