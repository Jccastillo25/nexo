import type { Metadata } from "next";
import Link from "next/link";
import { hasPermission } from "@nexo/permissions";
import { DataTable, EmptyState, PageHeader, RowActionIcons, StatusBadge, type StatusTone } from "@nexo/ui";
import { createClient } from "@/lib/supabase/server";
import { getCompanyId } from "@/lib/company";

export const metadata: Metadata = {
  title: "Contratos · RRHH",
};

interface ContratoListRow {
  id: string;
  numero_contrato: number;
  estado: "borrador" | "activo" | "finalizado";
  puesto: string | null;
  departamento: string | null;
  fecha_inicio: string | null;
  empleado_id: string;
  empleados: { nombre: string; apellido: string } | null;
}

const ESTADO_TONE: Record<ContratoListRow["estado"], StatusTone> = {
  borrador: "warning",
  activo: "positive",
  finalizado: "neutral",
};

/**
 * Listado de rrhh.contratos de TODOS los empleados (Contratación →
 * Contratos). Columna "Acciones" (👁 Ver contrato / ✎ Editar, solo en
 * borrador) separa explícitamente "ver la ficha del contrato" (ojo,
 * siempre) de "ir al expediente del empleado" (click en el nombre).
 *
 * P2 (reconciliación de navegación 2026-09-14, ver docs/status-log/):
 * Contratación absorbe TODO el ciclo contractual — "+ Nuevo contrato"
 * (/contratacion/contratos/nuevo, selecciona un empleado existente) y la
 * ficha de cada contrato (/contratacion/contratos/[id], ciclo completo
 * crear→editar→jornada→activar→PIN→finalizar) — el expediente del
 * empleado (/expedientes/[id]) ya no tiene ningún dato ni acción
 * contractual.
 */
export default async function ContratosListPage() {
  const supabase = await createClient();
  const companyId = getCompanyId();

  const [canVer, canEditar, canCrear] = await Promise.all([
    hasPermission({ supabase, companyId }, "rrhh.expedientes.contratos.ver"),
    hasPermission({ supabase, companyId }, "rrhh.expedientes.contratos.editar"),
    hasPermission({ supabase, companyId }, "rrhh.expedientes.contratos.crear"),
  ]);
  if (!canVer) {
    return (
      <EmptyState
        title="Sin permiso para ver contratos"
        description="No tenés el permiso rrhh.expedientes.contratos.ver para esta empresa."
      />
    );
  }

  const { data, error } = await supabase
    .schema("rrhh")
    .from("contratos")
    .select("id, numero_contrato, estado, puesto, departamento, fecha_inicio, empleado_id, empleados(nombre, apellido)")
    .eq("company_id", companyId)
    .order("numero_contrato", { ascending: false });

  if (error) {
    throw new Error(`No se pudo cargar el listado de contratos: ${error.message}`);
  }

  const rows = (data ?? []) as unknown as ContratoListRow[];

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Contratos"
        description="Todos los contratos registrados, de todos los empleados."
        actions={
          canCrear && (
            <Link
              href="/contratacion/contratos/nuevo"
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
            >
              + Nuevo contrato
            </Link>
          )
        }
      />

      <DataTable
        rows={rows}
        rowKey={(c) => c.id}
        emptyLabel="Todavía no hay contratos registrados."
        columns={[
          {
            key: "numero",
            header: "#",
            render: (c) => <span className="font-mono text-neutral-500">{c.numero_contrato}</span>,
          },
          {
            key: "empleado",
            header: "Empleado",
            render: (c) => (
              <Link href={`/expedientes/${c.empleado_id}`} className="font-medium text-neutral-900 hover:underline">
                {c.empleados ? `${c.empleados.nombre} ${c.empleados.apellido}` : "—"}
              </Link>
            ),
          },
          { key: "puesto", header: "Puesto", render: (c) => c.puesto ?? "—" },
          { key: "departamento", header: "Departamento", render: (c) => c.departamento ?? "—" },
          { key: "inicio", header: "Inicio", render: (c) => c.fecha_inicio ?? "—" },
          {
            key: "estado",
            header: "Estado",
            render: (c) => <StatusBadge label={c.estado} tone={ESTADO_TONE[c.estado]} />,
          },
          {
            key: "acciones",
            header: "Acciones",
            align: "right",
            render: (c) => (
              <RowActionIcons
                actions={[
                  {
                    key: "ver",
                    icon: "eye",
                    label: "Ver contrato",
                    href: `/contratacion/contratos/${c.id}`,
                  },
                  {
                    key: "editar",
                    icon: "pencil",
                    label: "Editar",
                    href: `/contratacion/contratos/${c.id}`,
                    disabled: !canEditar || c.estado !== "borrador",
                    disabledReason:
                      c.estado !== "borrador"
                        ? "Solo se puede editar un contrato en borrador."
                        : "Editar",
                  },
                ]}
              />
            ),
          },
        ]}
      />
    </div>
  );
}
