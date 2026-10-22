import { PageSkeleton } from "@nexo/ui";

// Esqueleto mientras el servidor consulta las RPC de la página. Con este
// archivo Next prefetchea la ruta dinámica y el clic responde al instante.
export default function Cargando() {
  return <PageSkeleton />;
}
