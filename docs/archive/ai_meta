Aquí tienes la arquitectura técnica detallada y el archivo de instrucciones para la refactorización. Este enfoque permite que Gestor360 pase de una gestión reactiva (empleado por empleado) a una planificación proactiva y escalable.

Estrategia de Refactorización: El Salto a lo Global
La clave de este cambio técnico reside en desacoplar la lógica del tiempo de la identidad del trabajador. Actualmente, el sistema busca empleado -> turno. El nuevo modelo operará bajo la lógica: posición -> plantilla -> calendario.

1. El Cambio en el Modelo de Datos
Para que Claude pueda procesar esto, la base de datos en Supabase debe soportar la herencia de turnos:

Independencia: Las plantillas de turnos (shift_templates) son objetos inmutables que definen "cómo se trabaja".

Asignación por Entidad: El calendario global vincula una plantilla a un position_id o department_id.

Capa de Resolución: El sistema, al cargar el perfil de un empleado, busca primero si tiene un turno manual y, si no, hereda el turno de su puesto asignado en el calendario global.

2. Flujo de Interfaz (UX/UI)
La implementación debe seguir el patrón de "Pintado de Planilla":

Estado "Pincel": El usuario selecciona un turno de la biblioteca lateral (carga el template_id en el estado global de React).

Evento "Drop": Al hacer clic en una celda de la cuadrícula (Día/Puesto), se ejecuta un upsert que registra la regla para esa posición.

Contenido del archivo claude.md
El archivo generado contiene las instrucciones exactas para que cualquier instancia de IA comprenda el contexto de Grupo CTSA y proceda con los cambios.

Secciones principales del documento:
Contexto del Proyecto: Next.js + Tailwind + Supabase.

Objetivo de Refactorización: Implementación de la metodología global de turnos.

Definición de Componentes: Estructura de la ShiftLibrary y la GlobalScheduleGrid.

Lógica de Negocio: Manejo de la persistencia de datos y visualización en formato 12h (AM/PM).

¿Deseas que profundice en algún endpoint específico de la API o en la lógica de validación de traslapes de turnos?

Python
import os

# Define the content for claude.md
claude_md_content = """# Guía de Refactorización: Gestor Global de Planillas (Gestor360)

## 1. Contexto del Proyecto
* **Empresa:** Grupo Castillo Torres S.A (Grupo CTSA)
* **Plataforma:** Gestor360 (SaaS de Recursos Humanos)
* **Stack:** Next.js 16 (App Router), Tailwind CSS, Supabase (PostgreSQL), Stitch (Design System).
* **Estado Actual:** El sistema asigna turnos de forma individual (Empleado -> Turno).
* **Objetivo:** Evolucionar hacia una metodología global donde los turnos se asignen a puestos/roles mediante una cuadrícula de planificación masiva.

---

## 2. Requerimientos Técnicos

### A. Modelo de Datos (Supabase)
Es necesario asegurar la existencia o creación de las siguientes tablas/campos:
1.  **`shift_templates`**: Almacena las definiciones base.
    * `id` (uuid), `name` (text), `start_time` (time), `end_time` (time), `break_minutes` (int), `color_code` (text).
2.  **`global_schedules`**: Tabla de vinculación para la planificación.
    * `id` (uuid), `position_id` (uuid), `day_of_week` (int 0-6), `template_id` (uuid), `branch_id` (uuid).

### B. Visualización de Tiempo
* **Formato:** Todo el output visual debe ser en **12 horas (AM/PM)** (ej: 03:00 PM).
* **Lógica:** Realizar la conversión en la capa de presentación, manteniendo el formato de 24h para cálculos internos en la base de datos.

---

## 3. Arquitectura del Componente `GlobalShiftManager`

### Componente 1: `ShiftLibrary` (Sidebar)
* Debe listar todas las `shift_templates` disponibles.
* Cada elemento debe ser accionable para establecer un `selectedTemplate` en el contexto.
* Diseño basado en tarjetas pequeñas con el color representativo del turno.

### Componente 2: `GlobalGrid` (Main)
* **Eje Y:** Lista de Puestos/Roles (ej: Cajero 1, Supervisor Almacén).
* **Eje X:** Días de la semana.
* **Interacción:** * Si hay un `selectedTemplate`, al hacer clic en una celda se dispara un `upsert` a `global_schedules`.
    * Las celdas deben mostrar el nombre del turno y el rango de horas asignado.

---

## 4. Instrucciones para la Refactorización
Al trabajar en este módulo, Claude debe:
1.  **Priorizar la Reutilización:** Utilizar los hooks existentes para la conexión con Supabase.
2.  **Estética Stitch:** Mantener los bordes redondeados (`rounded-xl`), sombras suaves y la paleta de colores corporativa definida en el Tailwind config.
3.  **Lógica de Herencia:** Asegurar que cuando un empleado sea consultado, el sistema busque: `Turno Manual (Override) > Turno Global por Puesto > Turno General de Sucursal`.
4.  **Optimización de Queries:** Utilizar `select` con joins para traer el nombre del turno y los datos del puesto en una sola petición.

---

## 5. Ejemplo de Estructura de Datos para la Cuadrícula
```json
{
  "position_name": "Encargado de Caja",
  "schedule": [
    { "day": 1, "shift": "Administrativo", "hours": "07:30 AM - 05:00 PM" },
    { "day": 2, "shift": "Administrativo", "hours": "07:30 AM - 05:00 PM" }
  ]
}
Este documento es la fuente de verdad para la adaptación del gestor de turnos en el repositorio marcacion-grupo-ct.