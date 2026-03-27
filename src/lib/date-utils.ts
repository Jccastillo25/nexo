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
 * Convierte strings de fecha local (YYYY-MM-DD) a un rango UTC para Supabase
 * Nica es UTC-6, por lo que 00:00 local es 06:00 UTC.
 */
export function getNicaRange(startStr: string, endStr?: string) {
  const finalEndStr = endStr || startStr;
  const start = new Date(`${startStr}T00:00:00-06:00`).toISOString();
  const end = new Date(`${finalEndStr}T23:59:59-06:00`).toISOString();
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

/**
 * Convierte una hora (HH:mm:ss o HH:mm) a formato 12h (AM/PM)
 */
export function formatTo12h(time: string | null | undefined): string {
  if (!time) return '--:--';
  
  // Manejar formatos HH:mm:ss o HH:mm
  const [hoursStr, minutesStr] = time.split(':');
  let hours = parseInt(hoursStr, 10);
  const minutes = minutesStr || '00';
  
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12; // la hora '0' debe ser '12'
  
  return `${hours}:${minutes.padStart(2, '0')} ${ampm}`;
}
