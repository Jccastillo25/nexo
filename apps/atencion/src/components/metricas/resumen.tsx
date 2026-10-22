import { MetricCard } from "@nexo/ui";
import { formatoDuracion, type ResumenMetricas } from "@/lib/metricas";

/**
 * KPIs del período. "No se presentó" se cuenta aparte y no entra en los
 * tiempos (decisión del usuario, plan 13 §6.3).
 */
export default function ResumenKpis({ resumen, global }: { resumen: ResumenMetricas; global: boolean }) {
  const r = resumen;
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <MetricCard
        label="Atendidos"
        value={r.atendidos}
        hint={global && r.turnos !== null ? `de ${r.turnos} turnos entregados` : undefined}
      />
      <MetricCard
        label="Espera promedio"
        value={formatoDuracion(r.espera_prom)}
        hint={r.espera_mediana !== null ? `Mediana ${formatoDuracion(r.espera_mediana)} · máx. ${formatoDuracion(r.espera_max)}` : "Sin atendidos"}
      />
      <MetricCard
        label="Atención promedio"
        value={formatoDuracion(r.atencion_prom)}
        hint={r.atencion_mediana !== null ? `Mediana ${formatoDuracion(r.atencion_mediana)} · máx. ${formatoDuracion(r.atencion_max)}` : "Sin atendidos"}
      />
      <MetricCard
        label="No se presentó"
        value={r.no_se_presento}
        tone={r.no_se_presento > 0 ? "negative" : "neutral"}
        hint={r.reactivados > 0 ? `${r.reactivados} reactivados` : "No cuenta en los tiempos"}
      />
      <MetricCard label="Tiempo en puesto" value={formatoDuracion(r.sesion_segundos)} hint="Con atención abierta" />
      <MetricCard label="Llamados fuera de orden" value={r.fuera_de_orden} />
      {global && (
        <>
          <MetricCard label="En curso ahora" value={r.en_curso ?? 0} hint="En espera o en atención" />
          <MetricCard label="Anulados" value={r.anulados ?? 0} hint={r.vencidos ? `${r.vencidos} vencidos al cierre` : undefined} />
        </>
      )}
    </div>
  );
}
