import { Suspense } from "react";
import { Alert, ButtonLink, EmptyState, MetricCard, PageHeader, Skeleton, StatusBadge, entero, fechaCorta } from "@nexo/ui";
import { cs, csReferencia, cumplimiento, datosHasta, estadoCumplimiento, usd } from "@/lib/metas/formato";
import { nombreMes, periodoActual, rangoMes } from "@/lib/metas/periodo";
import type { Indicadores, MiAvance, MisFacturas } from "@/lib/metas/tipos";
import { calcularRitmo } from "@/lib/metas/ritmo";
import { estadoRitmo } from "@/components/metas/tablero";
import {
  TablaClientesEnRiesgo,
  TablaClientesRecientes,
  TarjetasClientes,
  TarjetasClientesCargando,
  TarjetasRitmo,
  TarjetasRitmoCargando,
} from "@/components/metas/indicadores";
import { Anillo, BarraMeta, GraficoMensual } from "@/components/metas/graficos";
import { SelectorPeriodo } from "@/components/metas/selector-periodo";
import { claseTarjeta, claseThead } from "@/components/metas/estilos";
import type { ResultadoIndicadores } from "./indicadores";

type Vinculado = Extract<MiAvance, { vinculado: true }>;
type DatosIndicadores = Extract<Indicadores, { vinculado: true }>;

/**
 * Vista "Mi avance" del vendedor vinculado (presupuesto_mi_avance +
 * presupuesto_mis_facturas). presupuesto_indicadores llega por <Suspense>:
 * la meta, lo vendido y el ticket se ven de inmediato; el estado contra el
 * ritmo, el ritmo del mes, los clientes y sus tablas, cuando responde.
 */
export function VistaMiAvance({
  anio,
  mes,
  anios,
  datos,
  facturas,
  errorFacturas,
  indicadores,
  puedeVerFacturas,
  conListadoEquipo,
  puedeVincular,
  pestanas,
  conPestanas,
}: {
  /** Promesa sin esperar de presupuesto_indicadores (cargarIndicadores); nunca rechaza. */
  indicadores: Promise<ResultadoIndicadores>;
  /** Tiene "Ver facturas" (todas): /facturas es el listado del equipo, filtrado aquí por su vendedor. */
  conListadoEquipo: boolean;
  anio: number;
  mes: number;
  anios: number[];
  datos: MiAvance;
  facturas: MisFacturas | null;
  errorFacturas: string | null;
  puedeVerFacturas: boolean;
  puedeVincular: boolean;
  pestanas: React.ReactNode;
  conPestanas: boolean;
}) {
  const extra: Record<string, string> = conPestanas ? { vista: "mio" } : {};

  if (!datos.vinculado) {
    return (
      <div className="flex max-w-6xl flex-col gap-6">
        <PageHeader title="Mi avance" />
        <EmptyState
          title="Tu usuario todavía no está vinculado a un vendedor de AG Negocio"
          description="Pide al administrador que te vincule en Configuración > Vendedores y usuarios."
          action={puedeVincular ? <ButtonLink href="/configuracion/vendedores">Vincular vendedores</ButtonLink> : null}
        />
      </div>
    );
  }

  const { vendedor, ultima_factura } = datos;
  const primerNombre = vendedor.nombre.split(" ")[0] || vendedor.nombre;
  const actual = periodoActual();
  const esActual = actual.anio === anio && actual.mes === mes;
  const titulo = `Hola, ${primerNombre}. Así vas ${esActual ? "este mes" : `en ${nombreMes(mes)} de ${anio}`}`;
  const hrefClientes = conListadoEquipo ? `/clientes?vendedor=${vendedor.id}` : "/clientes";
  const base = { anio, mes, datos };

  return (
    <div className="flex max-w-6xl flex-col gap-6">
      <PageHeader
        title={titulo}
        description={
          <>
            <span className="capitalize">{nombreMes(mes)}</span> de {anio} · {datosHasta(ultima_factura)}
          </>
        }
        actions={<SelectorPeriodo anio={anio} mes={mes} anios={anios} extra={extra} />}
      />
      {pestanas}

      {/* La key por periodo muestra el esqueleto con el mes nuevo en vez de quedarse con el anterior. */}
      <Suspense key={`cuerpo-${anio}-${mes}`} fallback={<CuerpoMiAvance {...base} ind={null} errorIndicadores={null} cargando />}>
        <CuerpoMiAvanceConIndicadores {...base} indicadores={indicadores} />
      </Suspense>

      <section className={`${claseTarjeta} px-5 py-4`}>
        <GraficoMensual titulo={`Tus ventas de ${anio} contra tu meta`} serie={datos.serie} mesResaltado={mes} />
      </section>

      <Suspense key={`tablas-${anio}-${mes}`} fallback={puedeVerFacturas ? <TablasClientesCargando /> : null}>
        <TablasClientesConIndicadores indicadores={indicadores} hrefTodos={hrefClientes} />
      </Suspense>

      {puedeVerFacturas ? (
        <section className={claseTarjeta} aria-labelledby="mis-ultimas">
          <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-4">
            <h2 id="mis-ultimas" className="text-sm font-semibold text-neutral-900">
              Mis últimas facturas
            </h2>
            <div className="flex flex-wrap items-center gap-4">
              <ButtonLink variant="link" href={hrefClientes}>
                Ver mis clientes
              </ButtonLink>
              <ButtonLink
                variant="link"
                href={
                  conListadoEquipo
                    ? `/facturas?${new URLSearchParams({ ...rangoMes(anio, mes), vendedor: vendedor.id }).toString()}`
                    : `/facturas?anio=${anio}&mes=${mes}`
                }
              >
                Ver todas mis facturas
              </ButtonLink>
            </div>
          </div>
          {errorFacturas ? (
            <div className="px-5 pb-4">
              <Alert tone="error">{errorFacturas}</Alert>
            </div>
          ) : !facturas || facturas.filas.length === 0 ? (
            <div className="px-5 pb-5">
              <EmptyState
                title={`No tienes facturas en ${nombreMes(mes)} de ${anio}`}
                description={ultima_factura ? "Elige otro mes para ver tus ventas." : "Todavía no hay facturas importadas de AG Negocio."}
              />
            </div>
          ) : (
            <TablaFacturasPropias filas={facturas.filas} />
          )}
        </section>
      ) : null}
    </div>
  );
}

interface BaseMiAvance {
  anio: number;
  mes: number;
  datos: Vinculado;
}

async function CuerpoMiAvanceConIndicadores({
  indicadores,
  ...base
}: BaseMiAvance & { indicadores: Promise<ResultadoIndicadores> }) {
  const r = await indicadores;
  return (
    <CuerpoMiAvance
      {...base}
      ind={r.indicadores?.vinculado ? r.indicadores : null}
      errorIndicadores={r.error}
      cargando={false}
    />
  );
}

/**
 * El mes del vendedor: cumplimiento, meta, vendido y ticket, y el ritmo con
 * sus clientes. `cargando`: todavía no llegan los indicadores (el estado y
 * las tarjetas del ritmo van en esqueleto).
 */
function CuerpoMiAvance({
  anio,
  mes,
  datos,
  ind,
  errorIndicadores,
  cargando,
}: BaseMiAvance & { ind: DatosIndicadores | null; errorIndicadores: string | null; cargando: boolean }) {
  const { vendedor, avance, tipo_cambio: tc } = datos;
  const meta = avance.meta_usd === null ? null : Number(avance.meta_usd);
  const vendido = Number(avance.vendido_usd) || 0;
  const fraccion = cumplimiento(vendido, meta);
  // Mes en curso: mismo criterio que el equipo (contra el ritmo a la fecha). Mes
  // cerrado o sin días hábiles disponibles: contra la meta completa.
  const ritmo = ind ? calcularRitmo(vendido, meta, ind.dias_habiles_mes, ind.dias_habiles_transcurridos) : null;
  const estado = ritmo?.estado === "en_curso" ? estadoRitmo(ritmo, meta, vendido) : estadoCumplimiento(fraccion);
  const ticket = avance.facturas > 0 ? vendido / avance.facturas : null;

  return (
    <>
      {cargando ? (
        <p role="status" className="sr-only">
          Cargando el ritmo del mes y los indicadores…
        </p>
      ) : null}

      <section className={`${claseTarjeta} flex flex-col gap-5 px-5 py-5 sm:flex-row sm:items-center`} aria-labelledby="mi-mes">
        <h2 id="mi-mes" className="sr-only">
          Cumplimiento del mes
        </h2>
        {meta !== null && meta > 0 ? (
          <>
            <Anillo fraccion={fraccion} etiqueta="Cumplimiento del mes" />
            <div className="flex min-w-0 flex-1 flex-col gap-3">
              <div className="flex flex-wrap items-center gap-2">
                {cargando ? <Skeleton className="h-5 w-28" /> : <StatusBadge label={estado.label} tone={estado.tone} />}
                {!vendedor.activo ? <StatusBadge label="Inactivo" tone="neutral" /> : null}
                <span className="text-sm text-neutral-500">
                  Vendedor {vendedor.codigo} · {vendedor.nombre}
                </span>
              </div>
              <BarraMeta vendido={vendido} meta={meta} etiqueta="Vendido contra la meta del mes" />
            </div>
          </>
        ) : (
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge label={meta === null ? "Sin meta" : "Meta en 0"} tone="neutral" />
              {!vendedor.activo ? <StatusBadge label="Inactivo" tone="neutral" /> : null}
            </div>
            {meta === null ? (
              <>
                <p className="text-sm font-semibold text-neutral-900">
                  Tu meta de {nombreMes(mes)} todavía no está definida
                </p>
                <p className="text-sm text-neutral-500">Lo que llevas vendido se muestra igual. Tu gerente define la meta.</p>
              </>
            ) : (
              <>
                <p className="text-sm font-semibold text-neutral-900">
                  Tu meta de {nombreMes(mes)} es {usd(0)} (sin ventas en los 3 meses anteriores)
                </p>
                <p className="text-sm text-neutral-500">Pide a tu gerente que la ajuste. Lo que llevas vendido se muestra igual.</p>
              </>
            )}
          </div>
        )}
      </section>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <MetricCard
          label="Meta del mes"
          value={meta === null ? "Sin meta" : usd(meta)}
          tone={meta === null ? "pending" : "neutral"}
          hint={
            meta === null
              ? "Todavía no está definida"
              : meta === 0
                ? "Pide a tu gerente que la ajuste"
                : `${csReferencia(meta, tc)} · ${avance.meta_origen === "ajustada" ? "Ajustada por tu gerente" : "Sugerida"}`
          }
        />
        <MetricCard
          label="Vendido"
          value={usd(vendido)}
          hint={`${cs(avance.vendido_cs)} · ${entero(avance.facturas)} ${avance.facturas === 1 ? "factura" : "facturas"}${
            avance.anuladas > 0 ? ` · ${entero(avance.anuladas)} anuladas no suman` : ""
          }`}
        />
        <MetricCard
          label="Ticket promedio"
          value={ticket === null ? "—" : usd(ticket)}
          hint={ticket === null ? "Sin facturas en el mes" : `${csReferencia(ticket, tc)} por factura`}
        />
      </div>

      {errorIndicadores ? <Alert tone="error">{errorIndicadores}</Alert> : null}
      {cargando ? (
        <>
          <TarjetasRitmoCargando anio={anio} />
          <TarjetasClientesCargando propio />
        </>
      ) : ind ? (
        <>
          {/* El acumulado del vendedor se compara con el año anterior: sus metas no cubren todos los meses. */}
          <TarjetasRitmo datos={ind} anio={anio} mes={mes} metaAcumulada={false} />
          <TarjetasClientes datos={ind} propio />
        </>
      ) : null}
    </>
  );
}

/** Clientes recientes y por recuperar del vendedor: solo con permiso de facturas (la RPC manda las listas en null si no). */
async function TablasClientesConIndicadores({
  indicadores,
  hrefTodos,
}: {
  indicadores: Promise<ResultadoIndicadores>;
  hrefTodos: string;
}) {
  const { indicadores: r } = await indicadores;
  const ind = r?.vinculado ? r : null;
  if (!ind || !ind.recientes || !ind.en_riesgo) return null;
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <TablaClientesRecientes filas={ind.recientes} hrefTodos={hrefTodos} />
      <TablaClientesEnRiesgo filas={ind.en_riesgo} conVendedor={false} titulo="Mis clientes por recuperar" />
    </div>
  );
}

function TablasClientesCargando() {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2" aria-hidden="true">
      {[0, 1].map((i) => (
        <div key={i} className={`${claseTarjeta} flex flex-col gap-3 px-5 py-4`}>
          <Skeleton className="h-4 w-56 max-w-full" />
          <Skeleton className="h-3 w-72 max-w-full" />
          {[0, 1, 2, 3].map((j) => (
            <Skeleton key={j} className="h-4 w-full" />
          ))}
        </div>
      ))}
    </div>
  );
}

function TablaFacturasPropias({ filas }: { filas: MisFacturas["filas"] }) {
  return (
    <div className="overflow-x-auto border-t border-neutral-200">
      <table className="w-full text-sm">
        <thead className={claseThead}>
          <tr>
            <th scope="col" className="px-4 py-2.5">Fecha</th>
            <th scope="col" className="px-4 py-2.5">N.º</th>
            <th scope="col" className="px-4 py-2.5">Cliente</th>
            <th scope="col" className="px-4 py-2.5 text-right">US$</th>
            <th scope="col" className="hidden px-4 py-2.5 text-right sm:table-cell">C$</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100">
          {filas.map((f) => (
            <tr key={f.numero} className={f.anulada ? "text-neutral-500" : undefined}>
              <td className="whitespace-nowrap px-4 py-2.5 tabular-nums">{fechaCorta(f.fecha)}</td>
              <td className="whitespace-nowrap px-4 py-2.5 font-mono text-xs">
                {f.numero} {f.anulada ? <StatusBadge label="Anulada" tone="negative" /> : null}
              </td>
              <td className="max-w-[16rem] truncate px-4 py-2.5">{f.cliente ?? "—"}</td>
              <td className="whitespace-nowrap px-4 py-2.5 text-right tabular-nums">{usd(f.total_usd)}</td>
              <td className="hidden whitespace-nowrap px-4 py-2.5 text-right tabular-nums sm:table-cell">{cs(f.total_cs)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
