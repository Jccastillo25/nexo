# Roadmap — avance por fases

Plan original: 4 fases (documento `MVP_SaaS_Control_Transporte_Especificacion_Tecnica.pdf`). El orden real de construcción se adelantó (Fase 4 antes que Fase 3, a pedido explícito), y se agregó una capa completa no contemplada en el documento original: el panel Super Admin.

## ✅ Fase 1 — Base de Datos y Autenticación

**Entregado:** DDL completo (Sección 4 del documento), roles `admin`/`driver` conectados a Supabase Auth nativo, políticas RLS de aislamiento por `company_id`.

- Migración [`0001_init_schema_auth_rls.sql`](../supabase/migrations/0001_init_schema_auth_rls.sql)
- Desviación deliberada del documento: `users.id` referencia `auth.users.id` (sin `password_hash` propio) para conectar con Auth nativo, tal como pedía la instrucción de esta fase.

## ✅ Fase 2 — Web App Móvil Conductor

**Entregado:** flujo completo del conductor en `/driver`.

- Login por usuario/contraseña **o** PIN de 4 dígitos (magic link server-side).
- Selección de vehículo → inspección previa (odómetro + foto obligatoria + checklist de accesorios con evidencia de daños) → ciclo de viaje (5 botones de estado, cada uno con GPS + hora real vía `navigator.geolocation`) → checkout (odómetro final + foto).
- Offline-first: cola de eventos en IndexedDB, sync automático sin depender de Background Sync API.
- PWA instalable (manifest, Service Worker de app-shell).
- UI mobile-first (390px), alto contraste.

Archivos clave: `app/driver/**`, `lib/trip-events.ts`, `lib/offline/**`, `lib/geolocation.ts`.

## ✅ Fase 4 — Panel Admin *(construida antes que la Fase 3, a pedido del usuario)*

Evolucionó en varias iteraciones dentro de la misma fase:

1. **Versión inicial:** nav superior, dashboard con tabla de flota + tabla de viajes con tiempos calculados (`arrival - start`, `end_unloading - start_unloading`).
2. **CRUD completo:** vehículos (alta + checklist de accesorios por unidad), catálogo de accesorios, gestión de conductores/admins (alta vía `service_role`, activar/desactivar).
3. **Rediseño a pedido del usuario:** sidebar izquierdo fijo (colapsable en mobile) reemplazando el nav superior; `/admin` pasó a ser un dashboard de KPIs (vehículos activos, conductores activos, viajes en curso, completados 30 días) + gráficas (viajes por día, viajes por estado); las tablas originales se movieron a `/admin/fleet-trips`.
4. **Perfil de empresa** (`/admin/company`): nombre, RUC, dirección fiscal, teléfono, correo, logo — editable por el admin de esa empresa.

Archivos clave: `app/admin/**`, `components/AdminSidebar.tsx`, `components/StatCard.tsx`.

## ✅ Fase 3 — Lógica de Negocio

**Entregado:** trigger de base de datos (no lógica de aplicación) que, al completar un viaje, actualiza `vehicles.current_odometer` — garantizado sin importar desde qué pantalla o cliente se complete el viaje.

- Migración [`0004_sync_vehicle_odometer_on_trip_completion.sql`](../supabase/migrations/0004_sync_vehicle_odometer_on_trip_completion.sql)

## ✅ Extensión post-plan — Panel Super Admin (`/supadmin`)

No estaba en el documento original; se agregó a pedido del usuario como un nivel por encima de las empresas.

- Tabla `platform_admins`, **separada** de `public.users` por diseño explícito (nunca se mezclan usuarios de plataforma con usuarios de empresa).
- Login propio (`/supadmin/login`), completamente aislado del `/login` de empresas — su propia rama en `proxy.ts`.
- Listado de empresas con conteo de usuarios (`/supadmin/companies`), alta de empresa + su primer admin (`/supadmin/companies/new`), edición de perfil (idéntica a la de empresa, más cupo de usuarios y activar/desactivar).
- Enforcement real del cupo de usuarios en `POST /api/admin/create-user` (no solo cosmético en la UI).
- Desactivar una empresa corta el acceso de **todos** sus usuarios de inmediato (verificado a nivel de RLS, no solo de UI).
- Sidebar propio (Dashboard / Empresas / Configuración) y dashboard de KPIs de toda la plataforma (empresas, usuarios totales/activos, gráfica de usuarios por empresa).
- **Configuración de plataforma** (`/supadmin/settings`): nombre del producto, logo y copyright de Ruta360 — dinámico en toda la app (título de pestaña, manifest PWA, pantallas de login), no hardcodeado.

Archivos clave: `app/supadmin/**`, `app/api/supadmin/**`, `lib/supadmin.ts`, `lib/platform-settings.ts`.

## Pendiente / fuera de alcance actual

- **Leaked Password Protection** de Supabase Auth (HaveIBeenPwned) — requiere plan **Pro** de Supabase (de pago). Evaluado y pausado a pedido explícito del usuario; no bloqueante para el MVP.
- No hay vista de "impersonar" o entrar como una empresa desde el Super Admin — deliberadamente fuera de alcance (no se pidió).
- No hay exportes (CSV/PDF) de reportes — no forma parte del documento original ni se ha pedido.
