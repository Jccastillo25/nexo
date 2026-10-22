import { Suspense } from "react";
import { Alert, ButtonLink, EmptyState, MetricCard, PageHeader, Skeleton, entero } from "@nexo/ui";
import { UMBRAL_RIESGO, datosHasta, etiquetaVendedor, mesPosteriorAlCorte, pct, pctSigno, usd } from "@/lib/metas/formato";
import { capitalizar, nombreMes, ventanaBase } from "@/lib/metas/periodo";
import type { Equipo, Indicadores, MetasMes, VentaDiaria } from "@/lib/metas/tipos";
import { calcularRitmo, proyectar, variacion } from "@/lib/metas/ritmo";
import { diaDeCorte, serieAcumulada } from "@/lib/metas/acumulado";
import { GraficoMensual } from "@/components/metas/graficos";
import { GraficoAcumulado } from "@/components/metas/grafico-acumulado";
import { HeroMes, PanelClientes, PanelClientesCargando, RankingVendedores, estadoProyeccion } from "@/components/metas/tablero";
import { SelectorPeriodo } from "@/components/metas/selector-periodo";
import { claseTarjeta, claseThead } from "@/components/metas/estilos";
import { GenerarSugeridas } from "../metas/por-vendedor/generar-sugeridas";
import { ElegirVendedores } from "./elegir-vendedores";
import type { ResultadoIndicadores } from "./indicadores";

type Tono = "neutral" | "positive" | "warning" | "negative" | "pending";
type DatosIndicadores = Extract<Indicadores, { vinculado: true }>;

interface PermisosEquipo {
  importar: boolean;
  metasVend: boolean;
  presupuesto: boolean;
}

/** Lo que el cuerpo del equipo necesita sin presupuesto_indicadores (ya cargado por la página). */
interface BaseEquipo {
  anio: number;
  mes: number;
  datos: Equipo;
  metaEmpresa: number | null;
  ventaDiaria: VentaDiaria | null;
  /** Mensaje para el usuario si falló presupuesto_venta_diaria (ya registrado en el servidor). */
  errorVentaDiaria: string | null;
  permisos: PermisosEquipo;
}

/**
 * Vista "Equipo" del gerente, en pirámide: el número del mes con su ritmo,
 * cuatro indicadores, la venta acumulada día a día, los vendedores contra su
 * meta y, al final, el año y cómo se calcularon las metas.
 *
 * Los días hábiles (y con ellos el ritmo, la proyección y los indicadores)
 * salen de presupuesto_indicadores, que llega por <Suspense>: mientras tanto
 * el mismo cuerpo se pinta con lo vendido, la meta y el equipo, y esqueletos
 * donde va lo que depende del ritmo.
 */
export function VistaEquipo({
  anio,
  mes,
  anios,
  datos,
  metasMes,
  indicadores,
  ventaDiaria,
  errorVentaDiaria,
  permisos,
  pestanas,
}: {
  anio: number;
  mes: number;
  anios: number[];
  datos: Equipo;
  metasMes: MetasMes | null;
  /** Promesa sin esperar de presupuesto_indicadores (cargarIndicadores); nunca rechaza. */
  indicadores: Promise<ResultadoIndicadores>;
  ventaDiaria: VentaDiaria | null;
  errorVentaDiaria: string | null;
  permisos: PermisosEquipo;
  pestanas: React.ReactNode;
}) {
  const metaEmpresa = datos.meta_empresa_usd === null ? null : Number(datos.meta_empresa_usd);
  const nombre = capitalizar(nombreMes(mes));
  const topSugeridas = (metasMes?.vendedores ?? []).filter((v) => v.sugerida_usd !== null).slice(0, 5);
  const base: BaseEquipo = { anio, mes, datos, metaEmpresa, ventaDiaria, errorVentaDiaria, permisos };

  return (
    <div className="flex max-w-6xl flex-col gap-6">
      <PageHeader
        title="Avance del equipo"
        description={`${nombre} de ${anio} · ${datosHasta(datos.ultima_factura)}`}
        actions={<SelectorPeriodo anio={anio} mes={mes} anios={anios} />}
      />
      {pestanas}

      {datos.ultima_factura === null ? (
        <Alert
          title="Primer paso: importar las facturas de AG Negocio"
          action={
            permisos.importar ? (
              <ButtonLink href="/importar" size="sm">
                Ir a Importar
              </ButtonLink>
            ) : null
          }
        >
          Sube el reporte de facturas tal como sale de AG Negocio. Revisas lo que se leyó y nada se guarda hasta que confirmes.
        </Alert>
      ) : null}

      {metaEmpresa === null ? (
        <Alert
          tone="warning"
          title={`Todavía no hay presupuesto para ${anio}`}
          action={
            permisos.presupuesto ? (
              // Una sola acción primaria por pantalla: si falta importar, ese es el primer paso.
              <ButtonLink
                href={`/anual?anio=${anio}`}
                size="sm"
                variant={datos.ultima_factura === null && permisos.importar ? "secondary" : "primary"}
              >
                Definir presupuesto
              </ButtonLink>
            ) : null
          }
        >
          {permisos.presupuesto
            ? "Sin presupuesto no hay meta de la empresa ni metas por vendedor."
            : "Sin presupuesto no hay meta de la empresa. Pídeselo al administrador."}
        </Alert>
      ) : null}

      {/* 1 a 4: dependen de los días hábiles de presupuesto_indicadores. La key por
          periodo hace que, al cambiar de mes, se vea el esqueleto con los datos nuevos
          en vez de quedarse el mes anterior hasta que respondan los indicadores. */}
      <Suspense key={`${anio}-${mes}`} fallback={<CuerpoEquipo {...base} ind={null} errorIndicadores={null} cargando />}>
        <CuerpoEquipoConIndicadores {...base} indicadores={indicadores} />
      </Suspense>

      {/* 5. El año y el detalle de las metas */}
      <section className={`${claseTarjeta} px-5 py-4`}>
        <GraficoMensual
          titulo={`Presupuesto vs. ventas reales ${anio}`}
          serie={datos.serie_empresa}
          etiquetaMeta="Presupuesto"
          mesResaltado={mes}
        />
      </section>

      <details className={`${claseTarjeta} group px-5 py-4`}>
        <summary className="cursor-pointer list-none rounded-sm text-sm font-semibold text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
          <span className="mr-1 inline-block text-neutral-400 transition-transform group-open:rotate-90 motion-reduce:transition-none" aria-hidden="true">
            ›
          </span>
          Cómo se calculó la meta sugerida
        </summary>
        <div className="mt-3 flex flex-col gap-3">
          <p className="text-sm text-neutral-600">
            La meta de {nombreMes(mes)} de la empresa se reparte entre los vendedores activos según lo que vendió cada uno
            en los 3 meses anteriores ({ventanaBase(anio, mes)}). Quien no vendió en esos meses queda con 0 y su gerente le
            ajusta la meta a mano. Las metas ajustadas no se pisan al volver a generar.
          </p>
          {permisos.metasVend && topSugeridas.length > 0 ? (
            <div className="overflow-x-auto rounded-lg border border-neutral-200">
              <table className="w-full text-sm">
                <thead className={claseThead}>
                  <tr>
                    <th scope="col" className="px-3 py-2">Vendedor</th>
                    <th scope="col" className="px-3 py-2 text-right">Base</th>
                    <th scope="col" className="px-3 py-2 text-right">Peso</th>
                    <th scope="col" className="px-3 py-2 text-right">Sugerida</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 tabular-nums">
                  {topSugeridas.map((v) => (
                    <tr key={v.id}>
                      <td className="px-3 py-2">{etiquetaVendedor(v.codigo, v.nombre)}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-right">{usd(v.base_usd)}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-right">{pct(v.peso)}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-right">{usd(v.sugerida_usd)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
          {permisos.metasVend ? (
            <ButtonLink variant="link" href={`/metas/por-vendedor?anio=${anio}&mes=${mes}`} className="self-start">
              Ajustar metas
            </ButtonLink>
          ) : null}
        </div>
      </details>
    </div>
  );
}

/** Espera los indicadores y pinta el cuerpo completo (lo mismo que había antes del <Suspense>). */
async function CuerpoEquipoConIndicadores({
  indicadores,
  ...base
}: BaseEquipo & { indicadores: Promise<ResultadoIndicadores> }) {
  const r = await indicadores;
  return (
    <CuerpoEquipo
      {...base}
      ind={r.indicadores?.vinculado ? r.indicadores : null}
      errorIndicadores={r.error}
      cargando={false}
    />
  );
}

/**
 * Pisos 1 a 4 de la pirámide. `cargando`: todavía no llegan los indicadores;
 * lo vendido, la meta, el ticket y el equipo ya se ven, y el ritmo, los
 * indicadores, la venta acumulada y los clientes van en esqueleto. Sin
 * `cargando` e `ind` en null, falló la RPC: el ritmo se marca como no
 * disponible (no es lo mismo que "sin facturas del mes").
 */
function CuerpoEquipo({
  anio,
  mes,
  datos,
  metaEmpresa,
  ventaDiaria,
  errorVentaDiaria,
  permisos,
  ind,
  errorIndicadores,
  cargando,
}: BaseEquipo & { ind: DatosIndicadores | null; errorIndicadores: string | null; cargando: boolean }) {
  const vendedores = datos.vendedores;
  const vendido = vendedores.reduce((a, v) => a + (Number(v.vendido_usd) || 0), 0);
  const vendidoCs = vendedores.reduce((a, v) => a + (Number(v.vendido_cs) || 0), 0);
  const nFacturas = vendedores.reduce((a, v) => a + (Number(v.facturas) || 0), 0);

  const sinRitmo = ind === null;
  const diasMes = ind?.dias_habiles_mes ?? 0;
  const diasTrans = ind?.dias_habiles_transcurridos ?? 0;
  const ritmo = calcularRitmo(vendido, metaEmpresa, diasMes, diasTrans);
  const cerrado = ritmo.estado === "cerrado";
  const enCurso = ritmo.estado === "en_curso";

  // Indicadores de segundo nivel.
  const vsAnterior = ind && !(ritmo.estado === "sin_datos") ? variacion(vendido, ind.anio_anterior.a_la_fecha_usd) : null;
  const ytd = ind ? Number(ind.ytd.vendido_usd) || 0 : null;
  // Si el mes elegido es posterior al corte, la meta acumulada no corresponde a lo vendido: no se compara.
  const metaYtd =
    ind && metaEmpresa !== null && diasMes > 0 && !mesPosteriorAlCorte(ind.corte, anio, mes)
      ? (Number(ind.ytd.meta_previa_usd) || 0) + (metaEmpresa * diasTrans) / diasMes
      : null;
  const fraccionYtd = ytd !== null && metaYtd !== null && metaYtd > 0 ? ytd / metaYtd : null;
  const vsYtd = ind && ytd !== null ? variacion(ytd, ind.ytd.anterior_usd) : null;

  // Vendedores: los elegidos para el cuadro (en_tablero); los ocultos cuentan en los totales.
  const proyeccionDe = (v: number) => (enCurso ? proyectar(Number(v) || 0, diasMes, diasTrans) : null);
  const visibles = vendedores.filter((v) => v.en_tablero !== false);
  const ocultos = vendedores.filter((v) => v.en_tablero === false);
  const vendidoOcultos = ocultos.reduce((a, v) => a + (Number(v.vendido_usd) || 0), 0);
  const conMeta = vendedores.filter((v) => v.meta_usd !== null && Number(v.meta_usd) > 0);
  const vanACumplir = conMeta.filter((v) => {
    const base = enCurso ? proyeccionDe(v.vendido_usd) ?? 0 : Number(v.vendido_usd) || 0;
    return estadoProyeccion(base / Number(v.meta_usd), cerrado).tone === "positive";
  });
  const sinMetas = vendedores.length > 0 && vendedores.every((v) => v.meta_usd === null);
  const filasRanking = [...visibles]
    .sort((a, b) => Number(b.vendido_usd) - Number(a.vendido_usd))
    .map((v) => ({ vendedor: v, proyeccion: proyeccionDe(v.vendido_usd) }));

  // Venta acumulada día a día.
  const dias = ventaDiaria?.vinculado ? ventaDiaria.dias : null;
  const serie = dias ? serieAcumulada(dias, metaEmpresa, diaDeCorte(ind?.corte ?? datos.ultima_factura, anio, mes, dias.length)) : null;

  const tono = (v: number | null): Tono => (v === null ? "pending" : v >= 0 ? "positive" : "negative");
  const tonoFraccion = (f: number | null): Tono =>
    f === null ? "neutral" : f >= 1 ? "positive" : f >= UMBRAL_RIESGO ? "warning" : "negative";
  const ticket = nFacturas > 0 ? vendido / nFacturas : null;

  return (
    <>
      {cargando ? (
        <p role="status" className="sr-only">
          Cargando el ritmo del mes y los indicadores…
        </p>
      ) : null}
      {errorIndicadores ? <Alert tone="error">{errorIndicadores}</Alert> : null}

      {/* 1. El número del mes */}
      <HeroMes
        titulo={`Venta de ${nombreMes(mes)}`}
        vendido={vendido}
        vendidoCs={vendidoCs}
        facturas={nFacturas}
        meta={metaEmpresa}
        ritmo={ritmo}
        diasMes={diasMes}
        diasTranscurridos={diasTrans}
        ritmoDisponible={!sinRitmo}
        ritmoCargando={cargando}
      />

      {/* 2. Indicadores de segundo nivel */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label={`Vs. ${nombreMes(mes)} ${anio - 1}`}
          value={pctSigno(vsAnterior)}
          tone={cargando ? "neutral" : tono(vsAnterior)}
          loading={cargando}
          hint={ind ? `Mismo período: ${usd(ind.anio_anterior.a_la_fecha_usd)}` : undefined}
        />
        <MetricCard
          label="Acumulado del año"
          value={ytd === null ? "—" : usd(ytd)}
          tone={tonoFraccion(fraccionYtd)}
          loading={cargando}
          hint={[
            fraccionYtd === null ? null : `${pct(fraccionYtd)} del presupuesto a la fecha`,
            vsYtd === null ? null : `${pctSigno(vsYtd)} vs. ${anio - 1}`,
          ]
            .filter(Boolean)
            .join(" · ") || undefined}
        />
        <MetricCard
          label={cerrado ? "Vendedores que cumplieron" : "Vendedores que van a cumplir"}
          value={conMeta.length === 0 || ritmo.estado === "sin_datos" ? "—" : `${vanACumplir.length} de ${conMeta.length}`}
          tone={cargando ? "neutral" : conMeta.length === 0 || ritmo.estado === "sin_datos" ? "pending" : "neutral"}
          loading={cargando}
          hint={
            cargando
              ? undefined
              : conMeta.length === 0
                ? "Sin metas asignadas este mes"
                : sinRitmo
                  ? "No se pudo calcular el ritmo"
                  : cerrado
                    ? "Con meta mayor que 0"
                    : "Según su proyección al cierre"
          }
        />
        <MetricCard
          label="Ticket promedio"
          value={ticket === null ? "—" : usd(ticket)}
          tone={ticket === null ? "pending" : "neutral"}
          hint={ticket === null ? "Sin facturas en el mes" : `por factura · ${entero(nFacturas)} ${nFacturas === 1 ? "factura" : "facturas"}`}
        />
      </div>

      {/* 3. Tendencia del mes + clientes */}
      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-3">
        <section className={`${claseTarjeta} flex flex-col gap-3 px-5 py-4 xl:col-span-2`} aria-labelledby="acumulado">
          <div>
            <h2 id="acumulado" className="text-sm font-semibold text-neutral-900">
              Venta acumulada de {nombreMes(mes)}
            </h2>
            <p className="text-xs text-neutral-500">
              Por encima de la línea punteada, el equipo va adelantado para la meta.
            </p>
          </div>
          {!serie ? (
            <Alert tone="error">{errorVentaDiaria ?? "No se pudo cargar la venta por día."}</Alert>
          ) : cargando ? (
            <div className="flex flex-col gap-3" aria-hidden="true">
              <Skeleton className="h-4 w-72 max-w-full" />
              <Skeleton className="h-52 w-full sm:h-60" />
            </div>
          ) : (
            <GraficoAcumulado
              serie={serie}
              meta={metaEmpresa}
              proyeccion={enCurso ? ritmo.proyeccion : null}
              anioAnterior={anio - 1}
              nombreMes={nombreMes(mes)}
            />
          )}
        </section>
        {cargando ? (
          <PanelClientesCargando />
        ) : ind ? (
          <PanelClientes
            clientesMes={ind.mes.clientes}
            nuevos={ind.mes.clientes_nuevos}
            contado={vendido > 0 ? Number(ind.mes.contado_usd) / vendido : null}
            concentracion={Number(ind.clientes_12m.ventas_usd) > 0 ? Number(ind.clientes_12m.top10_usd) / Number(ind.clientes_12m.ventas_usd) : null}
            clientes12m={ind.clientes_12m.clientes}
            enRiesgo={ind.en_riesgo}
            enRiesgoTotal={ind.en_riesgo_total}
          />
        ) : null}
      </div>

      {/* 4. Vendedores contra su meta */}
      <section className={claseTarjeta} aria-labelledby="tabla-equipo">
        <div className="flex flex-wrap items-start justify-between gap-3 px-5 py-4">
          <div>
            <h2 id="tabla-equipo" className="text-sm font-semibold text-neutral-900">
              Vendedores contra su meta
              {ocultos.length > 0 ? (
                <span className="ml-2 text-xs font-normal text-neutral-500">
                  {visibles.length} de {vendedores.length} a la vista
                </span>
              ) : null}
            </h2>
            <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-500">
              <li className="flex items-center gap-1.5">
                <span aria-hidden="true" className="h-2.5 w-2.5 rounded-sm bg-blue-600" /> Vendido
              </li>
              {enCurso ? (
                <li className="flex items-center gap-1.5">
                  <span aria-hidden="true" className="h-2.5 w-2.5 rounded-sm bg-blue-300" /> Proyección al cierre
                </li>
              ) : null}
              <li className="flex items-center gap-1.5">
                <span aria-hidden="true" className="h-3 w-0.5 rounded bg-neutral-900" /> Meta
              </li>
            </ul>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {sinMetas && permisos.metasVend && metaEmpresa !== null ? <GenerarSugeridas anio={anio} mes={mes} /> : null}
            {permisos.metasVend && vendedores.length > 0 ? <ElegirVendedores vendedores={vendedores} /> : null}
          </div>
        </div>
        {vendedores.length === 0 ? (
          <div className="px-5 pb-5">
            <EmptyState
              title="Todavía no hay vendedores"
              description="Los vendedores se crean solos al importar las facturas de AG Negocio, con su código."
              action={
                // Secundaria: sin vendedores tampoco hay facturas, y el aviso de arriba ya lleva la primaria.
                permisos.importar ? (
                  <ButtonLink href="/importar" variant="secondary">
                    Ir a Importar
                  </ButtonLink>
                ) : null
              }
            />
          </div>
        ) : (
          <div className="border-t border-neutral-200">
            <RankingVendedores
              filas={filasRanking}
              cerrado={cerrado}
              sinDatos={!sinRitmo && ritmo.estado === "sin_datos"}
              sinRitmo={sinRitmo}
              cargando={cargando}
            />
            {ocultos.length > 0 ? (
              <p className="border-t border-neutral-100 bg-neutral-50 px-5 py-2.5 text-xs text-neutral-600">
                {ocultos.length === 1 ? "1 vendedor oculto" : `${ocultos.length} vendedores ocultos`} vendieron{" "}
                <span className="font-semibold tabular-nums">{usd(vendidoOcultos)}</span>. Cuentan en los totales de la empresa.
              </p>
            ) : null}
          </div>
        )}
      </section>
    </>
  );
}
