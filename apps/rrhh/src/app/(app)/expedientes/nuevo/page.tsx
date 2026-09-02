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
 * 20260902000008) — este chequeo aca es UX (norma v3.0): sin el, alguien
 * sin permiso veria el formulario completo y recien se enteraria del
 * rechazo al enviar.
 *
 * `canEditarCompensacion` se pasa al formulario para decidir si mostrar
 * los campos de modalidad_contrato/salario_base — sin
 * rrhh.expedientes.compensacion.editar, rrhh.fn_crear_empleado los
 * rechaza igual (separacion de funciones, ver comentario en la
 * migracion), esto es solo ocultar el control que de todas formas no
 * funcionaria (regla obligatoria de permisos, paso 4).
 */
export default async function NuevoEmpleadoPage() {
  const supabase = await createClient();
  const companyId = getCompanyId();

  const [canCrear, canEditarCompensacion] = await Promise.all([
    hasPermission({ supabase, companyId }, "rrhh.expedientes.empleados.crear"),
    hasPermission({ supabase, companyId }, "rrhh.expedientes.compensacion.editar"),
  ]);

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
      <NuevoEmpleadoForm canEditarCompensacion={canEditarCompensacion} />
    </div>
  );
}
