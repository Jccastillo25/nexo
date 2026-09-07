import type { Metadata } from "next";
import Link from "next/link";
import { hasPermission } from "@nexo/permissions";
import { DataTable, EmptyState, PageHeader, StatusBadge, type StatusTone } from "@nexo/ui";
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
  borrador: "neutral",
  activo: "positive",
  finalizado: "neutral",
};

/**
 * Nexo Enterprise UI (2026-09-07) — nueva vista de solo lectura pedida por
 * el arbol de navegacion (Contratación → Contratos): listado de
 * rrhh.contratos de TODOS los empleados, algo que antes solo existia
 * embebido en cada expediente individual. Sin cambios de logica/DB — usa
 * el mismo permiso rrhh.expedientes.contratos.ver ya existente y una
 * consulta de solo lectura protegida por RLS. La gestion (crear/editar/
 * activar/finalizar) sigue viviendo en el expediente del empleado
 * (/expedientes/[id]) — esta pantalla es de consulta, cada fila enlaza ahí.
 */
export default async function ContratosListPage() {
  const supabase = await createClient();
  const companyId = getCompanyId();

  const canVer = await hasPermission({ supabase, companyId }, "rrhh.expedientes.contratos.ver");
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
        ]}
      />
    </div>
  );
}
