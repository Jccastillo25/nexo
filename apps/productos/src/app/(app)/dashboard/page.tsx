import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { contextoActual } from "@nexo/auth";
import { mensajeDeError } from "@nexo/permissions";
import { Alert, ButtonLink, MetricCard, PageHeader, StatusBadge, entero, type StatusTone } from "@nexo/ui";
import { permisosDe } from "@/lib/permisos";
import type { Resumen } from "@/lib/tipos";

export const metadata: Metadata = {
  title: "Dashboard · Productos",
};

export const dynamic = "force-dynamic";

/** Resumen del catálogo. La RPC valida el permiso en la base. */
async function leerResumen() {
  const { supabase, companyId } = await contextoActual();
  return supabase.rpc("productos_resumen", { p_company_id: companyId });
}

/** KPIs del catálogo (public.productos_resumen). Datos reales, nunca de ejemplo. */
export default async function DashboardPage() {
  // Primero el permiso: un bloque sin permiso no ejecuta su consulta (la RPC
  // también deniega, pero no se llama en vano). permisosDe() es la misma
  // lista ya cargada por el layout, así que esperar no suma otra consulta.
  const permisos = await permisosDe();
  if (!permisos.dashboard) redirect("/catalogo");

  const { data, error } = await leerResumen();
  const puedeCrear = permisos.crear;
  const puedeImportar = permisos.importar;
  const r = data as Resumen | null;

  if (error || !r) {
    return (
      <div className="flex max-w-6xl flex-col gap-6">
        <PageHeader title="Catálogo de productos" />
        <Alert tone="error" title="No se pudo cargar el resumen">
          {error
            ? mensajeDeError(error, "productos_resumen", "Intenta de nuevo en unos minutos.")
            : "Intenta de nuevo en unos minutos."}
        </Alert>
      </div>
    );
  }

  const vacio = r.total === 0;
  // Con el catálogo vacío, importar es la acción principal y "Nuevo producto" la secundaria.
  const importarEsPrincipal = vacio && puedeImportar;
  const revisar: { n: number; tono: StatusTone; titulo: string; detalle: string; href: string | null }[] = [
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
            tono: (r.sin_costo > 0 ? "warning" : "positive") as StatusTone,
            titulo: "Sin costo de referencia",
            detalle: "Costo vacío o de relleno (C$ 1.00). Al importar se toma el costo real del Consolidado.",
            // El listado no tiene un filtro "sin costo": solo texto.
            href: null,
          },
        ]),
    {
      n: r.total - r.con_codigo_barras,
      tono: "neutral",
      titulo: "Sin código de barras",
      detalle: "No es obligatorio; se agrega cuando el proveedor lo trae.",
      href: null,
    },
  ];

  return (
    <div className="flex max-w-6xl flex-col gap-6">
      <PageHeader
        title="Catálogo de productos"
        description={
          vacio
            ? "Resumen del catálogo maestro. Todavía está vacío: el primer paso es importar los Excel del ERP."
            : `Resumen del catálogo maestro (${entero(r.total)} productos). Los precios se manejan en Listas de precios.`
        }
        actions={
          puedeCrear ? (
            <ButtonLink href="/catalogo/nuevo" variant={importarEsPrincipal ? "secondary" : "primary"}>
              Nuevo producto
            </ButtonLink>
          ) : null
        }
      />

      {vacio ? (
        <Alert
          tone="info"
          title="Primer paso: importar el catálogo del ERP"
          action={puedeImportar ? <ButtonLink href="/importar">Importar catálogo</ButtonLink> : undefined}
        >
          Sube la plantilla de importación y el Consolidado de productos. Verás una vista previa y nada se guarda hasta
          que confirmes.
        </Alert>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Productos activos" value={entero(r.activos)} hint={`${entero(r.servicios)} son servicios`} />
        <MetricCard
          label="Sin clasificación completa"
          value={entero(r.sin_clasificacion)}
          tone={r.sin_clasificacion > 0 ? "warning" : "neutral"}
          hint="No pueden generar código automático"
        />
        <MetricCard
          label="Con código de barras"
          value={entero(r.con_codigo_barras)}
          hint={`${entero(r.total - r.con_codigo_barras)} sin código de barras`}
        />
        <MetricCard label="Descontinuados" value={entero(r.descontinuados)} hint="Se descontinúan, no se borran" />
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
                <StatusBadge
                  label={entero(i.n)}
                  tone={i.tono}
                  dot={false}
                  className="mt-0.5 min-w-10 justify-center tabular-nums"
                />
                <div className="min-w-0">
                  {i.href && !vacio && i.n > 0 ? (
                    <Link
                      href={i.href}
                      className="rounded-sm text-sm font-medium text-neutral-900 hover:text-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                    >
                      {i.titulo}
                    </Link>
                  ) : (
                    <p className="text-sm font-medium text-neutral-900">{i.titulo}</p>
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
                <Link
                  href={`/catalogo/${u.id}`}
                  className="min-w-0 truncate rounded-sm font-medium text-neutral-900 hover:text-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                >
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
