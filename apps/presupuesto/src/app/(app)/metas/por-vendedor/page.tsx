import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Alert, ButtonLink, EmptyState, MetricCard, PageHeader } from "@nexo/ui";
import { contextoDePagina } from "@/lib/metas/permisos";
import { mensajeUsuario } from "@/lib/metas/errores";
import { usd } from "@/lib/metas/formato";
import { aniosDisponibles, leerPeriodo, nombreMes, ventanaBase } from "@/lib/metas/periodo";
import type { MetasMes } from "@/lib/metas/tipos";
import { SelectorPeriodo } from "@/components/metas/selector-periodo";
import { claseTarjeta } from "@/components/metas/estilos";
import { GenerarSugeridas } from "./generar-sugeridas";
import { TablaMetas } from "./tabla-metas";

export const metadata: Metadata = {
  title: "Metas por vendedor · Presupuesto",
};

export const dynamic = "force-dynamic";

export default async function PorVendedorPage({ searchParams }: PageProps<"/metas/por-vendedor">) {
  const [{ supabase, companyId, permisos: p }, params] = await Promise.all([contextoDePagina(), searchParams]);
  if (!p.metasVend) redirect(p.propio || p.equipo ? "/dashboard" : "/facturas");

  const { anio, mes } = leerPeriodo(params);
  const { data, error } = await supabase.rpc("presupuesto_metas_mes", { p_company_id: companyId, p_anio: anio, p_mes: mes });
  const r = data as MetasMes | null;

  const encabezado = (
    <PageHeader
      title="Metas por vendedor"
      description={
        <>
          Meta mensual en US$ de cada vendedor para <span>{nombreMes(mes)}</span> de {anio}.
        </>
      }
      actions={<SelectorPeriodo anio={anio} mes={mes} anios={aniosDisponibles()} />}
    />
  );

  if (error || !r) {
    return (
      <div className="flex max-w-5xl flex-col gap-6">
        {encabezado}
        <Alert tone="error">
          {mensajeUsuario(error, "presupuesto_metas_mes", "No se pudieron cargar las metas. Intenta de nuevo.")}
        </Alert>
      </div>
    );
  }

  if (r.meta_empresa_usd === null) {
    return (
      <div className="flex max-w-5xl flex-col gap-6">
        {encabezado}
        <EmptyState
          title={`Primero define el presupuesto de ${anio}`}
          description={
            p.presupuesto
              ? "Las metas por vendedor reparten la meta mensual de la empresa, que sale del presupuesto anual."
              : "Las metas por vendedor reparten la meta mensual de la empresa. Pídele al administrador que defina el presupuesto."
          }
          action={p.presupuesto ? <ButtonLink href={`/anual?anio=${anio}`}>Definir presupuesto de {anio}</ButtonLink> : null}
        />
      </div>
    );
  }

  if (r.vendedores.length === 0) {
    return (
      <div className="flex max-w-5xl flex-col gap-6">
        {encabezado}
        <EmptyState
          title="Todavía no hay vendedores"
          description="Los vendedores se crean solos al importar las facturas de AG Negocio, con su código."
          action={p.importar ? <ButtonLink href="/importar">Ir a Importar</ButtonLink> : null}
        />
      </div>
    );
  }

  const metaEmpresa = Number(r.meta_empresa_usd);
  const suma = r.vendedores.reduce((a, v) => a + (Number(v.meta_usd) || 0), 0);
  const diferencia = metaEmpresa - suma;
  const cuadre =
    Math.abs(diferencia) < 1
      ? { label: "Cuadra", tone: "positive" as const }
      : diferencia > 0
        ? { label: `Faltan ${usd(diferencia)}`, tone: "warning" as const }
        : { label: `Sobran ${usd(-diferencia)}`, tone: "warning" as const };

  return (
    <div className="flex max-w-5xl flex-col gap-6">
      {encabezado}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <MetricCard label="Meta de la empresa" value={usd(metaEmpresa)} hint={`Presupuesto de ${nombreMes(mes)}`} />
        <MetricCard label="Suma de metas" value={usd(suma)} hint="De todos los vendedores" />
        <MetricCard
          label="Diferencia"
          value={cuadre.label}
          tone={cuadre.tone}
          hint="Solo informa: puedes guardar aunque no cuadre."
        />
      </div>

      <section className={`${claseTarjeta} flex flex-col gap-3 px-5 py-4`}>
        <p className="text-sm text-neutral-600">
          La sugerida reparte la meta de la empresa según lo vendido por cada vendedor activo en {ventanaBase(anio, mes)}.
          Al generar, las metas ajustadas a mano se conservan.
        </p>
        <GenerarSugeridas anio={anio} mes={mes} conOpcionReemplazar />
      </section>

      <TablaMetas anio={anio} mes={mes} ventana={ventanaBase(anio, mes)} vendedores={r.vendedores} />
    </div>
  );
}
