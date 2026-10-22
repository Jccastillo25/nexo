/**
 * Rutas de Planilla (especificación §3), en un solo lugar: menú, enlaces
 * entre paquetes, `router.push`, `revalidatePath` y `redirect`. Módulo PURO
 * (solo `import type` de permisos): sirve en servidor y en cliente.
 *
 * Todas las entradas de `RUTA` son funciones; sin argumentos devuelven la
 * ruta base (p. ej. `revalidatePath(RUTA.novedades())`). Son rutas internas
 * SIN basePath: next/link, router.push, redirect y revalidatePath lo agregan
 * solos. Para `fetch()` (que no lo agrega) están `urlCsvPlanilla` y
 * `urlCsvDeclaracion`, con RRHH_BASE_PATH.
 *
 * Los filtros vacíos (undefined, null, "", false) no se escriben en la URL;
 * `true` se escribe como "1".
 */
import { RRHH_BASE_PATH } from "@/lib/reportes-asistencia/rutas";
import type { PermisoRrhh } from "@/lib/permisos-rrhh";
import type { TipoDeclaracion } from "./tipos";

type ValorQuery = string | number | boolean | null | undefined;

/** Ruta + query string, sin los filtros vacíos. */
export function conQuery(ruta: string, query?: Readonly<Record<string, ValorQuery>>): string {
  if (!query) return ruta;
  const sp = new URLSearchParams();
  for (const [clave, valor] of Object.entries(query)) {
    if (valor === undefined || valor === null || valor === "" || valor === false) continue;
    sp.set(clave, valor === true ? "1" : String(valor));
  }
  const texto = sp.toString();
  return texto ? `${ruta}?${texto}` : ruta;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** ¿Es un uuid? Valida `[id]` y filtros antes de llamar a la RPC (si no, `notFound()` o se ignora). */
export function esUuid(valor: unknown): valor is string {
  return typeof valor === "string" && UUID.test(valor);
}

const s = (id: string) => encodeURIComponent(id);
const BASE = "/planillas";
const CONFIG = `${BASE}/configuracion`;

export const RUTA = {
  /** Redirige a la primera pantalla permitida (B0). */
  inicio: () => BASE,

  // Nómina (paquete B)
  resumen: (f?: { mes?: string }) => conQuery(`${BASE}/resumen`, f),
  periodos: (f?: { estado?: string; tipo?: string; mes?: string; pagina?: number }) => conQuery(`${BASE}/periodos`, f),
  nuevaPlanilla: (f?: { reemplaza?: string }) => conQuery(`${BASE}/periodos/nueva`, f),
  detalle: (id: string) => `${BASE}/periodos/${s(id)}`,
  comparar: (id: string) => `${BASE}/periodos/${s(id)}/comparar`,
  importarAsistencia: (id: string) => `${BASE}/periodos/${s(id)}/asistencia`,
  persona: (id: string, contratoId: string) => `${BASE}/periodos/${s(id)}/contratos/${s(contratoId)}`,
  novedades: (f?: {
    desde?: string;
    hasta?: string;
    contrato?: string;
    estado?: string;
    origen?: string;
    agregar?: boolean;
  }) => conQuery(`${BASE}/novedades`, f),

  // Prestaciones (paquete C)
  vacaciones: (f?: { fecha?: string }) => conQuery(`${BASE}/vacaciones`, f),
  vacacionesMovimientos: (f?: { estado?: string; contrato?: string }) => conQuery(`${BASE}/vacaciones/movimientos`, f),
  vacacionesRegistrar: (f?: { contrato?: string }) => conQuery(`${BASE}/vacaciones/registrar`, f),
  prestamos: (f?: { estado?: string; contrato?: string }) => conQuery(`${BASE}/prestamos`, f),
  prestamoNuevo: () => `${BASE}/prestamos/nuevo`,
  prestamo: (id: string) => `${BASE}/prestamos/${s(id)}`,
  embargos: () => `${BASE}/embargos`,
  embargoNuevo: () => `${BASE}/embargos/nuevo`,
  liquidaciones: (f?: { estado?: string }) => conQuery(`${BASE}/liquidaciones`, f),
  liquidacion: (id: string) => `${BASE}/liquidaciones/${s(id)}`,
  simuladorLiquidacion: (f?: {
    contrato?: string;
    egreso?: string;
    causa?: string;
    pendiente?: number | string;
    vacaciones?: number | string;
    confianza?: number | string;
  }) => conQuery(`${BASE}/simulador-liquidacion`, f),

  // Análisis y configuración (paquete A)
  pasivo: (f?: { fecha?: string }) => conQuery(`${BASE}/pasivo`, f),
  simuladorRegimen: (f?: { fecha?: string }) => conQuery(`${BASE}/simulador-regimen`, f),
  declaraciones: (tipo?: TipoDeclaracion, mes?: string) => conQuery(`${BASE}/declaraciones`, { tipo, mes }),
  regimen: (f?: { aviso?: boolean; regimen?: string; estado?: string }) => conQuery(`${CONFIG}/regimen`, f),
  regimenContrato: (contratoId: string) => `${CONFIG}/regimen/${s(contratoId)}`,
  parametros: (f?: { historial?: boolean }) => conQuery(`${CONFIG}/parametros`, f),
  tablaIr: () => `${CONFIG}/tabla-ir`,
  tablaIrNueva: () => `${CONFIG}/tabla-ir/nueva`,
  conceptos: (f?: { tipo?: string; estado?: string }) => conQuery(`${CONFIG}/conceptos`, f),
  conceptoNuevo: () => `${CONFIG}/conceptos/nuevo`,
  concepto: (id: string) => `${CONFIG}/conceptos/${s(id)}`,
  tipos: () => `${CONFIG}/tipos`,
  tipoNuevo: () => `${CONFIG}/tipos/nuevo`,
  tipo: (id: string) => `${CONFIG}/tipos/${s(id)}`,

  /** Vistas de impresión: grupo (impresion-planilla), sin NexoShell. Ábrelas con target="_blank". */
  imprimir: {
    colillas: (id: string, contratoId?: string) => conQuery(`${BASE}/imprimir/colillas/${s(id)}`, { contrato: contratoId }),
    cheques: (id: string) => `${BASE}/imprimir/cheques/${s(id)}`,
    liquidacion: (id: string) => `${BASE}/imprimir/liquidacion/${s(id)}`,
  },

  /** Fuera de Planilla, dentro de RRHH: ficha del contrato (Contratación → Contratos). */
  fichaContrato: (contratoId: string) => `/contratacion/contratos/${s(contratoId)}`,
} as const;

// ---------------------------------------------------------------- URLs para fetch (con basePath)

/** GET del CSV de una planilla (Route Handler de B11). */
export function urlCsvPlanilla(id: string): string {
  return `${RRHH_BASE_PATH}${BASE}/periodos/${s(id)}/exportar`;
}

/** GET del CSV de una declaración del mes "YYYY-MM" (Route Handler de A5). */
export function urlCsvDeclaracion(tipo: TipoDeclaracion, mes: string): string {
  return `${RRHH_BASE_PATH}${conQuery(`${BASE}/declaraciones/exportar`, { tipo, mes })}`;
}

// ---------------------------------------------------------------- entrada y ayuda

type Permisos = Readonly<Partial<Record<PermisoRrhh, boolean>>>;

/**
 * Primera pantalla de Planilla que el rol puede abrir (B0): resumen →
 * novedades → vacaciones → préstamos → liquidaciones → régimen →
 * declaraciones → parámetros → conceptos. Null si no puede abrir ninguna.
 */
export function primeraPantallaPermitida(p: Permisos): string | null {
  if (p.planillaVer) return RUTA.resumen();
  if (p.novedadesVer) return RUTA.novedades();
  if (p.vacacionesVer) return RUTA.vacaciones();
  if (p.prestamosVer) return RUTA.prestamos();
  if (p.liquidacionesVer) return RUTA.liquidaciones();
  if (p.regimenVer) return RUTA.regimen();
  if (p.declaracionesGenerar) return RUTA.declaraciones();
  if (p.parametrosVer) return RUTA.parametros();
  if (p.conceptosVer) return RUTA.conceptos();
  return null;
}

export interface AyudaError {
  label: string;
  href: string;
}

/**
 * Enlaces de ayuda para un error de la RPC (p. ej. al calcular), solo los que
 * el rol puede abrir:
 * - "régimen" → Régimen por contrato (regimenVer);
 * - "tabla de IR" → Tabla de IR; "parámetro" → Parámetros de ley (parametrosVer);
 * - "novedad", "ausencias", "horas extra" → Novedades del período (novedadesVer);
 * - "catálogo" (falta un concepto) → Conceptos (conceptosVer).
 * `periodo` acota el enlace de novedades a las fechas de la planilla.
 */
export function ayudaDeError(
  mensaje: string | null | undefined,
  p: Permisos,
  periodo?: { inicio: string; fin: string }
): AyudaError[] {
  const texto = (mensaje ?? "").toLowerCase();
  if (!texto) return [];
  const ayuda: AyudaError[] = [];
  if (p.regimenVer && /régimen|regimen/.test(texto)) {
    ayuda.push({ label: "Ir a Régimen por contrato", href: RUTA.regimen() });
  }
  if (p.parametrosVer && /tabla de ir/.test(texto)) {
    ayuda.push({ label: "Ir a Tabla de IR", href: RUTA.tablaIr() });
  }
  if (p.parametrosVer && /parámetro|parametro/.test(texto)) {
    ayuda.push({ label: "Ir a Parámetros de ley", href: RUTA.parametros() });
  }
  if (p.novedadesVer && /novedad|ausencia|horas extra/.test(texto)) {
    ayuda.push({
      label: "Ver novedades del período",
      href: RUTA.novedades(periodo ? { desde: periodo.inicio, hasta: periodo.fin } : undefined),
    });
  }
  if (p.conceptosVer && /catálogo|catalogo/.test(texto)) {
    ayuda.push({ label: "Ir a Conceptos", href: RUTA.conceptos() });
  }
  return ayuda;
}
