import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Alert, ButtonLink, EmptyState, PageHeader } from "@nexo/ui";
import { contextoDePagina } from "@/lib/metas/permisos";
import { mensajeUsuario } from "@/lib/metas/errores";
import type { UsuarioVinculable, Vendedor } from "@/lib/metas/tipos";
import { TablaVendedores } from "./tabla-vendedores";

export const metadata: Metadata = {
  title: "Vendedores y usuarios · Presupuesto",
};

export const dynamic = "force-dynamic";

export default async function VendedoresPage() {
  const { supabase, companyId, permisos: p } = await contextoDePagina();
  if (!p.vendedores) redirect(p.propio || p.equipo ? "/dashboard" : "/facturas");

  const [vendedoresRes, usuariosRes] = await Promise.all([
    supabase.rpc("presupuesto_vendedores", { p_company_id: companyId }),
    supabase.rpc("presupuesto_usuarios_vinculables", { p_company_id: companyId }),
  ]);
  const error = vendedoresRes.error ?? usuariosRes.error;
  const vendedores = (vendedoresRes.data ?? []) as Vendedor[];
  const usuarios = ((usuariosRes.data ?? []) as UsuarioVinculable[]).map((u) => ({
    user_id: u.user_id,
    nombre: u.nombre,
    email: u.email,
    vendedor_id: u.vendedor_id,
  }));

  return (
    <div className="flex max-w-5xl flex-col gap-6">
      <PageHeader
        title="Vendedores y usuarios"
        description="Los vendedores se crean solos al importar facturas, con el código de AG Negocio. Cambiar el nombre aquí no se pisa en las próximas importaciones."
      />
      {error ? (
        <Alert tone="error">
          {mensajeUsuario(
            error,
            vendedoresRes.error ? "presupuesto_vendedores" : "presupuesto_usuarios_vinculables",
            "No se pudieron cargar los vendedores. Intenta de nuevo."
          )}
        </Alert>
      ) : vendedores.length === 0 ? (
        <EmptyState
          title="Todavía no hay vendedores"
          description="Aparecen aquí después de importar las facturas de AG Negocio. Luego vinculas cada uno con su usuario de Nexo."
          action={p.importar ? <ButtonLink href="/importar">Ir a Importar</ButtonLink> : null}
        />
      ) : (
        <TablaVendedores vendedores={vendedores} usuarios={usuarios} />
      )}
    </div>
  );
}
