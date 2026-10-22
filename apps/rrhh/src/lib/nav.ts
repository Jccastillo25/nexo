import type { NexoNavItem } from "@nexo/ui";
import type { PermisosRrhh } from "@/lib/permisos-rrhh";
import { RUTA } from "@/lib/planilla/rutas";

/**
 * Arbol de navegacion de RRHH — Nexo Enterprise UI (rediseño 2026-09-07),
 * con la regla de menú de la suite (docs/DESIGN_SYSTEM.md, "Menú lateral
 * desplegable", 2026-10-17): Dashboard suelto, todo lo demás en grupos
 * desplegables y cada subítem con su propio icono. Un item sin `href` (y
 * sin `children`) se muestra deshabilitado ("Pronto") en NexoSidebar: no se
 * crea una pagina placeholder por cada funcionalidad futura. Documentos no
 * tiene pantalla real todavia.
 *
 * Fase 2 (2026-09-16, bloque pre-F1.5): Puestos/Departamentos/Plantillas
 * viven con pantalla real bajo Contratación → Catálogos.
 *
 * 2026-10-17: Asistencia es una app propia (core.apps slug `asistencia`,
 * mismo deploy bajo /rrhh/asistencia, con su menú en lib/asistencia-nav.ts).
 * El grupo "Asistencia" (Marcas, Incidencias, Justificaciones y el enlace a
 * la terminal /kiosco) salió de este menú. Jornadas y Feriados se quedan
 * en Contratación porque son parte del contrato.
 *
 * 2026-10-20: cada hijo se lista solo con el permiso que exige su pantalla
 * (regla del menú lateral en CLAUDE.md). Un grupo que queda sin hijos no se
 * muestra (NexoSidebar los oculta en cascada). Ocultar un item NO autoriza
 * la ruta: cada página y cada acción siguen validando en el servidor. Los
 * permisos salen de la misma lista cacheada del layout: sin consultas extra.
 *
 * 2026-10-21, Planilla dentro de RRHH (no es app propia; decisión del
 * usuario): el grupo "Nómina" (antes un solo hijo con el placeholder de
 * /planillas) se reemplaza por Nómina, Prestaciones, Análisis y
 * Configuración, en el orden operativo → análisis → configuración. Las rutas
 * salen de lib/planilla/rutas.ts. Ningún href es prefijo de otro (el sidebar
 * marca activo por prefijo): los KPIs viven en /planillas/resumen y
 * /planillas solo redirige a la primera pantalla permitida. "Enviar
 * colillas" va como "Pronto" (no hay autoservicio ni correo todavía).
 * Iconos alternos (D19, sin tocar packages/ui): `sliders` en los dos
 * simuladores, `ruler` en Parámetros de ley, `list` en Tabla de IR y `tree`
 * en Tipos de planilla.
 */
export function rrhhNav(p: PermisosRrhh): NexoNavItem[] {
  const expedientes: NexoNavItem[] = [];
  if (p.empleadosVer) {
    expedientes.push({ label: "Empleados", href: "/expedientes", icon: "users" });
    expedientes.push({ label: "Documentos", icon: "file" });
  }

  const catalogos: NexoNavItem[] = [];
  if (p.puestosVer) catalogos.push({ label: "Puestos", href: "/contratacion/catalogos/puestos", icon: "briefcase" });
  if (p.departamentosVer) catalogos.push({ label: "Departamentos", href: "/contratacion/catalogos/departamentos", icon: "building" });
  if (p.plantillasVer) catalogos.push({ label: "Plantillas de contrato", href: "/contratacion/catalogos/plantillas", icon: "file" });

  const contratacion: NexoNavItem[] = [];
  if (p.contratosVer) contratacion.push({ label: "Contratos", href: "/contratacion/contratos", icon: "file" });
  if (p.turnosVer) contratacion.push({ label: "Jornadas", href: "/jornadas", icon: "clock" });
  if (p.feriadosVer) contratacion.push({ label: "Feriados", href: "/feriados", icon: "calendar" });
  contratacion.push({ label: "Catálogos", icon: "list", children: catalogos });

  const nomina: NexoNavItem[] = [];
  if (p.planillaVer) {
    nomina.push({ label: "Resumen de planilla", href: RUTA.resumen(), icon: "chart" });
    nomina.push({ label: "Planillas", href: RUTA.periodos(), icon: "receipt" });
  }
  if (p.novedadesVer) nomina.push({ label: "Novedades", href: RUTA.novedades(), icon: "inbox" });
  if (p.prestamosVer) {
    nomina.push({ label: "Préstamos y adelantos", href: RUTA.prestamos(), icon: "price" });
    nomina.push({ label: "Embargos", href: RUTA.embargos(), icon: "lock" });
  }
  if (p.colillasEnviar) nomina.push({ label: "Enviar colillas", icon: "mail" });

  const prestaciones: NexoNavItem[] = [];
  if (p.vacacionesVer) prestaciones.push({ label: "Vacaciones", href: RUTA.vacaciones(), icon: "calendar" });
  if (p.liquidacionesVer) prestaciones.push({ label: "Liquidaciones", href: RUTA.liquidaciones(), icon: "file" });
  if (p.liquidacionesCalcular) {
    prestaciones.push({ label: "Simulador de liquidación", href: RUTA.simuladorLiquidacion(), icon: "sliders" });
  }

  const analisis: NexoNavItem[] = [];
  if (p.planillaVer) analisis.push({ label: "Pasivo laboral", href: RUTA.pasivo(), icon: "trend-up" });
  if (p.regimenVer) analisis.push({ label: "Simulador de régimen", href: RUTA.simuladorRegimen(), icon: "sliders" });
  if (p.declaracionesGenerar) analisis.push({ label: "Declaraciones", href: RUTA.declaraciones(), icon: "book" });

  const configuracion: NexoNavItem[] = [];
  if (p.regimenVer) configuracion.push({ label: "Régimen por contrato", href: RUTA.regimen(), icon: "briefcase" });
  if (p.parametrosVer) {
    configuracion.push({ label: "Parámetros de ley", href: RUTA.parametros(), icon: "ruler" });
    configuracion.push({ label: "Tabla de IR", href: RUTA.tablaIr(), icon: "list" });
  }
  if (p.conceptosVer) {
    configuracion.push({ label: "Conceptos", href: RUTA.conceptos(), icon: "tag" });
    configuracion.push({ label: "Tipos de planilla", href: RUTA.tipos(), icon: "tree" });
  }

  return [
    { label: "Dashboard", href: "/dashboard", icon: "grid" },
    { label: "Expedientes", icon: "folder", children: expedientes },
    { label: "Contratación", icon: "briefcase", children: contratacion },
    { label: "Nómina", icon: "cash", children: nomina },
    { label: "Prestaciones", icon: "shield", children: prestaciones },
    { label: "Análisis", icon: "chart", children: analisis },
    { label: "Configuración", icon: "settings", children: configuracion },
  ];
}
