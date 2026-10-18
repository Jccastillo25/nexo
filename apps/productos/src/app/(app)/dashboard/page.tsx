import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { hasPermission, mensajeDeError } from "@nexo/permissions";
import { MetricCard, PageHeader } from "@nexo/ui";
import { createClient } from "@/lib/supabase/server";
import { getCompanyId } from "@/lib/company";
import { P } from "@/lib/permisos";
import type { Resumen } from "@/lib/tipos";

export const metadata: Metadata = {
  title: "Dashboard · Productos",
};

export const dynamic = "force-dynamic";

const pastilla = {
  warning: "bg-amber-50 text-amber-700",
  neutral: "bg-neutral-100 text-neutral-600",
  positive: "bg-emerald-50 text-emerald-700",
} as const;

/** KPIs del catálogo (public.productos_resumen). Datos reales, nunca de ejemplo. */
export default async function DashboardPage() {
  const supabase = await createClient();
  const companyId = getCompanyId();
  const ctx = { supabase, companyId };

  if (!(await hasPermission(ctx, P.dashboard))) redirect("/catalogo");
  const [puedeCrear, puedeImportar] = await Promise.all([hasPermission(ctx, P.crear), hasPermission(ctx, P.importar)]);

  const { data, error } = await supabase.rpc("productos_resumen", { p_company_id: companyId });
  const r = data as Resumen | null;

  if (error || !r) {
    return (
      <div className="flex max-w-6xl flex-col gap-6">
        <PageHeader title="Catálogo de productos" />
        <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error
            ? mensajeDeError(error, "productos_resumen", "No se pudo cargar el resumen. Intenta de nuevo.")
            : "No se pudo cargar el resumen."}
        </p>
      </div>
    );
  }

  const vacio = r.total === 0;
  const revisar: { n: number; tono: keyof typeof pastilla; titulo: string; detalle: string; href: string }[] = [
    {
      n: r.sin_clasificacion,
      tono: r.sin_clasificacion > 0 ? "warning" : "positive",
      titulo: "Sin clase, tipo o categoría",
      detalle: "No pueden generar código automático. Se clasifican desde su ficha.",
      href: "/catalogo?estado=sin_clasificar",
    },
    ...(r.sin_costo === null
      ? []
      : [
          {
            n: r.sin_costo,
            tono: (r.sin_costo > 0 ? "warning" : "positive") as keyof typeof pastilla,
            titulo: "Sin costo de referencia",
            detalle: "Costo vacío o de relleno (C$ 1.00). Al importar se toma el costo real del Consolidado.",
            href: "/catalogo",
          },
        ]),
    {
      n: r.total - r.con_codigo_barras,
      tono: "neutral",
      titulo: "Sin código de barras",
      detalle: "No es obligatorio; se agrega cuando el proveedor lo trae.",
      href: "/catalogo",
    },
  ];

  return (
    <div className="flex max-w-6xl flex-col gap-6">
      <PageHeader
        title="Catálogo de productos"
        description={
          vacio
            ? "Resumen del catálogo maestro. Todavía está vacío: el primer paso es importar los Excel del ERP."
            : `Resumen del catálogo maestro (${r.total} productos). Los precios se manejan en Listas de precios.`
        }
        actions={
          puedeCrear ? (
            <Link
              href="/catalogo/nuevo"
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              + Nuevo producto
            </Link>
          ) : null
        }
      />

      {vacio && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-blue-200 bg-blue-50 px-5 py-4">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-blue-900">Primer paso: importar el catálogo del ERP</p>
            <p className="mt-0.5 text-sm text-blue-800">
              Sube la plantilla de importación y el Consolidado de productos. Ves una vista previa y nada se guarda hasta
              que confirmas.
            </p>
          </div>
          {puedeImportar && (
            <Link
              href="/importar"
              className="shrink-0 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Ir a Importar
            </Link>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Productos activos" value={r.activos} hint={`${r.servicios} son servicios`} />
        <MetricCard
          label="Sin clasificación completa"
          value={r.sin_clasificacion}
          tone={r.sin_clasificacion > 0 ? "warning" : "neutral"}
          hint="No pueden generar código automático"
        />
        <MetricCard
          label="Con código de barras"
          value={r.con_codigo_barras}
          hint={`${r.total - r.con_codigo_barras} sin código de barras`}
        />
        <MetricCard label="Descontinuados" value={r.descontinuados} hint="Se descontinúan, no se borran" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.4fr_1fr]">
        <section className="rounded-xl border border-neutral-200 bg-white px-5 py-4 shadow-sm">
          <h2 className="text-sm font-semibold text-neutral-900">Para revisar</h2>
          <p className="mt-0.5 text-sm text-neutral-500">
            {vacio
              ? "Se llena después de importar: los productos se importan igual y quedan marcados aquí."
              : "Productos que se importaron o crearon con datos incompletos."}
          </p>
          <ul className="mt-3 divide-y divide-neutral-100">
            {revisar.map((i) => (
              <li key={i.titulo} className="flex items-start gap-3 py-2.5">
                <span className={`mt-0.5 min-w-10 rounded-full px-2 py-0.5 text-center text-xs font-semibold tabular-nums ${pastilla[i.tono]}`}>
                  {i.n}
                </span>
                <div className="min-w-0">
                  {vacio || i.n === 0 ? (
                    <p className="text-sm font-medium text-neutral-900">{i.titulo}</p>
                  ) : (
                    <Link href={i.href} className="text-sm font-medium text-neutral-900 hover:text-blue-700">
                      {i.titulo}
                    </Link>
                  )}
                  <p className="text-xs text-neutral-500">{i.detalle}</p>
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-2 rounded-md bg-neutral-100 px-3 py-2 text-xs text-neutral-600">
            Precios menores que el costo o en 0 se revisan en <strong>Listas de precios</strong>: este catálogo no guarda
            precios.
          </p>
        </section>

        <section className="flex flex-col gap-3 rounded-xl border border-neutral-200 bg-white px-5 py-4 shadow-sm">
          <div>
            <h2 className="text-sm font-semibold text-neutral-900">Cómo se arma el código</h2>
            <p className="mt-0.5 text-sm text-neutral-500">Para productos nuevos con clasificación completa.</p>
          </div>
          <div className="flex flex-wrap items-center gap-1 text-xs text-neutral-500">
            <Parte n="03" /> Construcción <Parte n="02" /> Perlín <Parte n="02" /> Galvanizado <span>→</span>
            <span className="font-mono text-sm font-semibold text-neutral-900">030202-001</span>
          </div>
          <p className="rounded-md bg-blue-50 px-3 py-2 text-sm text-blue-900">
            El código se puede editar. El <strong>ID</strong> lo pone el sistema y nunca cambia: los importados conservan su
            ID del ERP y los nuevos siguen desde <strong className="tabular-nums">{r.siguiente_id}</strong>.
          </p>
          <p className="rounded-md bg-neutral-100 px-3 py-2 text-sm text-neutral-700">
            Los productos importados conservan su código del ERP, por ejemplo <span className="font-mono">001001021</span>.
          </p>
        </section>
      </div>

      {r.ultimos.length > 0 && (
        <section className="rounded-xl border border-neutral-200 bg-white px-5 py-4 shadow-sm">
          <h2 className="text-sm font-semibold text-neutral-900">Últimos productos</h2>
          <ul className="mt-3 divide-y divide-neutral-100">
            {r.ultimos.map((u) => (
              <li key={u.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <Link href={`/catalogo/${u.id}`} className="min-w-0 truncate font-medium text-neutral-900 hover:text-blue-700">
                  {u.nombre}
                </Link>
                <span className="shrink-0 font-mono text-xs text-neutral-500">
                  ID {u.numero_id} · {u.codigo}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Parte({ n }: { n: string }) {
  return <span className="rounded bg-blue-50 px-1.5 py-0.5 font-mono font-semibold text-blue-700">{n}</span>;
}
