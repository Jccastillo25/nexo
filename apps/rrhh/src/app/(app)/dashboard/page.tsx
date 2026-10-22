import type { Metadata } from "next";
import { contextoActual } from "@nexo/auth";
import {
  Alert,
  ButtonLink,
  DataTable,
  EmptyState,
  MetricCard,
  NexoIcon,
  PageHeader,
  StatusBadge,
  entero,
  fechaCorta,
  type MetricCardDelta,
} from "@nexo/ui";
import type { Database } from "@/lib/supabase/database.types";
import { permisosDe } from "@/lib/permisos-rrhh";
import { hoyManagua, inicioDiaManagua, sumarDias } from "@/lib/fecha-managua";

export const metadata: Metadata = {
  title: "Dashboard · RRHH",
};

const DIA_MS = 86_400_000;

/** Resultado de un conteo: número, `null` si la consulta falló. */
type Conteo = number | null;

interface ProximoVencimiento {
  id: string;
  fecha_fin_prevista: string;
  empleados: { nombre: string; apellido: string } | null;
  puestos: { nombre: string } | null;
}

function plural(n: number, uno: string, varios: string): string {
  return `${entero(n)} ${n === 1 ? uno : varios}`;
}

/**
 * Dashboard de RRHH (Fase 4, 2026-10-20). Responde: ¿cuánto personal hay y
 * qué contratos requieren acción? Regla obligatoria (CLAUDE.md): la raíz del
 * módulo aterriza aquí, con KPIs reales; ningún número se inventa.
 *
 * Fuente: conteos `count: "exact", head: true` sobre rrhh.contratos y
 * rrhh.empleados (RLS). `hoy` es la fecha de Managua.
 * - Personal activo = contratos activos (contratos_empleado_activo_unq
 *   garantiza uno por empleado). Altas del mes: activado_at ≥ inicio de mes;
 *   bajas: finalizados con finalizado_at ≥ inicio de mes.
 * - Sin contrato activo = empleados − contratos activos.
 * Cada bloque se consulta solo con su permiso, y si su consulta falla solo
 * esa tarjeta muestra "No disponible" (antes un error tumbaba la página).
 */
export default async function DashboardPage() {
  const [{ supabase, companyId }, permisos] = await Promise.all([contextoActual<Database>(), permisosDe()]);

  const verContratos = permisos.contratosVer;
  const verEmpleados = permisos.empleadosVer;

  const accionNuevo = permisos.empleadosCrear ? (
    <ButtonLink href="/expedientes/nuevo" icon={<NexoIcon name="users" />}>
      Nuevo empleado
    </ButtonLink>
  ) : null;

  if (!verContratos && !verEmpleados) {
    return (
      <div className="flex max-w-6xl flex-col gap-6">
        <PageHeader title="RRHH" actions={accionNuevo} />
        <EmptyState variant="no-access" title="No tienes acceso a los indicadores de RRHH" />
      </div>
    );
  }

  const hoy = hoyManagua();
  const en30 = sumarDias(hoy, 30);
  const inicioMes = `${hoy.slice(0, 8)}01T00:00:00-06:00`;

  const contratos = () => supabase.schema("rrhh").from("contratos");
  const contar = async (
    consulta: PromiseLike<{ count: number | null; error: unknown }>,
    contexto: string
  ): Promise<Conteo> => {
    const { count, error } = await consulta;
    if (error) {
      console.error(`dashboard RRHH: ${contexto}`, error);
      return null;
    }
    return count ?? 0;
  };
  const conteo = { count: "exact", head: true } as const;
  // Un bloque sin permiso no ejecuta su consulta.
  const omitido = Promise.resolve<Conteo>(null);

  const [empleados, activos, altas, bajas, borradores, vencen30, vencidos, proximosRes] = await Promise.all([
    verEmpleados
      ? contar(supabase.schema("rrhh").from("empleados").select("id", conteo).eq("company_id", companyId), "empleados")
      : omitido,
    verContratos
      ? contar(contratos().select("id", conteo).eq("company_id", companyId).eq("estado", "activo"), "activos")
      : omitido,
    verContratos
      ? contar(contratos().select("id", conteo).eq("company_id", companyId).gte("activado_at", inicioMes), "altas")
      : omitido,
    verContratos
      ? contar(
          contratos()
            .select("id", conteo)
            .eq("company_id", companyId)
            .eq("estado", "finalizado")
            .gte("finalizado_at", inicioMes),
          "bajas"
        )
      : omitido,
    verContratos
      ? contar(contratos().select("id", conteo).eq("company_id", companyId).eq("estado", "borrador"), "borradores")
      : omitido,
    verContratos
      ? contar(
          contratos()
            .select("id", conteo)
            .eq("company_id", companyId)
            .eq("estado", "activo")
            .gte("fecha_fin_prevista", hoy)
            .lte("fecha_fin_prevista", en30),
          "vencen en 30 días"
        )
      : omitido,
    verContratos
      ? contar(
          contratos().select("id", conteo).eq("company_id", companyId).eq("estado", "activo").lt("fecha_fin_prevista", hoy),
          "vencidos"
        )
      : omitido,
    verContratos
      ? contratos()
          .select(
            "id, fecha_fin_prevista, empleados!contratos_empleado_id_fkey(nombre, apellido), puestos!contratos_puesto_id_fkey(nombre)"
          )
          .eq("company_id", companyId)
          .eq("estado", "activo")
          .lte("fecha_fin_prevista", en30)
          .order("fecha_fin_prevista", { ascending: true })
          .limit(5)
      : Promise.resolve({ data: null, error: null }),
  ]);

  if (proximosRes.error) console.error("dashboard RRHH: próximos vencimientos", proximosRes.error);
  const proximos = (proximosRes.data ?? []) as unknown as ProximoVencimiento[];

  // Personal activo: delta = altas − bajas del mes (tono neutro: no es bueno ni malo).
  let delta: MetricCardDelta | undefined;
  if (altas !== null && bajas !== null) {
    const neto = altas - bajas;
    delta = {
      value: neto > 0 ? `+${entero(neto)}` : entero(neto),
      direction: neto > 0 ? "up" : neto < 0 ? "down" : "flat",
      tone: "neutral",
      label: `este mes: ${plural(altas, "alta", "altas")}, ${plural(bajas, "baja", "bajas")}`,
    };
  }

  const diasHasta = (fecha: string) => Math.round((inicioDiaManagua(fecha) - inicioDiaManagua(hoy)) / DIA_MS);

  return (
    <div className="flex max-w-6xl flex-col gap-6">
      <PageHeader
        title="RRHH"
        description={`Personal y contratos al ${fechaCorta(hoy)}.`}
        actions={accionNuevo}
      />

      {verContratos ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {activos === null ? (
            <MetricCard size="hero" label="Personal activo" value="—" tone="pending" hint="No disponible" />
          ) : (
            <MetricCard
              size="hero"
              label="Personal activo"
              value={entero(activos)}
              unit={verEmpleados && empleados !== null ? `de ${entero(empleados)} empleados` : undefined}
              delta={delta}
              hint="Empleados con un contrato activo"
              href="/contratacion/contratos?estado=activo"
            />
          )}

          {borradores === null ? (
            <MetricCard label="Contratos en borrador" value="—" tone="pending" hint="No disponible" />
          ) : (
            <MetricCard
              label="Contratos en borrador"
              value={entero(borradores)}
              tone={borradores > 0 ? "warning" : "neutral"}
              hint={borradores > 0 ? "Creados y sin activar todavía" : "Ninguno pendiente de activar"}
              href="/contratacion/contratos?estado=borrador"
            />
          )}

          {vencen30 === null ? (
            <MetricCard label="Vencen en 30 días" value="—" tone="pending" hint="No disponible" />
          ) : (
            <MetricCard
              label="Vencen en 30 días"
              value={entero(vencen30)}
              tone={vencen30 > 0 ? "warning" : "neutral"}
              hint={
                vencidos === null ? (
                  "No se pudieron contar los ya vencidos"
                ) : vencidos > 0 ? (
                  <span className="font-medium text-red-700">
                    {plural(vencidos, "ya vencido sin finalizar", "ya vencidos sin finalizar")}
                  </span>
                ) : (
                  "Ninguno vencido sin finalizar"
                )
              }
              // Sin enlace: el listado de contratos no filtra por fecha de fin.
              // El detalle está en "Próximos vencimientos", más abajo.
            />
          )}

          {verEmpleados ? (
            empleados === null || activos === null ? (
              <MetricCard label="Sin contrato activo" value="—" tone="pending" hint="No disponible" />
            ) : (
              <MetricCard
                label="Sin contrato activo"
                value={entero(Math.max(0, empleados - activos))}
                hint="Incluye a quienes ya terminaron su contrato"
                href="/expedientes"
              />
            )
          ) : null}
        </div>
      ) : (
        // Solo con permiso de expedientes: el conteo de empleados es lo único que se puede mostrar.
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {empleados === null ? (
            <MetricCard size="hero" label="Empleados registrados" value="—" tone="pending" hint="No disponible" />
          ) : (
            <MetricCard
              size="hero"
              label="Empleados registrados"
              value={entero(empleados)}
              hint="Expedientes de la empresa"
              href="/expedientes"
            />
          )}
        </div>
      )}

      {verContratos ? (
        <section aria-labelledby="proximos-vencimientos" className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 id="proximos-vencimientos" className="text-base font-semibold text-neutral-900">
                Próximos vencimientos
              </h2>
              <p className="text-sm text-neutral-500">
                Contratos activos con fin previsto en los próximos 30 días o ya vencidos.
              </p>
            </div>
            <ButtonLink href="/contratacion/contratos" variant="link" size="sm">
              Ver todos los contratos
            </ButtonLink>
          </div>
          <DataTable
            rows={proximos}
            rowKey={(c) => c.id}
            rowHref={(c) => `/contratacion/contratos/${c.id}`}
            density="compact"
            caption="Próximos vencimientos de contratos"
            error={
              proximosRes.error ? (
                <Alert tone="error">
                  No se pudo cargar la lista de vencimientos. Recarga la página en unos minutos.
                </Alert>
              ) : undefined
            }
            empty={<EmptyState bare title="Ningún contrato vence en los próximos 30 días" />}
            columns={[
              {
                key: "empleado",
                header: "Empleado",
                render: (c) => (c.empleados ? `${c.empleados.nombre} ${c.empleados.apellido}` : "—"),
              },
              { key: "puesto", header: "Puesto", render: (c) => c.puestos?.nombre ?? "—" },
              {
                key: "fin",
                header: "Fin previsto",
                render: (c) => <span className="tabular-nums">{fechaCorta(c.fecha_fin_prevista)}</span>,
              },
              {
                key: "estado",
                header: "Estado",
                render: (c) => {
                  const dias = diasHasta(c.fecha_fin_prevista);
                  if (dias < 0) return <StatusBadge label="Vencido" tone="negative" />;
                  if (dias === 0) return <StatusBadge label="Vence hoy" tone="warning" />;
                  return <span className="text-neutral-600">{dias === 1 ? "En 1 día" : `En ${dias} días`}</span>;
                },
              },
            ]}
          />
        </section>
      ) : null}
    </div>
  );
}
