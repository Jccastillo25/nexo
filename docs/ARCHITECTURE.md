# Arquitectura

## Stack técnico

| Capa | Tecnología |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack) |
| UI | React 19 + Tailwind CSS 4 |
| Gráficas | Recharts |
| Base de datos | PostgreSQL (Supabase) |
| Auth | Supabase Auth (email/password + magic link para PIN) |
| Storage | Supabase Storage (3 buckets: `evidence`, `company-logos`, `platform-assets`) |
| Hosting | Vercel |
| Gateway de rutas | `proxy.ts` (reemplaza `middleware.ts` desde Next.js 16) |

Next.js 16 introduce cambios respecto a versiones anteriores (`middleware.ts` → `proxy.ts`, tipos `PageProps`/`RouteContext` generados, Proxy corre en runtime Node por defecto). Antes de modificar convenciones de archivo, revisar `node_modules/next/dist/docs/`.

## Modelo de roles

El sistema tiene **tres niveles de acceso, cada uno en su propia tabla de identidad, que nunca se mezclan entre sí**:

| Nivel | Tabla de identidad | Ruta | Alcance |
|---|---|---|---|
| **Super Admin** | `platform_admins` (independiente) | `/supadmin` | Toda la plataforma: crea empresas, define cupos de usuarios, activa/desactiva empresas, configura branding de Ruta360 |
| **Admin de empresa** | `admins` (independiente) | `/admin` | Su propia empresa: flota, accesorios, conductores, otros administradores, perfil de empresa |
| **Conductor** | `drivers` (independiente) | `/driver` | Su propio ciclo de viaje |

**Por qué son tres tablas separadas y no un enum `role` en una sola tabla `users`:** cada nivel tiene datos y necesidades de acceso genuinamente distintos (un Super Admin no pertenece a ninguna empresa; un conductor necesita usuario/PIN/licencia, un admin no; un admin puede auto-gestionar su fila, un conductor no debería poder auto-editarse el rol). Guardarlos en una tabla compartida con una columna discriminadora habría exigido replicar esa separación a mano en cada policy RLS, con el riesgo de que un bug la rompiera silenciosamente. Con tablas separadas, un usuario de una tabla **no puede existir físicamente** como fila de otra — el aislamiento es estructural, no solo una condición de RLS. Este es el mismo principio con el que se diseñó originalmente `platform_admins`, extendido en la migración `0012` a admins/conductores.

Cada nivel tiene su **propio login**:
- `/login` — con dos modos: **Usuario/Contraseña** resuelve contra `admins` (por correo); **PIN** resuelve contra `drivers` (por `username`, no por correo — ver Autenticación abajo).
- `/supadmin/login` — Super Admin, aislado del flujo anterior. `proxy.ts` tiene una rama de gate completamente separada para `/supadmin/*` que no comparte lógica de redirect con `/login`.

Una misma persona (email) puede tener sesión como Super Admin y **también** ser admin de una empresa (son registros independientes en `platform_admins` y `admins` respectivamente) — es el caso real de `jcastillo@materialesjcastillo.com`, Super Admin y a la vez admin de "Grupo CT".

## `proxy.ts` — gate de rutas

Corre en cada request a `/`, `/login`, `/admin/*`, `/driver/*` y `/supadmin/*`:

1. Resuelve la sesión de Supabase Auth desde las cookies.
2. Para `/admin` y `/driver`: si no hay sesión, redirige a `/login`. Si hay sesión, consulta si existe una fila en `admins` para ese `auth.uid()` (no una columna `role`) para permitir o redirigir (un conductor no tiene fila en `admins`, así que no puede entrar a `/admin`).
3. Para `/` y `/login` con sesión activa: redirige según pertenezca o no a `admins` (`admin` → `/admin`, si no → `/driver`).
4. Para `/supadmin/*`: rama aislada. Sin sesión o sin fila en `platform_admins` → `/supadmin/login`. Nunca consulta `admins` ni `drivers`.

## Autenticación

Tres mecanismos, todos sobre Supabase Auth nativo (sin JWT propio):

- **Usuario + contraseña** (admins de empresa y Super Admin) — `supabase.auth.signInWithPassword`, estándar. El campo pedido es el correo.
- **Usuario + PIN** (solo conductores) — `POST /api/auth/pin` recibe `username` (no correo) + `pin`, resuelve el conductor por `drivers.username` con el cliente `service_role`, valida `pin_code`, genera un magic link (`admin.auth.admin.generateLink`) y el cliente lo canjea con `verifyOtp({ token_hash, type: "magiclink" })`. Así se evita firmar JWTs a mano: el PIN es solo la llave para obtener un magic link válido de Supabase. `verifyOtp` debe recibir **solo** `token_hash` y `type` — pasarle también `email` hace que la API de Supabase lo rechace (`validation_failed`).
- Los conductores **no tienen contraseña**: su cuenta de `auth.users` se crea sin `password` (`admin.auth.admin.createUser({ email, email_confirm: true })`), porque el único camino de acceso soportado es usuario + PIN.
- **Super Admin** — solo usuario + contraseña, sin PIN (no lo pidió el negocio, y añadirlo sería sobre-ingeniería).

## Estrategia offline-first (Driver App)

Los botones de estado del ciclo de viaje (`Iniciar Viaje`, `Llegada a Destino`, etc.) capturan GPS + timestamp **en el momento del click**, antes de intentar la escritura de red:

1. Si `navigator.onLine` es `false`, o la escritura falla por un error de transporte (sin `code` en la respuesta de PostgREST), el evento se encola en IndexedDB (`lib/offline/db.ts`).
2. Un hook (`lib/offline/useOfflineSync.ts`) reintenta el envío al detectar el evento `online` del navegador y cada 20s mientras la app está en foreground — **no** se usa la Background Sync API porque Safari iOS no la soporta, y el conductor opera desde el navegador móvil.
3. `trip_events.synced_offline` marca los eventos que se escribieron así, distinguiendo timestamp real del dispositivo vs. confirmación en vivo del servidor.

El Service Worker (`public/sw.js`) solo cachea el app-shell estático (íconos, manifest, página `/offline`) — deliberadamente no cachea datos ni pantallas autenticadas, para no servir contenido stale de otro tenant.

## Modelo de seguridad

Ver el detalle de políticas en [DATABASE.md](./DATABASE.md). Resumen de las decisiones clave:

- **RLS en todas las tablas.** Ninguna tabla de negocio es accesible sin política explícita.
- **Dos funciones `SECURITY DEFINER`** (`auth_company_id()`, `auth_role()`) son la única fuente de verdad para "¿a qué empresa pertenece este usuario y con qué rol", usadas en *todas* las policies. Resuelven el rol probando primero `admins` y luego `drivers` (una fila solo puede existir en una de las dos). Desactivar una empresa (`companies.is_active = false`) hace que ambas funciones devuelvan `NULL` para sus usuarios — lo que automáticamente corta el acceso en cada policy del sistema sin tener que tocarlas una por una.
- **`drivers` no permite auto-edición.** A diferencia del viejo diseño de una sola tabla `users` (donde un conductor podía, vía RLS, actualizar su propia fila — incluyendo en teoría su propio rol), la tabla `drivers` solo acepta `UPDATE` de un admin de la misma empresa. Un conductor autenticado puede `SELECT` su propia fila (para su header), pero no escribirla.
- **Privilegios a nivel de columna** en `companies.max_users` e `companies.is_active`: revocados para el rol `authenticated` y re-otorgados solo para el resto de columnas. Un admin de empresa puede editar el nombre/RUC/logo de su empresa vía RLS normal, pero **no puede** auto-ampliar su cupo de usuarios ni reactivar su empresa así manipule la petición HTTP directamente — el bloqueo es de Postgres, no de la UI.
- **Rutas privilegiadas del Super Admin** (`/api/supadmin/*`) usan el cliente `service_role` (bypassa RLS) pero cada una empieza verificando `platform_admins` server-side antes de tocar cualquier dato — nunca se confía en el rol declarado por el cliente.
- **Buckets de Storage** siguen el mismo patrón: policies acotadas por `company_id` extraído de la ruta del archivo, más una policy adicional que permite a `platform_admins` escribir en cualquier carpeta (para subir logos de empresas que no son la suya).
