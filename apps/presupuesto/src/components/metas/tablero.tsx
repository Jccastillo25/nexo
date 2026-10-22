// Piezas del Dashboard del equipo: tarjeta principal del mes, ranking de
// vendedores contra su meta y panel de clientes. Sin estado (Server Components).
// Jerarquía: un número principal, 4 indicadores, tendencia y desglose.
//
// Los días hábiles salen de presupuesto_indicadores, que llega después (en
// <Suspense>): con `ritmoCargando`/`cargando` estas piezas se pintan antes,
// con lo vendido y la meta, y un esqueleto donde va el ritmo.
import { ButtonLink, Skeleton, StatusBadge, entero, type StatusTone } from "@nexo/ui";
import { UMBRAL_RIESGO, cs, estadoCumplimiento, etiquetaVendedor, haceDias, pct, usd } from "@/lib/metas/formato";
import type { Ritmo } from "@/lib/metas/ritmo";
import type { ClienteEnRiesgo, VendedorEquipo } from "@/lib/metas/tipos";
import { claseTarjeta } from "./estilos";

/** Cómo va contra el ritmo necesario (o contra la meta si el mes cerró). */
export function estadoRitmo(r: Ritmo, meta: number | null, vendido: number): { label: string; tone: StatusTone } {
  if (meta === null || !(meta > 0)) return { label: "Sin meta", tone: "neutral" };
  if (r.estado === "sin_datos") return { label: "Sin facturas del mes", tone: "neutral" };
  if (r.estado === "cerrado") {
    const f = vendido / meta;
    return f >= 1
      ? { label: "Meta cumplida", tone: "positive" }
      : { label: `Faltó ${pct(1 - f)}`, tone: f >= UMBRAL_RIESGO ? "warning" : "negative" };
  }
  const f = r.fraccionALaFecha ?? 0;
  if (f >= 1) return { label: `${pct(f - 1)} arriba del ritmo`, tone: "positive" };
  return { label: `${pct(1 - f)} abajo del ritmo`, tone: f >= UMBRAL_RIESGO ? "warning" : "negative" };
}

/** Estado de un vendedor por su proyección al cierre (o lo vendido, si el mes cerró). */
export function estadoProyeccion(fraccion: number | null, cerrado: boolean): { label: string; tone: StatusTone } {
  if (fraccion === null) return { label: "Sin meta", tone: "neutral" };
  if (fraccion >= 1) return { label: cerrado ? "Cumplida" : "Va a cumplir", tone: "positive" };
  if (fraccion >= UMBRAL_RIESGO) return { label: "En riesgo", tone: "warning" };
  return { label: cerrado ? "No cumplió" : "No llega", tone: "negative" };
}

const ancho = (v: number, escala: number) => `${Math.min(Math.max(v / escala, 0), 1) * 100}%`;


/** El número principal del mes con su barra contra la meta y el ritmo. */
export function HeroMes({
  titulo,
  vendido,
  vendidoCs,
  facturas,
  meta,
  ritmo,
  diasMes,
  diasTranscurridos,
  ritmoDisponible = true,
  ritmoCargando = false,
}: {
  titulo: string;
  vendido: number;
  vendidoCs: number;
  facturas: number;
  meta: number | null;
  ritmo: Ritmo;
  diasMes: number;
  diasTranscurridos: number;
  /** false cuando no llegaron los días hábiles (falló presupuesto_indicadores): no se calcula el ritmo. */
  ritmoDisponible?: boolean;
  /** true mientras presupuesto_indicadores no responde: lo vendido y la meta ya se ven; el ritmo, en esqueleto. */
  ritmoCargando?: boolean;
}) {
  const conMeta = meta !== null && meta > 0;
  const estado = ritmoDisponible ? estadoRitmo(ritmo, meta, vendido) : { label: "Ritmo no disponible", tone: "neutral" as const };
  const enCurso = !ritmoCargando && ritmoDisponible && ritmo.estado === "en_curso";
  const esperadoHoy = enCurso && conMeta && diasMes > 0 ? (meta! * diasTranscurridos) / diasMes : null;
  const proyeccion = enCurso ? ritmo.proyeccion : null;
  const sinRitmo = "No se pudo calcular el ritmo";
  const escala = Math.max(1, vendido, meta ?? 0, proyeccion ?? 0) * 1.02;

  return (
    <section className={`${claseTarjeta} flex flex-col gap-6 p-5 sm:p-6`} aria-labelledby="hero-mes">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 id="hero-mes" className="text-sm font-semibold text-neutral-600">
              {titulo}
            </h2>
            {ritmoCargando ? <Skeleton className="h-5 w-28" /> : <StatusBadge label={estado.label} tone={estado.tone} />}
          </div>
          <p className="text-4xl font-semibold tracking-tight tabular-nums text-neutral-900 sm:text-5xl">{usd(vendido)}</p>
          <p className="text-sm text-neutral-600">
            {conMeta ? (
              <>
                <span className="font-semibold text-neutral-900">{pct(vendido / meta!)}</span> de la meta de {usd(meta)}
              </>
            ) : (
              "Sin meta para este mes"
            )}
            <span className="text-neutral-400"> · </span>
            {cs(vendidoCs)} · {entero(facturas)} {facturas === 1 ? "factura" : "facturas"}
          </p>
        </div>
      </div>

      {conMeta ? (
        <div className="flex flex-col gap-3">
          <div
            role="img"
            aria-label={`Vendido ${usd(vendido)} de una meta de ${usd(meta)}${
              esperadoHoy !== null ? `; a esta altura tocaba llevar ${usd(esperadoHoy)}` : ""
            }${proyeccion !== null ? `; proyección al cierre ${usd(proyeccion)}` : ""}.`}
            className="relative h-5 w-full rounded-full bg-neutral-100"
          >
            {proyeccion !== null ? (
              <div className="absolute inset-y-0 left-0 rounded-full bg-blue-300" style={{ width: ancho(proyeccion, escala) }} />
            ) : null}
            <div className="absolute inset-y-0 left-0 rounded-full bg-blue-600" style={{ width: ancho(vendido, escala) }} />
            {esperadoHoy !== null ? (
              <div
                className="absolute -inset-y-1.5 w-1 rounded bg-neutral-500 ring-2 ring-white"
                style={{ left: `calc(${ancho(esperadoHoy, escala)} - 2px)` }}
              />
            ) : null}
            <div className="absolute -inset-y-1.5 w-1 rounded bg-neutral-900" style={{ left: `calc(${ancho(meta!, escala)} - 2px)` }} />
          </div>
          <ul className="flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-neutral-600">
            <li className="flex items-center gap-1.5">
              <span aria-hidden="true" className="h-2.5 w-2.5 rounded-sm bg-blue-600" />
              Vendido <span className="font-semibold tabular-nums text-neutral-900">{usd(vendido)}</span>
            </li>
            {proyeccion !== null ? (
              <li className="flex items-center gap-1.5">
                <span aria-hidden="true" className="h-2.5 w-2.5 rounded-sm bg-blue-300" />
                Proyección al cierre <span className="font-semibold tabular-nums text-neutral-900">{usd(proyeccion)}</span>
              </li>
            ) : null}
            {esperadoHoy !== null ? (
              <li className="flex items-center gap-1.5">
                <span aria-hidden="true" className="h-3 w-1 rounded bg-neutral-500" />
                Hoy tocaba llevar <span className="font-semibold tabular-nums text-neutral-900">{usd(esperadoHoy)}</span>
              </li>
            ) : null}
            <li className="flex items-center gap-1.5">
              <span aria-hidden="true" className="h-3 w-1 rounded bg-neutral-900" />
              Meta <span className="font-semibold tabular-nums text-neutral-900">{usd(meta)}</span>
            </li>
          </ul>
        </div>
      ) : null}

      <dl className="grid grid-cols-1 gap-4 border-t border-neutral-100 pt-5 sm:grid-cols-3">
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Proyección al cierre</dt>
          <dd className="mt-1 text-2xl font-semibold text-neutral-900">
            {ritmoCargando ? (
              <Skeleton className="h-8 w-36" />
            ) : !ritmoDisponible || ritmo.proyeccion === null ? (
              "—"
            ) : (
              usd(ritmo.proyeccion)
            )}
          </dd>
          <dd className="text-xs text-neutral-500">
            {ritmoCargando ? (
              <Skeleton className="mt-1 h-3 w-40 max-w-full" />
            ) : !ritmoDisponible ? (
              sinRitmo
            ) : ritmo.estado === "sin_datos" ? (
              "Todavía no hay facturas de este mes"
            ) : ritmo.estado === "cerrado" ? (
              "Mes cerrado"
            ) : ritmo.fraccionProyectada === null ? (
              "Al ritmo actual"
            ) : (
              `${pct(ritmo.fraccionProyectada)} de la meta, al ritmo actual`
            )}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Necesitas por día hábil</dt>
          <dd className="mt-1 text-2xl font-semibold text-neutral-900">
            {ritmoCargando ? (
              <Skeleton className="h-8 w-32" />
            ) : !ritmoDisponible || ritmo.requeridoPorDia === null ? (
              "—"
            ) : ritmo.requeridoPorDia === 0 ? (
              "Meta cumplida"
            ) : (
              usd(ritmo.requeridoPorDia)
            )}
          </dd>
          <dd className="text-xs text-neutral-500">
            {ritmoCargando ? (
              <Skeleton className="mt-1 h-3 w-36 max-w-full" />
            ) : !ritmoDisponible ? (
              sinRitmo
            ) : ritmo.promedioDiario === null ? (
              "Sin ventas todavía"
            ) : (
              `Vas a ${usd(ritmo.promedioDiario)} por día hábil`
            )}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Días hábiles</dt>
          <dd className="mt-1 text-2xl font-semibold text-neutral-900">
            {ritmoCargando ? <Skeleton className="h-8 w-24" /> : ritmoDisponible ? `${diasTranscurridos} de ${diasMes}` : "—"}
          </dd>
          <dd className="text-xs text-neutral-500">
            {ritmoCargando ? (
              <Skeleton className="mt-1 h-3 w-32 max-w-full" />
            ) : !ritmoDisponible ? (
              sinRitmo
            ) : ritmo.diasRestantes === 0 ? (
              "Mes completo"
            ) : (
              `Quedan ${ritmo.diasRestantes} · lunes a sábado`
            )}
          </dd>
        </div>
      </dl>
    </section>
  );
}

export interface FilaRanking {
  vendedor: VendedorEquipo;
  proyeccion: number | null;
}

/**
 * Vendedores contra su meta: barra de lo vendido, proyección en tono claro y marca de la meta.
 * `sinRitmo`: no llegaron los días hábiles; el estado es el cumplimiento simple contra la meta.
 * `cargando`: los días hábiles todavía no llegan; el estado va en esqueleto (filas sin proyección).
 */
export function RankingVendedores({
  filas,
  cerrado,
  sinDatos,
  sinRitmo = false,
  cargando = false,
}: {
  filas: FilaRanking[];
  cerrado: boolean;
  sinDatos: boolean;
  sinRitmo?: boolean;
  cargando?: boolean;
}) {
  const escala = Math.max(
    1,
    ...filas.map((f) => Math.max(Number(f.vendedor.vendido_usd) || 0, Number(f.vendedor.meta_usd) || 0, f.proyeccion ?? 0)),
  ) * 1.02;
  return (
    <ul className="divide-y divide-neutral-100">
      {filas.map(({ vendedor: v, proyeccion }) => {
        const vendido = Number(v.vendido_usd) || 0;
        const meta = v.meta_usd === null ? null : Number(v.meta_usd);
        const conMeta = meta !== null && meta > 0;
        const base = cerrado || proyeccion === null ? vendido : proyeccion;
        const estado = sinRitmo
          ? estadoCumplimiento(conMeta ? vendido / meta! : null)
          : sinDatos && conMeta
            ? { label: "Sin facturas", tone: "neutral" as const }
            : estadoProyeccion(conMeta ? base / meta! : null, cerrado);
        return (
          <li key={v.id} className="grid grid-cols-1 gap-2 px-5 py-3 sm:grid-cols-[minmax(9rem,13rem)_1fr_auto] sm:items-center sm:gap-4">
            <div className="flex min-w-0 flex-wrap items-center gap-1.5">
              <span className="truncate text-sm font-medium text-neutral-900">{etiquetaVendedor(v.codigo, v.nombre)}</span>
              {!v.activo ? <StatusBadge label="Inactivo" tone="neutral" /> : null}
            </div>
            <div className="flex flex-col gap-1">
              <div aria-hidden="true" className="relative h-3 w-full rounded-full bg-neutral-100">
                {!cerrado && proyeccion !== null ? (
                  <div className="absolute inset-y-0 left-0 rounded-full bg-blue-300" style={{ width: ancho(proyeccion, escala) }} />
                ) : null}
                <div className="absolute inset-y-0 left-0 rounded-full bg-blue-600" style={{ width: ancho(vendido, escala) }} />
                {conMeta ? (
                  <div className="absolute -inset-y-1 w-0.5 rounded bg-neutral-900" style={{ left: ancho(meta!, escala) }} />
                ) : null}
              </div>
              <p className="text-xs tabular-nums text-neutral-500">
                {usd(vendido)}
                {conMeta ? ` de ${usd(meta)}` : meta === 0 ? " · meta en 0" : " · sin meta"}
                {!cerrado && proyeccion !== null && vendido > 0 ? ` · proyecta ${usd(proyeccion)}` : ""}
              </p>
            </div>
            <div className="flex items-center justify-between gap-2 whitespace-nowrap sm:w-44 sm:justify-end">
              <span className="text-sm font-semibold tabular-nums text-neutral-900">{conMeta ? pct(vendido / meta!) : "—"}</span>
              {cargando ? <Skeleton className="h-5 w-20" /> : <StatusBadge label={estado.label} tone={estado.tone} />}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/** Indicadores de clientes y los que hay que recuperar, en una columna. */
export function PanelClientes({
  clientesMes,
  nuevos,
  contado,
  concentracion,
  clientes12m,
  enRiesgo,
  enRiesgoTotal,
}: {
  clientesMes: number;
  nuevos: number;
  contado: number | null;
  concentracion: number | null;
  clientes12m: number;
  enRiesgo: ClienteEnRiesgo[] | null;
  enRiesgoTotal: { clientes: number; usd_12m: number };
}) {
  return (
    <section className={`${claseTarjeta} flex flex-col`} aria-labelledby="panel-clientes">
      <div className="px-5 pt-4">
        <h2 id="panel-clientes" className="text-sm font-semibold text-neutral-900">
          Clientes
        </h2>
      </div>
      <dl className="grid grid-cols-3 gap-4 px-5 py-4">
        <div>
          <dt className="text-xs text-neutral-500">Atendidos</dt>
          <dd className="text-xl font-semibold text-neutral-900">{entero(clientesMes)}</dd>
          <dd className="text-xs text-neutral-500">{entero(nuevos)} {nuevos === 1 ? "nuevo" : "nuevos"}</dd>
        </div>
        <div>
          <dt className="text-xs text-neutral-500">De contado</dt>
          <dd className="text-xl font-semibold text-neutral-900">{pct(contado)}</dd>
          <dd className="text-xs text-neutral-500">de la venta</dd>
        </div>
        <div>
          <dt className="text-xs text-neutral-500">Top 10</dt>
          <dd className="text-xl font-semibold text-neutral-900">{pct(concentracion)}</dd>
          <dd className="text-xs text-neutral-500">de {entero(clientes12m)} clientes</dd>
        </div>
      </dl>
      <div className="border-t border-neutral-100 px-5 py-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-sm font-semibold text-neutral-900">Por recuperar</h3>
          <span className="text-xs text-neutral-500">
            {entero(enRiesgoTotal.clientes)} · {usd(enRiesgoTotal.usd_12m)} en 12 meses
          </span>
        </div>
        <p className="mt-0.5 text-xs text-neutral-500">Compraban seguido y llevan 45 días o más sin comprar.</p>
        {enRiesgo === null ? (
          <p className="mt-3 text-xs text-neutral-500">Los nombres los ve quien tiene permiso de ver facturas.</p>
        ) : enRiesgo.length === 0 ? (
          <p className="mt-3 text-sm text-neutral-600">Ningún cliente frecuente lleva 45 días sin comprar.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-3">
            {enRiesgo.map((c) => (
              <li key={c.cliente} className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <ButtonLink
                    variant="link"
                    href={`/clientes/detalle?${new URLSearchParams({ cliente: c.cliente }).toString()}`}
                    className="max-w-full"
                  >
                    <span className="truncate">{c.cliente}</span>
                  </ButtonLink>
                  <p className="truncate text-xs text-neutral-500">
                    {usd(c.usd_12m)} en 12 meses{c.vendedor ? ` · ${c.vendedor.nombre}` : ""}
                  </p>
                </div>
                <span className="shrink-0 whitespace-nowrap">
                  <StatusBadge label={haceDias(c.dias)} tone={c.dias >= 90 ? "negative" : "warning"} />
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

/** Lugar del panel de clientes mientras llegan los indicadores (misma tarjeta, sin cifras). */
export function PanelClientesCargando() {
  return (
    <section className={`${claseTarjeta} flex flex-col`} aria-labelledby="panel-clientes">
      <div className="px-5 pt-4">
        <h2 id="panel-clientes" className="text-sm font-semibold text-neutral-900">
          Clientes
        </h2>
      </div>
      <div className="grid grid-cols-3 gap-4 px-5 py-4" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex flex-col gap-1.5">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-7 w-14" />
            <Skeleton className="h-3 w-12" />
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-3 border-t border-neutral-100 px-5 py-4" aria-hidden="true">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-3/4" />
        <Skeleton className="h-3 w-5/6" />
      </div>
    </section>
  );
}
