import type { Metadata } from "next";
import Link from "next/link";
import { contextoActual } from "@nexo/auth";
import {
  Alert,
  ButtonLink,
  DataTable,
  EmptyState,
  NexoIcon,
  PageHeader,
  StatusBadge,
  type StatusTone,
} from "@nexo/ui";
import type { Database } from "@/lib/supabase/database.types";
import { permisosDe } from "@/lib/permisos-rrhh";
import { EmpleadoRowMenu } from "./empleado-row-menu";

export const metadata: Metadata = {
  title: "Expedientes · RRHH",
};

interface EmpleadoRow {
  id: string;
  codigo_empleado: number;
  nombre: string;
  apellido: string;
  documento_identidad: string | null;
  email: string | null;
  telefono: string | null;
}

/**
 * Listado del Expediente General de todos los empleados. Guard de recurso
 * (norma v3.0): rrhh.expedientes.empleados.ver — distinto del guard de
 * MODULO (rrhh.ver_modulo) que ya paso (app)/layout.tsx.
 *
 * Nexo Enterprise UI (2026-09-07): tabla clara via DataTable, acciones de
 * fila visibles (EmpleadoRowMenu).
 *
 * Rendimiento (2026-10-20): empleados y contratos se piden en paralelo, y
 * los contratos por company_id (antes, un `.in()` con todos los ids, que
 * esperaba a la primera consulta y crecía con la plantilla).
 */
export default async function ExpedientesPage() {
  const [{ supabase, companyId }, permisos] = await Promise.all([
    contextoActual<Database>(),
    permisosDe(),
  ]);

  if (!permisos.empleadosVer) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader title="Expedientes" />
        <EmptyState variant="no-access" title="No tienes acceso a los expedientes" />
      </div>
    );
  }

  const [empleadosRes, contratosRes] = await Promise.all([
    supabase
      .schema("rrhh")
      .from("empleados")
      .select("id, codigo_empleado, nombre, apellido, documento_identidad, email, telefono")
      .eq("company_id", companyId)
      .order("nombre", { ascending: true }),
    permisos.contratosVer
      ? supabase.schema("rrhh").from("contratos").select("empleado_id, estado").eq("company_id", companyId)
      : Promise.resolve({ data: null, error: null }),
  ]);

  if (empleadosRes.error) {
    // El detalle va al log del servidor; error.tsx muestra solo la referencia.
    console.error("expedientes: listado de empleados", empleadosRes.error);
    throw new Error("No se pudo cargar el listado de empleados.");
  }

  const rows: EmpleadoRow[] = empleadosRes.data ?? [];
  // Sin el estado de los contratos, la columna Estado y el bloqueo preventivo
  // de la papelera quedan "sin determinar"; el backend sigue validando.
  const contratosDisponibles = permisos.contratosVer && !contratosRes.error;
  if (contratosRes.error) console.error("expedientes: estado de contratos", contratosRes.error);

  const empleadosConContratoActivo = new Set<string>();
  const empleadosConBorrador = new Set<string>();
  // Cualquier contrato (borrador/activo/finalizado) — no solo el activo —
  // es lo que rrhh.fn_eliminar_empleado rechaza (historial contractual).
  // Se usa para deshabilitar la papelera de forma preventiva en la UI; el
  // backend sigue siendo quien realmente lo impide (ver empleado-row-menu).
  const empleadosConAlgunContrato = new Set<string>();
  for (const c of contratosRes.data ?? []) {
    empleadosConAlgunContrato.add(c.empleado_id);
    if (c.estado === "activo") empleadosConContratoActivo.add(c.empleado_id);
    if (c.estado === "borrador") empleadosConBorrador.add(c.empleado_id);
  }

  function estadoLaboral(empleadoId: string): { label: string; tone: StatusTone } {
    if (empleadosConContratoActivo.has(empleadoId)) return { label: "Activo", tone: "positive" };
    if (empleadosConBorrador.has(empleadoId)) return { label: "Contrato en borrador", tone: "warning" };
    if (empleadosConAlgunContrato.has(empleadoId)) return { label: "Finalizado", tone: "neutral" };
    return { label: "Sin contrato", tone: "neutral" };
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Expedientes"
        description="Expediente General de todos los empleados de la empresa."
        actions={
          permisos.empleadosCrear ? (
            <ButtonLink href="/expedientes/nuevo" icon={<NexoIcon name="users" />}>
              Nuevo empleado
            </ButtonLink>
          ) : null
        }
      />

      {permisos.contratosVer && contratosRes.error ? (
        <Alert tone="warning" title="No se pudo cargar el estado de los contratos">
          La columna Estado queda sin dato por ahora. Recarga la página en unos minutos.
        </Alert>
      ) : null}

      <DataTable
        rows={rows}
        rowKey={(e) => e.id}
        caption="Empleados de la empresa"
        empty={
          <EmptyState
            bare
            title="Todavía no hay expedientes"
            description="Crea el primer expediente para poder registrar su contrato."
            action={
              permisos.empleadosCrear ? (
                <ButtonLink href="/expedientes/nuevo" variant="secondary">
                  Nuevo empleado
                </ButtonLink>
              ) : null
            }
          />
        }
        columns={[
          {
            key: "empleado",
            header: "Empleado",
            render: (e) => (
              <Link
                href={`/expedientes/${e.id}`}
                className="rounded-sm font-medium text-neutral-900 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
              >
                {e.nombre} {e.apellido}
              </Link>
            ),
          },
          {
            key: "documento",
            header: "Documento",
            render: (e) => e.documento_identidad ?? "—",
          },
          {
            key: "contacto",
            header: "Contacto",
            render: (e) => e.email ?? e.telefono ?? "—",
          },
          {
            key: "estado",
            header: "Estado",
            render: (e) => {
              if (!contratosDisponibles) return "—";
              const estado = estadoLaboral(e.id);
              return <StatusBadge label={estado.label} tone={estado.tone} />;
            },
          },
          {
            key: "acciones",
            header: "Acciones",
            align: "right",
            render: (e) => (
              <EmpleadoRowMenu
                empleadoId={e.id}
                nombreCompleto={`${e.nombre} ${e.apellido}`}
                canVer={permisos.empleadosVer}
                canEditar={permisos.empleadosEditar}
                canEliminar={permisos.empleadosEliminar}
                tieneContrato={contratosDisponibles ? empleadosConAlgunContrato.has(e.id) : null}
              />
            ),
          },
        ]}
      />
    </div>
  );
}
