# Manual de Reglas de Negocio — Gestor360

## Gestión de Jornadas y Ley Laboral

### 1. Regla del Séptimo Día
Validación mandatoria en el sistema según legislación:
*   **Control Backend**: No se permite crear plantillas de turno que excedan los 6 días laborales consecutivos sin un día de descanso (`isSeventhDay: true`).
*   **Bonificación**: El trabajo en día de descanso se procesa como 100% extraordinario.

### 2. Estructura de "Turno Único"
Se ha corregido la fragmentación de turnos. En lugar de tener "Turno Administrativo" y "Turno Sabatino", se utiliza un **solo turno** con configuración diferenciada en la matriz `days_config`.
*   **Lunes a Viernes**: 07:30 - 17:00
*   **Sábado**: 08:00 - 15:00

---

## Tolerancias y Deducciones

### 1. Tolerancia de Entrada (`late_entry_tolerance`)
*   Se otorga un periodo de gracia (típicamente 15 min).
*   Si se excede, el descuento se calcula desde el minuto 0 de la hora de entrada teórica.

### 2. Tolerancia de Salida (`early_exit_tolerance`)
*   Protege la integridad de la jornada completa.
*   Salidas anticipadas fuera del rango generan alertas en el Monitor.

### 3. Gestión de Pausas (`lunch_duration`)
*   El tiempo de almuerzo es configurable por plantilla.
*   Se deduce automáticamente del tiempo total trabajado para obtener las `payable_hours`.

---

## Jerarquía de Prioridades (Resumen)
Para cualquier duda sobre qué turno aplica a un empleado, el sistema sigue este orden:
1. **Excepción de Día** (Manual Admin)
2. **Turno Fijo** (Legacy)
3. **Planilla del Puesto** (Global)
4. **Default de Sucursal** (Mínimo)

---

*Actualizado v1.0 — 28 de marzo de 2026*
