import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageHeader } from "@nexo/ui";
import { contextoDePagina } from "@/lib/metas/permisos";
import type { Vendedor } from "@/lib/metas/tipos";
import Importador from "./importador";

export const metadata: Metadata = {
  title: "Importar de AG Negocio · Presupuesto",
};

export const dynamic = "force-dynamic";

export default async function ImportarPage() {
  const { supabase, companyId, permisos: p } = await contextoDePagina();
  if (!p.importar) redirect(p.propio || p.equipo ? "/dashboard" : "/facturas");

  // Solo los códigos: con ellos el navegador marca los vendedores nuevos sin
  // otra llamada (H5). Si el rol no puede listar vendedores, queda en null.
  const { data, error } = await supabase.rpc("presupuesto_vendedores", { p_company_id: companyId });
  const codigos = error ? null : ((data ?? []) as Vendedor[]).map((v) => v.codigo.toLowerCase());

  return (
    <div className="flex max-w-5xl flex-col gap-6">
      <PageHeader
        title="Importar de AG Negocio"
        description="Carga las facturas de venta desde el reporte de AG Negocio. Primero ves lo que se leyó; nada se guarda hasta que confirmes."
      />
      <Importador codigosExistentes={codigos} puedeVincular={p.vendedores} puedeVerEquipo={p.equipo} />
    </div>
  );
}
