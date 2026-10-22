import { redirect } from "next/navigation";
import { permisosDe } from "@/lib/permisos-rrhh";

/**
 * Vistas de impresión de Planilla (colillas, detalle para cheques,
 * liquidación), 2026-10-21. Route group hermano de (app), SIN NexoShell: el
 * documento se imprime solo, en blanco, con Inter (del layout raíz).
 *
 * Exige `rrhh.ver_modulo`, igual que (app): no usa el layout (impresion) de
 * Asistencia, que exige `asistencia.ver_modulo` y dejaría sin colillas a
 * quien tiene RRHH pero no la app Asistencia. Cada página valida además su
 * permiso (planilla.ver, reportes.exportar o liquidaciones.ver). El proxy ya
 * exige sesión. La lista de permisos es la misma que pide la página: una
 * sola consulta por carga.
 */
export default async function ImpresionPlanillaLayout({ children }: { children: React.ReactNode }) {
  const permisos = await permisosDe();
  if (!permisos.modulo) redirect("/sin-acceso");
  return <div className="min-h-full flex-1 bg-white text-neutral-900">{children}</div>;
}
