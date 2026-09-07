import type { Metadata } from "next";
import Link from "next/link";
import { hasPermission } from "@nexo/permissions";
import { createClient } from "@/lib/supabase/server";
import { getCompanyId } from "@/lib/company";

export const metadata: Metadata = {
  title: "Expedientes · RRHH",
};

/**
 * Listado del Expediente General de todos los empleados. Guard de
 * recurso (norma v3.0, checklist paso 3-4): rrhh.expedientes.empleados.ver
 * — distinto del guard de MODULO (rrhh.ver_modulo) que ya paso
 * (app)/layout.tsx. Un usuario sin este permiso especifico ve un panel
 * "sin permiso" ACA mismo (no redirect a /sin-acceso: esa pantalla es
 * para "no tenés el modulo", no para "no tenés este recurso dentro del
 * modulo que si tenés" — el mensaje seria enganoso).
 *
 * F1.1 (2026-09-07): este listado ya no filtra por `estado = 'activo'`
 * ni muestra puesto/departamento/usuario — esos son datos
 * laborales/contractuales. F1.2 (2026-09-07): la columna "Contrato"
 * ahora refleja si el empleado tiene un contrato activo de verdad
 * (rrhh.contratos), no la columna deprecada rrhh.empleados.estado. Cada
 * fila enlaza a /expedientes/[id] (F1.2), donde vive el Expediente
 * Laboral completo.
 *
 * Requiere "rrhh" expuesto en Data API (ver .env.local.example) para el
 * `.schema("rrhh")` de abajo.
 */
export default async function ExpedientesPage() {
  const supabase = await createClient();
  const companyId = getCompanyId();

  const [canVer, canCrear, canVerContratos] = await Promise.all([
    hasPermission({ supabase, companyId }, "rrhh.expedientes.empleados.ver"),
    hasPermission({ supabase, companyId }, "rrhh.expedientes.empleados.crear"),
    hasPermission({ supabase, companyId }, "rrhh.expedientes.contratos.ver"),
  ]);

  if (!canVer) {
    return (
      <div className="nexo-glass rounded-2xl px-6 py-10 text-center text-sm text-white/60">
        No tenés el permiso <code className="text-white/80">rrhh.expedientes.empleados.ver</code>{" "}
        para ver esta sección.
      </div>
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

  let empleadosConContratoActivo = new Set<string>();
  if (canVerContratos && empleados && empleados.length > 0) {
    const { data: activos } = await supabase
      .schema("rrhh")
      .from("contratos")
      .select("empleado_id")
      .eq("company_id", companyId)
      .eq("estado", "activo");
    empleadosConContratoActivo = new Set((activos ?? []).map((c) => c.empleado_id));
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-white">Expedientes</h1>
        {canCrear && (
          <Link
            href="/expedientes/nuevo"
            className="rounded-lg bg-[var(--nexo-accent)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--nexo-accent-hover)]"
          >
            + Nuevo empleado
          </Link>
        )}
      </div>

      <div className="nexo-glass overflow-hidden rounded-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--nexo-border)] text-xs uppercase tracking-wide text-white/40">
                <th className="px-4 py-2 font-medium">#</th>
                <th className="px-4 py-2 font-medium">Nombre</th>
                <th className="px-4 py-2 font-medium">Documento</th>
                <th className="px-4 py-2 font-medium">Contacto</th>
                <th className="px-4 py-2 font-medium">Contrato</th>
              </tr>
            </thead>
            <tbody>
              {(empleados ?? []).map((e) => (
                <tr
                  key={e.id}
                  className="border-b border-[var(--nexo-border)] last:border-0 hover:bg-white/[0.03]"
                >
                  <td className="px-4 py-2 tabular-nums text-white/50">
                    {e.codigo_empleado}
                  </td>
                  <td className="px-4 py-2 font-medium text-white">
                    <Link href={`/expedientes/${e.id}`} className="hover:underline">
                      {e.nombre} {e.apellido}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-white/70">{e.documento_identidad ?? "—"}</td>
                  <td className="px-4 py-2 text-white/70">
                    {e.email ?? e.telefono ?? "—"}
                  </td>
                  <td className="px-4 py-2">
                    <EstadoContratoBadge
                      activo={empleadosConContratoActivo.has(e.id)}
                      visible={canVerContratos}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {(empleados ?? []).length === 0 && (
          <p className="px-4 py-8 text-center text-sm text-white/40">
            Todavía no hay expedientes creados.
          </p>
        )}
      </div>
    </div>
  );
}

function EstadoContratoBadge({ activo, visible }: { activo: boolean; visible: boolean }) {
  if (!visible) {
    return <span className="text-white/30">—</span>;
  }
  if (activo) {
    return (
      <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-400">
        Contrato activo
      </span>
    );
  }
  return (
    <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs font-medium text-white/50">
      Sin contrato activo
    </span>
  );
}
