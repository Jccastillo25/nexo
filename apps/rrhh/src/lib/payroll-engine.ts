/**
 * payroll-engine.ts
 *
 * Motor de Cálculo Salarial.
 * Analiza registros reales de asistencia contra la configuración de la plantilla,
 * generando metadatos de nómina (tolerancias, llegadas tardías, horas extras).
 */

export interface ShiftTemplateConfig {
  lunch_duration: number
  late_entry_tolerance: number
  early_exit_tolerance: number
  days_config?: any[]
}

export interface PayrollFlags {
  is_late: boolean
  minutes_deducted: number
  overtime_minutes: number
  is_seventh_day_overtime: boolean
  payable_hours: number
}

/**
 * Calcula las flags de reporte de nómina para una jornada terminada.
 */
export function calculatePayableHours(
  clockInDate: Date,
  clockOutDate: Date,
  shiftTemplate: ShiftTemplateConfig,
  dayOfWeek: number
): PayrollFlags {
  // Inicializar flags base
  const flags: PayrollFlags = {
    is_late: false,
    minutes_deducted: 0,
    overtime_minutes: 0,
    is_seventh_day_overtime: false,
    payable_hours: 0,
  }

  const totalMinutesWorked = Math.max(0, (clockOutDate.getTime() - clockInDate.getTime()) / 60000)

  // Extraer configuración del día actual
  const dayConfig = (shiftTemplate.days_config || []).find((d: any) => d.dayOfWeek === dayOfWeek)

  // Caso A: Séptimo Día (Descanso) o Día Inactivo
  if (!dayConfig || dayConfig.isSeventhDay || !dayConfig.isActive) {
    flags.is_seventh_day_overtime = true
    flags.overtime_minutes = totalMinutesWorked
    // En día de descanso, todas las horas trabajadas son pagables (generalmente como extra)
    // Se asume que no hay deducciones por "tarde" si era su día libre.
    flags.payable_hours = totalMinutesWorked / 60
    return flags
  }

  // Caso B: Día Laboral Normal
  const [startH, startM] = dayConfig.startTime.split(':').map(Number)
  const [endH, endM] = dayConfig.endTime.split(':').map(Number)

  const theoreticalStart = new Date(clockInDate)
  theoreticalStart.setHours(startH, startM, 0, 0)

  const theoreticalEnd = new Date(clockInDate)
  theoreticalEnd.setHours(endH, endM, 0, 0)
  
  // Si el turno cruza la medianoche (ej. 22:00 a 06:00)
  if (theoreticalEnd.getTime() <= theoreticalStart.getTime()) {
    theoreticalEnd.setDate(theoreticalEnd.getDate() + 1)
  }

  // 1. Cálculo de Llegada Tardía
  const lateDiff = (clockInDate.getTime() - theoreticalStart.getTime()) / 60000
  if (lateDiff > shiftTemplate.late_entry_tolerance) {
    flags.is_late = true
    flags.minutes_deducted += Math.floor(lateDiff)
  }

  // 2. Cálculo de Salida Temprana
  const earlyDiff = (theoreticalEnd.getTime() - clockOutDate.getTime()) / 60000
  if (earlyDiff > shiftTemplate.early_exit_tolerance) {
    flags.minutes_deducted += Math.floor(earlyDiff)
  }

  // 3. Cálculo de Horas Extra (Normal)
  const overtimeDiff = (clockOutDate.getTime() - theoreticalEnd.getTime()) / 60000
  // Solo consideramos overtime si se quedó más del límite tolerado (opcional, aplicaremos overtime estricto si > 0)
  if (overtimeDiff > 0) {
    flags.overtime_minutes = Math.floor(overtimeDiff)
  }

  // 4. Fórmula: (Salida - Entrada) - Almuerzo - Deducciones
  // Para evitar que deducts doble si ya el totalMinutesWorked es menor, 
  // la fórmula real de horas pagables en base a la jornada programada es:
  // Horas Pagables = (Diferencia Real) - (Tiempo de Almuerzo)
  // Nota: Las "Deducciones" numéricas ya se restan indirectamente al tomar los registros reales.
  // Sin embargo, si la ley exige "Descontar los minutos sumados", el valor de "minutes_deducted" se exporta para el HRIS.
  let effectiveWorked = totalMinutesWorked - shiftTemplate.lunch_duration
  if (effectiveWorked < 0) effectiveWorked = 0

  flags.payable_hours = Number((effectiveWorked / 60).toFixed(2))

  return flags
}
