import { PageSkeleton } from "@nexo/ui";

// Esqueleto mientras el servidor consulta las RPC de la página. Con este
// archivo Next prefetchea la ruta dinámica y el clic responde al instante.
// Mismo ancho máximo que las páginas, para que no salte al pintar.
export default function Cargando() {
  return (
    <div className="max-w-6xl">
      <PageSkeleton />
    </div>
  );
}
