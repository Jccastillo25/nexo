import { redirect } from "next/navigation";
import { permisosDe } from "@/lib/permisos";

export const dynamic = "force-dynamic";

/** Cada catálogo tiene su ruta y su entrada en el menú; esta raíz lleva al primero que el rol puede gestionar. */
export default async function ConfiguracionPage() {
  const p = await permisosDe();
  if (p.marca) redirect("/configuracion/marcas");
  if (p.unidad) redirect("/configuracion/unidades");
  if (p.proveedor) redirect("/configuracion/proveedores");
  if (p.caracteristica) redirect("/configuracion/caracteristicas");
  if (p.contable) redirect("/configuracion/cuentas");
  redirect("/catalogo");
}
