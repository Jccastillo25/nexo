import { PageSkeleton } from "@nexo/ui";

// Esqueleto mientras el servidor consulta las RPC de la página.
export default function Cargando() {
  return <PageSkeleton />;
}
