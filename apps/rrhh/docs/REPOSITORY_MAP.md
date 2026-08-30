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

---

## Monitor 360° — Supervisión en Tiempo Real
El monitor centraliza la visibilidad operativa mediante una **Jerarquía Visual Cascada**:

*   **OperationalMonitor (`/components/Monitor360`)**: Vista maestra que orquestra la carga de datos por empresa/sucursal.
*   **TimerDisplay (`/components/Monitor`)**: Componente reactivo que gestiona los tiempos de descanso y alertas visuales.
*   **Tipado (`/types/monitor.ts`)**: Define los estados operativos (`active`, `on_break`, `offline`).

## Módulo de Contratación y Expedientes (`/app/(admin)/contracts`)

El motor de contratación centraliza la legalización de la relación laboral:
*   **Hiring Wizard (`/new/hiring-wizard.tsx`)**: Orquestador de 3 pasos que vincula la estructura organizativa (Sucursal/Puesto) con la legal (Contrato/INSS).
*   **PDF Engine (`/lib/default-contract-template.ts`)**: Parser de plantillas HTML que inyecta datos dinámicos del empleado para previsualización y exportación.
*   **Gestión de Firmas**: Sistema de tracking de documentos subidos (`document_url`) con lógica de invalidación (`isDocumentOutdated`) si cambian los términos del contrato.

---

## Seguridad y Gobernanza (SSOT)

El sistema opera bajo una norma de **"Deny by Default"**:
*   **Manifiesto (`permissions-manifest.json`)**: Diccionario único de recursos y permisos asociados.
*   **AdminShell**: Middleware de nivel de aplicación que intercepta rutas y filtra permisos antes de renderizar la UI.
*   **Protección de Identidad**: Los campos marcados como SSOT en `profiles` se bloquean mediante validación en servidor para garantizar que la "verdad" legal resida en la tabla `employees`.

---

## Auditoría y Refactorizaciones Pendientes
1.  **Tabla `shifts`**: Debe depurarse tras migrar todas las "Asignaciones Fijas" a `shift_templates`.
2.  **Redundancia de Horarios**: Sincronizar las columnas planas de `shift_templates` con el objeto `days_config`.
3.  **RealTime**: Los componentes `Monitor360` ya utilizan canales de Supabase para reflejar cambios instantáneos.
4.  **Integración INSS**: Expandir las alertas de Dashboard para incluir otros trámites legales (p. ej., licencias de conducir vencidas).

---

*Actualizado v1.2 — 17 de abril de 2026*
