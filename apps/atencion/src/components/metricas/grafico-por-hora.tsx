import { FormSection } from "@nexo/ui";

/**
 * Columnas por hora del día, una sola serie (sin leyenda: el título la
 * nombra). Barras ≤ 24 px con extremo redondeado de 4 px apoyadas en la
 * línea base, valor solo en el máximo, tooltip al pasar el mouse o enfocar,
 * y la misma información como tabla. Color: acento del sistema (blue-600),
 * validado contra la superficie clara.
 */
export default function GraficoPorHora({
  titulo,
  descripcion,
  datos,
  unidad,
}: {
  titulo: string;
  descripcion: string;
  datos: { hora: number; turnos: number }[];
  unidad: string;
}) {
  if (datos.length === 0) {
    return (
      <FormSection title={titulo} description={descripcion}>
        <p className="text-sm text-neutral-500">Sin datos en el período.</p>
      </FormSection>
    );
  }

  const porHora = new Map(datos.map((d) => [d.hora, d.turnos]));
  const desde = Math.min(7, ...datos.map((d) => d.hora));
  const hasta = Math.max(18, ...datos.map((d) => d.hora));
  const horas = Array.from({ length: hasta - desde + 1 }, (_, i) => desde + i);
  const max = Math.max(...datos.map((d) => d.turnos));
  const etiqueta = (h: number) => `${String(h).padStart(2, "0")}:00`;

  return (
    <FormSection title={titulo} description={descripcion}>
      <div className="flex h-48 items-end gap-[2px] border-b border-neutral-200 pt-6" role="img" aria-label={`${titulo}: máximo ${max} ${unidad}`}>
        {horas.map((h, i) => {
          const n = porHora.get(h) ?? 0;
          // El tooltip se ancla hacia adentro del gráfico para no cortarse en los bordes.
          const anclaje =
            i < horas.length / 3 ? "left-0" : i >= (horas.length * 2) / 3 ? "right-0" : "left-1/2 -translate-x-1/2";
          const alto = n === 0 ? 0 : Math.max(4, (n / max) * 100);
          return (
            <div key={h} className="group relative flex h-full flex-1 items-end justify-center" tabIndex={n > 0 ? 0 : -1}>
              {n === max && (
                <span className="absolute text-xs font-semibold tabular-nums text-neutral-700" style={{ bottom: `calc(${alto}% + 4px)` }}>
                  {n}
                </span>
              )}
              <div
                className="w-full max-w-6 rounded-t bg-blue-600 transition-opacity group-hover:opacity-80"
                style={{ height: `${alto}%` }}
              />
              <span className={`pointer-events-none absolute bottom-full z-10 mb-1 hidden whitespace-nowrap ${anclaje} rounded-md bg-neutral-900 px-2 py-1 text-xs text-white shadow group-hover:block group-focus:block`}>
                {etiqueta(h)} – {etiqueta(h + 1 > 23 ? 0 : h + 1)} · {n} {unidad}
              </span>
            </div>
          );
        })}
      </div>
      <div className="flex gap-[2px] text-[10px] tabular-nums text-neutral-400">
        {horas.map((h) => (
          <span key={h} className="flex-1 text-center">
            {h % 2 === 0 ? h : ""}
          </span>
        ))}
      </div>
      <details className="text-sm">
        <summary className="cursor-pointer text-xs font-medium text-neutral-500 hover:text-neutral-800">Ver como tabla</summary>
        <table className="mt-2 w-full max-w-xs text-left text-sm">
          <thead>
            <tr className="text-xs uppercase tracking-wide text-neutral-400">
              <th className="py-1 font-medium">Hora</th>
              <th className="py-1 text-right font-medium">{unidad}</th>
            </tr>
          </thead>
          <tbody>
            {datos.map((d) => (
              <tr key={d.hora} className="border-t border-neutral-100">
                <td className="py-1 tabular-nums">{etiqueta(d.hora)}</td>
                <td className="py-1 text-right tabular-nums">{d.turnos}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </FormSection>
  );
}
