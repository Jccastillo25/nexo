import { PageSkeleton } from "@nexo/ui";

// Ficha del Expediente General (solo datos de la persona).
export default function ExpedienteDetalleLoading() {
  return <PageSkeleton variant="form" label="Cargando el expediente…" />;
}
