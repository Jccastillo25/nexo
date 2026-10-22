import { PageSkeleton } from "@nexo/ui";

// Esqueleto mientras el servidor consulta las RPC de la página. Sin
// loading.tsx, Next no prefetchea la ruta dinámica y el clic parece
// congelado. Variante "table": casi todas las pantallas de Configuración
// son listados (Usuarios, Roles, Sucursales, Auditoría).
export default function Cargando() {
  return <PageSkeleton variant="table" />;
}
