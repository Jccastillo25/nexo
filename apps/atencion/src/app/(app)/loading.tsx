import { PageSkeleton } from "@nexo/ui";

// Esqueleto mientras el servidor consulta las RPC de la página. Sin este
// archivo, Next no prefetchea las rutas dinámicas y el clic parece congelado.
export default function Cargando() {
  return <PageSkeleton variant="dashboard" />;
}
