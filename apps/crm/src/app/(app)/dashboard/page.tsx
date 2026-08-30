import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Dashboard · Panel de clientes",
};

// StatCard vive local por ahora — es el primer módulo con dashboard, y la
// norma de anti-fragmentación (docs/planning/NORMA_DISENO_UNIVERSAL.md §4)
// dice que se generaliza a packages/ui recién cuando exista una segunda
// implementación real (ej. RRHH/Flotilla), no antes.
function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-6">
      <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
        {label}
      </p>
      <p className="mt-2 text-3xl font-semibold text-neutral-900">{value}</p>
      {hint && <p className="mt-1 text-xs text-neutral-400">{hint}</p>}
    </div>
  );
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: clientes, error } = await supabase
    .schema("crm")
    .from("clientes")
    .select("id, tipo_cliente, created_at");

  if (error) {
    throw new Error(`No se pudo cargar el dashboard: ${error.message}`);
  }

  const total = clientes?.length ?? 0;

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);
  const nuevosEsteMes = (clientes ?? []).filter(
    (c) => new Date(c.created_at) >= startOfMonth
  ).length;

  const porTipo = { mayorista: 0, detal: 0, sinEspecificar: 0 };
  for (const c of clientes ?? []) {
    if (c.tipo_cliente === "mayorista") porTipo.mayorista++;
    else if (c.tipo_cliente === "detal") porTipo.detal++;
    else porTipo.sinEspecificar++;
  }

  const distribucion = [
    { label: "Mayorista", value: porTipo.mayorista },
    { label: "Detal", value: porTipo.detal },
    { label: "Sin especificar", value: porTipo.sinEspecificar },
  ];
  const maxDistribucion = Math.max(1, ...distribucion.map((d) => d.value));

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-neutral-900">Dashboard</h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Total de clientes" value={total} />
        <StatCard label="Nuevos este mes" value={nuevosEsteMes} />
        <StatCard
          label="Sin tipo especificado"
          value={porTipo.sinEspecificar}
          hint={
            total > 0
              ? `${Math.round((porTipo.sinEspecificar / total) * 100)}% del total`
              : undefined
          }
        />
      </div>

      <div className="rounded-lg border border-neutral-200 bg-white p-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
          Distribución por tipo de cliente
        </p>
        <div className="mt-4 flex flex-col gap-3">
          {distribucion.map((d) => (
            <div key={d.label} className="flex items-center gap-3">
              <span className="w-32 flex-shrink-0 text-sm text-neutral-600">
                {d.label}
              </span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-neutral-100">
                <div
                  className="h-full rounded-full bg-blue-600"
                  style={{ width: `${(d.value / maxDistribucion) * 100}%` }}
                />
              </div>
              <span className="w-8 flex-shrink-0 text-right text-sm text-neutral-500">
                {d.value}
              </span>
            </div>
          ))}
        </div>
      </div>

      {total === 0 && (
        <p className="text-sm text-neutral-400">
          Todavía no hay clientes cargados — estos números se actualizan
          solos apenas se agregue el primero.
        </p>
      )}
    </div>
  );
}
