import type { Metadata } from "next";
import { contextoActual, type Contexto } from "@nexo/auth";
import { Alert, ButtonLink, MetricCard, PageHeader, entero } from "@nexo/ui";
import { mensajeAtencion } from "@/lib/errores";
import { permisosDe } from "@/lib/permisos";
import {
  compararDuracion,
  esperaMasAntigua,
  formatoDuracion,
  rangoAnterior,
  rangoDe,
  type ComparacionDuracion,
  type Metricas,
} from "@/lib/metricas";
import type { Database, MiEstado } from "@/lib/supabase/database.types";
import GraficoPorHora from "@/components/metricas/grafico-por-hora";
import InicioAtencion from "./inicio-atencion";
import Bloque from "./bloque";

export const metadata: Metadata = {
  title: "Inicio · Atención",
};

export const dynamic = "force-dynamic";

type Ctx = Contexto<Database>;
type Rango = { desde: string; hasta: string };

/** Tarjeta cuya consulta falló: "—" en gris y el motivo debajo. */
const NO_DISPONIBLE = { value: "—", tone: "pending", hint: "No disponible" } as const;

/** Lo que se ve de la sala en este momento. null en un campo = su consulta falló. */
interface Sala {
  enEspera: number | null;
  masAntiguoSegundos: number | null;
  ocupados: number | null;
  activos: number | null;
}

async function cargarSala({ supabase, companyId }: Ctx, sucursalId: string): Promise<Sala> {
  const [cola, puestos] = await Promise.all([
    supabase.rpc("atencion_cola_v3", { p_company_id: companyId, p_sucursal_id: sucursalId }),
    supabase.rpc("atencion_listar_puestos", { p_company_id: companyId, p_sucursal_id: sucursalId }),
  ]);
  if (cola.error) console.error("atencion_cola_v3 (inicio)", cola.error);
  if (puestos.error) console.error("atencion_listar_puestos (inicio)", puestos.error);

  const turnos = cola.error ? null : (cola.data ?? []);
  const activos = puestos.error ? null : (puestos.data ?? []).filter((p) => p.activo);
  return {
    enEspera: turnos ? turnos.filter((t) => t.estado === "esperando").length : null,
    masAntiguoSegundos: turnos ? esperaMasAntigua(turnos, Date.now()) : null,
    ocupados: activos ? activos.filter((p) => p.ocupado_por).length : null,
    activos: activos ? activos.length : null,
  };
}

/** public.atencion_metricas (20261015173729); null si falla. */
async function cargarMetricas(
  { supabase, companyId }: Ctx,
  rango: Rango,
  sucursalId: string | null,
  soloMias: boolean
): Promise<Metricas | null> {
  const { data, error } = await supabase.rpc("atencion_metricas", {
    p_company_id: companyId,
    p_desde: rango.desde,
    p_hasta: rango.hasta,
    p_sucursal_id: sucursalId,
    p_solo_mias: soloMias,
  });
  if (error) {
    console.error(`atencion_metricas (inicio, ${soloMias ? "propias" : "sala"}, ${rango.desde}–${rango.hasta})`, error);
    return null;
  }
  return (data as unknown as Metricas | null) ?? null;
}

function conEtiqueta(comparacion: ComparacionDuracion | null, label: string) {
  return comparacion ? { ...comparacion, label } : undefined;
}

/** Contexto de un tiempo promedio cuando no hay flecha de comparación. */
function pistaTiempo(
  actual: number | null,
  anterior: Metricas | null,
  anteriorValor: number | null | undefined,
  quien: "" | "tus "
): string | undefined {
  if (actual === null) return quien ? "Todavía no atendiste a nadie hoy" : "Sin atendidos hoy";
  if (!anterior) return "Comparación no disponible";
  if (anteriorValor === null || anteriorValor === undefined) return `Sin atendidos en ${quien}últimos 7 días`;
  return undefined;
}

/**
 * Inicio del módulo. Responde dos preguntas:
 *   - agente: ¿estoy atendiendo y cuántos esperan? (InicioAtencion + Sala ahora)
 *   - supervisor: ¿cómo va la sala hoy? (Hoy, contra los últimos 7 días)
 * Cada bloque se consulta y se muestra solo con su permiso; si su RPC falla,
 * sus tarjetas dicen "No disponible" (nunca un 0 inventado).
 */
export default async function DashboardPage() {
  const [ctx, permisos] = await Promise.all([contextoActual<Database>(), permisosDe()]);
  const { supabase, companyId } = ctx;
  const hoy = rangoDe("hoy");
  const semana = rangoAnterior(hoy);

  // Ronda 1: estado del usuario y "Tu día", que no depende de la sucursal.
  const [estadoRes, miHoy, miSemana] = await Promise.all([
    supabase.rpc("atencion_mi_estado", { p_company_id: companyId }),
    permisos.misMetricas ? cargarMetricas(ctx, hoy, null, true) : null,
    permisos.misMetricas ? cargarMetricas(ctx, semana, null, true) : null,
  ]);
  const estado = estadoRes.error ? null : (estadoRes.data as unknown as MiEstado | null);

  // Sucursal resuelta: la de la atención abierta o la única asignada.
  const sucursalId: string | null =
    estado?.sesion?.sucursal_id ?? (estado?.sucursales.length === 1 ? estado.sucursales[0].id : null);
  const sucursalNombre =
    estado?.sesion?.sucursal ?? estado?.sucursales.find((s) => s.id === sucursalId)?.nombre ?? null;
  const lugar = sucursalNombre ? `En ${sucursalNombre}` : "En todas tus sucursales";

  // Ronda 2: lo que depende de la sucursal. Sin permiso, la consulta no se hace.
  const verSala = sucursalId !== null && permisos.colaVer;
  const [sala, salaHoy, salaSemana] = await Promise.all([
    verSala ? cargarSala(ctx, sucursalId) : null,
    permisos.reportes ? cargarMetricas(ctx, hoy, sucursalId, false) : null,
    permisos.reportes ? cargarMetricas(ctx, semana, sucursalId, false) : null,
  ]);

  const r = salaHoy?.resumen ?? null;
  const rSemana = salaSemana?.resumen;
  const mr = miHoy?.resumen ?? null;
  const mrSemana = miSemana?.resumen;

  return (
    <div className="flex max-w-6xl flex-col gap-8">
      <PageHeader
        title="Atención"
        description={sucursalNombre ? `Turnos de hoy en ${sucursalNombre}.` : "Turnos de sala de espera por sucursal."}
      />

      {estadoRes.error ? (
        <Alert tone="error" title="No se pudo cargar tu atención">
          {mensajeAtencion(estadoRes.error, "atencion_mi_estado (inicio)", "Recarga la página para intentarlo de nuevo.")}
        </Alert>
      ) : estado ? (
        <InicioAtencion estado={estado} />
      ) : null}

      {verSala && sala ? (
        <Bloque id="sala-ahora" titulo="Sala ahora" descripcion={`${lugar}.`}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {sala.enEspera === null ? (
              <MetricCard size="hero" label="En espera ahora" {...NO_DISPONIBLE} />
            ) : (
              <MetricCard
                size="hero"
                label="En espera ahora"
                value={entero(sala.enEspera)}
                hint={
                  sala.masAntiguoSegundos === null
                    ? "Nadie en espera"
                    : `Más antiguo: ${formatoDuracion(sala.masAntiguoSegundos)} en espera`
                }
              />
            )}
            {sala.ocupados === null || sala.activos === null ? (
              <MetricCard label="Puestos ocupados" {...NO_DISPONIBLE} />
            ) : (
              <MetricCard
                label="Puestos ocupados"
                value={entero(sala.ocupados)}
                unit={`de ${entero(sala.activos)}`}
                hint={sala.activos === 0 ? "No hay puestos activos en esta sucursal" : "Con una atención abierta"}
              />
            )}
          </div>
        </Bloque>
      ) : permisos.reportes ? (
        // Sin sucursal resuelta (o sin permiso para ver la fila): lo que sigue en curso hoy.
        <Bloque id="sala-ahora" titulo="Sala ahora" descripcion={`${lugar}.`}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {r && r.en_curso !== null ? (
              <MetricCard size="hero" label="En curso ahora" value={entero(r.en_curso)} hint="En espera o en atención" />
            ) : (
              <MetricCard size="hero" label="En curso ahora" {...NO_DISPONIBLE} />
            )}
          </div>
        </Bloque>
      ) : permisos.colaVer && !sucursalId ? (
        <p className="text-sm text-neutral-500">La sala aparece aquí cuando inicias atención en una sucursal.</p>
      ) : null}

      {permisos.reportes ? (
        <Bloque
          id="hoy"
          titulo="Hoy"
          descripcion={`${lugar}, comparado con los últimos 7 días.`}
          accion={
            <ButtonLink href="/reportes" variant="secondary" size="sm">
              Ver reportes
            </ButtonLink>
          }
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {r ? (
              <>
                <MetricCard
                  label="Atendidos"
                  value={entero(r.atendidos)}
                  hint={r.turnos !== null ? `de ${entero(r.turnos)} turnos entregados` : undefined}
                />
                <MetricCard
                  label="Espera promedio"
                  value={formatoDuracion(r.espera_prom)}
                  delta={conEtiqueta(compararDuracion(r.espera_prom, rSemana?.espera_prom), "vs. últimos 7 días")}
                  hint={pistaTiempo(r.espera_prom, salaSemana, rSemana?.espera_prom, "")}
                />
                <MetricCard
                  label="Atención promedio"
                  value={formatoDuracion(r.atencion_prom)}
                  delta={conEtiqueta(compararDuracion(r.atencion_prom, rSemana?.atencion_prom), "vs. últimos 7 días")}
                  hint={pistaTiempo(r.atencion_prom, salaSemana, rSemana?.atencion_prom, "")}
                />
                <MetricCard label="No se presentó" value={entero(r.no_se_presento)} hint="No cuenta en los tiempos" />
              </>
            ) : (
              ["Atendidos", "Espera promedio", "Atención promedio", "No se presentó"].map((label) => (
                <MetricCard key={label} label={label} {...NO_DISPONIBLE} />
              ))
            )}
          </div>
          {salaHoy ? (
            <GraficoPorHora
              titulo="Llegada de clientes por hora"
              descripcion="Hora en que recepción entregó cada turno hoy."
              datos={salaHoy.por_hora}
              unidad="turnos"
            />
          ) : null}
        </Bloque>
      ) : null}

      {permisos.misMetricas ? (
        <Bloque
          id="tu-dia"
          titulo="Tu día"
          descripcion="Tus turnos de hoy, comparados con tus últimos 7 días."
          accion={
            <ButtonLink href="/metricas" variant="secondary" size="sm">
              Ver mis métricas
            </ButtonLink>
          }
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {mr ? (
              <>
                <MetricCard label="Atendidos por ti" value={entero(mr.atendidos)} hint="Turnos que atendiste hoy" />
                <MetricCard
                  label="Tu atención promedio"
                  value={formatoDuracion(mr.atencion_prom)}
                  delta={conEtiqueta(compararDuracion(mr.atencion_prom, mrSemana?.atencion_prom), "vs. tus últimos 7 días")}
                  hint={pistaTiempo(mr.atencion_prom, miSemana, mrSemana?.atencion_prom, "tus ")}
                />
                <MetricCard
                  label="Tiempo en puesto"
                  value={formatoDuracion(mr.sesion_segundos)}
                  hint="Con atención abierta en un puesto"
                />
              </>
            ) : (
              ["Atendidos por ti", "Tu atención promedio", "Tiempo en puesto"].map((label) => (
                <MetricCard key={label} label={label} {...NO_DISPONIBLE} />
              ))
            )}
          </div>
        </Bloque>
      ) : null}
    </div>
  );
}
