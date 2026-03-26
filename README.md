# Gestor360 — Sistema de Control de Asistencia

> Panel de administración web para el control de asistencia, horarios, empleados y organización de Grupo CT.

---

## 📋 Tabla de contenido

1. [Descripción general](#descripción-general)
2. [Stack tecnológico](#stack-tecnológico)
3. [Estructura del proyecto](#estructura-del-proyecto)
4. [Módulos del sistema](#módulos-del-sistema)
5. [Base de datos](#base-de-datos)
6. [Variables de entorno](#variables-de-entorno)
7. [Instalación y desarrollo](#instalación-y-desarrollo)
8. [Arquitectura de datos](#arquitectura-de-datos)
9. [Kiosco de marcación](#kiosco-de-marcación)
10. [Flujo de autenticación](#flujo-de-autenticación)

---

## Descripción general

**Gestor360** es una aplicación web de gestión de recursos humanos y control de asistencia desarrollada para Grupo CT. El sistema permite:

- Registrar y administrar empleados con perfiles completos.
- Controlar marcaciones de entrada/salida a través de un **kiosco físico o web** con PIN de 4 dígitos.
- Gestionar turnos y asignarlos a empleados.
- Aprobar o rechazar permisos y ausencias.
- Generar reportes de asistencia, tardanzas e incidencias.
- Administrar la estructura organizacional: empresas, sucursales y membresías.
- Configurar dispositivos kiosco por sucursal.

---

## Stack tecnológico

| Categoría        | Tecnología                              |
|------------------|-----------------------------------------|
| Framework        | [Next.js 16](https://nextjs.org/) (App Router + Turbopack) |
| UI Library       | [React 19](https://react.dev/)          |
| Lenguaje         | TypeScript 5                            |
| Estilos          | Tailwind CSS v4                         |
| Backend / DB     | [Supabase](https://supabase.com/) (PostgreSQL + Auth + Storage) |
| Iconos           | [Lucide React](https://lucide.dev/), Material Symbols |
| Gráficas         | [Recharts](https://recharts.org/)       |
| Monitoreo        | Vercel Speed Insights                   |
| Linting          | ESLint 9 + eslint-config-next           |

---

## Cambios Recientes

### ⚡ Optimizaciones de Performance (2026-03-26)

**Base de datos — 9 índices nuevos en Supabase:**
- `attendance_logs (employee_id, clock_in DESC)` — lookup de log abierto en clock-out
- `attendance_logs (company_id, clock_in DESC)` — queries del dashboard por empresa y fecha
- `employees (employee_code, branch_id)` — PIN lookup del kiosco
- `employee_status_logs (employee_id)` — tracking de descansos (tabla sin índices secundarios)
- `employee_status_logs (employee_id, end_time_actual) WHERE end_time_actual IS NULL` — búsqueda de breaks abiertos

**Nuevas funciones RPC en PostgreSQL:**
- `get_weekly_attendance_counts(company_ids, since)` — agrega asistencia semanal en el servidor
- `get_monthly_top_delays(company_ids, since, limit)` — top tardanzas agregadas en el servidor

**Código — 5 archivos optimizados:**

| Archivo | Mejora |
|---|---|
| `app/actions/kiosk.ts` | `verifyKioskPin`: de 2 queries a 1 con join. `processKioskEvent`: operaciones independientes en `Promise.all` |
| `src/lib/utils.ts` | `generateUniquePin`: de hasta 100 queries en loop a 1 query + filtrado en memoria |
| `app/(admin)/monitor/monitor-client.tsx` | `createClient()` memoizado. Fix de merge en realtime (preserva campos join). Un solo `setInterval` global reemplaza el timer por tarjeta |
| `src/hooks/useAttendanceRealtime.ts` | `createClient()` memoizado. Fix de pérdida de `job_positions` en UPDATE de realtime. INSERTs traen solo el empleado nuevo en lugar de refetch completo. Cancellation flag anti-memory-leak |
| `app/(admin)/dashboard/page.tsx` | `weeklyRecords` y `monthlyDelaysData` reemplazados por RPCs — elimina fetch de miles de filas para procesar en cliente |

### 🐛 Fix: Auto-generación de `employee_code` (2026-03-24)

- Se agregó auto-generación de código único usando UUID (formato: `EMP-XXXXXXXX`)
- Archivo: `app/actions/employees.ts`

### 🔐 RLS Policies Optimizadas (2026-03-24)

- Consolidadas políticas de Row-Level Security en tabla `employees`
- Eliminada política circular que causaba "infinite recursion"
- Implementado patrón de autorización mediante `company_memberships`

---

## Estructura del proyecto

```
web/
├── app/
│   ├── layout.tsx              # Layout raíz (fuentes, favicon dinámico, SpeedInsights)
│   ├── page.tsx                # Página del kiosco (ruta /)
│   ├── globals.css             # Variables CSS globales y estilos base
│   ├── favicon.ico
│   │
│   ├── (admin)/                # Grupo de rutas protegidas del panel administrativo
│   │   ├── layout.tsx          # Envuelve con <AdminShell>
│   │   ├── _components/        # Componentes del shell de administración
│   │   │   ├── admin-nav.ts         # Definición tipada del menú de navegación
│   │   │   ├── admin-shell.tsx      # Shell del panel (Server Component)
│   │   │   ├── admin-sidebar.tsx    # Barra lateral colapsable
│   │   │   ├── admin-topbar.tsx     # Barra superior con búsqueda y perfil
│   │   │   ├── module-placeholder.tsx  # Placeholder para módulos
│   │   │   └── realtime-listener.tsx   # Escucha cambios en tiempo real (Supabase)
│   │   │
│   │   ├── dashboard/          # Panel principal con métricas y gráficas
│   │   ├── employees/          # Gestión de empleados
│   │   ├── attendance/         # Control de asistencia (records, corrections, incidents)
│   │   ├── schedules/          # Gestión de horarios y turnos
│   │   ├── leave/              # Permisos y ausencias
│   │   ├── reports/            # Módulo de reportes (asistencia, horas, incidencias)
│   │   ├── organization/       # Empresas, sucursales y membresías
│   │   ├── security/           # Seguridad del sistema
│   │   ├── settings/           # Configuración de la aplicación
│   │   └── kiosk/              # Administración de dispositivos kiosco
│   │
│   ├── (auth)/                 # Login y recuperación
│   ├── actions/                # Next.js Server Actions (lógica de negocio)
│   ├── api/                    # API Routes (webhooks, integraciones externas)
│   ├── onboarding/             # Flujo de configuración inicial
│   └── types/                  # Tipos TypeScript específicos de la App
│
├── db/                         # Base de datos
│   └── migrations/             # Historial de cambios SQL (DDL)
│
├── src/
│   ├── components/             # UI Components atómicos y complejos
│   ├── hooks/                  # React Hooks personalizados (useAttendanceRealtime, etc.)
│   └── lib/
│       ├── supabase/           # Clientes Supabase (server, client, admin, middleware)
│       └── utils.ts            # Utilidades generales
```
```

---

## Módulos del sistema

### 🏠 Dashboard
Pantalla principal del panel. Muestra:
- **Métricas en tiempo real**: empleados activos, asistencia del día, correcciones pendientes, permisos por aprobar.
- **Gráfica de asistencia semanal** (Recharts).
- **Top atrasos del mes** (empleados con más tardanzas acumuladas).
- **Donut de asistencia en vivo** (presentes vs. total).
- **Distribución de personal por sucursal**.
- **Solicitudes de permiso pendientes** con botones de aprobación rápida.
- **Actividad reciente** (últimas 4 marcaciones).

### 👥 Empleados
- Listado maestro con código de empleado, nombre, correo, teléfono, sucursal, fecha de ingreso y estado.
- Estadísticas: total, activos, inactivos, sin turno asignado.
- Perfil individual con todos los campos: datos personales, identidad (DUI, INNS, NIT), género, dirección, foto.
- Crear, editar y activar/desactivar empleados.
- Generación automática de **PIN único de 4 dígitos** al crear un empleado.

### ⏱️ Marcaciones
- **Resumen**: marcaciones del día (entradas, salidas, correcciones, incidencias).
- **Registros**: historial filtrable por fecha, empleado y sucursal.
- **Correcciones**: solicitudes enviadas por empleados para ajustar una marcación errónea.
- **Incidencias**: tardanzas, ausencias, horas extra y salidas fuera de turno.

### 📅 Horarios
- **Turnos**: definición de nombre, hora de entrada, hora de salida, minutos de descanso, tolerancia de entrada y salida.
- **Asignaciones**: asignación de un turno a un empleado. La nueva asignación desactiva las anteriores automáticamente.

### ✅ Aprobaciones
- Gestión de **permisos y ausencias** (vacaciones, permiso médico, día administrativo, etc.).
- Estados: `pending` → aprobado / rechazado.

### 📊 Reportes
- Reportes generales, de asistencia, horas trabajadas e incidencias.
- **Correcciones manuales**: Se implementó una lógica de corrección manual para registros de tiempo desfasados (ej. fix de Bryan).
- *(Módulo en expansión activa)*

### 🛠️ Herramientas de Mantenimiento
Se han incluido scripts auxiliares en la carpeta `web/` para tareas administrativas específicas:
- `fix_bryan.js`: Corrige minutos de tardanza para registros específicos mediante la API de Supabase (Service Role).
- `get_rpc_def.mjs`: Utilidad para obtener definiciones de funciones RPC de la base de datos.
- `test_shift.mjs`: Script de prueba para lógica de turnos y tolerancias.

### 🏢 Organización
- **Empresas**: multitenant — cada empresa tiene su slug único, nombre legal, RUC/NIT, dirección, teléfono y logo de reportes. Se usa el RPC `create_company_with_owner`.
- **Sucursales**: cada sucursal pertenece a una empresa y puede tener un código único.
- **Membresías**: control de qué usuarios tienen acceso a qué empresa y con qué rol.

### 🔒 Sistema / Seguridad
- Módulo de gestión de accesos y configuración del sistema.
- Roles disponibles: `owner`, `admin`, `rrhh`, `supervisor`, `viewer`.

### 🖥️ Kiosco
- **Mensaje del kiosco**: texto personalizable que aparece en la pantalla del kiosco.
- **Dispositivos**: registro de dispositivos físicos. El código se genera automáticamente: `{empresa}-{sucursal}-ki-{nn}`.
- **Configuración**: personalización de logo, imagen de fondo y nombre de empresa.
- **Asignación**: vinculación de un kiosco a una sucursal.

---

## Base de datos

Tablas principales en **Supabase (PostgreSQL)**:

| `employees`          | Empleados con todos sus datos y `employee_code` (PIN)    |
| `employee_pins`      | Historial de PINs por empleado                          |
| `employee_shifts`    | Asignaciones de turno (una activa por empleado)          |
| `shifts`             | Definición de turnos (horario, tolerancias)              |
| `branches`           | Sucursales vinculadas a empresas                         |
| `companies`          | Empresas (multitenant)                                   |
| `company_memberships`| Relación usuario-empresa con rol                         |
| `attendance_logs`    | Marcaciones omnicanal (CLOCK_IN, BREAK, CLOCK_OUT)       |
| `audit_logs`         | Auditoría de cambios en la base de datos                 |
| `time_corrections`   | Solicitudes de corrección de marcaciones                 |
| `incidents`          | Incidencias de asistencia (automáticas o manuales)       |
| `absence_logs`       | Registro de faltas y permisos aprobados                 |
| `kiosk_devices`      | Dispositivos kiosco autorizados                          |
| `app_settings`       | Configuración dinámica (mensaje, logo, etc.)             |

### Funciones RPC

| Función                        | Descripción                                             |
|--------------------------------|---------------------------------------------------------|
| `create_company_with_owner`    | Crea una empresa y asigna al usuario actual como `owner`|
| `rpc_mark_attendance_action`   | Firma de marcación oficial con validación de estado     |
| `rpc_monitor_mark_attendance`  | Marcación remota por supervisor desde el Monitor        |
| `get_weekly_attendance_counts` | Agrega asistencia por día (últimos 7 días) en servidor  |
| `get_monthly_top_delays`       | Top N empleados con más tardanzas en el mes             |

### Storage Buckets

| Bucket             | Uso                                         |
|--------------------|---------------------------------------------|
| `employee-photos`  | Fotos de empleados y logos de empresas      |

---

## Variables de entorno

Crea un archivo `.env.local` en la raíz del proyecto `web/`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=tu-anon-key
```

> ⚠️ Nunca incluyas la `service_role` key en el cliente. Usa siempre la `anon`/`publishable` key en el frontend.

---

## Instalación y desarrollo

### Requisitos previos
- Node.js 20+
- npm 10+ (o pnpm/yarn)
- Cuenta en [Supabase](https://supabase.com) con el proyecto configurado

### Pasos

```bash
# 1. Clonar el repositorio
git clone https://github.com/jcaatillo/marcacion-grupo-ct.git
cd marcacion-grupo-ct/web

# 2. Instalar dependencias
npm install

# 3. Configurar variables de entorno
cp .env.example .env.local
# Editar .env.local con tus credenciales de Supabase

# 4. Iniciar servidor de desarrollo
npm run dev
```

La aplicación estará disponible en `http://localhost:3000`.

### Scripts disponibles

| Comando        | Descripción                              |
|----------------|------------------------------------------|
| `npm run dev`  | Servidor de desarrollo (Next.js Turbopack) |
| `npm run build`| Construir para producción                |
| `npm run start`| Iniciar servidor en modo producción      |
| `npm run lint` | Ejecutar ESLint                          |

---

## Arquitectura de datos

```
Usuario autenticado (Supabase Auth)
        │
        ├─ company_memberships ─────► companies
        │        (rol: owner/admin/rrhh/supervisor/viewer)    │
        │                                                      ├─► branches
        │                                                      │       │
        │                                                      │       ├─► employees
        │                                                      │       │       │
        │                                                      │       │       ├─► employee_pins
        │                                                      │       │       ├─► employee_shifts ─► shifts
        │                                                      │       │       ├─► attendance_logs (vía RPC)
        │                                                      │       │       ├─► time_corrections
        │                                                      │       │       ├─► incidents
        │                                                      │       │       └─► absence_logs
        │                                                      │       │
        │                                                      │       └─► kiosk_devices
        │                                                      │
        │                                                      └─► audit_logs (Triggers)
        └─ app_settings (configuración global)
```

### Flujo de marcación (Kiosco)

```
Empleado ingresa PIN en kiosco
        │
        ▼
Server Action: processKioskEvent(branch_id, pin, event_type)
        │
        ▼
RPC: rpc_mark_attendance_action(...)
        │ (Valida estado + calcula retrasos + auditoría)
        ▼
Actualiza employees.current_status
        │ (Broadcast Realtime)
        ▼
Kiosco muestra confirmación + Monitor se actualiza
```

---

## Kiosco de marcación

La ruta raíz `/` sirve el kiosco de marcación. Es una página pública (sin autenticación obligatoria) que:

1. Carga configuración desde `app_settings`: logo, imagen de fondo, mensaje y nombre de empresa.
2. Muestra un teclado numérico para ingresar el PIN de 4 dígitos.
3. Llama al Server Action `processKioskEvent` al confirmar.
4. Los dispositivos físicos se identifican con un `device_code` en formato: `{empresa}-{sucursal}-ki-{nn}`.

---

## Flujo de autenticación

```
/login  ──► signIn (Server Action)
              │
              ├─ Validación de email + contraseña
              ├─ supabase.auth.signInWithPassword()
              └─ redirect('/dashboard') en éxito

Panel Admin ──► Middleware Supabase
              │
              └─ Verifica sesión activa en cada request
                   Si no hay sesión → redirect('/login')

Cerrar sesión ──► signOut (Server Action)
              │
              └─ supabase.auth.signOut() → redirect('/login')
```

---

## Convenciones de código

- **Server Actions** (`'use server'`): manejo de formularios y mutaciones en `app/actions/`.
- **Server Components** por defecto: todas las páginas se renderizan en servidor.
- **Client Components** (`'use client'`): solo donde se requiere interactividad (sidebar, gráficas, kiosco).
- **Rutas de grupo** `(admin)` y `(auth)`: organizan rutas sin afectar la URL.
- **Alias de importación**: `@/` apunta a `src/` (configurado en `tsconfig.json`).
- **CSS Variables**: el tema visual completo se gestiona con variables CSS (`--primary`, `--sidebar-bg`, etc.).

---

## Contribución

1. Crea una rama descriptiva: `feature/nombre-modulo` o `fix/descripcion-bug`.
2. Asegúrate de que `npm run lint` no reporte errores antes de hacer push.
3. Los Server Actions deben retornar `ActionState = { error: string } | null`.
4. Toda operación de base de datos debe usar el cliente de servidor (`@/lib/supabase/server`).

---

*Documentación actualizada el 26 de marzo de 2026 — Gestor360 v0.2.0*
- Última actualización: Performance pass — índices DB, RPCs de agregación, optimizaciones de realtime y timer global del monitor
