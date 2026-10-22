import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { contextoActual } from "@nexo/auth";
import { EmptyState, PageHeader, StatusBadge } from "@nexo/ui";
import type { Database } from "@/lib/supabase/database.types";
import { permisosDe } from "@/lib/permisos-rrhh";
import { ESTADO_CONTRATO } from "@/lib/contratos";
import ContratoFicha, {
  type CredencialEstado,
  type JornadaOption,
  type JornadaVigente,
  type PuestoOption,
  type DepartamentoOption,
  type PlantillaOption,
  type PuestoPlantillaOption,
} from "./contrato-ficha";

export const metadata: Metadata = {
  title: "Contrato · RRHH",
};

const ES_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Ficha de UN contrato (Contratación → Contratos → 👁/✎) — dueña del
 * ciclo de vida COMPLETO del contrato (P2/P3, reconciliación de
 * navegación 2026-09-14, ver docs/status-log/): crear (ver
 * contratacion/contratos/nuevo), editar datos base, asignar jornada,
 * activar (genera PIN), regenerar PIN, finalizar. Antes este ciclo vivía
 * repartido entre /expedientes/[id] (activar/finalizar/PIN) y esta
 * página (solo editar/jornada) — ya no: una sola implementación
 * (contratacion/contratos/actions.ts), un solo lugar de gestión. El
 * expediente del empleado (/expedientes/[id]) ya no tiene ninguna
 * acción ni dato contractual.
 */
export default async function ContratoFichaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // Primero lo barato: un id que no es UUID no existe.
  if (!ES_UUID.test(id)) notFound();

  // Kernel (2026-10-20): los 12 hasPermission sueltos pasan a la lista única
  // de permisosDe(); el contrato se pide en paralelo (la RLS lo protege).
  const { supabase, companyId } = await contextoActual<Database>();
  const [permisos, contratoRes] = await Promise.all([
    permisosDe(),
    supabase
      .schema("rrhh")
      .from("contratos")
      .select(
        "id, empleado_id, numero_contrato, estado, puesto_id, departamento_id, plantilla_contrato_id, modalidad_contrato, fecha_inicio, fecha_fin_prevista, fecha_fin_real, empleados!contratos_empleado_id_fkey(nombre, apellido), puestos!contratos_puesto_id_fkey(nombre), departamentos!contratos_departamento_id_fkey(nombre), plantillas_contrato!contratos_plantilla_contrato_id_fkey(nombre)"
      )
      .eq("id", id)
      .eq("company_id", companyId)
      .maybeSingle(),
  ]);

  if (!permisos.contratosVer) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Contrato" back={{ href: "/contratacion/contratos", label: "Contratos" }} />
        <EmptyState variant="no-access" title="No tienes acceso a este contrato" />
      </div>
    );
  }

  const canEditar = permisos.contratosEditar;
  const canActivar = permisos.contratosActivar;
  const canFinalizar = permisos.contratosFinalizar;
  const canVerSalario = permisos.compensacionVer;
  const canEditarSalario = permisos.compensacionEditar;
  const canVerCredenciales = permisos.credencialesVer;
  const canRegenerarPin = permisos.credencialesRegenerar;
  const canVerTurnos = permisos.turnosVer;
  const canVerPuestos = permisos.puestosVer;
  const canVerDepartamentos = permisos.departamentosVer;
  const canVerPlantillas = permisos.plantillasVer;

  const { data: contrato, error: contratoError } = contratoRes;
  if (contratoError) {
    // El detalle va al log del servidor; error.tsx muestra solo la referencia.
    console.error("contrato: ficha", contratoError);
    throw new Error("No se pudo cargar el contrato.");
  }
  if (!contrato) {
    notFound();
  }

  const empleado = contrato.empleados as unknown as { nombre: string; apellido: string } | null;
  const puestoActual = contrato.puestos as unknown as { nombre: string } | null;
  const departamentoActual = contrato.departamentos as unknown as { nombre: string } | null;
  const plantillaActual = contrato.plantillas_contrato as unknown as { nombre: string } | null;

  const [
    compensacionRes,
    jornadasCatalogoRes,
    vigenteRes,
    credencialRes,
    puestosRes,
    departamentosRes,
    plantillasRes,
  ] = await Promise.all([
      canVerSalario
        ? supabase
            .schema("rrhh")
            .from("contrato_compensacion")
            .select("salario_base")
            .eq("contrato_id", id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      canVerTurnos
        ? supabase
            .schema("rrhh")
            .from("jornadas")
            .select("id, nombre")
            .eq("company_id", companyId)
            .eq("activo", true)
            .order("nombre")
        : Promise.resolve({ data: null }),
      canVerTurnos
        ? supabase
            .schema("rrhh")
            .from("contrato_jornadas")
            .select("jornada_id, vigente_desde, jornadas(nombre)")
            .eq("contrato_id", id)
            .is("vigente_hasta", null)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      // F1.3: estado de la credencial, solo tiene sentido para un contrato
      // activo (los demas nunca tuvieron/ya perdieron su PIN).
      canVerCredenciales && contrato.estado === "activo"
        ? supabase.rpc("estado_credencial_contrato", { p_contrato_id: id, p_company_id: companyId })
        : Promise.resolve({ data: null }),
      canVerPuestos
        ? supabase
            .schema("rrhh")
            .from("puestos")
            .select("id, nombre, departamento_id")
            .eq("company_id", companyId)
            .eq("activo", true)
            .order("nombre")
        : Promise.resolve({ data: null }),
      canVerDepartamentos
        ? supabase
            .schema("rrhh")
            .from("departamentos")
            .select("id, nombre")
            .eq("company_id", companyId)
            .eq("activo", true)
            .order("nombre")
        : Promise.resolve({ data: null }),
      canVerPlantillas
        ? supabase
            .schema("rrhh")
            .from("plantillas_contrato")
            .select("id, nombre")
            .eq("company_id", companyId)
            .eq("activo", true)
            .order("nombre")
        : Promise.resolve({ data: null }),
    ]);
  const puestos: PuestoOption[] = (puestosRes.data ?? []).map((p) => ({
    id: p.id,
    nombre: p.nombre,
    departamentoId: p.departamento_id,
  }));
  const departamentos: DepartamentoOption[] = departamentosRes.data ?? [];
  const plantillas: PlantillaOption[] = plantillasRes.data ?? [];

  let puestoPlantillas: PuestoPlantillaOption[] = [];
  if (canVerPlantillas && puestos.length > 0) {
    const { data: relaciones } = await supabase
      .schema("rrhh")
      .from("puesto_plantillas")
      .select("puesto_id, plantilla_id, predeterminada")
      .eq("company_id", companyId)
      .eq("activo", true)
      .in(
        "puesto_id",
        puestos.map((p) => p.id)
      );
    puestoPlantillas = (relaciones ?? []).map((r) => ({
      puestoId: r.puesto_id,
      plantillaId: r.plantilla_id,
      predeterminada: r.predeterminada,
    }));
  }

  const salarioBase =
    (compensacionRes.data as { salario_base: number } | null)?.salario_base ?? null;
  const jornadasDisponibles: JornadaOption[] = jornadasCatalogoRes.data ?? [];
  const vigenteRow = vigenteRes.data as
    | { jornada_id: string; vigente_desde: string; jornadas: { nombre: string } | null }
    | null;
  const jornadaVigente: JornadaVigente | null = vigenteRow
    ? {
        jornadaNombre: vigenteRow.jornadas?.nombre ?? "(jornada eliminada)",
        vigenteDesde: vigenteRow.vigente_desde,
      }
    : null;

  const credencialRow = (credencialRes.data as
    | { tiene_credencial: boolean; activo: boolean; pin_bloqueado: boolean; rotacion_numero: number }[]
    | null)?.[0];
  const credencial: CredencialEstado | null = credencialRow
    ? {
        tieneCredencial: credencialRow.tiene_credencial,
        activo: credencialRow.activo,
        pinBloqueado: credencialRow.pin_bloqueado,
        rotacionNumero: credencialRow.rotacion_numero,
      }
    : null;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`Contrato N.º ${contrato.numero_contrato}`}
        back={{ href: "/contratacion/contratos", label: "Contratos" }}
        meta={
          <StatusBadge
            label={ESTADO_CONTRATO[contrato.estado].label}
            tone={ESTADO_CONTRATO[contrato.estado].tone}
          />
        }
        description={
          empleado ? (
            <>
              Empleado:{" "}
              <Link
                href={`/expedientes/${contrato.empleado_id}`}
                className="rounded-sm text-blue-700 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
              >
                {empleado.nombre} {empleado.apellido}
              </Link>
            </>
          ) : undefined
        }
      />

      <ContratoFicha
        contrato={{
          id: contrato.id,
          numeroContrato: contrato.numero_contrato,
          estado: contrato.estado,
          puestoId: contrato.puesto_id,
          puestoNombre: puestoActual?.nombre ?? null,
          departamentoId: contrato.departamento_id,
          departamentoNombre: departamentoActual?.nombre ?? null,
          plantillaContratoId: contrato.plantilla_contrato_id,
          plantillaNombre: plantillaActual?.nombre ?? null,
          modalidadContrato: contrato.modalidad_contrato,
          fechaInicio: contrato.fecha_inicio,
          fechaFinPrevista: contrato.fecha_fin_prevista,
          fechaFinReal: contrato.fecha_fin_real,
          salarioBase,
        }}
        canEditar={canEditar}
        canActivar={canActivar}
        canFinalizar={canFinalizar}
        canVerSalario={canVerSalario}
        canEditarSalario={canEditarSalario}
        canVerCredenciales={canVerCredenciales}
        canRegenerarPin={canRegenerarPin}
        canVerTurnos={canVerTurnos}
        credencial={credencial}
        jornadasDisponibles={jornadasDisponibles}
        jornadaVigente={jornadaVigente}
        puestos={puestos}
        departamentos={departamentos}
        plantillas={plantillas}
        puestoPlantillas={puestoPlantillas}
      />
    </div>
  );
}
