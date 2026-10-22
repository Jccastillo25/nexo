import Link from "next/link";
import type { Metadata } from "next";
import { Alert, AppTileIcon, Button, EmptyState } from "@nexo/ui";
import { contextoActual, sesionActual, signOut } from "@nexo/auth";
import type { Database, VisibleApp } from "@/lib/supabase/database.types";
import { permisosDe, type Permiso } from "@/lib/permisos";
import { exigirPasswordDefinitiva } from "@/lib/perfil";
import RecargarButton from "./recargar-button";

export const metadata: Metadata = {
  title: "Nexo",
};

// Mosaicos blancos con el icono a color de la app y el nombre debajo, al
// estilo de la pantalla de inicio de Odoo (pedido del usuario 2026-10-17),
// agrupados en secciones por categoría (core.apps.category) con un título
// arriba de cada grupo (pedido del usuario 2026-10-17, segunda parte).
//
// Cuadrícula fija (pedido del usuario 2026-10-17: "tener cuadrículas para que
// se vayan agregando aplicaciones y se vea siempre con la misma similitud
// visual, con Ventas arriba ocupando todo el espacio"): la página tiene
// columnas de 104 px (3 en celular, 5 en tablet, 8 en escritorio) y cada
// sección usa subgrid sobre esas mismas columnas, así todos los mosaicos
// quedan alineados sin importar cuántas apps tenga cada categoría. Una
// sección ocupa tantas columnas como apps (mínimo 2, para que quepa el
// título); si tiene más que columnas, sus mosaicos bajan de fila. Las
// secciones de SECCIONES_ANCHO_COMPLETO ocupan siempre la fila entera.
const seccionesClass =
  "grid grid-cols-[repeat(3,104px)] justify-center gap-x-3 gap-y-10 sm:grid-cols-[repeat(5,104px)] sm:gap-x-6 lg:grid-cols-[repeat(8,104px)]";
const seccionClass = "grid grid-cols-subgrid content-start gap-y-5";
const tituloClass =
  "col-span-full border-b border-neutral-300/70 px-1 pb-2 text-[11px] font-semibold uppercase tracking-[0.15em] text-neutral-500";

// Orden de las secciones: estas categorías primero y en este orden; las demás
// después, en el orden en que llegan. Administración (Configuración) siempre
// al final.
const ORDEN_CATEGORIAS = ["Ventas", "Cadena de suministro", "Finanzas", "RRHH", "Servicios"];
const SECCIONES_ANCHO_COMPLETO = new Set(["Ventas"]);

// Clases literales (Tailwind solo genera las que ve escritas en el código).
const SPAN_BASE = ["col-span-2", "col-span-2", "col-span-2", "col-span-3"];
const SPAN_SM = ["sm:col-span-2", "sm:col-span-2", "sm:col-span-2", "sm:col-span-3", "sm:col-span-4", "sm:col-span-5"];
const SPAN_LG = [
  "lg:col-span-2",
  "lg:col-span-2",
  "lg:col-span-2",
  "lg:col-span-3",
  "lg:col-span-4",
  "lg:col-span-5",
  "lg:col-span-6",
  "lg:col-span-7",
  "lg:col-span-8",
];

function spanDeSeccion(categoria: string, cantidad: number): string {
  if (SECCIONES_ANCHO_COMPLETO.has(categoria)) return "col-span-full";
  const n = (max: number) => Math.min(Math.max(cantidad, 2), max);
  return `${SPAN_BASE[n(3)]} ${SPAN_SM[n(5)]} ${SPAN_LG[n(8)]}`;
}
const tileClass =
  "flex h-[76px] w-[76px] items-center justify-center rounded-2xl bg-white shadow-[0_1px_3px_rgba(15,23,42,0.08),0_6px_16px_-6px_rgba(15,23,42,0.18)] ring-1 ring-black/5 transition-shadow duration-150 group-hover:shadow-[0_2px_6px_rgba(15,23,42,0.1),0_14px_24px_-8px_rgba(15,23,42,0.25)] group-hover:ring-black/10";
// Sin translate en el hover: un transform animado hace que Chrome dibuje el
// mosaico como capa rasterizada y, con escalado de pantalla de Windows (125 %,
// 150 %), los iconos se ven borrosos. Foco: el mismo anillo del kit
// (Button, DataTable).
const itemClass =
  "group flex w-[104px] flex-col items-center gap-2 rounded-xl p-1 text-center focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600";

// Apps planificadas que se muestran como "Próximamente" (pedido del usuario
// 2026-10-17: "para tener una mejor orientación visual"). Mosaico sin enlace,
// igual que los ítems "Pronto" del menú lateral: no hay página placeholder.
// Si una de estas apps llega en get_visible_apps (mismo slug), se muestra la
// real y no el aviso. Flotilla y Agencia ya existen en core.apps, pero hoy no
// están habilitadas para la empresa; si se habilitan y un usuario no tiene
// permiso, verá "Próximamente" en vez de nada (aceptado: es solo orientación).
// No van aquí las funciones que ya viven dentro de un módulo, como Nómina
// (RRHH). Asistencia tampoco: desde 2026-10-17 es una app propia en
// core.apps (slug `asistencia`, mismo deploy que RRHH bajo /rrhh/asistencia)
// y llega por get_visible_apps. Listas de precios sí: el usuario decidió
// (2026-10-17) que sea una app aparte, fuera de Productos. Punto de venta,
// facturación, inventario, compras, contabilidad y bancos son una sola app
// ERP (decisión 2026-10-20, réplica de AG Negocio: docs/plan/18).
interface AppProxima {
  slug: string;
  name: string;
  category: string;
  icon: string;
}

const APPS_PROXIMAMENTE: AppProxima[] = [
  // App aparte desde 2026-10-20 (docs/plan/19-presupuesto.md); registrada en
  // core.apps, todavía inactiva.
  { slug: "presupuesto", name: "Presupuesto", category: "Ventas", icon: "target" },
  { slug: "erp", name: "ERP", category: "Finanzas", icon: "calculator" },
  { slug: "precios", name: "Listas de precios", category: "Cadena de suministro", icon: "tag" },
  { slug: "flotilla", name: "Flotilla", category: "Cadena de suministro", icon: "truck" },
  { slug: "agencia", name: "Agencia digital", category: "Servicios", icon: "sun" },
];

type ItemLauncher = { tipo: "app"; app: VisibleApp } | { tipo: "proxima"; app: AppProxima };

// Agrupa por categoría: primero las apps reales (en el orden de
// get_visible_apps) y después las "Próximamente" de esa categoría. Una app
// sin categoría cae en "General".
function agruparPorCategoria(apps: VisibleApp[]): [string, ItemLauncher[]][] {
  const grupos = new Map<string, ItemLauncher[]>();
  const agregar = (clave: string, item: ItemLauncher) => {
    const grupo = grupos.get(clave);
    if (grupo) grupo.push(item);
    else grupos.set(clave, [item]);
  };
  for (const app of apps) agregar(app.category ?? "General", { tipo: "app", app });
  const visibles = new Set(apps.map((a) => a.slug));
  for (const app of APPS_PROXIMAMENTE) {
    if (!visibles.has(app.slug)) agregar(app.category, { tipo: "proxima", app });
  }
  const posicion = (categoria: string) => {
    const i = ORDEN_CATEGORIAS.indexOf(categoria);
    return i === -1 ? ORDEN_CATEGORIAS.length : i;
  };
  // sort es estable: las categorías fuera de ORDEN_CATEGORIAS conservan el
  // orden de llegada entre sí.
  return Array.from(grupos.entries()).sort(([a], [b]) => posicion(a) - posicion(b));
}

function esRutaInterna(route: string | null | undefined): route is string {
  return typeof route === "string" && route.startsWith("/") && !route.startsWith("//") && !route.startsWith("/\\");
}

function AppTile({ app }: { app: VisibleApp }) {
  // Cambio de zona: <a> plano para cargar la aplicación completa, sin prefetch
  // ni navegación cliente con los recursos de Nexo (Multi-Zones).
  return (
    <a href={app.route} className={itemClass}>
      <span className={tileClass}>
        <AppTileIcon icon={app.icon} category={app.category} className="h-12 w-12" />
      </span>
      <span className="text-[13px] leading-tight text-neutral-700">{app.name}</span>
    </a>
  );
}

function ProximaTile({ app }: { app: AppProxima }) {
  return (
    <div className="flex w-[104px] flex-col items-center gap-2 p-1 text-center">
      <span className="flex h-[76px] w-[76px] items-center justify-center rounded-2xl border border-dashed border-neutral-300 bg-white/50">
        {/* Gris por color de relleno, no con filter (grayscale/opacity rasterizan el SVG y lo desenfocan). */}
        <AppTileIcon
          icon={app.icon}
          category={app.category}
          className="h-12 w-12 [&_[class*=fill-]:not(.fill-white)]:fill-neutral-300!"
        />
      </span>
      <span className="text-[13px] leading-tight text-neutral-500">{app.name}</span>
      <span className="-mt-1 rounded-full bg-neutral-200/70 px-2 py-0.5 text-[11px] font-medium text-neutral-600">
        Próximamente
      </span>
    </div>
  );
}

// Tarjeta "Configuración" del Launcher (decisión del usuario 2026-10-14:
// "tiene que existir en el dashboard", al estilo de Ajustes en Odoo). Lleva
// a la primera pantalla de Configuración que el usuario puede ver; sin
// ningún permiso de administración, la tarjeta no aparece. Mostrarla no
// autoriza nada: cada pantalla valida su propio permiso en el servidor.
const DESTINOS_CONFIGURACION: { permiso: Permiso; href: string }[] = [
  { permiso: "usuariosVer", href: "/configuracion/usuarios" },
  { permiso: "rolesVer", href: "/configuracion/roles" },
  { permiso: "sucursalesVer", href: "/configuracion/sucursales" },
  { permiso: "auditoriaVer", href: "/configuracion/auditoria" },
  { permiso: "marcaEditar", href: "/configuracion/marca" },
];

/**
 * App Launcher de Nexo — decisión vigente (2026-09-17): "/" es
 * EXCLUSIVAMENTE el selector de aplicaciones, sin ningún chrome de módulo.
 * Antes (reconciliación 2026-09-14) esta página vivía dentro de
 * `(app)/page.tsx`, envuelta por `NexoShell` (sidebar + topbar con
 * breadcrumb/buscador/menú de usuario con "Configuración de marca") — eso
 * seguía mostrando, aunque fuera mínimo, un sidebar/topbar/menú de módulo
 * en la propia raíz. Se movió a la raíz de `app/` (fuera del grupo
 * `(app)`) para que NO herede ese layout — el proxy (src/proxy.ts) sigue
 * protegiendo esta ruta igual, la sesión no depende de estar dentro de
 * `(app)`. Header propio, mínimo: "Nexo" (texto fijo, sin link — ya
 * estamos en el inicio) + correo + cerrar sesión, sin dropdown, sin
 * buscador. La tarjeta "Configuración" de abajo lleva a esa sección.
 *
 * Kernel (2026-10-20): una llamada a Auth (sesionActual) y una sola
 * consulta de permisos (permisosDe, la misma lista que el resto del panel).
 */
export default async function PanelPage() {
  const { supabase, companyId } = await contextoActual<Database>();

  const [{ data: apps, error }, { user }, permisos] = await Promise.all([
    supabase.rpc("get_visible_apps", { p_company_id: companyId }),
    sesionActual<Database>(),
    permisosDe(),
    exigirPasswordDefinitiva(),
  ]);

  // El detalle técnico queda en el log del servidor, nunca en pantalla.
  if (error) console.error("get_visible_apps", error);
  // Solo rutas internas del dominio (Multi-Zones + SSO): una URL absoluta o
  // "//host" en core.apps.route sacaría al usuario del dominio de la sesión.
  const lista = (apps ?? []).filter((app) => {
    if (esRutaInterna(app.route)) return true;
    console.warn("core.apps.route no interna; la app no se muestra", app.slug);
    return false;
  });
  const secciones = agruparPorCategoria(lista);
  const configuracionHref = DESTINOS_CONFIGURACION.find((d) => permisos[d.permiso])?.href;

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-100 via-slate-50 to-sky-100">
      <header className="flex items-center justify-between border-b border-white/60 bg-white/60 px-4 py-3 backdrop-blur sm:px-6">
        <span className="text-sm font-semibold tracking-tight text-neutral-900">Nexo</span>
        <div className="flex min-w-0 items-center gap-3 text-sm text-neutral-500">
          {user?.email && <span className="hidden min-w-0 truncate sm:inline">{user.email}</span>}
          <form action={signOut}>
            <Button variant="ghost" size="sm" type="submit">
              Cerrar sesión
            </Button>
          </form>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-10 sm:px-6 sm:py-14">
        <h1 className="sr-only">Aplicaciones</h1>

        {error && (
          <Alert tone="error" title="No se pudo cargar la lista de aplicaciones" action={<RecargarButton />}>
            Intenta de nuevo en unos segundos.
          </Alert>
        )}

        {!error && lista.length === 0 && !configuracionHref && (
          <EmptyState
            variant="no-access"
            title="Todavía no tienes aplicaciones habilitadas"
            description="Pide a quien administra Nexo en tu empresa que te asigne un rol con acceso a las aplicaciones que necesitas."
          />
        )}

        {(secciones.length > 0 || configuracionHref) && (
          <div className={seccionesClass}>
            {secciones.map(([categoria, items], i) => (
              <section
                key={categoria}
                aria-labelledby={`seccion-${i}`}
                className={`${seccionClass} ${spanDeSeccion(categoria, items.length)}`}
              >
                <h2 id={`seccion-${i}`} className={tituloClass}>
                  {categoria}
                </h2>
                {items.map((item) =>
                  item.tipo === "app" ? (
                    <AppTile key={item.app.slug} app={item.app} />
                  ) : (
                    <ProximaTile key={item.app.slug} app={item.app} />
                  ),
                )}
              </section>
            ))}

            {configuracionHref && (
              <section
                aria-labelledby="seccion-administracion"
                className={`${seccionClass} ${spanDeSeccion("Administración", 1)}`}
              >
                <h2 id="seccion-administracion" className={tituloClass}>
                  Administración
                </h2>
                <Link href={configuracionHref} className={itemClass}>
                  <span className={tileClass}>
                    <AppTileIcon icon="settings" className="h-12 w-12" />
                  </span>
                  <span className="text-[13px] leading-tight text-neutral-700">Configuración</span>
                </Link>
              </section>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
