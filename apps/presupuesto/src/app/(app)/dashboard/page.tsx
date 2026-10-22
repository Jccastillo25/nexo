import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Alert, EmptyState, PageHeader, TabLinks } from "@nexo/ui";
import { contextoDePagina } from "@/lib/metas/permisos";
import { mensajeUsuario } from "@/lib/metas/errores";
import { aniosDisponibles, leerPeriodo } from "@/lib/metas/periodo";
import type { Equipo, MetasMes, MiAvance, MisFacturas, VentaDiaria } from "@/lib/metas/tipos";
import { cargarIndicadores } from "./indicadores";
import { VistaMiAvance } from "./mi-avance";
import { VistaEquipo } from "./equipo";

export const metadata: Metadata = {
  title: "Dashboard · Presupuesto",
};

export const dynamic = "force-dynamic";

/**
 * Dashboard de la app: Mi avance (vendedor) y/o Equipo (gerente), con la
 * venta del mes contra la meta y contra el presupuesto. La vista Equipo solo
 * se consulta con su permiso: forzar ?vista=equipo sin él no llama a
 * presupuesto_equipo.
 *
 * Rendimiento: presupuesto_indicadores (la RPC más lenta) se lanza junto con
 * las demás pero no se espera aquí; cada vista la resuelve dentro de
 * <Suspense>, así el número del mes y el equipo pintan antes.
 */
export default async function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  const [ctx, params] = await Promise.all([contextoDePagina(), searchParams]);
  const { supabase, companyId, permisos: p } = ctx;
  if (!p.propio && !p.equipo) {
    if (p.facturas || p.misFacturas) redirect("/facturas");
    // Solo entra a la app (por ejemplo, Configuración): no hay indicadores
    // que mostrar, y redirigir aquí mismo daría un ciclo.
    return (
      <div className="flex max-w-6xl flex-col gap-6">
        <PageHeader title="Dashboard" />
        <EmptyState
          variant="no-access"
          title="Tu rol no tiene indicadores en esta app"
          description="El avance de metas lo ven los vendedores y la gerencia de ventas. Usa el menú para ir a lo que tienes asignado."
        />
      </div>
    );
  }

  const { anio, mes } = leerPeriodo(params);
  // Con avance propio se entra a "Mi avance" (decisión del usuario 2026-10-20:
  // el gerente que también vende ve primero lo suyo); "?vista=equipo" cambia
  // de pestaña. Sin avance propio se consulta Equipo de una vez.
  const pideMio = p.propio && params.vista !== "equipo";
  const anios = aniosDisponibles();
  const quiereMio = p.propio && (!p.equipo || pideMio);

  // Los indicadores salen primero y no se esperan: llegan por <Suspense>.
  const indicadoresMio = quiereMio ? cargarIndicadores(ctx, anio, mes, "propio") : null;
  let indicadoresEquipo = p.equipo && !pideMio ? cargarIndicadores(ctx, anio, mes, "equipo") : null;

  // El resto de las lecturas independientes, en paralelo. Equipo se omite si el usuario pidió "Mi avance".
  const ventaDiaria = (vista: "propio" | "equipo") =>
    supabase.rpc("presupuesto_venta_diaria", { p_company_id: companyId, p_anio: anio, p_mes: mes, p_vista: vista });
  const [avanceRes, equipoRes, metasRes, misRes, diariaEquipoRes] = await Promise.all([
    p.propio ? supabase.rpc("presupuesto_mi_avance", { p_company_id: companyId, p_anio: anio, p_mes: mes }) : null,
    p.equipo && !pideMio ? supabase.rpc("presupuesto_equipo", { p_company_id: companyId, p_anio: anio, p_mes: mes }) : null,
    p.equipo && p.metasVend && !pideMio
      ? supabase.rpc("presupuesto_metas_mes", { p_company_id: companyId, p_anio: anio, p_mes: mes })
      : null,
    quiereMio && p.misFacturas
      ? supabase.rpc("presupuesto_mis_facturas", { p_company_id: companyId, p_anio: anio, p_mes: mes, p_limite: 10, p_offset: 0 })
      : null,
    p.equipo && !pideMio ? ventaDiaria("equipo") : null,
  ]);

  const miAvance = (avanceRes?.data ?? null) as MiAvance | null;
  const vinculado = miAvance?.vinculado === true;
  const conPestanas = p.equipo && p.propio && vinculado;
  const vista: "equipo" | "mio" = !p.equipo ? "mio" : conPestanas && pideMio ? "mio" : "equipo";

  // Tiene avance propio pero no está vinculado a un vendedor: cae en Equipo,
  // que no se consultó todavía (una segunda tanda solo en ese caso).
  let equipo = equipoRes;
  let metas = metasRes;
  let diariaEquipo = diariaEquipoRes;
  if (vista === "equipo" && !equipo) {
    indicadoresEquipo = cargarIndicadores(ctx, anio, mes, "equipo");
    [equipo, metas, diariaEquipo] = await Promise.all([
      supabase.rpc("presupuesto_equipo", { p_company_id: companyId, p_anio: anio, p_mes: mes }),
      p.metasVend ? supabase.rpc("presupuesto_metas_mes", { p_company_id: companyId, p_anio: anio, p_mes: mes }) : null,
      ventaDiaria("equipo"),
    ]);
  }

  // Las dos pestañas comparten la ruta /dashboard: la activa se marca a mano.
  const pestanas = conPestanas ? (
    <TabLinks
      label="Vista del dashboard"
      items={[
        { label: "Mi avance", href: `/dashboard?vista=mio&anio=${anio}&mes=${mes}`, active: vista === "mio" },
        { label: "Equipo", href: `/dashboard?vista=equipo&anio=${anio}&mes=${mes}`, active: vista === "equipo" },
      ]}
    />
  ) : null;

  if (vista === "mio") {
    if (avanceRes?.error || !miAvance) {
      return (
        <div className="flex max-w-6xl flex-col gap-6">
          <PageHeader title="Mi avance" />
          <Alert tone="error">
            {mensajeUsuario(avanceRes?.error, "presupuesto_mi_avance", "No se pudo cargar tu avance. Intenta de nuevo.")}
          </Alert>
        </div>
      );
    }
    return (
      <VistaMiAvance
        anio={anio}
        mes={mes}
        anios={anios}
        datos={miAvance}
        facturas={(misRes?.data ?? null) as MisFacturas | null}
        errorFacturas={misRes?.error ? mensajeUsuario(misRes.error, "presupuesto_mis_facturas", "No se pudieron cargar tus facturas.") : null}
        indicadores={indicadoresMio ?? Promise.resolve({ indicadores: null, error: null })}
        puedeVerFacturas={p.misFacturas}
        conListadoEquipo={p.facturas}
        puedeVincular={p.vendedores}
        pestanas={pestanas}
        conPestanas={conPestanas}
      />
    );
  }

  if (!equipo || equipo.error || !equipo.data) {
    return (
      <div className="flex max-w-6xl flex-col gap-6">
        <PageHeader title="Avance del equipo" />
        {pestanas}
        <Alert tone="error">
          {mensajeUsuario(equipo?.error, "presupuesto_equipo", "No se pudo cargar el avance del equipo. Intenta de nuevo.")}
        </Alert>
      </div>
    );
  }

  // Complementos: si fallan se registra en el servidor (mensajeUsuario) y la vista sigue.
  // Las metas solo alimentan el detalle plegado de la meta sugerida, que se oculta sin datos.
  if (metas?.error) mensajeUsuario(metas.error, "presupuesto_metas_mes", "No se pudieron cargar las metas del mes.");
  const errorVentaDiaria = diariaEquipo?.error
    ? mensajeUsuario(diariaEquipo.error, "presupuesto_venta_diaria", "No se pudo cargar la venta por día.")
    : null;

  return (
    <VistaEquipo
      anio={anio}
      mes={mes}
      anios={anios}
      datos={equipo.data as Equipo}
      metasMes={metas && !metas.error ? (metas.data as MetasMes) : null}
      indicadores={indicadoresEquipo ?? Promise.resolve({ indicadores: null, error: null })}
      ventaDiaria={diariaEquipo && !diariaEquipo.error ? (diariaEquipo.data as VentaDiaria) : null}
      errorVentaDiaria={errorVentaDiaria}
      permisos={{ importar: p.importar, metasVend: p.metasVend, presupuesto: p.presupuesto }}
      pestanas={pestanas}
    />
  );
}
