import type { Metadata } from "next";
import { EmptyState, MetricCard, PageHeader, QuickActions, type QuickAction } from "@nexo/ui";
import { createClient } from "@/lib/supabase/server";
import { getCompanyId } from "@/lib/company";
import { permisosAsistenciaDe } from "@/lib/permisos-asistencia";
import { hoyManagua } from "@/lib/fecha-managua";

export const metadata: Metadata = {
  title: "Dashboard · Asistencia",
};

/** Conteo de una consulta `head: true`; `null` si falló (la tarjeta dice "No disponible"). */
type Conteo = number | null;

const NO_DISPONIBLE = { value: "—", hint: "No disponible", tone: "pending" as const };

/**
 * Dashboard de KPIs de Asistencia (regla de CLAUDE.md: la raíz de cada app
 * aterriza en su dashboard). Cada tarjeta aparece solo con su permiso y
 * con datos reales:
 *
 * - "Marcas de hoy": conteo en rrhh.asistencia_marcas (RLS) por
 *   `marcado_en` dentro del día de America/Managua, [hoy 00:00, mañana
 *   00:00) en -06:00 (Nicaragua no tiene horario de verano). Corrige el bug
 *   de la tarjeta retirada del dashboard de RRHH, que usaba medianoche UTC.
 * - "Dispositivos activos": rrhh.kiosko_dispositivos con activo = true.
 * - "Envíos no aceptados hoy": sin fuente legible (rrhh.kiosko_solicitudes
 *   está revocada para authenticated y no hay RPC todavía) → "Pendiente de
 *   integración", nunca un número inventado.
 *
 * Si una consulta falla, se registra en el servidor y solo esa tarjeta
 * dice "No disponible"; la página no se cae.
 */
export default async function AsistenciaDashboardPage() {
  const supabase = await createClient();
  const companyId = getCompanyId();
  const permisos = await permisosAsistenciaDe(companyId);

  const hoy = hoyManagua();
  const inicioDia = Date.parse(`${hoy}T00:00:00-06:00`);
  const desde = new Date(inicioDia).toISOString();
  const hasta = new Date(inicioDia + 86_400_000).toISOString();

  const [marcasHoy, dispositivosActivos, dispositivosTotal] = await Promise.all([
    permisos.marcasVer
      ? contar(
          "marcas de hoy",
          supabase
            .schema("rrhh")
            .from("asistencia_marcas")
            .select("id", { count: "exact", head: true })
            .eq("company_id", companyId)
            .gte("marcado_en", desde)
            .lt("marcado_en", hasta)
        )
      : Promise.resolve(null),
    permisos.kioskosVer
      ? contar(
          "dispositivos activos",
          supabase
            .schema("rrhh")
            .from("kiosko_dispositivos")
            .select("id", { count: "exact", head: true })
            .eq("company_id", companyId)
            .eq("activo", true)
        )
      : Promise.resolve(null),
    permisos.kioskosVer
      ? contar(
          "dispositivos registrados",
          supabase
            .schema("rrhh")
            .from("kiosko_dispositivos")
            .select("id", { count: "exact", head: true })
            .eq("company_id", companyId)
        )
      : Promise.resolve(null),
  ]);

  const acciones: QuickAction[] = [
    ...(permisos.marcasVer ? [{ label: "Consultar marcas", href: "/asistencia/marcas", icon: "list" as const }] : []),
    ...(permisos.kioskosVer ? [{ label: "Dispositivos", href: "/asistencia/dispositivos", icon: "monitor" as const }] : []),
  ];
  const sinTarjetas = !permisos.marcasVer && !permisos.kioskosVer;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Asistencia" description="Resumen de marcaciones y terminales. Hora de Nicaragua." />

      {sinTarjetas ? (
        <EmptyState title="Tu rol puede entrar a Asistencia, pero no ver sus datos. Pide acceso a tu administrador." />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {permisos.marcasVer &&
              (marcasHoy === null ? (
                <MetricCard label="Marcas de hoy" {...NO_DISPONIBLE} />
              ) : (
                <MetricCard
                  label="Marcas de hoy"
                  value={marcasHoy.toLocaleString("es-NI")}
                  hint="Entradas, descansos y salidas"
                />
              ))}
            {permisos.kioskosVer &&
              (dispositivosActivos === null ? (
                <MetricCard label="Dispositivos activos" {...NO_DISPONIBLE} />
              ) : (
                <MetricCard
                  label="Dispositivos activos"
                  value={dispositivosActivos.toLocaleString("es-NI")}
                  hint={
                    dispositivosTotal === null
                      ? undefined
                      : `de ${dispositivosTotal.toLocaleString("es-NI")} registrados`
                  }
                />
              ))}
            {permisos.kioskosVer && (
              <MetricCard label="Envíos no aceptados hoy" value="—" hint="Pendiente de integración" tone="pending" />
            )}
          </div>

          {acciones.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <QuickActions actions={acciones} />
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

async function contar(
  contexto: string,
  consulta: PromiseLike<{ count: number | null; error: unknown }>
): Promise<Conteo> {
  try {
    const { count, error } = await consulta;
    if (error) {
      console.error(`Dashboard de Asistencia: no se pudo contar ${contexto}`, error);
      return null;
    }
    return count ?? 0;
  } catch (err) {
    console.error(`Dashboard de Asistencia: no se pudo contar ${contexto}`, err);
    return null;
  }
}
