import type { Metadata } from "next";
import Link from "next/link";
import { hasPermission } from "@nexo/permissions";
import { createClient } from "@/lib/supabase/server";
import { getCompanyId } from "@/lib/company";
import NuevoEmpleadoForm from "./nuevo-empleado-form";

export const metadata: Metadata = {
  title: "Nuevo empleado · RRHH",
};

/**
 * Guard de recurso: rrhh.expedientes.empleados.crear. La capa que de
 * verdad protege es el chequeo DENTRO de rrhh.fn_crear_empleado (ver
 * 20260907152301_f1_1_separar_expediente_general_laboral.sql) — este
 * chequeo aca es UX (norma v3.0): sin el, alguien sin permiso veria el
 * formulario completo y recien se enteraria del rechazo al enviar.
 *
 * F1.1 (2026-09-07): ya no pasa `canEditarCompensacion` al formulario —
 * esta pagina solo crea el Expediente General. Compensacion/modalidad de
 * contrato pasan a formar parte del flujo de Contrato (F1.2).
 */
export default async function NuevoEmpleadoPage() {
  const supabase = await createClient();
  const companyId = getCompanyId();

  const canCrear = await hasPermission(
    { supabase, companyId },
    "rrhh.expedientes.empleados.crear"
  );

  if (!canCrear) {
    return (
      <div className="nexo-glass rounded-2xl px-6 py-10 text-center text-sm text-white/60">
        No tenés el permiso{" "}
        <code className="text-white/80">rrhh.expedientes.empleados.crear</code> para
        dar de alta empleados.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Link href="/expedientes" className="text-sm text-white/50 hover:text-white">
          ← Expedientes
        </Link>
      </div>
      <h1 className="text-2xl font-semibold text-white">Nuevo empleado</h1>
      <NuevoEmpleadoForm />
    </div>
  );
}
