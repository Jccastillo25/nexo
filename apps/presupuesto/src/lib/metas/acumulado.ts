// Serie de venta acumulada del mes para la gráfica del Dashboard: lo vendido
// hasta el corte, el ritmo necesario para llegar a la meta (repartida por
// días hábiles), el mismo mes del año anterior y la proyección al cierre.

export interface DiaVenta {
  dia: number;
  habil: boolean;
  usd: number;
  usd_anterior: number;
}

export interface PuntoAcumulado {
  dia: number;
  /** Acumulado hasta ese día; null después del corte. */
  real: number | null;
  /** Acumulado que tocaba para llegar a la meta; null sin meta. */
  esperado: number | null;
  anterior: number;
}

/**
 * @param diaCorte último día con datos dentro del mes (0 = ninguno).
 */
export function serieAcumulada(dias: DiaVenta[], meta: number | null, diaCorte: number): PuntoAcumulado[] {
  const habiles = dias.filter((d) => d.habil).length;
  let real = 0;
  let anterior = 0;
  let habilesHasta = 0;
  return dias.map((d) => {
    real += Number(d.usd) || 0;
    anterior += Number(d.usd_anterior) || 0;
    if (d.habil) habilesHasta++;
    return {
      dia: d.dia,
      real: d.dia <= diaCorte ? real : null,
      esperado: meta !== null && meta > 0 && habiles > 0 ? (meta * habilesHasta) / habiles : null,
      anterior,
    };
  });
}

/** Día del mes del corte: 0 si el corte es anterior al mes; el último día si es posterior. */
export function diaDeCorte(corte: string | null, anio: number, mes: number, diasMes: number): number {
  if (!corte) return 0;
  const [a, m, d] = corte.slice(0, 10).split("-").map(Number);
  if (a * 12 + m < anio * 12 + mes) return 0;
  if (a * 12 + m > anio * 12 + mes) return diasMes;
  return Math.min(d, diasMes);
}
