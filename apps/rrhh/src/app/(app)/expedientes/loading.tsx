import { PageSkeleton } from "@nexo/ui";

// Esqueleto de /expedientes mientras el Server Component resuelve sus
// consultas: feedback inmediato al hacer clic, no una forma de esconder
// latencia real.
export default function ExpedientesLoading() {
  return <PageSkeleton variant="table" label="Cargando empleados…" />;
}
