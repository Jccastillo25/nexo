import type { Metadata } from "next";
import Link from "next/link";
import { hasPermission } from "@nexo/permissions";
import { createClient } from "@/lib/supabase/server";
import { getCompanyId } from "@/lib/company";

export const metadata: Metadata = {
  title: "Expedientes · RRHH",
};

/**
 * Listado denso de empleados activos. Guard de recurso (norma v3.0,
 * checklist paso 3-4): rrhh.expedientes.empleados.ver — distinto del
 * guard de MODULO (rrhh.ver_modulo) que ya paso (app)/layout.tsx. Un
 * usuario sin este permiso especifico ve un panel "sin permiso" ACA
 * mismo (no redirect a /sin-acceso: esa pantalla es para "no tenés el
 * modulo", no para "no tenés este recurso dentro del modulo que si
 * tenés" — el mensaje seria enganoso).
 *
 * Requiere "rrhh" expuesto en Data API (ver .env.local.example) para el
 * `.schema("rrhh")` de abajo.
 */
export default async function ExpedientesPage() {
  const supabase = await createClient();
  const companyId = getCompanyId();

  const [canVer, canCrear] = await Promise.all([
    hasPermission({ supabase, companyId }, "rrhh.expedientes.empleados.ver"),
    hasPermission({ supabase, companyId }, "rrhh.expedientes.empleados.crear"),
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
    .select(
      "id, codigo_empleado, nombre, apellido, puesto, departamento, nombre_usuario, pin_bloqueado, fecha_ingreso"
    )
    .eq("company_id", companyId)
    .eq("estado", "activo")
    .order("nombre", { ascending: true });

  if (error) {
    throw new Error(`No se pudo cargar el listado de empleados: ${error.message}`);
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
                <th className="px-4 py-2 font-medium">Puesto</th>
                <th className="px-4 py-2 font-medium">Departamento</th>
                <th className="px-4 py-2 font-medium">Usuario</th>
                <th className="px-4 py-2 font-medium">Ingreso</th>
                <th className="px-4 py-2 font-medium">Acceso</th>
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
                    {e.nombre} {e.apellido}
                  </td>
                  <td className="px-4 py-2 text-white/70">{e.puesto ?? "—"}</td>
                  <td className="px-4 py-2 text-white/70">{e.departamento ?? "—"}</td>
                  <td className="px-4 py-2 font-mono text-white/70">
                    {e.nombre_usuario}
                  </td>
                  <td className="px-4 py-2 tabular-nums text-white/50">
                    {new Date(e.fecha_ingreso).toLocaleDateString("es-NI")}
                  </td>
                  <td className="px-4 py-2">
                    {e.pin_bloqueado ? (
                      <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-xs font-medium text-red-400">
                        Bloqueado
                      </span>
                    ) : (
                      <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-400">
                        Activo
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {(empleados ?? []).length === 0 && (
          <p className="px-4 py-8 text-center text-sm text-white/40">
            Todavía no hay empleados activos.
          </p>
        )}
      </div>
    </div>
  );
}
