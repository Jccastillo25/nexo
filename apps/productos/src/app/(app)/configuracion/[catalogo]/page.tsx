import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { contextoActual } from "@nexo/auth";
import { Alert, PageHeader } from "@nexo/ui";
import { permisosDe, type Permiso } from "@/lib/permisos";
import type { Catalogos } from "@/lib/tipos";
import { CATALOGOS_RUTA, type CatalogoRuta } from "@/lib/catalogos-ruta";
import PanelesCatalogos from "../paneles";

export const dynamic = "force-dynamic";

const PAGINAS: Record<CatalogoRuta, { titulo: string; descripcion: string; permiso: Permiso }> = {
  marcas: { titulo: "Marcas", descripcion: "Marcas de producto y las clases donde se pueden usar.", permiso: "marca" },
  unidades: { titulo: "Unidades de medida", descripcion: "Unidades que usa la ficha de producto.", permiso: "unidad" },
  proveedores: { titulo: "Proveedores", descripcion: "Proveedor habitual de cada producto.", permiso: "proveedor" },
  caracteristicas: { titulo: "Características", descripcion: "Datos extra de la ficha de producto.", permiso: "caracteristica" },
  cuentas: { titulo: "Cuentas contables", descripcion: "Cuentas de ingreso, inventario y costo, y centros de costo.", permiso: "contable" },
};

function esCatalogo(v: string): v is CatalogoRuta {
  return (CATALOGOS_RUTA as readonly string[]).includes(v);
}

export async function generateMetadata({ params }: PageProps<"/configuracion/[catalogo]">): Promise<Metadata> {
  const { catalogo } = await params;
  return { title: `${esCatalogo(catalogo) ? PAGINAS[catalogo].titulo : "Catálogos"} · Productos` };
}

/** Un catálogo de configuración por página. Nada se borra: se desactiva. */
export default async function CatalogoConfigPage({ params }: PageProps<"/configuracion/[catalogo]">) {
  const { catalogo } = await params;
  if (!esCatalogo(catalogo)) notFound();
  const pagina = PAGINAS[catalogo];

  const [{ supabase, companyId }, permisos] = await Promise.all([contextoActual(), permisosDe()]);
  if (!permisos[pagina.permiso]) redirect("/catalogo");

  const { data, error } = await supabase.rpc("productos_catalogos", { p_company_id: companyId });
  // El detalle técnico queda en el log del servidor, nunca en pantalla.
  if (error) console.error("productos_catalogos", error);

  return (
    <div className="flex max-w-5xl flex-col gap-6">
      <PageHeader title={pagina.titulo} description={`${pagina.descripcion} Nada se borra: se desactiva.`} />
      {error ? (
        <Alert tone="error" title="No se pudo cargar el catálogo">
          Intenta recargar la página.
        </Alert>
      ) : (
        <PanelesCatalogos catalogos={data as Catalogos} permisos={permisos} solo={catalogo} />
      )}
    </div>
  );
}
