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
 * Nexo Enterprise UI (2026-09-07) — nueva vista de solo lectura pedida por
 * el arbol de navegacion (Contratación → Contratos): listado de
 * rrhh.contratos de TODOS los empleados, algo que antes solo existia
 * embebido en cada expediente individual. Sin cambios de logica/DB — usa
 * el mismo permiso rrhh.expedientes.contratos.ver ya existente y una
 * consulta de solo lectura protegida por RLS. La gestion del ciclo de vida
 * completo (crear/activar/finalizar/regenerar PIN/asignar jornada) sigue
 * viviendo en el expediente del empleado (/expedientes/[id]) — un contrato
 * nuevo nace ahí, donde se elige a qué empleado corresponde.
 *
 * Fix (2026-09-08, docs/IMPLEMENTATION_STATUS.md): columna "Acciones"
 * visible (👁 Ver contrato / ✎ Editar, solo en borrador) que separa
 * explícitamente "ver la ficha del contrato" (ojo, siempre) de "ir al
 * expediente del empleado" (click en el nombre) — antes solo existía este
 * segundo camino. La ficha vive en /contratacion/contratos/[id].
 */
export default async function ContratosListPage() {
  const supabase = await createClient();
  const companyId = getCompanyId();

  const [canVer, canEditar] = await Promise.all([
    hasPermission({ supabase, companyId }, "rrhh.expedientes.contratos.ver"),
    hasPermission({ supabase, companyId }, "rrhh.expedientes.contratos.editar"),
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
      <PageHeader title="Contratos" description="Todos los contratos registrados, de todos los empleados." />

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
