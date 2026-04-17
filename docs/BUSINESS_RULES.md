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

### 3. Regla de Gracia INSS (5 Días)
Para garantizar la agilidad en la contratación sin comprometer el cumplimiento legal:
*   **Periodo de Gracia**: Los empleados nuevos sin número de INSS entran en estado `PENDING_GRACE`.
*   **Vencimiento**: El sistema otorga exactamente 5 días calendario desde la `hire_date` para regularizar el número.
*   **Alertas Administrativas**: El dashboard resalta en ROJO los trámites vencidos y en NARANJA los que vencen en <48h.

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

## Reglas de Contratación y Legalidad

### 1. Unicidad de Contrato
*   Un empleado solo puede tener **un (1) contrato en estado `active`** simultáneamente. 
*   Al activar un nuevo contrato, el anterior se marca automáticamente como `expired` o `terminated`.

### 2. Inmutabilidad de Documentos Impresos
*   Si un contrato tiene el flag `is_printed: true` (indicando que ya fue generado para firma física), **no se permite su eliminación**.
*   Para corregir errores en contratos impresos, se debe proceder a la **Anulación (`annulled`)**, lo cual preserva la correlación de auditoría.

### 3. Vigencia de Documentos PDF
*   El sistema detecta discrepancias entre los datos del contrato en DB y el archivo subido en Storage.
*   Cualquier cambio en Salario, Turno o Puesto marca el documento actual como **"Desactualizado"**, exigiendo una nueva impresión y firma.

---

## Jerarquía de Prioridades (Resumen)
Para cualquier duda sobre qué turno aplica a un empleado, el sistema sigue este orden:
1. **Excepción de Día** (Manual Admin)
2. **Turno Fijo** (Legacy)
3. **Planilla del Puesto** (Global)
4. **Default de Sucursal** (Mínimo)

---

*Actualizado v1.1 — 17 de abril de 2026*
