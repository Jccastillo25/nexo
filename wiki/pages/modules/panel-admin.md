---
type: module
updated: 2026-08-22
sources: [[2026-08-22-migraciones-0012-0013-split-admins-drivers]], [[2026-08-22-migraciones-0014-0015-gestion-excepcion]]
---

# Panel Admin (`/admin`)

Panel de administración de una empresa. Requiere fila en [[admins]] (`lib/admin-auth.ts` →
`requireAdmin()`), gate en `proxy.ts`.

## Estructura del sidebar (`components/AdminSidebar.tsx`)

Reorganizado a pedido del usuario en grupos desplegables para reducir botones visibles:

- **Fijos:** Dashboard, Autorizaciones.
- **Flota** (desplegable): Flota y Viajes, Vehículos, Accesorios.
- **Conductores** (desplegable): Conductores, Categorías de Licencia.
- **Configuración** (desplegable): Categorías de Novedad, Administradores, Empresa.

El grupo que contiene la ruta activa se auto-expande al cargar.

## Páginas

- **Dashboard (`/admin`)** — KPIs (vehículos activos, conductores activos, viajes en curso,
  completados 30 días) + gráficas (viajes por día, por estado). Banner de alerta si hay viajes
  en `pending_authorization`, enlaza a [[panel-autorizaciones]].
- **`/admin/fleet-trips`** — tabla de flota + tabla de viajes con tiempos calculados.
- **`/admin/vehicles`**, **`/admin/accessories`** — CRUD de flota, ver [[fleet]].
- **`/admin/drivers`**, **`/admin/license-categories`** — CRUD de conductores (todos los campos
  del perfil ampliado, filtros, panel de PIN) y catálogo de categorías de licencia — ver
  [[drivers]].
- **`/admin/incident-categories`** — CRUD del catálogo `anomaly_categories` (nombre + si
  bloquea el viaje) — ver [[gestion-por-excepcion]].
- **`/admin/admins`** — CRUD de administradores, separado de conductores — ver [[admins]].
- **`/admin/company`** — perfil de empresa (nombre, RUC, dirección, teléfono, correo, logo) —
  ver [[companies]].
- **`/admin/authorizations`** — ver [[panel-autorizaciones]] (página propia por su complejidad).

## Fuentes

- [[2026-08-22-migraciones-0012-0013-split-admins-drivers]]
- [[2026-08-22-migraciones-0014-0015-gestion-excepcion]]
