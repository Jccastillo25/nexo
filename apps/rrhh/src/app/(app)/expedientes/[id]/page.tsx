import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { contextoActual } from "@nexo/auth";
import { ButtonLink, EmptyState, FormTabs, PageHeader } from "@nexo/ui";
import type { Database } from "@/lib/supabase/database.types";
import { permisosDe } from "@/lib/permisos-rrhh";
import DireccionPanel, { type DepartamentoGeoOption, type MunicipioGeoOption } from "./direccion-panel";
import InfoComplementariaPanel from "./info-complementaria-panel";
import CuentasBancariasPanel, { type CuentaBancariaRow } from "./cuentas-bancarias-panel";
import BeneficiariosPanel, { type BeneficiarioRow } from "./beneficiarios-panel";
import DocumentosPanel, { type DocumentoRow } from "./documentos-panel";

export const metadata: Metadata = {
  title: "Expediente · RRHH",
};

const ES_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Ficha del Expediente General de un empleado — SOLO información de
 * persona. Reconciliación de navegación 2026-09-14 (P2, ver
 * docs/status-log/): decisión vigente del usuario, "Expediente =
 * información de la persona" / "Contratación = relación laboral
 * completa" — esta página ya NO contiene contratos, compensación,
 * jornada, estado/gestión de PIN, activar, finalizar, regenerar PIN ni
 * ninguna otra acción contractual. Todo ese ciclo de vida se movió a
 * /contratacion/contratos (listado) y /contratacion/contratos/[id]
 * (ficha de UN contrato, con el flujo completo) — mismas Server
 * Actions/RPC de siempre, reubicadas en contratacion/contratos/actions.ts,
 * no duplicadas.
 *
 * Fase 5 (2026-09-16, bloque pre-F1.5, ver docs/status-log/2026-09-16-
 * rrhh-pre-f1-5.md): las 5 pestañas que hasta ahora eran placeholders
 * (PestanaPendiente) tienen modelo de datos y UI real. "Cuentas
 * bancarias"/"Beneficiario" son datos sensibles -- solo se cargan sus
 * queries cuando el usuario tiene el permiso .ver correspondiente, para no
 * traer filas que la RLS de todas formas bloquearía pero que no hace falta
 * ni intentar pedir.
 *
 * Kernel (2026-10-20): los 14 hasPermission sueltos pasan a la lista única
 * de permisosDe() (una consulta, compartida con el layout).
 */
export default async function ExpedienteDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // Primero lo barato: un id que no es UUID no existe (y PostgREST lo
  // rechazaría con un error técnico).
  if (!ES_UUID.test(id)) notFound();
  // contextoActual no toca la red; el empleado se pide en paralelo con los
  // permisos (la RLS lo protege igual) y se descarta si no hay permiso.
  const { supabase, companyId } = await contextoActual<Database>();
  const [permisos, empleadoRes] = await Promise.all([
    permisosDe(),
    supabase
      .schema("rrhh")
      .from("empleados")
      .select("id, codigo_empleado, nombre, apellido, documento_identidad, email, telefono")
      .eq("id", id)
      .eq("company_id", companyId)
      .maybeSingle(),
  ]);

  if (!permisos.empleadosVer) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Expediente" back={{ href: "/expedientes", label: "Empleados" }} />
        <EmptyState variant="no-access" title="No tienes acceso a este expediente" />
      </div>
    );
  }

  const canEditar = permisos.empleadosEditar;
  const canVerDireccion = permisos.direccionVer;
  const canEditarDireccion = permisos.direccionEditar;
  const canVerInfoComplementaria = permisos.infoComplementariaVer;
  const canEditarInfoComplementaria = permisos.infoComplementariaEditar;
  const canVerCuentasBancarias = permisos.cuentasBancariasVer;
  const canEditarCuentasBancarias = permisos.cuentasBancariasEditar;
  const canVerBeneficiarios = permisos.beneficiariosVer;
  const canEditarBeneficiarios = permisos.beneficiariosEditar;
  const canVerDocumentos = permisos.documentosVer;

  const { data: empleado, error: empleadoError } = empleadoRes;
  if (empleadoError) {
    // El detalle va al log del servidor; error.tsx muestra solo la referencia.
    console.error("expediente: empleado", empleadoError);
    throw new Error("No se pudo cargar el expediente.");
  }
  if (!empleado) {
    notFound();
  }

  const [
    direccionRes,
    departamentosGeoRes,
    municipiosGeoRes,
    infoComplementariaRes,
    cuentasRes,
    beneficiariosRes,
    documentosRes,
  ] = await Promise.all([
    canVerDireccion
      ? supabase
          .schema("rrhh")
          .from("empleado_direccion")
          .select("departamento_geo_id, municipio_geo_id, direccion_detalle")
          .eq("empleado_id", id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    canVerDireccion
      ? supabase.schema("core").from("geografia_ni_departamentos").select("id, nombre").order("nombre")
      : Promise.resolve({ data: null, error: null }),
    canVerDireccion
      ? supabase.schema("core").from("geografia_ni_municipios").select("id, nombre, departamento_id").order("nombre")
      : Promise.resolve({ data: null, error: null }),
    canVerInfoComplementaria
      ? supabase
          .schema("rrhh")
          .from("empleado_info_complementaria")
          .select("estado_civil, contacto_emergencia_nombre, contacto_emergencia_telefono, contacto_emergencia_parentesco")
          .eq("empleado_id", id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    canVerCuentasBancarias
      ? supabase
          .schema("rrhh")
          .from("empleado_cuentas_bancarias")
          .select("id, banco, tipo_cuenta, moneda, numero_cuenta, principal, activo")
          .eq("empleado_id", id)
          .order("created_at")
      : Promise.resolve({ data: null, error: null }),
    canVerBeneficiarios
      ? supabase
          .schema("rrhh")
          .from("empleado_beneficiarios")
          .select("id, nombre_completo, parentesco, porcentaje, documento_identidad, telefono, activo")
          .eq("empleado_id", id)
          .order("created_at")
      : Promise.resolve({ data: null, error: null }),
    canVerDocumentos
      ? supabase
          .schema("rrhh")
          .from("empleado_documentos")
          .select("id, tipo_documento, nombre_original, tamano_bytes, subido_at")
          .eq("empleado_id", id)
          .is("eliminado_at", null)
          .order("subido_at", { ascending: false })
      : Promise.resolve({ data: null, error: null }),
  ]);

  const departamentosGeo: DepartamentoGeoOption[] = departamentosGeoRes.data ?? [];
  const municipiosGeo: MunicipioGeoOption[] = (municipiosGeoRes.data ?? []).map((m) => ({
    id: m.id,
    nombre: m.nombre,
    departamentoId: m.departamento_id,
  }));
  const cuentas: CuentaBancariaRow[] = (cuentasRes.data ?? []).map((c) => ({
    id: c.id,
    banco: c.banco,
    tipoCuenta: c.tipo_cuenta,
    moneda: c.moneda,
    numeroCuenta: c.numero_cuenta,
    principal: c.principal,
    activo: c.activo,
  }));
  const beneficiarios: BeneficiarioRow[] = (beneficiariosRes.data ?? []).map((b) => ({
    id: b.id,
    nombreCompleto: b.nombre_completo,
    parentesco: b.parentesco,
    porcentaje: Number(b.porcentaje),
    documentoIdentidad: b.documento_identidad,
    telefono: b.telefono,
    activo: b.activo,
  }));
  const documentos: DocumentoRow[] = (documentosRes.data ?? []).map((d) => ({
    id: d.id,
    tipoDocumento: d.tipo_documento,
    nombreOriginal: d.nombre_original,
    tamanoBytes: d.tamano_bytes,
    subidoAt: d.subido_at,
  }));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`${empleado.nombre} ${empleado.apellido}`}
        description={`#${empleado.codigo_empleado}${empleado.documento_identidad ? ` · ${empleado.documento_identidad}` : ""}`}
        back={{ href: "/expedientes", label: "Empleados" }}
        actions={
          canEditar ? (
            <ButtonLink href={`/expedientes/${id}/editar`} variant="secondary">
              Editar datos personales
            </ButtonLink>
          ) : null
        }
      />

      <FormTabs
        label="Secciones del expediente"
        tabs={[
          {
            key: "personales",
            label: "Datos personales",
            content: (
              <dl className="grid grid-cols-1 gap-4 rounded-xl border border-neutral-200 bg-white p-5 shadow-xs sm:grid-cols-2">
                <Dato label="Nombres" value={empleado.nombre} />
                <Dato label="Apellidos" value={empleado.apellido} />
                <Dato label="Documento de identidad" value={empleado.documento_identidad ?? "—"} />
                <Dato label="Código de empleado" value={`#${empleado.codigo_empleado}`} />
                <Dato label="Correo" value={empleado.email ?? "—"} />
                <Dato label="Teléfono" value={empleado.telefono ?? "—"} />
              </dl>
            ),
          },
          {
            key: "direccion",
            label: "Dirección",
            content: canVerDireccion ? (
              <DireccionPanel
                empleadoId={id}
                direccion={
                  direccionRes.data
                    ? {
                        departamentoGeoId: direccionRes.data.departamento_geo_id,
                        municipioGeoId: direccionRes.data.municipio_geo_id,
                        direccionDetalle: direccionRes.data.direccion_detalle,
                      }
                    : null
                }
                departamentos={departamentosGeo}
                municipios={municipiosGeo}
                canEditar={canEditarDireccion}
              />
            ) : (
              <SinPermiso seccion="la dirección" />
            ),
          },
          {
            key: "complementaria",
            label: "Información complementaria",
            content: canVerInfoComplementaria ? (
              <InfoComplementariaPanel
                empleadoId={id}
                info={
                  infoComplementariaRes.data
                    ? {
                        estadoCivil: infoComplementariaRes.data.estado_civil,
                        contactoEmergenciaNombre: infoComplementariaRes.data.contacto_emergencia_nombre,
                        contactoEmergenciaTelefono: infoComplementariaRes.data.contacto_emergencia_telefono,
                        contactoEmergenciaParentesco: infoComplementariaRes.data.contacto_emergencia_parentesco,
                      }
                    : null
                }
                canEditar={canEditarInfoComplementaria}
              />
            ) : (
              <SinPermiso seccion="la información complementaria" />
            ),
          },
          {
            key: "bancarias",
            label: "Cuentas bancarias",
            content: canVerCuentasBancarias ? (
              <CuentasBancariasPanel
                empleadoId={id}
                cuentas={cuentas}
                canCrear={canEditarCuentasBancarias}
                canEditar={canEditarCuentasBancarias}
              />
            ) : (
              <SinPermiso seccion="las cuentas bancarias" />
            ),
          },
          {
            key: "beneficiario",
            label: "Beneficiario",
            content: canVerBeneficiarios ? (
              <BeneficiariosPanel
                empleadoId={id}
                beneficiarios={beneficiarios}
                canCrear={canEditarBeneficiarios}
                canEditar={canEditarBeneficiarios}
              />
            ) : (
              <SinPermiso seccion="los beneficiarios" />
            ),
          },
          {
            key: "documentos",
            label: "Documentos",
            content: canVerDocumentos ? (
              <DocumentosPanel
                empleadoId={id}
                documentos={documentos}
                canSubir={permisos.documentosSubir}
                canDescargar={permisos.documentosDescargar}
                canEliminar={permisos.documentosEliminar}
              />
            ) : (
              <SinPermiso seccion="los documentos" />
            ),
          },
        ]}
      />
    </div>
  );
}

/** Pestaña sin permiso: nunca muestra el código del permiso. */
function SinPermiso({ seccion }: { seccion: string }) {
  return <EmptyState variant="no-access" title={`No tienes acceso a ${seccion}`} />;
}

/** Dato de solo lectura (no confundir con el Field de formulario del kit). */
function Dato({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <dt className="text-xs font-medium text-neutral-500">{label}</dt>
      <dd className="break-words text-sm text-neutral-900">{value}</dd>
    </div>
  );
}
