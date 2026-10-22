import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { contextoActual } from "@nexo/auth";
import { PageHeader, StatusBadge } from "@nexo/ui";
import { permisosDe } from "@/lib/permisos";
import type { Catalogos, Producto } from "@/lib/tipos";
import FichaProducto from "../ficha-producto";

export const metadata: Metadata = {
  title: "Producto · Productos",
};

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function ProductoPage({ params }: PageProps<"/catalogo/[id]">) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const { supabase, companyId } = await contextoActual();

  const [producto, catalogos, permisos] = await Promise.all([
    supabase.rpc("productos_obtener", { p_company_id: companyId, p_producto_id: id }),
    supabase.rpc("productos_catalogos", { p_company_id: companyId }),
    permisosDe(),
  ]);
  if (producto.error || !producto.data) notFound();
  const p = producto.data as Producto;
  const clasificacion = [p.clase, p.tipo, p.categoria].filter(Boolean).join(" › ");

  return (
    <div className="flex max-w-5xl flex-col gap-6">
      <PageHeader
        title={p.nombre}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <span>ID {p.numero_id}</span>·<span className="font-mono">{p.codigo}</span>
            {clasificacion && <>·<span>{clasificacion}</span></>}
            {p.descontinuado_ventas && <StatusBadge label="Descontinuado" tone="neutral" />}
          </span>
        }
      />
      <FichaProducto producto={p} catalogos={catalogos.data as Catalogos} permisos={permisos} siguienteId={null} />
    </div>
  );
}
