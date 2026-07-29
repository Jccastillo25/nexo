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

El sistema tiene **tres niveles de acceso, completamente aislados entre sí**:

| Nivel | Tabla de identidad | Ruta | Alcance |
|---|---|---|---|
| **Super Admin** | `platform_admins` (independiente) | `/supadmin` | Toda la plataforma: crea empresas, define cupos de usuarios, activa/desactiva empresas, configura branding de Ruta360 |
| **Admin de empresa** | `public.users` (`role = 'admin'`) | `/admin` | Su propia empresa: flota, accesorios, conductores, perfil de empresa |
| **Conductor** | `public.users` (`role = 'driver'`) | `/driver` | Su propio ciclo de viaje |

**Por qué `platform_admins` es una tabla separada y no un valor más de `user_role`:** un Super Admin no pertenece a ninguna empresa (`public.users.company_id` es `NOT NULL` — cualquier fila ahí implica pertenencia a un tenant). Mezclar ambos conceptos en la misma tabla habría requerido debilitar esa restricción o inventar una empresa "fantasma". Mantenerlos separados garantiza que un usuario de empresa nunca pueda, por accidente o por un bug de RLS, aparecer como operador de la plataforma.

Cada nivel tiene su **propio login**:
- `/login` — admins y conductores de empresa (mismo formulario, con selector de modo Usuario/Contraseña o PIN).
- `/supadmin/login` — Super Admin, aislado del flujo anterior. `proxy.ts` tiene una rama de gate completamente separada para `/supadmin/*` que no comparte lógica de redirect con `/login`.

Una misma persona (email) puede tener sesión como Super Admin y **también** ser admin de una empresa (son registros independientes en `platform_admins` y `public.users` respectivamente) — es el caso real de `jcastillo@materialesjcastillo.com`, Super Admin y a la vez admin de "Grupo CT".

## `proxy.ts` — gate de rutas

Corre en cada request a `/`, `/login`, `/admin/*`, `/driver/*` y `/supadmin/*`:

1. Resuelve la sesión de Supabase Auth desde las cookies.
2. Para `/admin` y `/driver`: si no hay sesión, redirige a `/login`. Si hay sesión, consulta `public.users.role` para permitir o redirigir (un conductor no puede entrar a `/admin`).
3. Para `/` y `/login` con sesión activa: redirige según el rol (`admin` → `/admin`, `driver` → `/driver`).
4. Para `/supadmin/*`: rama aislada. Sin sesión o sin fila en `platform_admins` → `/supadmin/login`. Nunca consulta `public.users`.

## Autenticación

Tres mecanismos, todos sobre Supabase Auth nativo (sin JWT propio):

- **Usuario + contraseña** — `supabase.auth.signInWithPassword`, estándar.
- **PIN de 4 dígitos** (solo conductores/admins de empresa) — `POST /api/auth/pin` valida el PIN contra `public.users.pin_code` con el cliente `service_role`, genera un magic link (`admin.auth.admin.generateLink`) y el cliente lo canjea con `verifyOtp`. Así se evita firmar JWTs a mano: el PIN es solo la llave para obtener un magic link válido de Supabase.
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
- **Dos funciones `SECURITY DEFINER`** (`auth_company_id()`, `auth_role()`) son la única fuente de verdad para "¿a qué empresa pertenece este usuario y con qué rol", usadas en *todas* las policies. Desactivar una empresa (`companies.is_active = false`) hace que ambas funciones devuelvan `NULL` para sus usuarios — lo que automáticamente corta el acceso en cada policy del sistema sin tener que tocarlas una por una.
- **Privilegios a nivel de columna** en `companies.max_users` e `companies.is_active`: revocados para el rol `authenticated` y re-otorgados solo para el resto de columnas. Un admin de empresa puede editar el nombre/RUC/logo de su empresa vía RLS normal, pero **no puede** auto-ampliar su cupo de usuarios ni reactivar su empresa así manipule la petición HTTP directamente — el bloqueo es de Postgres, no de la UI.
- **Rutas privilegiadas del Super Admin** (`/api/supadmin/*`) usan el cliente `service_role` (bypassa RLS) pero cada una empieza verificando `platform_admins` server-side antes de tocar cualquier dato — nunca se confía en el rol declarado por el cliente.
- **Buckets de Storage** siguen el mismo patrón: policies acotadas por `company_id` extraído de la ruta del archivo, más una policy adicional que permite a `platform_admins` escribir en cualquier carpeta (para subir logos de empresas que no son la suya).
