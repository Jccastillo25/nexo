import type { Metadata } from "next";
import Link from "next/link";
import { hasPermission } from "@nexo/permissions";
import { DataTable, EmptyState, PageHeader, StatusBadge, type StatusTone } from "@nexo/ui";
import { createClient } from "@/lib/supabase/server";
import { getCompanyId } from "@/lib/company";
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
 * Listado del Expediente General de todos los empleados. Guard de
 * recurso (norma v3.0, checklist paso 3-4): rrhh.expedientes.empleados.ver
 * — distinto del guard de MODULO (rrhh.ver_modulo) que ya paso
 * (app)/layout.tsx.
 *
 * Nexo Enterprise UI (2026-09-07): tabla clara via DataTable (columnas
 * Empleado/Documento/Contacto/Estado laboral/Acciones, regla obligatoria
 * §1.6 — "no muestres cinco botones por fila", el menu "⋯" vive en
 * EmpleadoRowMenu). Elimina empleado agregado (§1.8) reutilizando el
 * permiso/RLS que ya existian.
 *
 * Requiere "rrhh" expuesto en Data API (ver .env.local.example) para el
 * `.schema("rrhh")` de abajo.
 */
export default async function ExpedientesPage() {
  const supabase = await createClient();
  const companyId = getCompanyId();

  const [canVer, canCrear, canEditar, canEliminar, canVerContratos] = await Promise.all([
    hasPermission({ supabase, companyId }, "rrhh.expedientes.empleados.ver"),
    hasPermission({ supabase, companyId }, "rrhh.expedientes.empleados.crear"),
    hasPermission({ supabase, companyId }, "rrhh.expedientes.empleados.editar"),
    hasPermission({ supabase, companyId }, "rrhh.expedientes.empleados.eliminar"),
    hasPermission({ supabase, companyId }, "rrhh.expedientes.contratos.ver"),
  ]);

  if (!canVer) {
    return (
      <EmptyState
        title="Sin permiso para ver expedientes"
        description="No tenés el permiso rrhh.expedientes.empleados.ver para esta empresa."
      />
    );
  }

  const { data: empleados, error } = await supabase
    .schema("rrhh")
    .from("empleados")
    .select("id, codigo_empleado, nombre, apellido, documento_identidad, email, telefono")
    .eq("company_id", companyId)
    .order("nombre", { ascending: true });

  if (error) {
    throw new Error(`No se pudo cargar el listado de empleados: ${error.message}`);
  }

  const rows: EmpleadoRow[] = empleados ?? [];

  const empleadosConContratoActivo = new Set<string>();
  const empleadosConBorrador = new Set<string>();
  // Cualquier contrato (borrador/activo/finalizado) — no solo el activo —
  // es lo que rrhh.fn_eliminar_empleado rechaza (historial contractual).
  // Se usa para deshabilitar la papelera de forma preventiva en la UI; el
  // backend sigue siendo quien realmente lo impide (ver empleado-row-menu).
  const empleadosConAlgunContrato = new Set<string>();
  if (canVerContratos && rows.length > 0) {
    const { data: contratosDeTodos } = await supabase
      .schema("rrhh")
      .from("contratos")
      .select("empleado_id, estado")
      .eq("company_id", companyId)
      .in(
        "empleado_id",
        rows.map((e) => e.id)
      );
    for (const c of contratosDeTodos ?? []) {
      empleadosConAlgunContrato.add(c.empleado_id);
      if (c.estado === "activo") empleadosConContratoActivo.add(c.empleado_id);
      if (c.estado === "borrador") empleadosConBorrador.add(c.empleado_id);
    }
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
          canCrear && (
            <Link
              href="/expedientes/nuevo"
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
            >
              + Nuevo empleado
            </Link>
          )
        }
      />

      <DataTable
        rows={rows}
        rowKey={(e) => e.id}
        emptyLabel="Todavía no hay expedientes creados."
        columns={[
          {
            key: "empleado",
            header: "Empleado",
            render: (e) => (
              <Link href={`/expedientes/${e.id}`} className="font-medium text-neutral-900 hover:underline">
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
            render: (e) =>
              canVerContratos ? (
                <StatusBadge label={estadoLaboral(e.id).label} tone={estadoLaboral(e.id).tone} />
              ) : (
                "—"
              ),
          },
          {
            key: "acciones",
            header: "Acciones",
            align: "right",
            render: (e) => (
              <EmpleadoRowMenu
                empleadoId={e.id}
                nombreCompleto={`${e.nombre} ${e.apellido}`}
                canVer={canVer}
                canEditar={canEditar}
                canEliminar={canEliminar}
                tieneContrato={canVerContratos ? empleadosConAlgunContrato.has(e.id) : null}
              />
            ),
          },
        ]}
      />
    </div>
  );
}
