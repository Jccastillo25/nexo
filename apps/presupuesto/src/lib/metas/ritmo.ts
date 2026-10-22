// Ritmo del mes (pacing) y variaciones: cálculo puro a partir de
// presupuesto_indicadores. Días hábiles = lunes a sábado hasta el corte (la
// última factura importada), sin feriados.

export type EstadoRitmo = "sin_datos" | "en_curso" | "cerrado";

export interface Ritmo {
  estado: EstadoRitmo;
  /** Venta esperada al cierre del mes al ritmo actual; null sin días transcurridos. */
  proyeccion: number | null;
  /** proyeccion / meta; null sin meta o sin proyección. */
  fraccionProyectada: number | null;
  /** Lo que falta vender por día hábil restante para llegar a la meta; 0 si ya se cumplió. */
  requeridoPorDia: number | null;
  /** Venta por día hábil transcurrido. */
  promedioDiario: number | null;
  /** Vendido contra lo que tocaba vender a esta altura del mes (meta × días transcurridos / días del mes). */
  fraccionALaFecha: number | null;
  diasRestantes: number;
}

export function calcularRitmo(
  vendido: number,
  meta: number | null | undefined,
  diasMes: number,
  diasTranscurridos: number,
): Ritmo {
  const total = Math.max(0, Math.floor(diasMes));
  const trans = Math.min(Math.max(0, Math.floor(diasTranscurridos)), total);
  const m = meta === null || meta === undefined || !(Number(meta) > 0) ? null : Number(meta);
  const estado: EstadoRitmo = trans === 0 || total === 0 ? "sin_datos" : trans >= total ? "cerrado" : "en_curso";
  const restantes = total - trans;

  const proyeccion = estado === "sin_datos" ? null : estado === "cerrado" ? vendido : (vendido / trans) * total;
  const requeridoPorDia =
    m === null || estado === "cerrado" || restantes === 0 ? null : Math.max(0, m - vendido) / restantes;

  return {
    estado,
    proyeccion,
    fraccionProyectada: m === null || proyeccion === null ? null : proyeccion / m,
    requeridoPorDia,
    promedioDiario: trans > 0 ? vendido / trans : null,
    fraccionALaFecha: m === null || trans === 0 ? null : vendido / ((m * trans) / total),
    diasRestantes: restantes,
  };
}

/** Proyección al cierre de un monto con los mismos días (para cada vendedor del equipo). */
export function proyectar(vendido: number, diasMes: number, diasTranscurridos: number): number | null {
  return calcularRitmo(vendido, null, diasMes, diasTranscurridos).proyeccion;
}

/** (actual − anterior) / anterior; null si no hay base para comparar. */
export function variacion(actual: number, anterior: number | null | undefined): number | null {
  const b = anterior === null || anterior === undefined ? 0 : Number(anterior);
  return b > 0 ? (Number(actual) - b) / b : null;
}
