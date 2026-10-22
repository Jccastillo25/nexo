import type { Metadata } from "next";
import Link from "next/link";
import { contextoActual } from "@nexo/auth";
import { ButtonLink, DataTable, EmptyState, NexoIcon, PageHeader, StatusBadge, fechaCorta } from "@nexo/ui";
import type { Database } from "@/lib/supabase/database.types";
import { permisosDe } from "@/lib/permisos-rrhh";
import { ESTADO_CONTRATO, type EstadoContrato } from "@/lib/contratos";
import { FiltroEstadoContratos } from "./filtro-estado";

export const metadata: Metadata = {
  title: "Contratos · RRHH",
};

/** `?estado=` válido o null: cualquier otro valor se ignora (lista completa). */
function leerEstado(valor: string | string[] | undefined): EstadoContrato | null {
  return typeof valor === "string" && Object.keys(ESTADO_CONTRATO).includes(valor) ? (valor as EstadoContrato) : null;
}

interface ContratoListRow {
  id: string;
  numero_contrato: number;
  estado: EstadoContrato;
  fecha_inicio: string | null;
  empleado_id: string;
  empleados: { nombre: string; apellido: string } | null;
  puestos: { nombre: string } | null;
  departamentos: { nombre: string } | null;
}

/**
 * Listado de rrhh.contratos de TODOS los empleados (Contratación →
 * Contratos). Toda la fila abre la ficha del contrato (rowHref; el "N.º" es
 * el enlace con foco de teclado). El nombre del empleado conserva su propio
 * enlace al expediente.
 *
 * P2 (reconciliación de navegación 2026-09-14, ver docs/status-log/):
 * Contratación absorbe TODO el ciclo contractual — "Nuevo contrato"
 * (/contratacion/contratos/nuevo) y la ficha de cada contrato
 * (/contratacion/contratos/[id], ciclo completo
 * crear→editar→jornada→activar→PIN→finalizar).
 *
 * Filtro por estado en la URL (`?estado=borrador|activo|finalizado`): los
 * KPI del Dashboard de RRHH enlazan a la lista filtrada que cuentan.
 */
export default async function ContratosListPage({ searchParams }: PageProps<"/contratacion/contratos">) {
  const [{ supabase, companyId }, params] = await Promise.all([contextoActual<Database>(), searchParams]);
  const estado = leerEstado(params.estado);

  let consulta = supabase
    .schema("rrhh")
    .from("contratos")
    .select(
      "id, numero_contrato, estado, fecha_inicio, empleado_id, empleados!contratos_empleado_id_fkey(nombre, apellido), puestos!contratos_puesto_id_fkey(nombre), departamentos!contratos_departamento_id_fkey(nombre)"
    )
    .eq("company_id", companyId);
  if (estado) consulta = consulta.eq("estado", estado);

  // Contratos en paralelo con los permisos (la RLS los protege igual); se
  // descartan si no hay permiso de verlos.
  const [permisos, contratosRes] = await Promise.all([
    permisosDe(),
    consulta.order("numero_contrato", { ascending: false }),
  ]);

  if (!permisos.contratosVer) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader title="Contratos" />
        <EmptyState variant="no-access" title="No tienes acceso a los contratos" />
      </div>
    );
  }

  if (contratosRes.error) {
    // El detalle va al log del servidor; error.tsx muestra solo la referencia.
    console.error("contratos: listado", contratosRes.error);
    throw new Error("No se pudo cargar el listado de contratos.");
  }

  const rows = (contratosRes.data ?? []) as unknown as ContratoListRow[];
  const puedeCrear = permisos.contratosCrear;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Contratos"
        description="Todos los contratos registrados, de todos los empleados."
        actions={
          puedeCrear ? (
            <ButtonLink href="/contratacion/contratos/nuevo" icon={<NexoIcon name="file" />}>
              Nuevo contrato
            </ButtonLink>
          ) : null
        }
      />

      <DataTable
        rows={rows}
        rowKey={(c) => c.id}
        rowHref={(c) => `/contratacion/contratos/${c.id}`}
        caption={estado ? `Contratos de la empresa en estado ${ESTADO_CONTRATO[estado].label.toLowerCase()}` : "Contratos de la empresa"}
        toolbar={<FiltroEstadoContratos estado={estado} />}
        empty={
          estado ? (
            <EmptyState
              bare
              variant="no-results"
              title={`No hay contratos en estado ${ESTADO_CONTRATO[estado].label.toLowerCase()}`}
              description="Elige otro estado o quita el filtro para ver todos los contratos."
              action={
                <ButtonLink href="/contratacion/contratos" variant="secondary">
                  Quitar filtro
                </ButtonLink>
              }
            />
          ) : (
            <EmptyState
              bare
              title="Todavía no hay contratos"
              description="Crea el primer contrato a partir de un expediente existente."
              action={
                puedeCrear ? (
                  <ButtonLink href="/contratacion/contratos/nuevo" variant="secondary">
                    Nuevo contrato
                  </ButtonLink>
                ) : null
              }
            />
          )
        }
        columns={[
          {
            key: "numero",
            header: "N.º",
            numeric: true,
            width: "5rem",
            render: (c) => (
              <span className="tabular-nums">
                <span className="sr-only">Contrato </span>
                {c.numero_contrato}
              </span>
            ),
          },
          {
            key: "empleado",
            header: "Empleado",
            render: (c) =>
              c.empleados ? (
                <Link
                  href={`/expedientes/${c.empleado_id}`}
                  className="rounded-sm font-medium text-neutral-900 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                >
                  {c.empleados.nombre} {c.empleados.apellido}
                </Link>
              ) : (
                "—"
              ),
          },
          { key: "puesto", header: "Puesto", render: (c) => c.puestos?.nombre ?? "—" },
          { key: "departamento", header: "Departamento", render: (c) => c.departamentos?.nombre ?? "—" },
          { key: "inicio", header: "Inicio", render: (c) => <span className="tabular-nums">{fechaCorta(c.fecha_inicio)}</span> },
          {
            key: "estado",
            header: "Estado",
            render: (c) => (
              <StatusBadge label={ESTADO_CONTRATO[c.estado].label} tone={ESTADO_CONTRATO[c.estado].tone} />
            ),
          },
        ]}
      />
    </div>
  );
}
