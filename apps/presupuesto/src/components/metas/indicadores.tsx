import { ButtonLink, EmptyState, MetricCard, StatusBadge, entero, fechaCorta } from "@nexo/ui";
import {
  estadoCumplimiento,
  etiquetaVendedor,
  haceDias,
  mesPosteriorAlCorte,
  pct,
  pctSigno,
  usd,
} from "@/lib/metas/formato";
import { calcularRitmo, variacion } from "@/lib/metas/ritmo";
import type { ClienteEnRiesgo, ClienteReciente, Indicadores } from "@/lib/metas/tipos";
import { claseTarjeta, claseThead } from "./estilos";

type Datos = Extract<Indicadores, { vinculado: true }>;

type Tono = "neutral" | "positive" | "warning" | "negative" | "pending";

function tonoCumplimiento(fraccion: number | null): Tono {
  const t = estadoCumplimiento(fraccion).tone;
  return fraccion === null ? "pending" : t === "positive" ? "positive" : t === "warning" ? "warning" : "negative";
}

function tonoVariacion(v: number | null): Tono {
  return v === null ? "pending" : v >= 0 ? "positive" : "negative";
}

const hrefCliente = (cliente: string) => `/clientes/detalle?${new URLSearchParams({ cliente }).toString()}`;

/**
 * Ritmo del mes: proyección al cierre, venta necesaria por día hábil,
 * comparación con el mismo período del año anterior y acumulado del año.
 * `metaAcumulada`: compara el acumulado contra la meta a la fecha (solo si
 * todos los meses tienen meta, como el presupuesto de la empresa) y no si el
 * mes elegido es posterior al corte (la meta acumulada no corresponde a lo vendido).
 */
export function TarjetasRitmo({
  datos,
  anio,
  mes,
  metaAcumulada,
}: {
  datos: Datos;
  anio: number;
  mes: number;
  metaAcumulada: boolean;
}) {
  const vendido = Number(datos.mes.vendido_usd) || 0;
  const meta = datos.meta_mes_usd === null ? null : Number(datos.meta_mes_usd);
  const r = calcularRitmo(vendido, meta, datos.dias_habiles_mes, datos.dias_habiles_transcurridos);
  const dias = `${datos.dias_habiles_transcurridos} de ${datos.dias_habiles_mes} días hábiles`;

  const vsAnterior = r.estado === "sin_datos" ? null : variacion(vendido, datos.anio_anterior.a_la_fecha_usd);
  const ytd = Number(datos.ytd.vendido_usd) || 0;
  const vsYtd = variacion(ytd, datos.ytd.anterior_usd);
  const metaYtd =
    metaAcumulada && meta !== null && datos.dias_habiles_mes > 0 && !mesPosteriorAlCorte(datos.corte, anio, mes)
      ? (Number(datos.ytd.meta_previa_usd) || 0) + (meta * datos.dias_habiles_transcurridos) / datos.dias_habiles_mes
      : null;
  const fraccionYtd = metaYtd !== null && metaYtd > 0 ? ytd / metaYtd : null;

  return (
    <section aria-labelledby="ritmo-mes" className="flex flex-col gap-3">
      <h2 id="ritmo-mes" className="text-sm font-semibold text-neutral-900">
        Ritmo del mes
      </h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Proyección al cierre"
          value={r.proyeccion === null ? "—" : usd(r.proyeccion)}
          tone={r.proyeccion === null ? "pending" : meta === null ? "neutral" : tonoCumplimiento(r.fraccionProyectada)}
          hint={
            r.estado === "sin_datos"
              ? "Todavía no hay facturas de este mes"
              : r.estado === "cerrado"
                ? `Mes cerrado${r.fraccionProyectada === null ? "" : ` · ${pct(r.fraccionProyectada)} de la meta`}`
                : `${r.fraccionProyectada === null ? "Sin meta" : `${pct(r.fraccionProyectada)} de la meta`} · ${dias}`
          }
        />
        <MetricCard
          label="Necesitas por día hábil"
          value={r.requeridoPorDia === null ? "—" : r.requeridoPorDia === 0 ? "Meta cumplida" : usd(r.requeridoPorDia)}
          tone={r.requeridoPorDia === null ? "pending" : r.requeridoPorDia === 0 ? "positive" : "neutral"}
          hint={
            meta === null
              ? "Sin meta este mes"
              : r.estado === "cerrado"
                ? "Mes cerrado"
                : `${r.diasRestantes} días hábiles restantes${
                    r.promedioDiario === null ? "" : ` · vas a ${usd(r.promedioDiario)} por día`
                  }`
          }
        />
        <MetricCard
          label={`Vs. ${anio - 1}`}
          value={pctSigno(vsAnterior)}
          tone={tonoVariacion(vsAnterior)}
          hint={
            r.estado === "sin_datos"
              ? "Se compara cuando haya facturas del mes"
              : `Mismo período de ${anio - 1}: ${usd(datos.anio_anterior.a_la_fecha_usd)}`
          }
        />
        <MetricCard
          label="Acumulado del año"
          value={usd(ytd)}
          tone={fraccionYtd === null ? "neutral" : tonoCumplimiento(fraccionYtd)}
          hint={[
            fraccionYtd === null ? null : `${pct(fraccionYtd)} del presupuesto a la fecha`,
            vsYtd === null ? null : `${pctSigno(vsYtd)} vs. ${anio - 1}`,
          ]
            .filter(Boolean)
            .join(" · ") || undefined}
        />
      </div>
    </section>
  );
}

/** Lugar de TarjetasRitmo mientras llega presupuesto_indicadores: mismas etiquetas, valores en esqueleto. */
export function TarjetasRitmoCargando({ anio }: { anio: number }) {
  return (
    <section aria-labelledby="ritmo-mes" className="flex flex-col gap-3">
      <h2 id="ritmo-mes" className="text-sm font-semibold text-neutral-900">
        Ritmo del mes
      </h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {["Proyección al cierre", "Necesitas por día hábil", `Vs. ${anio - 1}`, "Acumulado del año"].map((label) => (
          <MetricCard key={label} label={label} value="—" loading />
        ))}
      </div>
    </section>
  );
}

/** Lugar de TarjetasClientes mientras llega presupuesto_indicadores. */
export function TarjetasClientesCargando({ propio }: { propio: boolean }) {
  return (
    <section aria-labelledby="kpi-clientes" className="flex flex-col gap-3">
      <h2 id="kpi-clientes" className="text-sm font-semibold text-neutral-900">
        {propio ? "Mis clientes" : "Clientes"}
      </h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[propio ? "Mi última factura" : "Concentración top 10", "Clientes atendidos", "Clientes por recuperar", "Venta de contado"].map(
          (label) => (
            <MetricCard key={label} label={label} value="—" loading />
          ),
        )}
      </div>
    </section>
  );
}

/** Indicadores de clientes del mes y de los últimos 12 meses. */
export function TarjetasClientes({ datos, propio }: { datos: Datos; propio: boolean }) {
  const vendido = Number(datos.mes.vendido_usd) || 0;
  const contado = Number(datos.mes.contado_usd) || 0;
  const conNombre12 = Number(datos.clientes_12m.ventas_usd) || 0;
  const riesgo = datos.en_riesgo_total;

  return (
    <section aria-labelledby="kpi-clientes" className="flex flex-col gap-3">
      <h2 id="kpi-clientes" className="text-sm font-semibold text-neutral-900">
        {propio ? "Mis clientes" : "Clientes"}
      </h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {propio ? (
          <MetricCard
            label="Mi última factura"
            value={datos.ultima ? fechaCorta(datos.ultima.fecha) : "—"}
            tone={datos.ultima ? "neutral" : "pending"}
            hint={
              datos.ultima
                ? `${datos.ultima.numero} · ${datos.ultima.cliente} · ${usd(datos.ultima.total_usd)}`
                : datos.detalle
                  ? "Todavía no tienes facturas"
                  : "Sin permiso para ver facturas"
            }
          />
        ) : (
          <MetricCard
            label="Concentración top 10"
            value={conNombre12 > 0 ? pct(Number(datos.clientes_12m.top10_usd) / conNombre12) : "—"}
            tone={conNombre12 > 0 ? "neutral" : "pending"}
            hint={`De la venta a ${entero(datos.clientes_12m.clientes)} clientes con nombre, últimos 12 meses`}
          />
        )}
        <MetricCard
          label="Clientes atendidos"
          value={entero(datos.mes.clientes)}
          hint={`${entero(datos.mes.clientes_nuevos)} ${datos.mes.clientes_nuevos === 1 ? "nuevo" : "nuevos"} este mes · sin contar contado`}
        />
        <MetricCard
          label="Clientes por recuperar"
          value={entero(riesgo.clientes)}
          tone={riesgo.clientes > 0 ? "warning" : "positive"}
          hint={
            riesgo.clientes > 0
              ? `Compraron ${usd(riesgo.usd_12m)} en 12 meses y llevan 45 días o más sin comprar`
              : "Ningún cliente frecuente lleva 45 días sin comprar"
          }
        />
        <MetricCard
          label="Venta de contado"
          value={vendido > 0 ? pct(contado / vendido) : "—"}
          tone={vendido > 0 ? "neutral" : "pending"}
          hint={vendido > 0 ? `${usd(contado)} a "Vario" en el mes` : "Sin ventas en el mes"}
        />
      </div>
    </section>
  );
}

export function TablaClientesEnRiesgo({
  filas,
  conVendedor,
  titulo,
}: {
  filas: ClienteEnRiesgo[];
  conVendedor: boolean;
  titulo: string;
}) {
  return (
    <section className={claseTarjeta} aria-labelledby="clientes-riesgo">
      <div className="px-5 py-4">
        <h2 id="clientes-riesgo" className="text-sm font-semibold text-neutral-900">
          {titulo}
        </h2>
        <p className="mt-0.5 text-xs text-neutral-500">
          Compraron 3 veces o más en 12 meses y llevan 45 días o más sin comprar. Los que más compraban, primero.
        </p>
      </div>
      {filas.length === 0 ? (
        <div className="px-5 pb-5">
          <EmptyState title="No hay clientes por recuperar" description="Tus clientes frecuentes compraron en los últimos 45 días." />
        </div>
      ) : (
        <div className="overflow-x-auto border-t border-neutral-200">
          <table className="w-full text-sm">
            <thead className={claseThead}>
              <tr>
                <th scope="col" className="px-4 py-2.5">Cliente</th>
                <th scope="col" className="px-4 py-2.5">Última compra</th>
                <th scope="col" className="hidden px-4 py-2.5 text-right sm:table-cell">12 meses</th>
                {conVendedor ? <th scope="col" className="hidden px-4 py-2.5 lg:table-cell">Vendedor</th> : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {filas.map((c) => (
                <tr key={c.cliente}>
                  <td className="max-w-[16rem] px-4 py-2.5">
                    <ButtonLink variant="link" href={hrefCliente(c.cliente)} className="max-w-full">
                      <span className="truncate">{c.cliente}</span>
                    </ButtonLink>
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5">
                    <span className="tabular-nums">{fechaCorta(c.ultima_fecha)}</span>{" "}
                    <StatusBadge label={haceDias(c.dias)} tone={c.dias >= 90 ? "negative" : "warning"} />
                  </td>
                  <td className="hidden whitespace-nowrap px-4 py-2.5 text-right tabular-nums sm:table-cell">
                    {usd(c.usd_12m)}
                    <span className="block text-xs text-neutral-500">{entero(c.facturas_12m)} facturas</span>
                  </td>
                  {conVendedor ? (
                    <td className="hidden px-4 py-2.5 lg:table-cell">
                      {c.vendedor ? etiquetaVendedor(c.vendedor.codigo, c.vendedor.nombre) : "—"}
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export function TablaClientesRecientes({ filas, hrefTodos }: { filas: ClienteReciente[]; hrefTodos: string }) {
  return (
    <section className={claseTarjeta} aria-labelledby="clientes-recientes">
      <div className="flex flex-wrap items-start justify-between gap-2 px-5 py-4">
        <div>
          <h2 id="clientes-recientes" className="text-sm font-semibold text-neutral-900">
            Clientes que te compraron hace poco
          </h2>
          <p className="mt-0.5 text-xs text-neutral-500">Su última factura contigo. Sin contar contado.</p>
        </div>
        <ButtonLink variant="link" href={hrefTodos}>
          Ver todos
        </ButtonLink>
      </div>
      {filas.length === 0 ? (
        <div className="px-5 pb-5">
          <EmptyState title="Todavía no tienes clientes con nombre" description="Las ventas de contado (Vario) no se cuentan como cliente." />
        </div>
      ) : (
        <div className="overflow-x-auto border-t border-neutral-200">
          <table className="w-full text-sm">
            <thead className={claseThead}>
              <tr>
                <th scope="col" className="px-4 py-2.5">Cliente</th>
                <th scope="col" className="px-4 py-2.5">Última factura</th>
                <th scope="col" className="px-4 py-2.5 text-right">US$</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {filas.map((c) => (
                <tr key={c.cliente}>
                  <td className="max-w-[16rem] px-4 py-2.5">
                    <ButtonLink variant="link" href={hrefCliente(c.cliente)} className="max-w-full">
                      <span className="truncate">{c.cliente}</span>
                    </ButtonLink>
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5">
                    <span className="tabular-nums">{fechaCorta(c.fecha)}</span>
                    <span className="block text-xs text-neutral-500">
                      {c.numero} · {haceDias(c.dias)}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-right tabular-nums">
                    {usd(c.total_usd)}
                    {c.usd_12m !== null ? (
                      <span className="block text-xs text-neutral-500">{usd(c.usd_12m)} en 12 meses</span>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
