import type { Metadata } from "next";
import { contextoActual } from "@nexo/auth";
import {
  ButtonLink,
  DataTable,
  EmptyState,
  MetricCard,
  PageHeader,
  StatusBadge,
  entero,
  fechaHora,
  porcentaje,
  type DataTableColumn,
  type MetricCardDelta,
  type StatusTone,
} from "@nexo/ui";
import type { Database } from "@/lib/supabase/database.types";
import { permisosAsistencia } from "@/lib/permisos-asistencia";
import { sumarDias, ventanasDeMarcas, type Ventana } from "@/lib/fecha-managua";
import { consultarReporte, type Cliente, type Fallo, type Resultado } from "@/lib/reportes-asistencia/datos";
import {
  fechaCorta,
  filtrosAQuery,
  filtrosDeRango,
  horaProgramada,
  minutosHM,
  periodo,
  persona,
  rangoPorDefecto,
  variacionPuntos,
} from "@/lib/reportes-asistencia/formato";
import { rutaReporte } from "@/lib/reportes-asistencia/rutas";
import type { DatosReporte, FilaDiaria, FiltrosReporte } from "@/lib/reportes-asistencia/tipos";

export const metadata: Metadata = {
  title: "Dashboard · Asistencia",
};

/** Filas de la lista "Pendientes de marcar" (el total completo sale del reporte). */
const LIMITE_PENDIENTES = 10;

/** Tarjeta cuya consulta falló: "No disponible", nunca un 0. */
const NO_DISPONIBLE = { value: "—", hint: "No disponible", tone: "pending" as const };
const FALLO: Fallo = { ok: false, motivo: "error", mensaje: "No disponible" };

/** Rango de fechas de negocio (YYYY-MM-DD, ambos incluidos). */
type Rango = { desde: string; hasta: string };

type EstadoTerminal = "asignada" | "codigo_pendiente" | "sin_asignar";
type Terminal = { clave: string; nombre: string; estado: EstadoTerminal | null; ultimoUso: string | null };
type ResultadoTerminales = { ok: true; terminales: Terminal[]; estadoDisponible: boolean } | { ok: false };

const ESTADO_TERMINAL: Record<EstadoTerminal, { label: string; tone: StatusTone }> = {
  asignada: { label: "Asignada", tone: "positive" },
  codigo_pendiente: { label: "Código pendiente", tone: "warning" },
  sin_asignar: { label: "Sin asignar", tone: "neutral" },
};

/**
 * Dashboard de Asistencia: ¿quién marcó hoy, quién falta por marcar y qué hay
 * que corregir? Hora de Nicaragua. Cada bloque se consulta y se muestra solo
 * con su permiso (la lista de permisos es la misma que cargó el layout: no hay
 * otra consulta de permisos). Si una consulta falla, solo su tarjeta dice
 * "No disponible" y el resto carga.
 *
 * Con `rrhh.asistencia.reportes.ver` (mismas RPC que los reportes, que validan
 * permiso y empresa en la base):
 * - hoy (diario, sin no laborables, p_limit 1): E = total; tardanzas y minutos;
 * - hoy con estado pendiente_hoy (p_limit 10): P = total y la lista;
 * - hoy−7 a hoy−1 (diario, p_limit 1): marcas incompletas;
 * - resumen de hoy−29 a hoy y de hoy−59 a hoy−30: puntualidad y su variación.
 * Sin reportes y con `rrhh.asistencia.marcas.ver`: conteo de marcas de hoy
 * contra ayer a la misma hora. Con `rrhh.asistencia.kioskos.ver`: terminales.
 */
export default async function AsistenciaDashboardPage() {
  const [{ supabase, companyId }, permisos] = await Promise.all([contextoActual<Database>(), permisosAsistencia()]);
  const { hoy, hoyCompleto, ayerHastaEstaHora } = ventanasDeMarcas();

  const verReportes = permisos.reportesVer;
  // El conteo de marcas solo es el número principal de quien no ve reportes.
  const verMarcas = !verReportes && permisos.marcasVer;
  const verTerminales = permisos.kioskosVer;

  if (!verReportes && !verMarcas && !verTerminales) {
    return (
      <div className="flex max-w-6xl flex-col gap-6">
        <Encabezado hoy={hoy} />
        <EmptyState variant="no-access" title="No tienes acceso a los datos de Asistencia" />
      </div>
    );
  }

  const deHoy: Rango = { desde: hoy, hasta: hoy };
  const semana: Rango = { desde: sumarDias(hoy, -7), hasta: sumarDias(hoy, -1) };
  const treinta: Rango = { desde: sumarDias(hoy, -29), hasta: hoy };
  const treintaAnterior: Rango = { desde: sumarDias(hoy, -59), hasta: sumarDias(hoy, -30) };

  // Todo en paralelo; un bloque sin permiso no se consulta.
  const [general, pendientes, ultimaSemana, puntualidad, puntualidadAnterior, marcasHoy, marcasAyer, terminales] =
    await Promise.all([
      verReportes ? diaria(supabase, companyId, deHoy, {}, 1) : null,
      verReportes ? diaria(supabase, companyId, deHoy, { estado: "pendiente_hoy" }, LIMITE_PENDIENTES) : null,
      verReportes ? diaria(supabase, companyId, semana, {}, 1) : null,
      verReportes ? resumen(supabase, companyId, treinta) : null,
      verReportes ? resumen(supabase, companyId, treintaAnterior) : null,
      verMarcas ? contarMarcas(supabase, companyId, hoyCompleto, "las marcas de hoy") : null,
      verMarcas ? contarMarcas(supabase, companyId, ayerHastaEstaHora, "las marcas de ayer a esta hora") : null,
      verTerminales ? leerTerminales(supabase, companyId) : null,
    ]);

  // E = 0 solo cuando la consulta respondió: si falló, no se sabe.
  const sinJornadaHoy = general?.ok === true && general.valor.total === 0;
  const conPendientes = verReportes && !sinJornadaHoy;

  return (
    <div className="flex max-w-6xl flex-col gap-6">
      <Encabezado hoy={hoy} />

      {verReportes ? (
        <>
          {sinJornadaHoy ? (
            <EmptyState
              title="Hoy nadie tiene jornada laborable"
              description="Es feriado, día de descanso o nadie tiene una jornada asignada para hoy. Los indicadores de los últimos días siguen abajo."
            />
          ) : (
            <KpisDeHoy hoy={hoy} general={general} pendientes={pendientes} />
          )}
          <KpisRecientes
            semana={semana}
            treinta={treinta}
            ultimaSemana={ultimaSemana}
            puntualidad={puntualidad}
            puntualidadAnterior={puntualidadAnterior}
          />
        </>
      ) : verMarcas ? (
        <section aria-label="Marcas de hoy" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <MarcasDeHoy hoy={marcasHoy} ayer={marcasAyer} />
        </section>
      ) : null}

      {conPendientes || verTerminales ? (
        <div className={`grid grid-cols-1 items-start gap-6 ${conPendientes && verTerminales ? "lg:grid-cols-3" : ""}`}>
          {conPendientes ? (
            <div className={`min-w-0 ${verTerminales ? "lg:col-span-2" : ""}`}>
              <Pendientes hoy={hoy} resultado={pendientes} />
            </div>
          ) : null}
          {verTerminales ? (
            <div className="min-w-0">
              <Terminales resultado={terminales} />
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

// ------------------------------------------------------------------ bloques

function Encabezado({ hoy }: { hoy: string }) {
  return (
    <PageHeader
      title="Asistencia"
      description={`Hoy, ${fechaCorta(hoy)} · hora de Nicaragua. Quién marcó, quién falta y qué hay que corregir.`}
    />
  );
}

function KpisDeHoy({
  hoy,
  general,
  pendientes,
}: {
  hoy: string;
  general: Resultado<DatosReporte> | null;
  pendientes: Resultado<DatosReporte> | null;
}) {
  const E = general?.ok ? general.valor.total : null;
  const P = pendientes?.ok ? pendientes.valor.total : null;
  const tardanzas = totalDe(general, "tardanzas");
  const minutosTardanza = totalDe(general, "minutos_tardanza");
  const rutaPendientes = rutaReporte("diaria", filtrosAQuery("diaria", filtrosDeRango(hoy, hoy, { estado: "pendiente_hoy" })));
  const rutaTardanzas = rutaReporte("tardanzas", filtrosAQuery("tardanzas", filtrosDeRango(hoy, hoy, { tipo: "tardanza" })));

  return (
    <section aria-label="Asistencia de hoy" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {/* Número principal: ocupa toda la fila en tablet y una columna en escritorio. */}
      <div className="grid sm:col-span-2 lg:col-span-1">
        {E !== null && P !== null ? (
          <MetricCard
            size="hero"
            label="Ya marcaron hoy"
            value={entero(Math.max(0, E - P))}
            unit={`de ${entero(E)}`}
            hint="Personas con jornada hoy que ya registraron al menos una marca"
          />
        ) : (
          <MetricCard size="hero" label="Ya marcaron hoy" {...NO_DISPONIBLE} />
        )}
      </div>
      {P !== null ? (
        <MetricCard
          label="Sin marcar todavía"
          value={entero(P)}
          hint="Con jornada hoy y sin ninguna marca"
          href={P > 0 ? rutaPendientes : undefined}
        />
      ) : (
        <MetricCard label="Sin marcar todavía" {...NO_DISPONIBLE} />
      )}
      {tardanzas !== null ? (
        <MetricCard
          label="Tardanzas hoy"
          value={entero(tardanzas)}
          hint={tardanzas > 0 ? `Retraso acumulado: ${minutosHM(minutosTardanza)} h` : "Nadie ha llegado tarde hoy"}
          href={tardanzas > 0 ? rutaTardanzas : undefined}
        />
      ) : (
        <MetricCard label="Tardanzas hoy" {...NO_DISPONIBLE} />
      )}
    </section>
  );
}

function KpisRecientes({
  semana,
  treinta,
  ultimaSemana,
  puntualidad,
  puntualidadAnterior,
}: {
  semana: Rango;
  treinta: Rango;
  ultimaSemana: Resultado<DatosReporte> | null;
  puntualidad: Resultado<DatosReporte> | null;
  puntualidadAnterior: Resultado<DatosReporte> | null;
}) {
  const incompletos = totalDe(ultimaSemana, "incompletos");
  const rutaIncidencias = rutaReporte("incidencias", filtrosAQuery("incidencias", filtrosDeRango(semana.desde, semana.hasta)));
  const rutaResumen = rutaReporte("resumen", filtrosAQuery("resumen", filtrosDeRango(treinta.desde, treinta.hasta)));

  return (
    <section aria-label="Últimos días" className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {incompletos !== null ? (
        <MetricCard
          label="Marcas incompletas en 7 días"
          value={entero(incompletos)}
          tone={incompletos > 0 ? "warning" : "neutral"}
          hint={
            <>
              {periodo(semana.desde, semana.hasta)} · falta salida, descanso sin cerrar o secuencia por revisar.
              <span className="mt-1 block">El reporte de incidencias incluye también días sin marcas.</span>
            </>
          }
          href={rutaIncidencias}
        />
      ) : (
        <MetricCard label="Marcas incompletas en 7 días" {...NO_DISPONIBLE} />
      )}
      <Puntualidad
        treinta={treinta}
        actual={puntualidad}
        anterior={puntualidadAnterior}
        href={rutaResumen}
      />
    </section>
  );
}

function Puntualidad({
  treinta,
  actual,
  anterior,
  href,
}: {
  treinta: Rango;
  actual: Resultado<DatosReporte> | null;
  anterior: Resultado<DatosReporte> | null;
  href: string;
}) {
  const etiqueta = "Puntualidad en 30 días";
  if (!actual?.ok) return <MetricCard label={etiqueta} {...NO_DISPONIBLE} />;
  // `null` en la RPC = ningún día evaluable en el período (no es un error).
  const valor = actual.valor.totales.puntualidad ?? null;
  if (valor === null) return <MetricCard label={etiqueta} value="—" tone="pending" hint="Sin días evaluables" />;

  const previo = anterior?.ok ? (anterior.valor.totales.puntualidad ?? null) : null;
  const variacion = variacionPuntos(valor, previo);
  const delta: MetricCardDelta | undefined = variacion
    ? { value: variacion.valor, direction: variacion.direccion, label: "vs. los 30 días anteriores" }
    : undefined;
  const rango = periodo(treinta.desde, treinta.hasta);

  return (
    <MetricCard
      label={etiqueta}
      value={porcentaje(valor)}
      delta={delta}
      hint={variacion ? rango : `${rango} · sin datos para comparar con los 30 días anteriores`}
      href={href}
    />
  );
}

function MarcasDeHoy({ hoy, ayer }: { hoy: number | null; ayer: number | null }) {
  if (hoy === null) return <MetricCard size="hero" label="Marcas registradas hoy" {...NO_DISPONIBLE} />;
  const diferencia = ayer === null ? null : hoy - ayer;
  const delta: MetricCardDelta | undefined =
    diferencia === null
      ? undefined
      : {
          value: `${diferencia > 0 ? "+" : ""}${entero(diferencia)}`,
          direction: diferencia > 0 ? "up" : diferencia < 0 ? "down" : "flat",
          // Más o menos marcas no es bueno ni malo por sí mismo.
          tone: "neutral",
          label: "vs. ayer a esta hora",
        };
  return (
    <MetricCard
      size="hero"
      label="Marcas registradas hoy"
      value={entero(hoy)}
      delta={delta}
      hint={ayer === null ? "Entradas, descansos y salidas · sin dato de ayer para comparar" : "Entradas, descansos y salidas"}
      href="/asistencia/marcas"
    />
  );
}

function Pendientes({ hoy, resultado }: { hoy: string; resultado: Resultado<DatosReporte> | null }) {
  const filas: FilaDiaria[] = resultado?.ok && resultado.valor.reporte !== "resumen" ? resultado.valor.filas : [];
  const total = resultado?.ok ? resultado.valor.total : 0;
  const mes = rangoPorDefecto(hoy);
  const verTodos = rutaReporte("diaria", filtrosAQuery("diaria", filtrosDeRango(hoy, hoy, { estado: "pendiente_hoy" })));
  const tarjeta = (f: FilaDiaria) =>
    rutaReporte(
      "tarjeta",
      filtrosAQuery("tarjeta", filtrosDeRango(mes.desde, mes.hasta, { empleadoId: f.empleado_id, contratoId: f.contrato_id }))
    );
  const columnas: DataTableColumn<FilaDiaria>[] = [
    {
      key: "persona",
      header: "Persona",
      className: "min-w-44",
      render: (f) => (
        <>
          {persona(f.empleado_nombre, f.empleado_codigo)}
          <span className="sr-only"> · abrir su tarjeta individual</span>
        </>
      ),
    },
    { key: "departamento", header: "Departamento", render: (f) => f.departamento ?? "—" },
    { key: "entrada", header: "Entrada programada", numeric: true, render: (f) => horaProgramada(f.hora_entrada_prog) },
  ];

  return (
    <DataTable<FilaDiaria>
      caption="Pendientes de marcar"
      density="compact"
      rows={filas}
      rowKey={(f) => f.contrato_id}
      rowHref={tarjeta}
      columns={columnas}
      toolbar={
        <div className="flex w-full flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-neutral-900">Pendientes de marcar</h2>
            <p className="text-xs text-neutral-500">
              Con jornada hoy y sin ninguna marca. Cada fila abre la tarjeta del mes de esa persona.
            </p>
          </div>
          {total > 0 ? (
            <ButtonLink href={verTodos} variant="secondary" size="sm">
              Ver todos ({entero(total)})
            </ButtonLink>
          ) : null}
        </div>
      }
      empty={
        <EmptyState
          bare
          title="Nadie está pendiente"
          description="Todas las personas con jornada hoy ya registraron al menos una marca."
        />
      }
      error={
        resultado?.ok ? undefined : (
          <EmptyState
            bare
            variant="error"
            title="No disponible"
            description="No se pudo consultar quién falta por marcar. Recarga la página en unos minutos."
          />
        )
      }
    />
  );
}

function Terminales({ resultado }: { resultado: ResultadoTerminales | null }) {
  return (
    <section
      aria-labelledby="terminales-titulo"
      className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-xs"
    >
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-neutral-200 px-4 py-3">
        <div className="min-w-0">
          <h2 id="terminales-titulo" className="text-sm font-semibold text-neutral-900">
            Terminales
          </h2>
          <p className="text-xs text-neutral-500">
            {resultado?.ok
              ? `${entero(resultado.terminales.length)} ${resultado.terminales.length === 1 ? "activa" : "activas"}`
              : "Equipos de marcación"}
          </p>
        </div>
        <ButtonLink href="/asistencia/dispositivos" variant="secondary" size="sm">
          Ver dispositivos
        </ButtonLink>
      </div>
      {!resultado?.ok ? (
        <EmptyState
          bare
          variant="error"
          title="No disponible"
          description="No se pudieron consultar las terminales. Recarga la página en unos minutos."
        />
      ) : resultado.terminales.length === 0 ? (
        <EmptyState
          bare
          title="No hay terminales activas"
          description="Registra o reactiva una terminal en Dispositivos para que el personal pueda marcar."
        />
      ) : (
        <>
          {!resultado.estadoDisponible ? (
            <p className="px-4 pt-3 text-xs text-neutral-500">No se pudo consultar el estado de los equipos.</p>
          ) : null}
          <ul className="divide-y divide-neutral-100">
            {resultado.terminales.map((t) => (
              <li key={t.clave} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-neutral-900">{t.nombre}</p>
                  <p className="text-xs text-neutral-500 tabular-nums">
                    {t.ultimoUso ? `Último uso: ${fechaHora(t.ultimoUso)}` : "Sin uso todavía"}
                  </p>
                </div>
                {t.estado ? (
                  <StatusBadge label={ESTADO_TERMINAL[t.estado].label} tone={ESTADO_TERMINAL[t.estado].tone} />
                ) : (
                  <span className="text-xs text-neutral-500">Estado no disponible</span>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

// ------------------------------------------------------------------ datos

/** Un total numérico del reporte; `null` si la consulta falló o el valor no es un número. */
function totalDe(resultado: Resultado<DatosReporte> | null, clave: string): number | null {
  if (!resultado?.ok) return null;
  const valor = resultado.valor.totales[clave];
  return typeof valor === "number" && Number.isFinite(valor) ? valor : null;
}

/** Una consulta que lanza no tumba el dashboard: queda en el log y su tarjeta dice "No disponible". */
async function seguro<T>(contexto: string, consulta: Promise<Resultado<T>>): Promise<Resultado<T>> {
  try {
    return await consulta;
  } catch (err) {
    console.error(`Dashboard de Asistencia: falló ${contexto}`, err);
    return FALLO;
  }
}

function diaria(
  supabase: Cliente,
  companyId: string,
  rango: Rango,
  extra: Partial<FiltrosReporte>,
  limit: number
): Promise<Resultado<DatosReporte>> {
  return seguro(
    `la asistencia diaria del ${rango.desde} al ${rango.hasta}`,
    consultarReporte(supabase, companyId, "diaria", filtrosDeRango(rango.desde, rango.hasta, extra), { limit, offset: 0 })
  );
}

function resumen(supabase: Cliente, companyId: string, rango: Rango): Promise<Resultado<DatosReporte>> {
  return seguro(
    `el resumen del ${rango.desde} al ${rango.hasta}`,
    // El resumen no se pagina: la RPC no recibe límite.
    consultarReporte(supabase, companyId, "resumen", filtrosDeRango(rango.desde, rango.hasta), { limit: 1, offset: 0 })
  );
}

/** Marcas en [desde, hasta) (rrhh.asistencia_marcas con RLS por permiso). `null` si falló. */
async function contarMarcas(supabase: Cliente, companyId: string, ventana: Ventana, contexto: string): Promise<number | null> {
  try {
    const { count, error } = await supabase
      .schema("rrhh")
      .from("asistencia_marcas")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId)
      .gte("marcado_en", ventana.desde)
      .lt("marcado_en", ventana.hasta);
    if (error) {
      console.error(`Dashboard de Asistencia: no se pudo contar ${contexto}`, error);
      return null;
    }
    return count ?? 0;
  } catch (err) {
    console.error(`Dashboard de Asistencia: no se pudo contar ${contexto}`, err);
    return null;
  }
}

/**
 * Terminales activas (rrhh.kiosko_dispositivos, RLS por kioskos.ver) con el
 * estado de su equipo (asistencia_estado_terminales, la misma RPC de la
 * pantalla de Dispositivos). Si falla el estado, la lista sale igual.
 */
async function leerTerminales(supabase: Cliente, companyId: string): Promise<ResultadoTerminales> {
  try {
    const [lista, estados] = await Promise.all([
      supabase
        .schema("rrhh")
        .from("kiosko_dispositivos")
        .select("id, nombre")
        .eq("company_id", companyId)
        .eq("activo", true)
        .order("nombre"),
      supabase.rpc("asistencia_estado_terminales", { p_company_id: companyId }),
    ]);
    if (lista.error) {
      console.error("Dashboard de Asistencia: no se pudieron cargar las terminales", lista.error);
      return { ok: false };
    }
    if (estados.error) {
      console.error("Dashboard de Asistencia: no se pudo consultar el estado de los equipos", estados.error);
    }
    const porKiosko = new Map((estados.error ? [] : (estados.data ?? [])).map((t) => [t.kiosko_id, t]));
    return {
      ok: true,
      estadoDisponible: !estados.error,
      terminales: (lista.data ?? []).map((d) => {
        const t = porKiosko.get(d.id);
        const estado: EstadoTerminal | null = estados.error
          ? null
          : t?.estado === "asignada" || t?.estado === "codigo_pendiente"
            ? t.estado
            : "sin_asignar";
        return { clave: d.id, nombre: d.nombre, estado, ultimoUso: t?.ultimo_uso_en ?? null };
      }),
    };
  } catch (err) {
    console.error("Dashboard de Asistencia: no se pudieron cargar las terminales", err);
    return { ok: false };
  }
}
