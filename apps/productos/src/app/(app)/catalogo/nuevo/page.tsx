import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { contextoActual } from "@nexo/auth";
import { PageHeader } from "@nexo/ui";
import { permisosDe } from "@/lib/permisos";
import type { Catalogos, Resumen } from "@/lib/tipos";
import FichaProducto from "../ficha-producto";

export const metadata: Metadata = {
  title: "Nuevo producto · Productos",
};

export const dynamic = "force-dynamic";

export default async function NuevoProductoPage() {
  const [{ supabase, companyId }, permisos] = await Promise.all([contextoActual(), permisosDe()]);
  if (!permisos.crear) redirect("/catalogo");

  const [catalogos, resumen] = await Promise.all([
    supabase.rpc("productos_catalogos", { p_company_id: companyId }),
    permisos.dashboard ? supabase.rpc("productos_resumen", { p_company_id: companyId }) : Promise.resolve({ data: null }),
  ]);

  return (
    <div className="flex max-w-5xl flex-col gap-6">
      <PageHeader title="Nuevo producto" description="Elige clase, tipo y categoría y el código se arma solo; puedes cambiarlo." />
      <FichaProducto
        producto={null}
        catalogos={catalogos.data as Catalogos}
        permisos={permisos}
        siguienteId={(resumen.data as Resumen | null)?.siguiente_id ?? null}
      />
    </div>
  );
}
