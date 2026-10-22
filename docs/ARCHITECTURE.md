# Arquitectura de Nexo

## Productos — zona `/productos` (2026-10-16)

App independiente `apps/productos` (`basePath: "/productos"`, puerto local
3005), **sin proyecto Vercel todavía**. Nexo la cose con `PRODUCTOS_APP_URL`
(rewrite solo si la variable existe; agregada al allowlist de `turbo.json`) y
su proxy excluye `/productos`, igual que `/atencion`. Login único y `NexoShell`
compartidos. Schema `productos` cerrado a la API: todo pasa por RPC
`public.productos_*` (security definer + `core.fn_exigir_permiso`), reutilizable
por Listas de precios, Inventario y Nexo Mobile. Los demás módulos referencian
el producto por su `id`/`numero_id` (inmutables), nunca por el código
(editable). La importación lee los Excel del ERP en el navegador
(`read-excel-file`) y manda JSON a `productos_importar`; la exportación arma el
Excel del ERP en el navegador (`write-excel-file`). Diseño:
[plan 14](plan/14-productos.md).

## Atención — zona `/atencion` (2026-10-14)

App independiente `apps/atencion` (`basePath: "/atencion"`, puerto local 3004),
proyecto Vercel `nexo-atencion` (`prj_FT2U6mICFnLJGgy94IZ2M8BDJlN6`, Root
Directory `apps/atencion`, creado 2026-10-14 con la misma protección que
CRM/RRHH). Nexo la cose con `ATENCION_APP_URL` (rewrite solo si
la variable existe; agregada al allowlist de `turbo.json`). Login único y
`NexoShell` compartidos. Toda la lógica vive en RPC `public.atencion_*`
(schema `atencion` sin exponer a la API), reutilizable por una futura app de
tablets/móvil. `/atencion/pantalla/<id>` queda fuera del proxy de sesión: la
pantalla de TV no tiene usuario y llama con la clave anónima a
`atencion_pantalla_estado` cada 3 s (número siempre; puesto, cliente y agente según la configuración de cada pantalla, desde 2026-10-15). Puesto y recepción reciben los cambios de la fila por Supabase Realtime (`postgres_changes` sobre `public.atencion_cola_senales`, una señal sin datos del cliente) y recargan por RPC; el refresco periódico queda como respaldo (Chrome lo congela en segundo plano). El proxy de `apps/nexo` excluye `/atencion` (como `/crm`, `/rrhh`, `/agencia`): sin esa exclusión, la pantalla y sus `/atencion/_next/static/*` iban al login antes del rewrite. `pg_cron`
cierra atenciones a medianoche (hora de la sucursal). Diseño:
[plan 13](plan/13-atencion-turnos.md).

## Agencia digital — ticket #18, extracción del Dashboard del #13 (2026-10-14)

El usuario aprobó una app independiente `apps/agencia` y proyecto Vercel `nexo-agencia`. `/agencia` pertenece a esa zona (`basePath`); Nexo la cose mediante `AGENCIA_APP_URL`. El catálogo guarda `/agencia`, no el dominio del deployment. El acceso antiguo `/dashboard` redirige a la nueva zona en el candidato de #18; necesita destino desplegado antes del merge. Auth y `NexoShell` compartidos, permisos propios del módulo y de lectura del Dashboard. Catálogo inactivo hasta la activación coordinada. [Estado y runbook](status-log/2026-10-14-agencia-independiente.md).


Estado: vigente desde 2026-08-29, actualizado 2026-09-06 con estrategia Mobile y separación de credenciales operativas.

Ver propuestas históricas en `docs/planning/` y decisiones operativas vigentes en `docs/PLAN_MAESTRO_IMPLEMENTACION_NEXO.md`.

---

# 1. Resumen

- **Monorepo**: Turborepo + pnpm workspaces. Una app por módulo en `apps/*`, paquetes compartidos en `packages/*`.
- **Un solo dominio Web**: `nexo.materialesjcastillo.com`.
- **Multi-Zones**: la app `nexo` es zona raíz y reescribe hacia cada módulo desplegado en su propio proyecto Vercel.
- **Base de datos**: un solo proyecto Supabase `nexo-core`, `auth.users` compartido, un schema PostgreSQL por módulo más `core`.
- **Permisos**: DENY-BY-DEFAULT con `core.permissions_catalog`, roles por app, RLS y `core.has_permission()`.
- **Integración**: funciones/RPC de dominio y `core.fn_*` para operaciones atómicas cross-schema.
- **Nexo Mobile**: una sola app Android/iOS, operacional y limitada por roles; no replica toda la Web.

---

# 2. Web: Multi-Zones

Cada aplicación Web mantiene despliegue independiente:

```text
apps/nexo      → zona raíz
apps/rrhh      → /rrhh (+ /rrhh/asistencia)
apps/agencia   → /agencia
apps/atencion  → /atencion
apps/productos → /productos
apps/erp       → /erp (réplica de AG Negocio, por crear)
apps/flotilla  → /flotilla (al adaptar)
```

La ruta registrada en `core.apps.route` siempre es relativa. La URL real de Vercel existe únicamente como destino de rewrite.

Cada proyecto Vercel mantiene sus propias variables de entorno.

Un schema PostgreSQL nuevo requiere `GRANT USAGE` y permisos base sobre tablas además de RLS.

---

# 3. Identidad: dos contextos de sesión, una autoridad

Nexo distingue entre:

1. **sesión digital autenticada**;
2. **marcación física en kiosko**.

No son la misma credencial.

## 3.1 Sesión digital

Web administrativa, Panel de Conductor Web y Nexo Mobile utilizan Supabase Auth.

```text
Cliente Web/Mobile
      ↓
Supabase Auth
      ↓
auth.uid()
      ↓
core.has_permission()
      ↓
RLS / RPC
```

La identidad digital pertenece al empleado/persona, no a un módulo específico.

Evitar múltiples cuentas para la misma persona:

```text
NO:
usuario_transporte
usuario_rrhh
usuario_crm
usuario_fabricacion

SÍ:
1 identidad digital Nexo
+ roles/permisos por módulo
```

## 3.2 Kiosko

El kiosko no abre una sesión de Supabase Auth para el empleado.

```text
Kiosko autorizado
      ↓
PIN contractual
      ↓
validar contrato activo
      ↓
registrar entrada/salida
```

El PIN es exclusivamente una credencial de asistencia.

---

# 4. Separación obligatoria de credenciales

Decisión vigente desde 2026-09-06:

```text
PIN                 = asistencia
usuario+contraseña  = sesión digital
```

El diseño anterior que reutilizaba el mismo PIN para kiosko y login operativo queda deprecado como arquitectura objetivo.

El código existente con `rrhh.fn_validar_acceso_operativo()` y `nombre_usuario + PIN` debe migrarse mediante nuevas migraciones; no modificar migraciones ya aplicadas.

Fuente detallada: [`DRIVER_ACCESS_AND_KIOSK.md`](DRIVER_ACCESS_AND_KIOSK.md).

---

# 5. Relación empleado → contrato → identidad → conductor

Las responsabilidades se separan así:

```text
RRHH EMPLEADO
   │
   ├── Expediente General
   │
   ├── Contrato activo
   │      └── PIN de asistencia
   │
   └── Identidad digital Nexo
          └── auth.users
                │
                └── roles/permisos
                      │
                      └── habilitación Transporte / conductor
```

## 5.1 Habilitación de conductor

Ser empleado no implica ser conductor.

```text
Empleado + contrato activo
      ↓
Habilitar conductor
      ↓
Crear/reutilizar identidad digital
      ↓
Asignar permisos Transporte
      ↓
Panel Conductor Web + Nexo Mobile
```

Si el empleado ya posee `auth.users`, no se crea otra cuenta.

`flotilla.conductores` es una extensión operacional y no una segunda persona.

---

# 6. Panel de Conductor Web

El Panel de Conductor es distinto de la administración de Transporte.

Acceso:

```text
usuario + contraseña
      ↓
Supabase Auth
      ↓
contrato activo
+ conductor habilitado
+ permisos
      ↓
Panel Conductor
```

Contenido operacional previsto:

- viaje actual;
- vehículo asignado;
- inspección;
- iniciar/continuar/finalizar viaje;
- incidencias;
- GPS/eventos;
- evidencia de entrega;
- historial;
- gastos/liquidación cuando aplique.

No se debe exponer administración de empleados, permisos, configuración global o administración de flota únicamente porque esas funciones existan en Nexo Web.

---

# 7. Nexo Mobile

Objetivo futuro:

```text
apps/mobile
```

Stack recomendado para spike técnico:

- React Native;
- Expo;
- TypeScript.

Nexo Mobile no es una WebView ni un espejo de la suite Web.

Es una superficie operacional que muestra únicamente los módulos y acciones aprobados para cada rol.

Primera vertical productiva: **Transporte / conductor**.

Capacidades nativas esperadas:

- Secure Storage;
- cámara;
- GPS;
- ubicación cuando el flujo lo requiera;
- offline-first;
- sincronización idempotente;
- push notifications;
- biometría como desbloqueo local opcional, nunca como autorización de backend.

La misma cuenta Supabase Auth debe funcionar en Panel de Conductor Web, Android e iOS.

---

# 8. Backend compartido para Web y Mobile

Toda lógica que deba existir en ambas superficies debe vivir en una capa compartida:

```text
Web ───────┐
           ├── RPC / servicio de dominio → PostgreSQL
Mobile ────┘
```

Evitar lógica crítica encerrada exclusivamente en Server Actions de Next.js.

Los Server Actions actúan como adaptadores Web; la autoridad de negocio y permisos debe quedar disponible para Mobile sin duplicación.

## 8.1 Kernel compartido de las zonas (2026-10-20)

La revisión integral del 2026-10-20 encontró la infraestructura copiada en
6 apps, con copias que ya habían divergido: algunas no pasaban las cookies
de sesión ni `Cache-Control` en las redirecciones del proxy. Desde entonces
vive en paquetes del workspace. Cada app los compila con `transpilePackages`
y las zonas siguen siendo deploys independientes.

| Paquete | Qué ofrece |
|---|---|
| `@nexo/supabase` | `createServerClient()` (con cookies), `createAnonClient()` (sin sesión, para RPC públicas), `updateSession(request, { basePath, rutasPublicas })` para el `proxy.ts` de cada zona (SSO al login del panel, que siempre conserva cookies y `Cache-Control`) y `redirigirConSesion()`. Además, `@nexo/supabase/client` (`createBrowserClient`) y `@nexo/supabase/admin` (`createServiceRoleClient`, `server-only`) |
| `@nexo/auth` | Es `server-only`. Incluye `getCompanyId()` y `getPanelUrl()`, más `sesionActual()`, con una sola llamada a `getUser()` por request (`cache` de React), para el layout. Para páginas y acciones, `contextoActual()`, con el mismo cliente y sin llamar a Auth. También `misPermisos(códigos)` (ver [PERMISSIONS.md](PERMISSIONS.md)), `signOut` (también en `@nexo/auth/acciones`) y `getPlatformSettings()`, cacheada entre requests 5 minutos con la etiqueta `platform-settings`; la acción de Marca la invalida con `revalidarPlatformSettings()` |
| `@nexo/permissions` | `hasPermission` y `requirePermission`, sin cambios, más `getPermisos(ctx, códigos)`: una RPC `mis_permisos`, con respaldo a `has_permission` y fail-closed |
| `@nexo/config` | `@nexo/config/next-security`: las cabeceras de seguridad HTTP de todas las zonas |
| `@nexo/ui` | El kit de interfaz y `@nexo/ui/formato` (fechas en `America/Managua` y montos C$/US$, sin Next ni React; también sirve a Mobile) |

Pendiente: `@nexo/types` sigue vacío. Los tipos generados de `public` y una
posible separación de `formato` en `@nexo/format` quedan para la etapa de
contratos entre módulos (ver la hoja de ruta de la revisión integral).

---

# 9. Offline-first

Prioridad:

1. Transporte — obligatorio.
2. Fabricación — deseable/operacional.
3. Ventas en el ERP (preventa y rutas de vendedor, como la app móvil de AG Negocio) — parcial.
4. RRHH — principalmente consulta/autoservicio; marcación móvil no se asume aprobada.

Toda escritura offline debe soportar:

- identificador idempotente;
- timestamp del dispositivo y servidor;
- estados pending/synced/failed;
- reintentos seguros;
- estrategia de conflictos;
- auditoría de origen.

---

# 10. Contrato laboral como autoridad operativa

Un contrato finalizado debe impedir nuevas operaciones laborales.

Ejemplos:

- PIN deja de marcar;
- conductor no inicia nuevos viajes;
- permisos/habilitaciones dependientes del contrato se revocan o suspenden;
- el historial no se borra.

Si el empleado deja de ser conductor pero conserva contrato activo:

- PIN de asistencia sigue vigente;
- otras funciones autorizadas pueden continuar;
- Transporte deja de autorizar nuevos viajes.

---

# 11. Seguridad

- contraseñas gestionadas por Supabase Auth;
- no guardar password/hash propio en tablas de negocio;
- PIN almacenado únicamente como hash de credencial de asistencia;
- no usar PIN como password temporal;
- no crear sesiones caseras paralelas;
- RLS y permisos validan cada operación aunque la UI la muestre;
- revocación backend prevalece sobre caché/estado local de Mobile.

La provisión de cuentas debe usar Admin SDK/API soportada por Supabase, nunca `INSERT` directo en `auth.users`.

---

# 12. Configuración efectiva conocida de Multi-Zones

Proyectos del equipo `julio-s-projects7`, verificados con el MCP de Vercel el 2026-10-20 (la tabla anterior, del 2026-09-04, solo listaba 3):

| Proyecto Vercel | App | Root Directory |
|---|---|---|
| `nexocore` | `apps/nexo` | `apps/nexo` |
| `nexo-crm` | `apps/crm` (borrada el 2026-10-20); pasará a `apps/presupuesto` | `apps/crm` hoy; `apps/presupuesto` al desplegar |
| `nexo-rrhh` | `apps/rrhh` (incluye Asistencia y el kiosco) | `apps/rrhh` |
| `nexo-atencion` | `apps/atencion` | `apps/atencion` |
| `nexo-agencia` | `apps/agencia` | `apps/agencia` |
| `nexo-productos` | `apps/productos` (tiene un deploy de producción READY; los docs anteriores decían que no había proyecto) | `apps/productos` |
| `materiales-jcastillo-web` | `apps/web-corporativo` (dominio aparte) | — |
| `materiales-jcastillo-marketing-dashboard` | Fuera del monorepo. Posible solapamiento con `apps/agencia`, a decidir por el usuario | — |

`nexo-crm` quedó sin código en el repositorio con el retiro del CRM del 2026-10-20 ([status-log](status-log/2026-10-20-retiro-crm-replica-ag-negocio.md)). Decisión del usuario del mismo día: lo reutiliza la app **Presupuesto** ([plan 19](plan/19-presupuesto.md)), que no tiene proyecto propio. Al desplegar:
- su *Root Directory* pasa a `apps/presupuesto` justo antes de fusionar el PR que trae la app y el retiro del CRM;
- `nexocore` recibe `PRESUPUESTO_APP_URL`, la URL de producción de ese proyecto.

Sus variables (`NEXO_COMPANY_ID`, `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`) ya están puestas.

Contrato de rutas actual:

```text
/rrhh         → RRHH_APP_URL
/agencia      → AGENCIA_APP_URL      (solo si está definida)
/atencion     → ATENCION_APP_URL     (solo si está definida)
/productos    → PRODUCTOS_APP_URL    (solo si está definida)
/presupuesto  → PRESUPUESTO_APP_URL  (solo si está definida; en local, puerto 3001)
```

El proxy del panel excluye `/presupuesto`, igual que `/productos`: la zona tiene su propio guard y redirige al login del panel.

`/rrhh/kiosco` sigue siendo una excepción deliberada al guard de sesión del usuario porque el kiosko autentica dispositivo + PIN, no una sesión personal.

Accesos al kiosco sin sesión (2026-10-20). Son `redirects` de `next.config`, que corren antes del proxy:

```text
/kiosco                  → /rrhh/kiosco   (apps/nexo/next.config.ts)
/asistencia/kiosco       → /rrhh/kiosco   (apps/nexo/next.config.ts)
/rrhh/asistencia/kiosco  → /rrhh/kiosco   (apps/rrhh/next.config.ts, con el basePath)
/rrhh/<Kiosco en cualquier mayúscula> → /rrhh/kiosco   (apps/rrhh/src/proxy.ts)
```

El proxy de RRHH solo exime del guard la ruta exacta `/kiosco`, en minúsculas (la revisión de seguridad del 2026-10-20 quitó también las subrutas). Antes, `startsWith("/kiosco")` dejaba sin guard rutas como `/kioscoX`. La query, por ejemplo `?asignar=1`, se conserva en todas las redirecciones.

---

# 13. Pendientes arquitectónicos

- [ ] Adaptar `apps/flotilla` a `nexo-core` y Multi-Zones.
- [ ] Refactorizar acceso operativo heredado de PIN doble propósito.
- [ ] Definir/provisionar identidad digital de empleados mediante Supabase Auth.
- [ ] Implementar Panel de Conductor Web sobre la identidad Nexo.
- [ ] Crear `apps/mobile` tras spike técnico.
- [x] Completar `@nexo/supabase` y `@nexo/auth` (2026-10-20, ver §8.1; con la migración de cada app en curso).
- [ ] Datos maestros en `core` (terceros, sucursal y empresa fiscal, tipo de cambio) y eventos entre módulos (outbox `core.eventos`): propuesta de la revisión integral del 2026-10-20, pendiente de aprobación. **Hay que decidirlo antes de aplicar el Paso Cero de ERP R1**, cuya migración local crea una empresa y una sucursal propias del ERP.
- [ ] Pipeline CI/CD por app.
- [ ] Estrategia de versionado de paquetes compartidos.
- [ ] Distribución Android/iOS y gestión de versiones.

---

# 14. Fuentes relacionadas

- [`PLAN_MAESTRO_IMPLEMENTACION_NEXO.md`](PLAN_MAESTRO_IMPLEMENTACION_NEXO.md)
- [`IMPLEMENTATION_STATUS.md`](IMPLEMENTATION_STATUS.md)
- [`DRIVER_ACCESS_AND_KIOSK.md`](DRIVER_ACCESS_AND_KIOSK.md)
- [`DATABASE.md`](DATABASE.md)
- [`PERMISSIONS.md`](PERMISSIONS.md)
- [`planning/ARQUITECTURA_MVP_ESCALABLE.md`](planning/ARQUITECTURA_MVP_ESCALABLE.md)
