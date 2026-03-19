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
| Framework        | [Next.js 16](https://nextjs.org/) (App Router) |
| UI Library       | [React 19](https://react.dev/)          |
| Lenguaje         | TypeScript 5                            |
| Estilos          | Tailwind CSS v4                         |
| Backend / DB     | [Supabase](https://supabase.com/) (PostgreSQL + Auth + Storage) |
| Iconos           | [Lucide React](https://lucide.dev/), Material Symbols |
| Gráficas         | [Recharts](https://recharts.org/)       |
| Fuentes          | Geist Sans / Geist Mono + Inter         |
| Monitoreo        | Vercel Speed Insights                   |
| Linting          | ESLint 9 + eslint-config-next           |

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
│   │   │   ├── admin-shell-client.tsx  # Gestión de estado de sidebar (Client Component)
│   │   │   ├── admin-sidebar.tsx    # Barra lateral colapsable
│   │   │   ├── admin-topbar.tsx     # Barra superior con búsqueda y perfil
│   │   │   └── module-placeholder.tsx  # Placeholder para módulos en construcción
│   │   │
│   │   ├── dashboard/          # Panel principal con métricas y gráficas
│   │   ├── employees/          # Gestión de empleados
│   │   │   ├── page.tsx        # Listado maestro de empleados
│   │   │   ├── [id]/           # Perfil detallado del empleado
│   │   │   └── new/            # Formulario de nuevo empleado
│   │   ├── attendance/         # Control de asistencia
│   │   │   ├── page.tsx        # Resumen del día
│   │   │   ├── records/        # Historial de registros
│   │   │   ├── corrections/    # Correcciones de marcación
│   │   │   └── incidents/      # Incidencias (tardanzas, ausencias, etc.)
│   │   ├── schedules/          # Gestión de horarios
│   │   │   ├── page.tsx        # Listado de turnos
│   │   │   ├── new/            # Nuevo turno
│   │   │   └── assignments/    # Asignación de turnos a empleados
│   │   ├── leave/              # Permisos y ausencias (aprobaciones)
│   │   ├── reports/            # Módulo de reportes
│   │   ├── organization/       # Estructura organizacional
│   │   │   ├── page.tsx        # Vista general
│   │   │   ├── companies/      # Gestión de empresas
│   │   │   ├── branches/       # Gestión de sucursales
│   │   │   └── memberships/    # Membresías de usuarios
│   │   ├── security/           # Seguridad del sistema
│   │   ├── settings/           # Configuración de la aplicación
│   │   └── kiosk/              # Administración de dispositivos kiosco
│   │       ├── message/        # Mensaje personalizado del kiosco
│   │       ├── devices/        # Listado y gestión de dispositivos
│   │       ├── settings/       # Configuración de kioscos
│   │       └── assign/         # Asignación de kioscos a sucursales
│   │
│   ├── (auth)/
│   │   └── login/              # Página de inicio de sesión
│   │
│   ├── onboarding/             # Flujo de configuración inicial
│   │
│   ├── actions/                # Next.js Server Actions (lógica de negocio)
│   │   ├── auth.ts             # signIn / signOut
│   │   ├── employees.ts        # CRUD de empleados + toggle de estado
│   │   ├── companies.ts        # CRUD de empresas (con upload de logo)
│   │   ├── branches.ts         # CRUD de sucursales
│   │   ├── schedules.ts        # Crear turnos y asignarlos
│   │   ├── kiosk.ts            # CRUD de dispositivos kiosco
│   │   ├── pins.ts             # Gestión de PINs de empleados
│   │   ├── upload-photo.ts     # Subida de fotos de empleados
│   │   └── appearance.ts       # Configuración de apariencia
│   │
│   └── types/
│       └── kiosk.ts            # Tipos TypeScript para entidades del kiosco
│
└── src/
    └── lib/
        ├── supabase/
        │   ├── client.ts       # Cliente Supabase para Client Components
        │   ├── server.ts       # Cliente Supabase para Server Components/Actions
        │   └── middleware.ts   # Middleware para refresco de sesión
        └── utils.ts            # generateUniquePin()
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

| Tabla                | Descripción                                              |
|----------------------|----------------------------------------------------------|
| `employees`          | Empleados con todos sus datos y `employee_code` (PIN)    |
| `employee_pins`      | Historial de PINs por empleado                          |
| `employee_shifts`    | Asignaciones de turno (una activa por empleado)          |
| `shifts`             | Definición de turnos (horario, tolerancias)              |
| `branches`           | Sucursales vinculadas a empresas                         |
| `companies`          | Empresas (multitenant)                                   |
| `company_memberships`| Relación usuario-empresa con rol                         |
| `time_records`       | Registros de entrada/salida con `event_type` y `tardiness_minutes` |
| `time_corrections`   | Solicitudes de corrección de marcaciones                 |
| `incidents`          | Incidencias de asistencia                                |
| `leave_requests`     | Solicitudes de permiso o ausencia                        |
| `kiosk_devices`      | Dispositivos kiosco con `device_code` único              |
| `app_settings`       | Configuración clave-valor (logo, favicon, mensaje, etc.) |

### Funciones RPC

| Función                      | Descripción                                             |
|------------------------------|---------------------------------------------------------|
| `create_company_with_owner`  | Crea una empresa y asigna al usuario actual como `owner`|

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
        │                                                      └─► branches
        │                                                              │
        │                                                              ├─► employees
        │                                                              │       │
        │                                                              │       ├─► employee_pins
        │                                                              │       ├─► employee_shifts ─► shifts
        │                                                              │       ├─► time_records
        │                                                              │       ├─► time_corrections
        │                                                              │       ├─► incidents
        │                                                              │       └─► leave_requests
        │                                                              │
        │                                                              └─► kiosk_devices
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
Next.js valida PIN → busca employee_code en employees usando admin_client
        │
        ▼
Inserta registro en time_records (clock_in / clock_out)
  + calcula tardiness_minutes según shift activo
        │
        ▼
Kiosco muestra confirmación con nombre del empleado
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

*Documentación actualizada el 19 de marzo de 2026 — Gestor360 v0.1.0*
