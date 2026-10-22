import { PageSkeleton } from "@nexo/ui";

// Carga genérica del grupo (Nexo Enterprise UI v2): con loading.tsx, Next
// prefetchea la ruta dinámica y el clic muestra el esqueleto al instante.
// Las rutas con forma propia (tablas, formularios) tienen su loading.tsx.
export default function RrhhLoading() {
  return <PageSkeleton variant="table" />;
}
