import { PageSkeleton } from "@nexo/ui";

/** Carga de cualquier pantalla de Asistencia que no tenga su propio loading.tsx. */
export default function AsistenciaLoading() {
  return <PageSkeleton variant="dashboard" label="Cargando Asistencia…" />;
}
