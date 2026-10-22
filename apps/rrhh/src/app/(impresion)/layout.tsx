import { redirect } from "next/navigation";
import { permisosAsistencia } from "@/lib/permisos-asistencia";

/**
 * Vistas de impresión (2026-10-18). Route group hermano de (asistencia),
 * SIN NexoShell: el documento se imprime solo, en blanco, con Inter (del
 * layout raíz). Igual que el layout de Asistencia, exige
 * `asistencia.ver_modulo`; cada página valida además su permiso de
 * exportación. El proxy ya exige sesión. La lista de permisos es la misma
 * que pide la página: una sola consulta por carga.
 */
export default async function ImpresionLayout({ children }: { children: React.ReactNode }) {
  const permisos = await permisosAsistencia();
  if (!permisos.modulo) redirect("/sin-acceso");
  return <div className="min-h-full flex-1 bg-white text-neutral-900">{children}</div>;
}
