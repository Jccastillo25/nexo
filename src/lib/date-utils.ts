export const NICA_TZ = 'America/Managua';

/**
 * Formatea una fecha en el timezone de Nicaragua
 */
export function formatInNica(date: Date | string, options: Intl.DateTimeFormatOptions = {}) {
  return new Intl.DateTimeFormat('es-NI', {
    timeZone: NICA_TZ,
    ...options
  }).format(new Date(date));
}

/**
 * Obtiene la fecha YYYY-MM-DD actual o de una fecha dada en Nicaragua
 */
export function getNicaISODate(date: Date = new Date()) {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: NICA_TZ }).format(date);
}

/**
 * Convierte un string de fecha local (YYYY-MM-DD) a un rango UTC para Supabase
 * Nica es UTC-6, por lo que 00:00 local es 06:00 UTC.
 */
export function getNicaRange(dateStr: string) {
  const start = new Date(`${dateStr}T00:00:00-06:00`).toISOString();
  const end = new Date(`${dateStr}T23:59:59-06:00`).toISOString();
  return { start, end };
}

/**
 * Obtiene las horas y minutos actuales en Nicaragua como números
 */
export function getNicaTimeParts(date: Date = new Date()) {
  const parts = new Intl.DateTimeFormat('es-NI', {
    timeZone: NICA_TZ,
    hour: 'numeric',
    minute: 'numeric',
    hour12: false
  }).formatToParts(date);

  const hour = parseInt(parts.find(p => p.type === 'hour')?.value || '0', 10);
  const minute = parseInt(parts.find(p => p.type === 'minute')?.value || '0', 10);
  
  return { hour, minute };
}
