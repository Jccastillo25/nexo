/**
 * Formateadores, etiquetas y filtros de los reportes de Asistencia.
 *
 * Módulo PURO a propósito: sin imports de ejecución (solo `import type`,
 * que se borran al compilar), sin acceso a Supabase ni a Next. Lo usan la
 * página (servidor), el formulario de filtros (cliente), el PDF y la vista
 * de impresión, y lo prueba `supabase/tests/rrhh_reportes_formato.test.mjs`
 * con `node --experimental-strip-types` (por eso no puede importar otros
 * archivos del proyecto: Node no resuelve imports sin extensión ni el
 * alias `@/`).
 *
 * Zona horaria de negocio: America/Managua (UTC-6, sin horario de verano).
 */
import type {
  EmpleadoOpcion,
  FiltrosReporte,
  OpcionesReporte,
  Reporte,
} from "./tipos";

export const REPORTES: readonly Reporte[] = ["diaria", "resumen", "tardanzas", "incidencias", "tarjeta"];

export function esReporte(valor: unknown): valor is Reporte {
  return typeof valor === "string" && (REPORTES as readonly string[]).includes(valor);
}

/** Rango máximo que aceptan las RPC (hasta − desde ≤ 61 días, ambos incluidos). */
export const MAX_DIAS = 62;
/** Filas por página en pantalla (R1, R3, R4). */
export const TAMANO_PAGINA = 100;
/** Máximo de filas que piden el PDF y la vista de impresión. */
export const MAX_FILAS_EXPORTACION = 5000;
/**
 * Tope de filas por llamada sin `rrhh.asistencia.reportes.exportar`
 * (20261021164902_seguridad_kiosco_reportes_exportar: por encima, las RPC
 * responden 42501). Excepción: el diario de UN contrato (la tarjeta).
 */
export const MAX_FILAS_SIN_EXPORTAR = 200;

export const RANGO_INVALIDO = "Rango inválido: máximo 62 días y no posterior a hoy.";
export const FILTROS_INVALIDOS =
  "Filtros inválidos: el rango admite hasta 62 días y no puede pasar de hoy; revisa también estado y tipo.";

export const INFO_REPORTE: Record<
  Reporte,
  { titulo: string; descripcion: string; orientacion: "landscape" | "portrait"; paginado: boolean }
> = {
  diaria: {
    titulo: "Asistencia diaria",
    descripcion: "Una fila por persona y día: marcas, horas netas, tardanzas y estado. Hora de Nicaragua.",
    orientacion: "landscape",
    paginado: true,
  },
  resumen: {
    titulo: "Resumen por persona",
    descripcion: "Totales del período por contrato: asistencia, horas, ausencias y puntualidad.",
    orientacion: "landscape",
    paginado: false,
  },
  tardanzas: {
    titulo: "Tardanzas y salidas tempranas",
    descripcion: "Días con llegada tarde o salida antes de hora, fuera de la tolerancia de la jornada.",
    orientacion: "landscape",
    paginado: true,
  },
  incidencias: {
    titulo: "Incidencias",
    descripcion: "Días con marcas incompletas, secuencias por revisar, días sin marcas y marcas sin jornada.",
    orientacion: "landscape",
    paginado: true,
  },
  tarjeta: {
    titulo: "Tarjeta individual",
    descripcion: "Detalle día a día de un contrato, con totales del período y espacio de firma.",
    orientacion: "portrait",
    paginado: false,
  },
};

// ---------------------------------------------------------------- etiquetas

/**
 * Valor de una clave PROPIA del mapa (nunca heredada: "toString",
 * "constructor"…). Todas las búsquedas por texto que viene de la URL o de la
 * RPC pasan por aquí.
 */
export function propia<T>(mapa: Record<string, T>, clave: string): T | undefined {
  return Object.hasOwn(mapa, clave) ? mapa[clave] : undefined;
}

export type TonoEstado = "neutral" | "positive" | "warning" | "negative" | "info";

/** Estados que solo existen en días no laborables: al filtrar por ellos hay que incluirlos. */
export const ESTADOS_NO_LABORABLES: readonly string[] = ["feriado", "dia_descanso", "sin_jornada"];

export function exigeNoLaborables(estado: string): boolean {
  return ESTADOS_NO_LABORABLES.includes(estado);
}

export const ESTADOS_DIA: Record<string, { label: string; tone: TonoEstado }> = {
  completo: { label: "Completo", tone: "positive" },
  en_jornada: { label: "En jornada", tone: "info" },
  en_descanso: { label: "En descanso", tone: "info" },
  pendiente_hoy: { label: "Pendiente (hoy)", tone: "info" },
  falta_salida: { label: "Falta salida", tone: "warning" },
  descanso_sin_cerrar: { label: "Descanso sin cerrar", tone: "warning" },
  revision: { label: "Revisar secuencia", tone: "warning" },
  sin_marcas: { label: "Sin marcas", tone: "negative" },
  feriado: { label: "Feriado", tone: "neutral" },
  dia_descanso: { label: "Día de descanso", tone: "neutral" },
  sin_jornada: { label: "Sin jornada", tone: "neutral" },
};

/** Un estado desconocido se muestra tal cual y en advertencia (nunca como otro estado). */
export function estadoDia(estado: string): { label: string; tone: TonoEstado } {
  return propia(ESTADOS_DIA, estado) ?? { label: estado, tone: "warning" };
}

export const OBSERVACIONES: Record<string, string> = {
  tardanza: "Tardanza",
  salida_temprana: "Salida temprana",
  sin_descanso_marcado: "Descanso no marcado: se descontó el programado",
  trabajo_feriado: "Trabajó en feriado",
  trabajo_dia_descanso: "Trabajó en día de descanso",
  sin_jornada: "Marcas sin jornada asignada",
};

export function textoObservaciones(obs: readonly string[] | null | undefined): string {
  if (!obs || obs.length === 0) return "—";
  return obs.map((o) => propia(OBSERVACIONES, o) ?? o).join("; ");
}

export const TIPOS_TARDANZA: Record<string, string> = {
  tardanza: "Tardanza",
  salida_temprana: "Salida temprana",
};

export const TIPOS_INCIDENCIA: Record<string, string> = {
  falta_salida: "Falta salida",
  descanso_sin_cerrar: "Descanso sin cerrar",
  sin_marcas: "Sin marcas",
  revision: "Revisar secuencia",
  marcas_sin_jornada: "Marcas sin jornada",
};

export const NOTA_SIN_MARCAS =
  "«Sin marcas» es un día laborable sin ninguna marca. No equivale a falta injustificada: todavía no se registran vacaciones ni permisos.";
export const NOTA_SOBRE_JORNADA =
  "El tiempo sobre jornada es informativo: no son horas extra autorizadas.";

// ---------------------------------------------------------------- formato

const SIN_DATO = "—";

/** Minutos → "H:MM" (510 → "8:30"). `null` → "—". */
export function minutosHM(minutos: number | null | undefined): string {
  if (minutos === null || minutos === undefined || !Number.isFinite(minutos)) return SIN_DATO;
  const total = Math.round(Math.abs(minutos));
  const signo = minutos < 0 ? "-" : "";
  return `${signo}${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

const formatoHora = new Intl.DateTimeFormat("en-GB", {
  timeZone: "America/Managua",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** Timestamptz → "HH:mm" en hora de Managua (24 h). `null` → "—". */
export function horaManagua(ts: string | null | undefined): string {
  if (!ts) return SIN_DATO;
  const fecha = new Date(ts);
  if (Number.isNaN(fecha.getTime())) return SIN_DATO;
  const partes = formatoHora.formatToParts(fecha);
  const h = partes.find((p) => p.type === "hour")?.value ?? "00";
  const m = partes.find((p) => p.type === "minute")?.value ?? "00";
  return `${h}:${m}`;
}

/** Hora programada "HH:MM:SS" → "HH:MM". */
export function horaProgramada(hora: string | null | undefined): string {
  if (!hora) return SIN_DATO;
  return /^\d{2}:\d{2}/.test(hora) ? hora.slice(0, 5) : SIN_DATO;
}

const formatoFecha = new Intl.DateTimeFormat("es-NI", {
  timeZone: "UTC",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});
const formatoDiaSemana = new Intl.DateTimeFormat("es-NI", { timeZone: "UTC", weekday: "short" });

function fechaUtc(iso: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const d = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== iso ? null : d;
}

/** "YYYY-MM-DD" → "dd/mm/aaaa". */
export function fechaDMA(iso: string): string {
  const d = fechaUtc(iso);
  return d ? formatoFecha.format(d) : iso;
}

/** "YYYY-MM-DD" → "vie 17/10/2026" (día de semana abreviado). */
export function fechaCorta(iso: string): string {
  const d = fechaUtc(iso);
  if (!d) return iso;
  const dia = formatoDiaSemana.format(d).replace(/\.$/, "").toLowerCase();
  return `${dia} ${formatoFecha.format(d)}`;
}

/** Timestamptz → "dd/mm/aaaa HH:mm" en hora de Managua. */
export function fechaHoraManagua(ts: string): string {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return ts;
  const partes = new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Managua",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(d);
  const v = (t: string) => partes.find((p) => p.type === t)?.value ?? "";
  return `${v("day")}/${v("month")}/${v("year")} ${v("hour")}:${v("minute")}`;
}

/** Fracción 0..1 → "83,3 %" (coma decimal, como pidió el negocio). `null` → "—". */
export function porcentaje(valor: number | null | undefined): string {
  if (valor === null || valor === undefined || !Number.isFinite(valor)) return SIN_DATO;
  return `${(valor * 100).toFixed(1).replace(".", ",")} %`;
}

/** Minutos promedio con un decimal → "12,5 min". */
export function minutosPromedio(valor: number | null | undefined): string {
  if (valor === null || valor === undefined || !Number.isFinite(valor)) return SIN_DATO;
  return `${valor.toFixed(1).replace(".", ",")} min`;
}

const formatoEntero = new Intl.NumberFormat("es-NI", { maximumFractionDigits: 0 });

export function entero(valor: number | null | undefined): string {
  if (valor === null || valor === undefined || !Number.isFinite(valor)) return SIN_DATO;
  return formatoEntero.format(valor);
}

const formatoPuntos = new Intl.NumberFormat("es-NI", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/**
 * Diferencia entre dos fracciones 0..1 en puntos porcentuales, con un decimal
 * y PUNTO decimal (formato de la suite, es-NI, el mismo de `porcentaje()` de
 * `@nexo/ui/formato`): (0.85, 0.80) → "+5.0 pts", "up". Solo la usa el
 * Dashboard de Asistencia; los reportes y el PDF siguen con su `porcentaje`
 * de coma decimal (deuda documentada: unificarlo cambia las pruebas P6).
 * `null` si falta alguno de los dos valores.
 */
export function variacionPuntos(
  actual: number | null | undefined,
  anterior: number | null | undefined
): { valor: string; direccion: "up" | "down" | "flat" } | null {
  if (actual === null || actual === undefined || !Number.isFinite(actual)) return null;
  if (anterior === null || anterior === undefined || !Number.isFinite(anterior)) return null;
  const puntos = Math.round((actual - anterior) * 1000) / 10;
  if (puntos === 0) return { valor: `${formatoPuntos.format(0)} pts`, direccion: "flat" };
  const texto = formatoPuntos.format(Math.abs(puntos));
  return puntos > 0 ? { valor: `+${texto} pts`, direccion: "up" } : { valor: `-${texto} pts`, direccion: "down" };
}

/** "Apellido, Nombre (123)". */
export function persona(nombre: string, codigo: number | string | null | undefined): string {
  return codigo === null || codigo === undefined || codigo === "" ? nombre : `${nombre} (${codigo})`;
}

export function periodo(desde: string, hasta: string): string {
  return desde === hasta ? fechaDMA(desde) : `Del ${fechaDMA(desde)} al ${fechaDMA(hasta)}`;
}

/** asistencia-<reporte>-<desde>-<hasta>.pdf */
export function nombreArchivo(reporte: Reporte, desde: string, hasta: string): string {
  return `asistencia-${reporte}-${desde}-${hasta}.pdf`;
}

// ---------------------------------------------------------------- filtros

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Del día 1 del mes de `hoy` a `hoy` (≤ 31 días, siempre dentro del límite). */
export function rangoPorDefecto(hoy: string): { desde: string; hasta: string } {
  return { desde: `${hoy.slice(0, 8)}01`, hasta: hoy };
}

/** Filtros de un rango sin ningún otro filtro (página 1); `extra` agrega los que hagan falta. */
export function filtrosDeRango(desde: string, hasta: string, extra: Partial<FiltrosReporte> = {}): FiltrosReporte {
  return {
    desde,
    hasta,
    departamentoId: "",
    puestoId: "",
    empleadoId: "",
    contratoId: "",
    estado: "",
    tipo: "",
    incluirNoLaborables: false,
    pagina: 1,
    ...extra,
  };
}

/**
 * Filas que pide la PANTALLA de un reporte. Paginados: una página. Sin
 * paginar: la tarjeta (un contrato, ≤ 62 días) y quien puede exportar piden
 * hasta MAX_FILAS_EXPORTACION; el resto, hasta MAX_FILAS_SIN_EXPORTAR, que es
 * lo que aceptan las RPC sin el permiso de exportar. El PDF y la impresión no
 * usan esto: siempre piden MAX_FILAS_EXPORTACION y exigen exportar.
 */
export function limiteEnPantalla(reporte: Reporte, puedeExportar: boolean): number {
  if (INFO_REPORTE[reporte].paginado) return TAMANO_PAGINA;
  if (reporte === "tarjeta" || puedeExportar) return MAX_FILAS_EXPORTACION;
  return MAX_FILAS_SIN_EXPORTAR;
}

/** Mensaje de error del rango o `null` si es válido. Mismo límite que las RPC. */
export function validarRango(desde: string, hasta: string, hoy: string): string | null {
  const d = fechaUtc(desde);
  const h = fechaUtc(hasta);
  if (!d || !h) return "Fecha inválida: elige las fechas en el calendario.";
  if (d.getTime() > h.getTime()) return "La fecha «Desde» no puede ser posterior a «Hasta».";
  const limite = fechaUtc(hoy);
  if (limite && h.getTime() > limite.getTime()) return RANGO_INVALIDO;
  if ((h.getTime() - d.getTime()) / 86_400_000 > MAX_DIAS - 1) return RANGO_INVALIDO;
  return null;
}

/** Qué filtros aplican a cada reporte (los demás se ignoran). */
export function filtrosAplican(reporte: Reporte) {
  return {
    contrato: reporte === "tarjeta",
    estado: reporte === "diaria",
    noLaborables: reporte === "diaria",
    tipo: reporte === "tardanzas" || reporte === "incidencias",
    paginado: INFO_REPORTE[reporte].paginado,
  };
}

export function tiposDe(reporte: Reporte): Record<string, string> {
  if (reporte === "tardanzas") return TIPOS_TARDANZA;
  if (reporte === "incidencias") return TIPOS_INCIDENCIA;
  return {};
}

type Parametros = URLSearchParams | Record<string, string | string[] | undefined>;

function leer(params: Parametros, clave: string): string {
  if (params instanceof URLSearchParams) return params.get(clave)?.trim() ?? "";
  const v = params[clave];
  return (Array.isArray(v) ? v[0] : v)?.trim() ?? "";
}

/**
 * Lee y valida los filtros de la URL. Devuelve siempre los filtros (para
 * volver a mostrarlos en el formulario) y un `error` legible si no son
 * válidos; con error, el servidor no consulta.
 */
export function leerFiltros(
  reporte: Reporte,
  params: Parametros,
  hoy: string
): { filtros: FiltrosReporte; error: string | null } {
  const aplica = filtrosAplican(reporte);
  const def = rangoPorDefecto(hoy);
  const paginaTexto = leer(params, "pagina");
  const pagina = /^\d{1,6}$/.test(paginaTexto) ? Math.max(1, Number(paginaTexto)) : 1;
  const filtros: FiltrosReporte = {
    desde: leer(params, "desde") || def.desde,
    hasta: leer(params, "hasta") || def.hasta,
    departamentoId: leer(params, "departamento"),
    puestoId: leer(params, "puesto"),
    empleadoId: leer(params, "empleado"),
    contratoId: aplica.contrato ? leer(params, "contrato") : "",
    estado: aplica.estado ? leer(params, "estado") : "",
    tipo: aplica.tipo ? leer(params, "tipo") : "",
    incluirNoLaborables: aplica.noLaborables && leer(params, "no_laborables") === "1",
    pagina: aplica.paginado ? pagina : 1,
  };

  const errorRango = validarRango(filtros.desde, filtros.hasta, hoy);
  if (errorRango) return { filtros, error: errorRango };
  const ids = [filtros.departamentoId, filtros.puestoId, filtros.empleadoId, filtros.contratoId];
  if (ids.some((id) => id !== "" && !UUID.test(id))) {
    return { filtros, error: "Un filtro no es válido. Vuelve a elegirlo en la lista." };
  }
  if (filtros.estado && !Object.hasOwn(ESTADOS_DIA, filtros.estado)) {
    return { filtros, error: "El estado elegido no es válido. Vuelve a elegirlo en la lista." };
  }
  if (filtros.tipo && !Object.hasOwn(tiposDe(reporte), filtros.tipo)) {
    return { filtros, error: "El tipo elegido no es válido. Vuelve a elegirlo en la lista." };
  }
  // Feriado / día de descanso / sin jornada solo aparecen si se incluyen los
  // días no laborables: con esos estados la casilla queda forzada (también
  // para una URL escrita a mano con no_laborables ausente).
  if (aplica.noLaborables && exigeNoLaborables(filtros.estado)) filtros.incluirNoLaborables = true;
  return { filtros, error: null };
}

/** Filtros → query string (sin "?"), solo con lo que aplica y no está vacío. */
export function filtrosAQuery(reporte: Reporte, filtros: FiltrosReporte, pagina?: number): string {
  const aplica = filtrosAplican(reporte);
  const q = new URLSearchParams();
  q.set("desde", filtros.desde);
  q.set("hasta", filtros.hasta);
  if (filtros.departamentoId) q.set("departamento", filtros.departamentoId);
  if (filtros.puestoId) q.set("puesto", filtros.puestoId);
  if (filtros.empleadoId) q.set("empleado", filtros.empleadoId);
  if (aplica.contrato && filtros.contratoId) q.set("contrato", filtros.contratoId);
  if (aplica.estado && filtros.estado) q.set("estado", filtros.estado);
  if (aplica.noLaborables && filtros.incluirNoLaborables) q.set("no_laborables", "1");
  if (aplica.tipo && filtros.tipo) q.set("tipo", filtros.tipo);
  const p = pagina ?? 1;
  if (aplica.paginado && p > 1) q.set("pagina", String(p));
  return q.toString();
}

/** Filtros aplicados para la auditoría de exportación (objeto JSON plano). */
export function filtrosParaAuditoria(reporte: Reporte, filtros: FiltrosReporte): Record<string, string | boolean> {
  const aplica = filtrosAplican(reporte);
  const salida: Record<string, string | boolean> = { desde: filtros.desde, hasta: filtros.hasta };
  if (filtros.departamentoId) salida.departamento_id = filtros.departamentoId;
  if (filtros.puestoId) salida.puesto_id = filtros.puestoId;
  if (filtros.empleadoId) salida.empleado_id = filtros.empleadoId;
  if (aplica.contrato && filtros.contratoId) salida.contrato_id = filtros.contratoId;
  if (aplica.estado && filtros.estado) salida.estado = filtros.estado;
  if (aplica.noLaborables) salida.incluir_no_laborables = filtros.incluirNoLaborables;
  if (aplica.tipo && filtros.tipo) salida.tipo = filtros.tipo;
  return salida;
}

/**
 * Tarjeta individual: exige persona y, si tiene varios contratos, contrato.
 * Con un solo contrato lo elige solo.
 */
export function resolverContrato(
  empleados: readonly EmpleadoOpcion[],
  empleadoId: string,
  contratoId: string
):
  | { estado: "ok"; contratoId: string }
  | { estado: "falta_empleado" | "falta_contrato" | "invalido" } {
  if (!empleadoId) return { estado: "falta_empleado" };
  const empleado = empleados.find((e) => e.id === empleadoId);
  if (!empleado) return { estado: "invalido" };
  const contratos = empleado.contratos ?? [];
  if (contratoId) {
    return contratos.some((c) => c.id === contratoId) ? { estado: "ok", contratoId } : { estado: "invalido" };
  }
  if (contratos.length === 1) return { estado: "ok", contratoId: contratos[0].id };
  return contratos.length === 0 ? { estado: "invalido" } : { estado: "falta_contrato" };
}

/** Filtros en texto para el encabezado del PDF/impresión. */
export function describirFiltros(
  reporte: Reporte,
  filtros: FiltrosReporte,
  opciones: OpcionesReporte | null
): string[] {
  const aplica = filtrosAplican(reporte);
  const salida: string[] = [];
  const nombre = (lista: { id: string; nombre: string }[] | undefined, id: string) =>
    lista?.find((x) => x.id === id)?.nombre ?? "seleccionado";
  if (filtros.departamentoId) salida.push(`Departamento: ${nombre(opciones?.departamentos, filtros.departamentoId)}`);
  if (filtros.puestoId) salida.push(`Puesto: ${nombre(opciones?.puestos, filtros.puestoId)}`);
  if (filtros.empleadoId) {
    const emp = opciones?.empleados.find((e) => e.id === filtros.empleadoId);
    salida.push(`Persona: ${emp?.label ?? "seleccionada"}`);
    if (aplica.contrato && filtros.contratoId) {
      const c = emp?.contratos?.find((x) => x.id === filtros.contratoId);
      if (c) salida.push(`Contrato: N.º ${c.numero}`);
    }
  }
  if (aplica.estado && filtros.estado) salida.push(`Estado: ${estadoDia(filtros.estado).label}`);
  if (aplica.tipo && filtros.tipo) salida.push(`Tipo: ${propia(tiposDe(reporte), filtros.tipo) ?? filtros.tipo}`);
  if (aplica.noLaborables && filtros.incluirNoLaborables) salida.push("Incluye feriados y días no laborables");
  return salida;
}

// ---------------------------------------------------------------- errores de RPC

export type MotivoError = "denegado" | "filtros" | "error";

/**
 * Traduce el error de una RPC a un mensaje para el usuario. Nunca devuelve
 * el texto crudo de Postgres: 42501 → sin permiso; 22023 → filtros.
 */
export function errorDeRpc(error: { code?: string | null; message?: string | null } | null | undefined): {
  motivo: MotivoError;
  mensaje: string;
} {
  if (error?.code === "42501") {
    return { motivo: "denegado", mensaje: "No tienes permiso para consultar este reporte. Pide acceso a tu administrador." };
  }
  if (error?.code === "22023") {
    if ((error.message ?? "").toLowerCase().includes("acota")) {
      return {
        motivo: "filtros",
        mensaje: "Hay demasiadas personas para un solo resumen. Acota con departamento o puesto.",
      };
    }
    // Los filtros ya se validan antes de llamar a la RPC; si aun así llega
    // un 22023 (p. ej. "hoy" cambió entre la página y la base) no se puede
    // saber qué filtro fue, así que el texto cubre ambos casos.
    return { motivo: "filtros", mensaje: FILTROS_INVALIDOS };
  }
  return { motivo: "error", mensaje: "No se pudo consultar el reporte. Intenta de nuevo en unos minutos." };
}
