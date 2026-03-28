# Mapa del Repositorio y Arquitectura Logic — Gestor360 (FASE 3)

## Jerarquía de Planificación Global
El sistema implementa una **Planificación por Puestos** que hereda turnos de forma inteligente. Esta lógica reside principalmente en `shift-resolver.ts`.

### Resolución de 4 Niveles (Prioridad Descendente):
1.  **Excepción Individual (`employee_shift_overrides`)**: Máxima prioridad. Permite ajustes puntuales por empleado/fecha.
2.  **Asignación Fija (`employee_shifts`)**: Mecanismo legacy para turnos estáticos asignados directamente.
3.  **Planilla Global (`global_schedules`)**: Turno asignado al **Puesto de Trabajo** del empleado según el día de la semana.
4.  **Default de Sucursal (`branch_default_shifts`)**: Turno base para toda la sucursal si no hay reglas superiores.

---

## Motor de Nómina e Inteligencia de Tiempo (`payroll-engine.ts`)

### Fórmulas de Cálculo:
*   **Atrasos**: `Marcación Real - Inicio Teórico > Tolerancia`.
*   **Séptimo Día**: Si el día en `days_config` es marcado como `isSeventhDay`, el motor calcula automáticamente el 100% de las horas como Tiempo Extra.
*   **Horas Pagables**: `(Salida Real - Entrada Real) - lunch_duration`.

---

## Server Actions (`/actions/schedules.ts`)
Orquestadores backend para la persistencia de planificación:
*   **createShiftTemplate**: Valida legalmente que exista al menos 1 día de descanso por cada 6 laborados.
*   **upsertGlobalSchedule**: Mapeo masivo Puesto <-> Turno con persistencia optimista.
*   **pinShift**: Fijar un turno heredado convirtiéndolo en un override local.

---

## Estándar de Diseño 'Stitch'
Gestor360 utiliza un lenguaje de diseño premium caracterizado por:
*   **Glassmorphism**: Modales con `backdrop-blur` y opacidad controlada.
*   **Radios de 32px**: Tarjetas y componentes principales usan `rounded-3xl`.
*   **Matriz Dinámica**: La UI de "Planilla Maestra" permite Drag & Drop de turnos desde una librería lateral hacia una cuadrícula de puestos.

---

## Auditoría y Refactorizaciones Pendientes
1.  **Tabla `shifts`**: Debe depurarse tras migrar todas las "Asignaciones Fijas" a `shift_templates`.
2.  **Redundancia de Horarios**: Sincronizar las columnas planas de `shift_templates` con el objeto `days_config`.
3.  **RealTime**: Implementar canales de Supabase para que cambios en la Planilla Maestra se reflejen instantáneamente en el Monitor.

---

*Actualizado v1.0 — 28 de marzo de 2026*
