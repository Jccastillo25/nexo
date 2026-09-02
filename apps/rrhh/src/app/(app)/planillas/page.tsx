import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Planillas · RRHH",
};

/**
 * Placeholder de ruta — mismo criterio que expedientes/page.tsx: este
 * turno construyo estructura + Kiosco, el motor de planillas (que lee de
 * rrhh.parametros_ley, ver 20260902000008) queda para un turno aparte.
 */
export default function PlanillasPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold text-white">Planillas</h1>
      <div className="nexo-glass rounded-2xl px-5 py-8 text-center text-sm text-white/50">
        Motor de planillas — pendiente de construir en un turno aparte
        (lee de <code className="text-white/70">rrhh.parametros_ley</code>,
        respeta <code className="text-white/70">modalidad_contrato</code>).
      </div>
    </div>
  );
}
