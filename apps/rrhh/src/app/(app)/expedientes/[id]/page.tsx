import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { hasPermission } from "@nexo/permissions";
import { EmptyState, FormTabs, PageHeader } from "@nexo/ui";
import { createClient } from "@/lib/supabase/server";
import { getCompanyId } from "@/lib/company";
import DireccionPanel, { type DepartamentoGeoOption, type MunicipioGeoOption } from "./direccion-panel";
import InfoComplementariaPanel from "./info-complementaria-panel";
import CuentasBancariasPanel, { type CuentaBancariaRow } from "./cuentas-bancarias-panel";
import BeneficiariosPanel, { type BeneficiarioRow } from "./beneficiarios-panel";
import DocumentosPanel, { type DocumentoRow } from "./documentos-panel";

export const metadata: Metadata = {
  title: "Expediente · RRHH",
};

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
 */
export default async function ExpedienteDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const companyId = getCompanyId();

  const [
    canVer,
    canEditar,
    canVerDireccion,
    canEditarDireccion,
    canVerInfoComplementaria,
    canEditarInfoComplementaria,
    canVerCuentasBancarias,
    canEditarCuentasBancarias,
    canVerBeneficiarios,
    canEditarBeneficiarios,
    canVerDocumentos,
    canSubirDocumentos,
    canDescargarDocumentos,
    canEliminarDocumentos,
    empleadoResult,
  ] = await Promise.all([
    hasPermission({ supabase, companyId }, "rrhh.expedientes.empleados.ver"),
    hasPermission({ supabase, companyId }, "rrhh.expedientes.empleados.editar"),
    hasPermission({ supabase, companyId }, "rrhh.expedientes.direccion.ver"),
    hasPermission({ supabase, companyId }, "rrhh.expedientes.direccion.editar"),
    hasPermission({ supabase, companyId }, "rrhh.expedientes.info_complementaria.ver"),
    hasPermission({ supabase, companyId }, "rrhh.expedientes.info_complementaria.editar"),
    hasPermission({ supabase, companyId }, "rrhh.expedientes.cuentas_bancarias.ver"),
    hasPermission({ supabase, companyId }, "rrhh.expedientes.cuentas_bancarias.editar"),
    hasPermission({ supabase, companyId }, "rrhh.expedientes.beneficiarios.ver"),
    hasPermission({ supabase, companyId }, "rrhh.expedientes.beneficiarios.editar"),
    hasPermission({ supabase, companyId }, "rrhh.expedientes.documentos.ver"),
    hasPermission({ supabase, companyId }, "rrhh.expedientes.documentos.subir"),
    hasPermission({ supabase, companyId }, "rrhh.expedientes.documentos.descargar"),
    hasPermission({ supabase, companyId }, "rrhh.expedientes.documentos.eliminar"),
    supabase
      .schema("rrhh")
      .from("empleados")
      .select("id, codigo_empleado, nombre, apellido, documento_identidad, email, telefono")
      .eq("id", id)
      .eq("company_id", companyId)
      .maybeSingle(),
  ]);

  if (!canVer) {
    return (
      <EmptyState
        title="Sin permiso para ver este expediente"
        description="No tenés el permiso rrhh.expedientes.empleados.ver para esta empresa."
      />
    );
  }

  const { data: empleado, error: empleadoError } = empleadoResult;
  if (empleadoError) {
    throw new Error(`No se pudo cargar el expediente: ${empleadoError.message}`);
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
        description={`#${empleado.codigo_empleado} · ${empleado.documento_identidad}`}
        actions={
          canEditar && (
            <Link
              href={`/expedientes/${id}/editar`}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
            >
              Editar
            </Link>
          )
        }
      />

      <FormTabs
        tabs={[
          {
            key: "personales",
            label: "Datos personales",
            content: (
              <div className="grid grid-cols-1 gap-4 rounded-xl border border-neutral-200 bg-white p-5 sm:grid-cols-2">
                <Field label="Nombres" value={empleado.nombre} />
                <Field label="Apellidos" value={empleado.apellido} />
                <Field label="Documento de identidad" value={empleado.documento_identidad} />
                <Field label="Código de empleado" value={`#${empleado.codigo_empleado}`} />
                <Field label="Correo" value={empleado.email ?? "—"} />
                <Field label="Teléfono" value={empleado.telefono ?? "—"} />
              </div>
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
              <SinPermiso codigo="rrhh.expedientes.direccion.ver" />
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
              <SinPermiso codigo="rrhh.expedientes.info_complementaria.ver" />
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
              <SinPermiso codigo="rrhh.expedientes.cuentas_bancarias.ver" />
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
              <SinPermiso codigo="rrhh.expedientes.beneficiarios.ver" />
            ),
          },
          {
            key: "documentos",
            label: "Documentos",
            content: canVerDocumentos ? (
              <DocumentosPanel
                empleadoId={id}
                documentos={documentos}
                canSubir={canSubirDocumentos}
                canDescargar={canDescargarDocumentos}
                canEliminar={canEliminarDocumentos}
              />
            ) : (
              <SinPermiso codigo="rrhh.expedientes.documentos.ver" />
            ),
          },
        ]}
      />
    </div>
  );
}

function SinPermiso({ codigo }: { codigo: string }) {
  return (
    <EmptyState
      title="Sin permiso para ver esta sección"
      description={`No tenés el permiso ${codigo} para esta empresa.`}
    />
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium uppercase tracking-wide text-neutral-400">{label}</span>
      <span className="text-sm text-neutral-900">{value}</span>
    </div>
  );
}
