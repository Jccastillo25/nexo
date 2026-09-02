# Arquitectura MVP escalable de Nexo — identidad, datos, RBAC y playbook

Estado: propuesta aprobada (2026-09-02), pendiente de implementar por fases.
Este documento **no reabre** la decisión de fondo ya tomada y ya construida
en [ARCHITECTURE.md](../ARCHITECTURE.md) (Monolito Modular por schemas +
Multi-Zones) — la valida con criterios de Staff Architect y la **extiende**
en los puntos que faltaban: particionamiento, pooling, read replicas, RBAC
de dos capas (suite + app), atomicidad inter-módulo, y un playbook único
para dar de alta una app nueva.

Una decisión de este documento sí **reemplaza** una norma obligatoria
anterior: dark mode por defecto + glassmorphism reemplaza "el negro es
solo del login" (ver §4). El resto de las reglas obligatorias vigentes
(permisos v3.0, SSO único, `ShellBar`, `next/link`, Dashboard de KPIs,
Vercel Analytics) **no cambian** — se documentan acá solo donde se
extienden.

Índice: [1. Identidad y datos](#1-arquitectura-de-identidad-y-datos) ·
[2. Escalabilidad](#2-estrategia-de-escalabilidad-extrema) ·
[3. RBAC de dos capas](#3-matriz-de-roles-y-permisos-granulares-rbacabac) ·
[4. UI: dark mode + glass](#4-estándares-de-uiux-y-frontend) ·
[5. Atomicidad inter-app](#5-flujos-de-trabajo-e-interconexión) ·
[6. Playbook de app nueva](#6-playbook-para-agregar-una-nueva-app) ·
[7. Código y seguridad](#7-mejores-prácticas-de-código-y-seguridad)

---

## 1. Arquitectura de identidad y datos

### 1.1 La decisión ya tomada, evaluada con criterio de staff

| Criterio | Monolito Modular (1 proyecto Supabase, 1 schema Postgres por módulo) | Microservicios puros (1 proyecto Supabase por módulo) |
|---|---|---|
| Identidad única | `auth.users` es **una sola tabla física**. Un JWT sirve para todos los módulos sin sincronización. | Requiere un IdP externo (o un Supabase "de auth" separado) + replicar el usuario a cada proyecto vía webhook — más piezas, más forma de desincronizarse. |
| Transaccionalidad cruzada | `BEGIN; ... COMMIT;` real entre `rrhh.nomina` y `contabilidad.asientos` — mismo motor Postgres, mismo WAL. Ver §5. | No existe transacción de base de datos entre dos proyectos. Obliga a Saga/outbox con estados intermedios ("nómina aprobada pero asiento pendiente") desde el día 1, para un MVP que no lo necesita todavía. |
| Seguridad | Una sola superficie de RLS, una sola función `core.has_permission()` (ya construida, ver [PERMISSIONS.md](../PERMISSIONS.md)) que policies **y** server actions comparten. | N proyectos = N configuraciones de RLS, N `service_role` keys que rotar y filtrar, N superficies de ataque. |
| Velocidad de iteración | Un módulo nuevo = un schema + políticas, no un proyecto de infraestructura nuevo. Ya demostrado: CRM se adaptó en una fase. | Cada módulo nuevo implica aprovisionar proyecto, red, secretos, pipeline — fricción que un equipo chico no puede pagar en MVP. |
| Aislamiento de datos | Lógico (schema + RLS + rol `authenticated` sin `USAGE` en schemas que no le tocan). Suficiente para SOC2/ISO si RLS está bien probado. | Físico, más fuerte en papel — pero el proyecto ya eligió no pagar ese costo operativo por una separación que RLS ya cubre. |
| Límite real de este modelo | Un solo Postgres primario para toda la suite — se resuelve con particionamiento + pooling + read replicas (§2), no reescribiendo la arquitectura. | Escala por proyecto, pero el techo aparece en la capa de identidad/transacciones, no en la de datos. |

**Veredicto: Monolito Modular por schemas, confirmado.** El costo que
"no paga" (aislamiento físico) no es un requisito de negocio declarado
(no hay indicio de que un módulo deba vivir en otra región, otro
proveedor, o bajo otro régimen de compliance); el costo que sí evita
(transaccionalidad, identidad, superficie de seguridad) sí es un
requisito de negocio explícito ("interconectadas... sin colapsar").
Microservicios puros se revisita únicamente si un módulo futuro necesita
residencia de datos distinta o un ritmo de despliegue que un `pnpm
turbo build --filter` ya no pueda aislar — no es el caso hoy.

### 1.2 Cómo se comunican los módulos entre sí

Regla dura: **ningún módulo hace `supabase.schema("otro_modulo")` desde
el cliente ni desde su propia server action para leer/escribir datos de
otro módulo.** Un schema de módulo solo se expone en la Data API (Settings
→ API → Exposed schemas) para que **ese mismo módulo** lo consuma. La
comunicación cruzada pasa siempre por una de estas tres vías, en este
orden de preferencia:

1. **Función SQL `security definer` en `core` o en un schema neutro**
   (ej. `core.fn_aprobar_planilla`, ver §5) — la única que puede tocar dos
   schemas en una sola transacción real. Expuesta como RPC (`public.*`
   wrapper, mismo patrón que `public.has_permission`).
2. **Vista de solo lectura en `public`** cuando un módulo necesita
   *leer* un dato resumido de otro (ej. Contabilidad necesita el nombre
   del cliente que vive en `crm.clientes`) — nunca la tabla cruda.
3. **`core.audit_log` / tabla de eventos** cuando la relación es
   "enterarse de que algo pasó", no "necesito el dato ahora" — ver el
   patrón *outbox* en §5.3 para cuando un módulo futuro sí viva en su
   propio proyecto Supabase (excepción, no la regla).

`core` mismo permanece **sin exponer** en la Data API (ya es así, ver
[DATABASE.md](../DATABASE.md)) — todo lo que un módulo necesita de `core`
(permisos, catálogo de apps, roles) pasa por wrappers en `public`,
firmados con `security definer` y `set search_path`, para que no haya
manera de leer `core.user_permissions` cruda desde `supabase-js`.

```
auth.users (única, compartida)
      │
      ├── core.company_memberships   (rol de SUITE: owner/admin/member)
      ├── core.user_app_roles        (rol por APP: admin/editor/viewer) — nuevo, §3
      └── core.user_permissions      (permiso fino por acción)  ← ya existe

core.has_permission(user, company, code)  ── única función, RLS y server actions la llaman igual
      │
      ├── schema rrhh          (solo rrhh lee/escribe directo)
      ├── schema flotilla      (solo flotilla lee/escribe directo)
      ├── schema crm           (solo crm lee/escribe directo)
      ├── schema contabilidad  (solo contabilidad lee/escribe directo)
      └── funciones cross-schema en `core` (§5) — el único puente entre dos schemas
```

---

## 2. Estrategia de escalabilidad extrema

Nada de esto compromete el modelo de §1 — vive **dentro** del mismo
Postgres. El monolito modular escala verticalmente y por particiones
mucho más lejos de lo que la suite va a necesitar en años (Postgres
particionado maneja cómodamente cientos de millones de filas por tabla
hija).

### 2.1 Particionamiento — regla de nacimiento

**Regla obligatoria (nueva): toda tabla de hechos transaccional —
cualquier tabla donde cada fila es un evento que ocurrió en el tiempo y
que se sigue insertando sin límite (movimientos, transacciones, marcas de
asistencia, viajes, asientos contables, logs, auditoría) — nace
particionada por `RANGE` mensual desde su primera migración.** Las
tablas de catálogo/dimensión (clientes, empleados, vehículos,
`permissions_catalog`, `apps`) **no** se particionan — su volumen es
acotado por naturaleza (miles, no millones).

Cómo decidir en 10 segundos al diseñar una tabla nueva: *"¿esta tabla
crece un renglón por evento de negocio, para siempre?"* → sí:
particionada. *"¿es una lista de entidades que la empresa administra?"* →
no.

Plantilla (usar tal cual, cambiando el nombre de schema/tabla/columnas):

```sql
-- Tabla particionada por rango mensual sobre la columna de fecha del
-- evento. La PK compuesta DEBE incluir la columna de partición — es un
-- requisito de Postgres para particionamiento por rango.
create table contabilidad.asientos (
  id uuid not null default gen_random_uuid(),
  company_id uuid not null references core.companies(id),
  fecha date not null,
  cuenta text not null,
  monto numeric(14,2) not null,
  origen_modulo text not null,       -- 'rrhh', 'crm', 'flotilla'...
  origen_id uuid,                    -- id del registro que originó el asiento
  created_at timestamptz not null default now(),
  primary key (id, fecha)
) partition by range (fecha);

-- Particiones futuras: una funcion que crea "el mes que viene" si no
-- existe, para llamar desde pg_cron (ver 2.1.1) o desde el propio insert
-- si pg_cron no esta disponible en el plan.
create or replace function contabilidad.fn_asegurar_particion(p_mes date)
returns void language plpgsql as $$
declare
  particion text := 'asientos_' || to_char(p_mes, 'YYYY_MM');
  inicio date := date_trunc('month', p_mes);
  fin date := inicio + interval '1 month';
begin
  if not exists (select 1 from pg_class where relname = particion) then
    execute format(
      'create table contabilidad.%I partition of contabilidad.asientos
       for values from (%L) to (%L)',
      particion, inicio, fin
    );
    -- indices locales por particion (ver 2.2) — se crean una vez por particion
    execute format('create index on contabilidad.%I (company_id, fecha)', particion);
  end if;
end;
$$;
```

#### 2.1.1 Creación automática de particiones (pg_cron)

Supabase expone `pg_cron` como extensión gestionada. Un job mensual
único en `core` mantiene **todas** las tablas particionadas de la suite
con 3 meses de antelación — así un módulo nuevo solo agrega su tabla a
la lista, no reinventa el cron:

```sql
create table core.tablas_particionadas (
  schema_nombre text not null,
  tabla_nombre text not null,
  fn_asegurar_particion regtype,  -- referencia informativa; la llamada real es dinamica
  primary key (schema_nombre, tabla_nombre)
);

select cron.schedule(
  'nexo_asegurar_particiones',
  '0 3 1 * *',  -- el 1 de cada mes, 3am
  $$ select core.fn_asegurar_particiones_futuras(3) $$  -- 3 meses adelante
);
```

**Tablas que nacen particionadas desde la Fase 2/3 (ya identificadas):**
`rrhh.asistencia_marcas`, `rrhh.nomina_movimientos`, `flotilla.viajes`,
`flotilla.evidencias`, `crm.interacciones` (cuando exista), `contabilidad.asientos`,
`core.audit_log` (candidata retroactiva — hoy vacía, se convierte sin
riesgo de migración de datos, ver la migración adjunta a este documento).

### 2.2 Indexación agresiva

Regla por tipo de columna, aplicar en toda tabla nueva sin excepción:

| Columna | Índice | Motivo |
|---|---|---|
| `id` (PK) | B-Tree automático | Postgres lo crea solo |
| Toda FK (`company_id`, `user_id`, `*_id`) | B-Tree explícito | Postgres **no** indexa FKs automáticamente — sin esto, cualquier `on delete cascade` o join hace seq scan |
| `(company_id, created_at)` / `(company_id, fecha)` | Índice compuesto | Es el patrón de acceso #1 de la suite: "los eventos de esta empresa en este rango" — el orden de columnas importa (igualdad primero, rango después) |
| Columnas usadas en RLS (`company_id` siempre) | B-Tree | La policy se evalúa en cada fila leída — sin índice, RLS convierte cualquier `select` en seq scan filtrado |
| `datos_extra jsonb` / cualquier columna JSONB | GIN | `crm.clientes.datos_extra` ya existe sin índice — agregar `create index using gin (datos_extra jsonb_path_ops)` en cuanto se filtre por ahí |
| Estados con pocos valores activos (`activo = true`, `estado = 'pendiente'`) | Índice parcial (`where activo`) | Un índice sobre el 2% de filas "vivas" en una tabla de millones pesa una fracción del índice completo |
| Texto libre buscable (nombre de cliente, empleado) | `pg_trgm` + GIN | Búsqueda `ilike '%...%'` sin esto es seq scan garantizado a cualquier escala |

```sql
create extension if not exists pg_trgm;
create index concurrently idx_crm_clientes_nombre_trgm
  on crm.clientes using gin (nombre gin_trgm_ops);
```

`concurrently` es obligatorio en cualquier índice creado sobre una tabla
con tráfico real (no bloquea escrituras) — la contrapartida es que no
puede correr dentro de una transacción de migración normal; documentarlo
en el mensaje de la migración cuando aplique.

### 2.3 Connection pooling (Supavisor) — reglas de uso

Supabase expone Supavisor en dos modos + la conexión directa. **La regla
que evita el cuello de botella real** (agotar conexiones de Postgres
cuando cada request serverless de Vercel abre la suya):

| Cliente | Modo | Puerto | Por qué |
|---|---|---|---|
| Server Components, Server Actions, Route Handlers (Next.js en Vercel, serverless/edge) | **Transaction mode** | `6543` | Cada invocación es corta y aislada — transaction mode multiplexa miles de conexiones lógicas sobre un pool chico de conexiones físicas. Es el modo por defecto de `NEXT_PUBLIC_SUPABASE_URL` pooled. |
| Migraciones (`supabase db push`, MCP `apply_migration`), scripts de mantenimiento, `pg_cron` | **Session mode** o conexión directa | `5432` | DDL, `prepared statements` explícitos y transacciones largas necesitan la conexión pegada a una sesión real — transaction mode rompe `prepared statements` entre requests. |
| Read replica para reportes pesados (§2.4) | Transaction mode contra el endpoint de la réplica | `6543` (host de réplica) | Mismo razonamiento que la primaria, tráfico igual de fragmentado. |

Regla de implementación en `packages/supabase` (hoy un stub vacío, ver
§7.2): **un solo lugar** decide qué URL usa cada cliente — nunca hardcodear
el puerto/host en cada `apps/<módulo>`. Contrato:

```ts
// packages/supabase/index.ts (contrato, no relleno — implementar en la Fase de adopción)
// createServerClient(schema)      -> pooled (6543), para Server Components/Actions
// createServerActionClient(schema)-> pooled (6543), igual pero para mutaciones con
//                                    manejo de errores homogeneo (ver §7.2)
// createReadReplicaClient(schema) -> host de replica (6543), SOLO lectura, para
//                                    dashboards/reportes (§2.4) — nunca para escrituras
```

`SUPABASE_DB_URL` de sesión directa (`5432`) vive **solo** en las
variables de entorno de CI/migraciones (GitHub Actions o el shell local
de `supabase` CLI) — nunca en las env vars de runtime de Vercel de
ninguna app. Ver §7.3.

### 2.4 Read replicas — lectura analítica separada de la escritura transaccional

**Cuándo:** cuando aparece el primer dashboard que cruza módulos (la
"Torre de Control" ya prevista en
[planning/NORMA_DISENO_UNIVERSAL.md](NORMA_DISENO_UNIVERSAL.md) §3.1) o
cuando cualquier reporte individual empieza a tardar &gt;500ms de forma
sostenida contra la primaria — no antes; una réplica sin tráfico que la
justifique es costo operativo puro para un MVP.

**Cómo:**

1. Aprovisionar una Read Replica de Supabase (mismo proyecto `nexo-core`,
   read-only, misma región `us-east-1` para no sumar latencia entre
   escritura y replicación).
2. `packages/supabase` expone `createReadReplicaClient()` (contrato de
   arriba) apuntando al host de la réplica — mismas credenciales
   `anon`/`service_role`, mismo esquema de RLS (la réplica hereda las
   policies).
3. **Regla de uso**: cualquier query que solo lee y no necesita
   consistencia *read-your-writes* inmediata (dashboards, reportes,
   exports, la Torre de Control) va contra la réplica. Cualquier query
   que un usuario espera ver reflejada en el siguiente render tras una
   escritura suya (la lista de clientes después de crear uno) sigue
   contra la primaria — la réplica tiene *replication lag*, típicamente
   sub-segundo pero no garantizado cero.
4. `core.has_permission()` y las policies de RLS funcionan igual en la
   réplica (mismo catálogo, misma función) — no hay lógica de permisos
   distinta que mantener en dos lugares.

---

## 3. Matriz de roles y permisos granulares (RBAC/ABAC)

### 3.1 El modelo ya existente cubre 2 de 3 capas necesarias

Lo construido en la Fase 3 ([PERMISSIONS.md](../PERMISSIONS.md)) ya
resuelve:

- **Capa 1 — rol de suite** (`core.company_memberships.role`):
  `owner`/`admin` con bypass total DENY-BY-DEFAULT, `member` sin bypass.
- **Capa 3 — permiso fino por acción** (`core.user_permissions`):
  override explícito por `permission_code`, por usuario, por empresa.

**Falta la capa 2 — rol por app**, que es literalmente el ejemplo del
enunciado: *"Admin de Planilla pero Solo Lectura en Contabilidad"*. Hoy
esa distinción solo se puede lograr otorgando/denegando permisos uno por
uno en `user_permissions`, lo cual escala mal (un admin de RRHH con 20
acciones necesita 20 filas). La capa 2 la resuelve con una sola fila por
app.

### 3.2 Extensión: `core.user_app_roles`

```sql
-- Roles pre-empaquetados por modulo: admin/editor/viewer (o los que cada
-- modulo declare). No reemplaza user_permissions (capa 3, permiso fino) —
-- es un atajo: "dame todos los permisos de este rol en este modulo" en
-- vez de otorgar uno por uno. Ver core.has_permission() extendida abajo.
create table core.app_roles (
  id uuid primary key default gen_random_uuid(),
  module_slug text not null references core.apps(slug) on update cascade,
  role_key text not null,             -- 'admin', 'editor', 'viewer'
  label text not null,                -- 'Administrador de Planilla'
  unique (module_slug, role_key)
);

-- Que permisos trae empaquetados cada rol de app. Editable sin tocar codigo:
-- agregar filas aqui es la forma normal de definir que puede hacer un
-- "viewer" de Contabilidad, por ejemplo.
create table core.app_role_permissions (
  app_role_id uuid not null references core.app_roles(id) on delete cascade,
  permission_code text not null references core.permissions_catalog(code) on update cascade,
  primary key (app_role_id, permission_code)
);

-- Asignacion real: que rol de que app tiene cada usuario, en que empresa.
create table core.user_app_roles (
  user_id uuid not null references auth.users(id) on delete cascade,
  company_id uuid not null references core.companies(id) on delete cascade,
  app_role_id uuid not null references core.app_roles(id) on delete cascade,
  granted_by uuid references auth.users(id),
  granted_at timestamptz not null default now(),
  primary key (user_id, company_id, app_role_id)
);

-- core.has_permission() extendida: agrega la capa 2 sin romper la 1 ni la 3.
-- Orden de evaluacion (el mismo principio DENY-BY-DEFAULT, ahora con 3 capas):
--   1. codigo invalido -> false, siempre (sin cambios)
--   2. fila explicita en user_permissions -> manda esa fila (sin cambios, capa 3 gana)
--   3. el rol de app del usuario en esta empresa trae el permiso empaquetado -> true (NUEVO, capa 2)
--   4. owner/admin de suite -> true (sin cambios, capa 1, ahora es el ultimo fallback)
create or replace function core.has_permission(p_user_id uuid, p_company_id uuid, p_code text)
returns boolean
language sql stable security definer set search_path = core
as $$
  select case
    when not exists (select 1 from core.permissions_catalog where code = p_code) then false
    when exists (
      select 1 from core.user_permissions
      where user_id = p_user_id and company_id = p_company_id and permission_code = p_code
    ) then coalesce((
      select granted from core.user_permissions
      where user_id = p_user_id and company_id = p_company_id and permission_code = p_code
    ), false)
    when exists (
      select 1
      from core.user_app_roles uar
      join core.app_role_permissions arp on arp.app_role_id = uar.app_role_id
      where uar.user_id = p_user_id and uar.company_id = p_company_id
        and arp.permission_code = p_code
    ) then true
    else exists (
      select 1 from core.company_memberships
      where user_id = p_user_id and company_id = p_company_id and role in ('owner', 'admin')
    )
  end;
$$;
```

Esto es **retrocompatible**: ningún módulo existente (CRM) cambia una
línea — sigue llamando a `public.has_permission(companyId, code)` igual
que hoy. La migración va como archivo nuevo en `supabase/migrations/`
(adjunta a este documento, ver §"Migraciones incluidas"), nunca editando
una migración ya aplicada.

### 3.3 Plantilla RLS genérica (usar en todo módulo nuevo)

```sql
-- Plantilla: copiar y reemplazar <schema>, <tabla>, <modulo.dominio.recurso>.
-- Las 4 policies (ver/crear/editar/eliminar) siguen el mismo patron que
-- crm.clientes (ya en produccion) — una condicion, una funcion, cero logica
-- de permisos duplicada en la policy misma.
alter table <schema>.<tabla> enable row level security;

create policy "<tabla>: ver con permiso" on <schema>.<tabla>
  for select to authenticated
  using (core.has_permission(auth.uid(), company_id, '<modulo.dominio.recurso>.ver'));

create policy "<tabla>: crear con permiso" on <schema>.<tabla>
  for insert to authenticated
  with check (core.has_permission(auth.uid(), company_id, '<modulo.dominio.recurso>.crear'));

create policy "<tabla>: editar con permiso" on <schema>.<tabla>
  for update to authenticated
  using (core.has_permission(auth.uid(), company_id, '<modulo.dominio.recurso>.editar'))
  with check (core.has_permission(auth.uid(), company_id, '<modulo.dominio.recurso>.editar'));

create policy "<tabla>: eliminar con permiso" on <schema>.<tabla>
  for delete to authenticated
  using (core.has_permission(auth.uid(), company_id, '<modulo.dominio.recurso>.eliminar'));
```

Para tablas **particionadas** (§2.1): las policies se definen una sola
vez sobre la tabla padre — Postgres las aplica a todas las particiones
automáticamente, no hace falta repetirlas por partición.

---

## 4. Estándares de UI/UX y frontend

### 4.1 Cambio de norma: dark mode por defecto + glassmorphism

**Reemplaza la regla anterior** ("el negro es solo del login",
[DESIGN_SYSTEM.md](../DESIGN_SYSTEM.md) previo) — decisión explícita del
usuario (2026-09-02): toda la suite (`ShellBar`, `Sidebar`, panel y
contenido de cada módulo) adopta tema oscuro por defecto con paneles
glassmorphism, dashboards compactos de alta densidad. El detalle completo
de tokens, migración de `ShellBar`/`Sidebar`/CRM y checklist actualizado
vive ahora en [DESIGN_SYSTEM.md](../DESIGN_SYSTEM.md) (actualizado en el
mismo cambio que este documento) — acá solo la configuración base de
Tailwind y el porqué.

**Tokens base** (`packages/ui`, variables CSS — el mismo mecanismo que ya
usa `--nexo-shell-bg` hoy, valores nuevos):

```css
/* packages/ui/tokens.css — nuevo archivo, importado por cada app junto al
   @source existente (ver checklist de DESIGN_SYSTEM.md) */
:root {
  --nexo-bg: #0A0A0F;              /* fondo base, casi negro con tinte azul */
  --nexo-bg-elevated: #12121A;     /* superficie de card antes del glass */
  --nexo-shell-bg: rgba(18, 18, 26, 0.72);
  --nexo-shell-fg: #F5F5F7;
  --nexo-border: rgba(255, 255, 255, 0.08);
  --nexo-glass-blur: 16px;
  --nexo-accent: #3B82F6;          /* blue-500, sube un tono sobre fondo oscuro */
  --nexo-accent-hover: #60A5FA;
}

/* Utility de glass — una sola clase, reusada en ShellBar, Sidebar, StatCard */
.nexo-glass {
  background: var(--nexo-shell-bg);
  backdrop-filter: blur(var(--nexo-glass-blur)) saturate(160%);
  -webkit-backdrop-filter: blur(var(--nexo-glass-blur)) saturate(160%);
  border: 1px solid var(--nexo-border);
}
```

```ts
// tailwind.config de cada app (o el archivo compartido en packages/config,
// hoy vacio — ver §7.2): dark por defecto vía "class" fijo, no
// "media" — así el tema no depende de la config del SO del usuario y es
// consistente entre dispositivos.
export default {
  darkMode: "class",   // <html class="dark"> seteado en el layout raiz, siempre
  theme: {
    extend: {
      colors: {
        nexo: {
          bg: "var(--nexo-bg)",
          "bg-elevated": "var(--nexo-bg-elevated)",
          border: "var(--nexo-border)",
          accent: "var(--nexo-accent)",
        },
      },
      backdropBlur: { nexo: "16px" },
    },
  },
};
```

**Deuda técnica reconocida, no bloqueante:** `packages/ui/ShellBar.tsx`,
`Sidebar.tsx` y las páginas de `apps/crm` fueron construidas explícitamente
para el tema claro anterior (el propio código de `ShellBar.tsx` documenta
esa decisión en un comentario). Migrarlos es trabajo de una fase
posterior — no se reescriben como parte de este documento. Hasta esa
migración, CRM queda visualmente inconsistente con cualquier módulo nuevo
que sí nazca con los tokens de esta sección; es una inconsistencia
temporal aceptada, no un bug.

### 4.2 Dashboards compactos de alta densidad

Se apoya en la regla obligatoria ya vigente de "todo módulo aterriza en
su Dashboard de KPIs" ([DESIGN_SYSTEM.md](../DESIGN_SYSTEM.md)) — la
densidad es una propiedad del layout de esa misma pantalla, no una
pantalla nueva:

- Grid de `StatCard` con `.nexo-glass`, mínimo 2-3 columnas en desktop,
  números grandes (`text-2xl`/`text-3xl` tabular-nums) + label chico —
  patrón "KPI tile" de Fiori/Odoo, ya referenciado en
  [planning/DISENO_UX_UI.md](DISENO_UX_UI.md).
- `StatCard` se unifica en `packages/ui` (existe 3 veces distinto hoy
  entre RRHH/Flotilla — deuda ya señalada en DESIGN_SYSTEM.md, esta
  unificación es también donde se le agrega la clase `.nexo-glass`).
- Tablas de datos densas: fila compacta (`py-2` no `py-4`), fuente
  `text-sm`, sin padding decorativo — el objetivo es información por
  pantalla, no aire.

### 4.3 Componentes reutilizables (contrato, no relleno)

| Componente | Vive en | Responsabilidad |
|---|---|---|
| `AppShell` (nuevo, envuelve `ShellBar` + `Sidebar`) | `packages/ui` | Layout de dos columnas + fondo `--nexo-bg`, un solo lugar para el grid responsivo que hoy cada `apps/<módulo>/(app)/layout.tsx` arma a mano |
| `ShellBar` | `packages/ui` (existente) | Barra superior — migra a tokens dark/glass, sin cambio de props/contrato |
| `Sidebar` | `packages/ui` (existente) | Navegación del módulo, `next/link` (regla ya vigente) — migra a tokens dark/glass |
| `StatCard` | `packages/ui` (nuevo, unifica 3 duplicados) | Tile de KPI con `.nexo-glass` |
| `useSession` / `getServerSession` | `packages/auth` (hoy stub, ver §7.2) | Estado de sesión tipado, wrapper sobre `supabase.auth.getUser()` — hoy cada módulo repite su propio `createClient()` de `@supabase/ssr` (ver §7.2 para el contrato de unificación) |

---

## 5. Flujos de trabajo e interconexión

### 5.1 Caso: aprobar planilla (RRHH) → asiento contable (Contabilidad)

El monolito modular hace esto **trivial comparado con microservicios**:
como `rrhh` y `contabilidad` viven en el mismo Postgres, una función
`security definer` puede escribir en ambos schemas dentro de una única
transacción real — si algo falla, Postgres revierte las dos escrituras,
no queda estado intermedio posible. No hace falta Saga, ni outbox, ni
"compensating transaction" para este caso.

```sql
-- Vive en `core` (schema neutro, ni de rrhh ni de contabilidad) porque
-- cruza dos modulos — regla de §1.2. Expuesta via RPC en `public`.
create or replace function core.fn_aprobar_planilla(
  p_planilla_id uuid,
  p_company_id uuid
)
returns uuid  -- devuelve el id del asiento contable generado
language plpgsql
security definer
set search_path = core, rrhh, contabilidad
as $$
declare
  v_asiento_id uuid;
  v_total numeric(14,2);
begin
  -- 1. Permiso: solo quien puede aprobar planilla llega aca (capa server
  --    action ya lo valida antes de llamar el RPC; esto es defensa en
  --    profundidad, la misma logica corre si alguien llama el RPC directo).
  if not core.has_permission(auth.uid(), p_company_id, 'rrhh.planillas.planilla.aprobar') then
    raise exception 'Permiso denegado: rrhh.planillas.planilla.aprobar';
  end if;

  -- 2. Marcar la planilla como aprobada (schema rrhh).
  update rrhh.planillas
    set estado = 'aprobada', aprobada_por = auth.uid(), aprobada_en = now()
    where id = p_planilla_id and company_id = p_company_id and estado = 'pendiente'
    returning total into v_total;

  if not found then
    raise exception 'Planilla % no esta pendiente o no existe', p_planilla_id;
  end if;

  -- 3. Generar el asiento contable (schema contabilidad) — misma
  --    transaccion: si esto falla, el UPDATE de arriba tambien se revierte.
  insert into contabilidad.asientos
    (company_id, fecha, cuenta, monto, origen_modulo, origen_id)
  values
    (p_company_id, current_date, 'gastos_planilla', v_total, 'rrhh', p_planilla_id)
  returning id into v_asiento_id;

  -- 4. Auditoria unificada (schema core) — mismo commit tambien.
  insert into core.audit_log (user_id, company_id, action, entity, entity_id, metadata)
  values (auth.uid(), p_company_id, 'planilla.aprobar', 'rrhh.planillas', p_planilla_id::text,
          jsonb_build_object('asiento_id', v_asiento_id, 'total', v_total));

  return v_asiento_id;
end;
$$;

create or replace function public.aprobar_planilla(p_planilla_id uuid, p_company_id uuid)
returns uuid language sql security definer set search_path = core, public
as $$ select core.fn_aprobar_planilla(p_planilla_id, p_company_id); $$;
```

Desde `apps/rrhh`, la server action queda delgada — llama al RPC, no
reimplementa la lógica:

```ts
// apps/rrhh/src/app/(app)/nomina/actions.ts (contrato)
"use server";
export async function aprobarPlanilla(companyId: string, planillaId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("aprobar_planilla", {
    p_planilla_id: planillaId,
    p_company_id: companyId,
  });
  if (error) throw new Error(error.message);
  return data; // id del asiento generado, por si la UI quiere linkearlo
}
```

### 5.2 Por qué esto no rompe el aislamiento de módulos

`core.fn_aprobar_planilla` es la **única** pieza de código que conoce
ambos schemas — ni `apps/rrhh` ni `apps/contabilidad` se importan datos
entre sí directamente, ni el cliente de Contabilidad puede escribir en
`rrhh.planillas`. El acoplamiento vive en un solo punto, versionado como
cualquier otra migración, revisable en un solo diff — es el patrón
correcto para "atomicidad sin acoplar los módulos entre sí".

### 5.3 Salida de escape: cuándo sí hace falta un patrón *outbox*

Si algún día un módulo (ej. Contabilidad, por requisito de un ERP externo
tipo SAP) tuviera que vivir en su **propio** proyecto Supabase —
rompiendo la premisa de §1 solo para ese caso — la transacción atómica de
§5.1 deja de ser posible. La salida documentada, para no reinventarla bajo
presión ese día: `core.audit_log` (o una tabla `core.outbox` dedicada) se
llena en la misma transacción que sí es local (la de `rrhh`), y un
worker (Edge Function con retry) drena esa tabla hacia el proyecto
externo de forma idempotente (`origen_id` como clave de dedupe). Se
documenta como referencia — **no se construye hoy**, porque no hay ningún
módulo con ese requisito.

---

## 6. Playbook para agregar una nueva app

Consolida en un solo checklist lo que hoy vive disperso en
[MODULES.md](../MODULES.md), [PERMISSIONS.md](../PERMISSIONS.md) y
[DESIGN_SYSTEM.md](../DESIGN_SYSTEM.md) — usar este orden exacto, cada
paso depende del anterior.

### Paso Cero (ley, previa a los pasos 1-10 — sin excepción)

**Prohibido generar código de frontend o crear tablas de datos para una
app nueva (o un módulo nuevo dentro de una app existente) sin antes
haber diseñado, presentado y hecho aprobar explícitamente su Matriz de
Permisos y Roles** — la lista completa de códigos
`[app].[modulo].[recurso].[accion]` (nomenclatura estricta de 4
segmentos, sin excepción para código nuevo) y los roles de app que los
empaquetan (§3.2) — **e insertado esa matriz en el catálogo**
(`core.permissions_catalog`, `core.app_roles`, `core.app_role_permissions`)
antes de que exista una sola tabla de datos del módulo. Precedente real:
la matriz de RRHH (Expedientes/Asistencia/Planillas, 2026-09-02) se
diseñó, presentó como 2 tablas Markdown + 1 script SQL, se aprobó
explícitamente, y **recién entonces** se autorizó diseñar
`rrhh.empleados`/`rrhh.asistencia_marcas`/`rrhh.planillas` — nunca al
revés. Motivo: diseñar las tablas primero tienta a improvisar permisos
ad-hoc sobre la marcha (o a olvidar alguno) en vez de pensar el modelo de
autorización como una decisión completa de una sola vez; también evita
construir UI o RLS contra permisos que después cambian de nombre.

**Verificación Remota Obligatoria** — antes de escribir cualquier script
de `insert` hacia `core.permissions_catalog`/`core.app_roles` (sea para
una matriz nueva o una extensión), se consulta el estado real del
proyecto remoto (`core.apps`, `core.permissions_catalog`,
`core.app_roles` filtrados por el `module_slug` en cuestión — vía
`list_tables`/`execute_sql` del MCP de Supabase, o el equivalente en
`supabase db diff`/`psql` si no hay MCP disponible) para confirmar que el
`module_slug` ya existe en `core.apps` y no reinsertar códigos que ya
estén dados de alta. "Anclar a la realidad" antes de insertar, no asumir
el estado a partir de la documentación local — la documentación puede
estar desactualizada, el proyecto remoto no.

1. **`apps/<slug>/manifest.json`** — slug, nombre, categoría (tabla de
   tokens en DESIGN_SYSTEM.md), ícono Lucide, ruta (`/<slug>`), `depends`
   si aplica.
2. **Migración: registrar en `core.apps`** — un `insert` que dispara solo
   el trigger `trg_seed_module_permission` (crea `<slug>.ver_modulo`
   automáticamente, sin paso manual — ver PERMISSIONS.md).
3. **Migración: schema del módulo** — `create schema <slug>`, tablas
   (particionadas si aplica §2.1, con `company_id` e índices de §2.2
   desde la primera versión, nunca agregados después), RLS con la
   plantilla de §3.3.
4. **Migración: `permissions_catalog`** — un `insert` por cada acción real
   del módulo (`<slug>.<dominio>.<recurso>.<verbo>`), y opcionalmente
   `core.app_roles` + `core.app_role_permissions` si el módulo define
   roles empaquetados (§3.2) desde el día 1.
5. **Exponer el schema en la Data API** — Settings → API → Data API →
   Exposed schemas → agregar `<slug>` (paso manual hoy, sin herramienta
   MCP — mismo procedimiento ya documentado para `crm`).
6. **Vercel — proyecto independiente** — nuevo proyecto Vercel para
   `apps/<slug>`, variables de entorno: `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (solo en
   server, nunca `NEXT_PUBLIC_`), `NEXO_PANEL_URL` (override opcional).
7. **`apps/nexo/next.config.ts` — rewrite nuevo** — agregar el par
   `source`/`destination` para `/​<slug>` y `/​<slug>/:path*` apuntando al
   deploy real (mismo patrón que el rewrite de `/crm` ya existente) — y
   **`apps/<slug>/next.config.ts` — `basePath: "/<slug>"`** en el módulo
   mismo. Los dos tienen que coincidir en el prefijo o rompe en
   producción (bug real ya documentado en DESIGN_SYSTEM.md sobre
   `next/link` vs `<a>`).
8. **Checklist de UI** (ver DESIGN_SYSTEM.md actualizado): `@source` de
   Tailwind hacia `packages/ui`, `ShellBar`/`Sidebar` montados (nunca un
   header propio), tokens dark/glass de §4.1, `/dashboard` como raíz con
   KPIs reales, `next/link` para navegación interna, `BackToPanelLink`/
   `backHref` presente en toda pantalla autenticada.
9. **`@vercel/speed-insights` + `@vercel/analytics`** en `layout.tsx` —
   regla obligatoria ya vigente (ver CLAUDE.md raíz).
10. **Verificación en vivo** — entrar por el dominio público
    (`nexo.materialesjcastillo.com/<slug>`, nunca solo el
    `*.vercel.app` del módulo aislado) y confirmar: SSO real (sin sesión
    propia del módulo), permisos deniegan por defecto, dashboard con
    datos reales, rewrite resuelve — el mismo criterio de
    `<when_to_verify>` que ya aplica a cualquier cambio de UI.

---

## 7. Mejores prácticas de código y seguridad

### 7.1 Estructura de carpetas — confirmada, con lo que falta

Turborepo + pnpm ya es la decisión correcta y ya está construida
(`apps/*` un módulo por app, `packages/*` compartido) — no hay razón para
repos separados: un módulo nuevo necesita los mismos 5 paquetes
compartidos que los demás (`@nexo/ui`, `@nexo/permissions`,
`@nexo/supabase`, `@nexo/types`, `@nexo/auth`), y un repo separado
obligaría a versionarlos y publicarlos como si fueran de terceros — costo
que un equipo chico no debe pagar antes de tener un motivo real (ej. dar
acceso de contribución a un equipo externo a un solo módulo).

Lo que falta — 3 de los 5 paquetes compartidos son stubs hoy
(`packages/supabase/index.ts` es literalmente `export {}`,
`packages/auth`, `packages/config` casi vacíos) mientras cada
`apps/<módulo>` reimplementa su propio `lib/supabase/{client,server,middleware}.ts`
(ya son 4 copias potenciales — RRHH, Flotilla, CRM, y la próxima). Esto
es la próxima deuda a pagar, antes de que existan 6 copias divergentes:

```
packages/supabase/
  server.ts     -> createServerClient(schema?) — pooled 6543, cookies de next/headers
  client.ts     -> createBrowserClient() — para Client Components
  middleware.ts -> updateSession(request) — refresco + redirect a NEXO_PANEL_URL/login
  replica.ts    -> createReadReplicaClient(schema?) — host de replica, solo lectura (§2.4)
  database.types.ts -> tipos generados (supabase gen types typescript), uno por schema o unificado
```

Cada `apps/<módulo>/src/lib/supabase/*.ts` pasa a ser un re-export delgado
de `@nexo/supabase` con su schema por defecto — no una copia del código.

### 7.2 Reglas de TypeScript

- `strict: true` en el `tsconfig.json` base de `packages/config` (hoy no
  existe un `tsconfig.base.json` compartido — cada app define el suyo;
  unificarlo es parte de la misma deuda de §7.1).
- Tipos de base de datos **generados, nunca escritos a mano** —
  `supabase gen types typescript --schema core,rrhh,flotilla,crm,contabilidad`
  hacia `packages/supabase/database.types.ts`, importado por todos los
  módulos. Hoy `apps/crm/src/lib/supabase/database.types.ts` es local al
  CRM — se centraliza en el mismo movimiento de §7.1.
- Ningún `any` en el límite de una función que cruza el borde
  cliente/servidor (server actions, RPC) — el error de un `any` ahí no lo
  atrapa el compilador, lo atrapa un usuario en producción.

### 7.3 Inyección de dependencias de clientes Supabase (SSR vs CSR) y secretos

| Contexto | Cliente | Credencial | Dónde vive |
|---|---|---|---|
| Server Component / Server Action / Route Handler | `@nexo/supabase` `createServerClient()` (`@supabase/ssr`, cookies de `next/headers`) | `anon` key + sesión del usuario (RLS activo) | Env var `NEXT_PUBLIC_SUPABASE_ANON_KEY` — pública a propósito, RLS es la protección real |
| Client Component (interactividad pura, sin mutación sensible) | `@nexo/supabase` `createBrowserClient()` | `anon` key + sesión del usuario | Misma env var — nunca la `service_role` en el bundle del navegador |
| Función `security definer` que necesita bypassear RLS a propósito (ej. el trigger de §3.2, el wrapper de `has_permission`) | Rol de ejecución de Postgres, no un cliente HTTP | N/A — corre dentro de Postgres | La migración misma; nunca se llama `service_role` desde una app para "saltarse" RLS en vez de escribir la función correcta |
| Migraciones, seeds, jobs de mantenimiento | `service_role` key, conexión directa (§2.3) | `SUPABASE_SERVICE_ROLE_KEY` | Solo en secretos de CI/CLI local — **nunca** en las env vars de runtime de un proyecto Vercel de ninguna app |

Reglas duras:

- `SUPABASE_SERVICE_ROLE_KEY` jamás lleva prefijo `NEXT_PUBLIC_` — si
  algún día aparece un `NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY` en una
  búsqueda del repo, es un incidente de seguridad, no una variable de
  config.
- Secretos por entorno en Vercel: Production/Preview/Development
  separados — el `service_role` de `nexo-core` en Preview solo si hay un
  branch de Supabase de verdad (`create_branch`), nunca apuntando a
  producción desde un deploy de PR.
- Rotación: cualquier secreto que se pegó alguna vez en un chat, log, o
  captura de pantalla se rota, no se "confía en que nadie lo vio" —
  aplica en particular a `SUPABASE_SERVICE_ROLE_KEY` y `JWT_SECRET`
  (ambos ya listados en `turbo.json` como env vars de build, confirmar
  que ninguno tiene prefijo `NEXT_PUBLIC_`).

---

## Migraciones incluidas con este documento

Archivos nuevos en `supabase/migrations/`, **creados pero no aplicados**
al proyecto remoto — revisar y aplicar con `apply_migration` (MCP de
Supabase) o `supabase db push` cuando se confirme. Solo 2 archivos: la
función cross-schema de §5.1 (`core.fn_aprobar_planilla`) queda como
**plantilla dentro de este documento, no como migración** — depende de
`rrhh.planillas` y `contabilidad.asientos`, que no existen todavía
(Fases 2/6 del [ROADMAP](../ROADMAP.md)); aplicarla hoy fallaría contra
un proyecto real. Se adapta y se convierte en migración cuando esas dos
tablas existan.

| Migración | Contenido |
|---|---|
| `20260902000001_app_scoped_roles.sql` | §3.2 — `core.app_roles`, `core.app_role_permissions`, `core.user_app_roles`, `core.has_permission()` extendida (retrocompatible) |
| `20260902000002_partition_core_audit_log.sql` | §2.1 — convierte `core.audit_log` (vacía hoy) a particionada por mes + función `fn_asegurar_particion` + `pg_cron` (si la extensión está disponible en el plan) |

## Qué queda pendiente de decidir (no bloqueante para el MVP)

- Fecha de creación del proyecto Vercel de Contabilidad (Fase 2, ver
  [ROADMAP.md](../ROADMAP.md)) — este documento asume su schema y rutas
  pero el módulo no existe todavía en `apps/`.
- Umbral exacto (ms / filas) para disparar la creación de la primera Read
  Replica (§2.4) — se decide con datos reales de producción, no antes.
- Si `core.app_roles` predefine roles estándar (`admin`/`editor`/`viewer`)
  iguales en todos los módulos o cada módulo declara los suyos — el
  esquema de §3.2 soporta ambos, es una decisión de producto, no de
  arquitectura.
