# 2026-10-17 — Revisión de seguridad (diagnóstico, sin cambios de producto)

**Pedido del usuario:** revisión de seguridad de Nexo como coordinador. Solo
diagnóstico y propuesta: sin tocar código de producto, sin commit/push, sin
cambiar de rama (`feat/launcher-iconos`, con trabajo sin commit que saldrá
en un único despliegue) y sin aplicar migraciones.

**Estado anterior → nuevo:** sin revisión de seguridad registrada →
diagnóstico hecho; ninguna corrección aplicada.

## Qué se hizo

| Paso | Resultado |
|---|---|
| Skill `nexo-security` (encargo a `skills-specialist`) | Ver "Skill" abajo. El agente `reviewer` la carga recién en una **sesión nueva**. |
| Skill `security-review` sobre los cambios pendientes | **Falló al arrancar**: su plantilla ejecuta `git status` y `git` no está en el PATH de esta PC (usa el de GitHub Desktop). Se aplicó su método a mano sobre el mismo diff (`git diff -- apps packages CLAUDE.md`, 17 archivos, +362/−160, más los archivos nuevos). |
| Remoto `nexo-core` (`yrbjlmiqhkyxtlcerowh`) | `get_advisors(security)` + consultas SQL de solo lectura (RLS, policies, `search_path` de funciones `security definer`, `USAGE`/`CREATE` por schema, `EXECUTE` de `anon`, cuerpo de las funciones expuestas, `schema_migrations`). Sin migraciones ni escrituras. |

## Hallazgos

Gravedad: crítica / alta / media / baja. Ninguno crítico.

### H1 — ALTA — El remoto va por delante del repo: 6 migraciones RRHH aplicadas que no están en esta rama ni en `main`, y rompen la firma que el kiosco usa

- **Objeto:** `supabase_migrations.schema_migrations` tiene `20261017131004_p1_pin_ambiguo_fallo_cerrado`, `20261017131040_rrhh_p2_pin_unico_empresa`, `20261017131113_rrhh_p3_marca_contrato`, `20261017131132_rrhh_p4a_kiosko_solicitudes`, `20261017131202_rrhh_p4b_marca_atomica_idempotente`, `20261017131221_rrhh_p6_consultar_marcas`. No existe ningún `supabase/migrations/202610171*` en esta rama.
- **Evidencia:** `public.registrar_marca_kiosko` y `rrhh.fn_registrar_marca_kiosko` existen **solo** con la firma `(p_pin text, p_kiosko_id uuid, p_solicitud_id uuid, p_confirmar_salida boolean)`, sin valores por defecto y con retorno `jsonb`. El código de esta rama llama a la versión vieja: [`apps/rrhh/src/app/kiosco/actions.ts:90`](../../apps/rrhh/src/app/kiosco/actions.ts) pasa solo `p_pin` y `p_kiosko_id` y lee `data?.[0]` como fila. PostgREST no va a encontrar esa función: toda marca termina en "PIN incorrecto o kiosko inactivo.". Además el dashboard (sección 0/7) todavía dice "P1 sin aplicar a `nexo-core`" y "P2 no iniciado". Las migraciones parecen venir de la rama `codex/rrhh-piloto-mvp` (worktree `.rrhh-piloto-worktree`, commit `0511cd7`).
- **Recomendación:** antes del despliegue de `feat/launcher-iconos`, llevar a `main` las migraciones y el código del kiosco de `codex/rrhh-piloto-mvp`. No desplegar RRHH desde una rama sin ese código. No es una vulnerabilidad de confidencialidad: el kiosco **falla cerrado**, no registra marcas. Pero deja el sistema de asistencia caído y `main` no reproduce la base.
- **Aclaración posterior (misma sesión):** la aplicación **sí está documentada y fue aprobada por el usuario**, aunque solo en la rama: `docs/status-log/2026-10-17-rrhh-p1-p6-aplicadas.md` en `codex/rrhh-piloto-mvp` (`0511cd7`). Ahí constan los prechecks (0 marcas, 0 contratos activos), los postchecks y que el kiosco de `main` "falla cerrado desde P4b; se resuelve fusionando el PR #47". Las migraciones están en esa rama con los nombres remotos: P1 renombrada desde `20261015181000`, sin tocar su SQL. El PR [#47](https://github.com/Jccastillo25/nexo/pull/47) está abierto, sin borrador, `MERGEABLE` contra `main` y con los cinco checks obligatorios en verde. Lo único que faltaba era fusionarlo.
- **Resuelto (2026-10-17):** el PR #47 se fusionó en `main` (`6619646`) por pedido del usuario, y `main` se integró en `feat/launcher-iconos` en local. Choques resueltos: en `apps/rrhh/src/lib/nav.ts` Marcas queda con `href: "/marcas"` e icono `list`; en `IMPLEMENTATION_STATUS.md` se conservaron las filas de las dos ramas y la sección 7 quedó actualizada.

### H2 — MEDIA — `error.message` y textos internos de la base llegan a la UI fuera de lo que corrige el diff

- **Ubicación (muestras, no exhaustivo):** `apps/productos/src/app/(app)/catalogo/actions.ts:38,53`, `clasificacion/actions.ts:36`, `importar/actions.ts:40,53`, `catalogo/page.tsx:100`, `dashboard/page.tsx:40`; `apps/crm/src/app/(app)/clientes/actions.ts:94,131,166`; `apps/atencion/src/app/(app)/reportes/page.tsx:52`, `metricas/page.tsx:52`; `apps/nexo/src/app/page.tsx:98`; en RRHH, unas 40 Server Actions devuelven `{ message: error.message }` (`jornadas/actions.ts`, `contratacion/contratos/actions.ts`, `expedientes/[id]/*-actions.ts`, …) y `documentos-panel.tsx:92-93` muestra `uploadError.message`.
- **Evidencia:** las RPC de RRHH lanzan `'Permiso denegado: rrhh.expedientes.empleados.editar'` (sqlstate P0001), lo que expone el código interno del permiso. Además, cualquier error de Postgres/PostgREST (nombre de constraint, `invalid input syntax for type uuid`, "permission denied for schema …") se muestra tal cual. Los `throw new Error(\`…${error.message}\`)` de los Server Components son menos graves: en producción Next.js solo envía un `digest` al cliente.
- **Recomendación:** aplicar en todos los módulos el patrón que el diff ya introduce en [`productos/configuracion/actions.ts:37-46`](../../apps/productos/src/app/(app)/configuracion/actions.ts): pasar a la UI solo los mensajes propios de la RPC, mapear `42501` y el resto a un texto genérico y registrar el detalle con `console.error`. En RRHH, cambiar `raise exception 'Permiso denegado: <código>'` por `errcode = '42501'` con un mensaje sin el código, o filtrar en la acción.

### H3 — BAJA — 35 funciones `security definer` con `search_path` distinto de `''`

- **Objeto:** `core.fn_seed_module_permission()` (`search_path=core`). Los envoltorios `public.*` de RRHH y core (`activar_contrato`, `crear_empleado`, `has_permission`, `get_visible_apps`, `get_platform_settings`, `update_platform_settings`, …) usan `rrhh, public` o `core, public`. Los `rrhh.fn_*` usan `rrhh, core, extensions, pg_temp` o `rrhh, public`. Las funciones de Productos y Atención sí usan `''`.
- **Evidencia / mitigación verificada:** ni `anon` ni `authenticated` tienen `CREATE` en `public`, `core`, `rrhh`, `crm`, `productos`, `atencion` ni `extensions`, y `pg_temp` va explícito al final. **Hoy no hay forma de explotarlo**, pero no cumple la norma.
- **Recomendación:** cuando se toque cada función, pasarla a `set search_path = ''` con nombres calificados. No vale la pena una migración solo para esto.

### H4 — BAJA — `anon` puede ejecutar `update_platform_settings`, que además usa un código de permiso de 3 segmentos

- **Objeto:** `public.update_platform_settings(...)`, `security definer`, con `EXECUTE` para `anon`.
- **Evidencia:** con `anon`, `auth.uid()` es nulo, `v_company_id` queda nulo y la función lanza "No autorizado", así que **hoy no se puede explotar**. Toma la empresa con `select company_id … limit 1`, lo que es ambiguo si un usuario pertenece a varias, y valida `'nexo.configuracion.editar'` (3 segmentos, anterior a la norma v3.0). Acepta cualquier URL en `logo_url`, `login_background_url` y `favicon_url`.
- **Recomendación:** `revoke execute … from anon`, recibir `p_company_id` explícito y validar que las URL sean `https:` (o del bucket propio).

### H5 — BAJA — Kiosco anónimo: el `kiosko_id` es el único secreto del dispositivo y el PIN tiene 4 dígitos

- **Objeto:** `public.registrar_marca_kiosko` (`EXECUTE` para `anon`, por diseño).
- **Evidencia:** el límite de intentos vive en la base (`rrhh.kiosko_rate_limits`: 8 fallos por minuto y luego 5 minutos de bloqueo, **por kiosko**) y la app agrega otro en memoria (`actions.ts:84`). El `kiosko_id` sale de `NEXO_KIOSKO_ID` en el servidor y no viaja al navegador. Pero quien conozca ese UUID puede llamar directamente a `/rest/v1/rpc/registrar_marca_kiosko` con la anon key, que es pública: el límite de la app no aplica y cada intento acierta si coincide con el PIN de *cualquier* contrato activo (probabilidad N/10 000 por intento). Con eso podría registrar marcas falsas o bloquear el kiosco a propósito.
- **Recomendación:** al cerrar el piloto (P7 de [RRHH_PILOTO_MVP_OPERATIVO.md](../RRHH_PILOTO_MVP_OPERATIVO.md)), agregar un secreto de dispositivo con hash en `rrhh.kiosko_dispositivos` que viaje solo desde el servidor, o quitar `EXECUTE` a `anon` y llamar con una credencial de servidor. Tratar `NEXO_KIOSKO_ID` como secreto.

### H6 — BAJA — Protección contra contraseñas filtradas desactivada en Supabase Auth

- **Objeto:** advisor `auth_leaked_password_protection` (WARN).
- **Recomendación:** activarla en el dashboard de Supabase (Auth → Password security; requiere plan Pro). Es un cambio de configuración externa y lo decide el usuario.

### H7 — BAJA — Worktree `.rrhh-piloto-worktree/` dentro del repo, sin ignorar y con `.env.local`

- **Evidencia:** `git status` lo muestra como `??`. `git worktree list` confirma que es el worktree de `codex/rrhh-piloto-mvp`. Contiene `apps/nexo/.env.local` y `apps/rrhh/.env.local`. Un `git add -A` antes del despliegue único lo agregaría como repositorio embebido. Los `.env.local` no se suben (git agrega solo el enlace), pero ensucia el commit.
- **Recomendación:** moverlo fuera de la carpeta del repo o agregar `/.rrhh-piloto-worktree/` a `.gitignore`. Al hacer el commit, agregar los archivos con rutas explícitas.

### H8 — BAJA — El Launcher pone `core.apps.route` en `<a href>` sin validarlo

- **Ubicación:** [`apps/nexo/src/app/page.tsx:240`](../../apps/nexo/src/app/page.tsx) (diff pendiente; el `<a href={app.route}>` ya existía antes).
- **Evidencia:** el valor viene de la base (`get_visible_apps`) y solo un administrador puede escribirlo. React 19 bloquea `javascript:` en `href`, pero un `https://otro-dominio` rompería la regla de SSO.
- **Recomendación:** renderizar solo si `route` empieza con `/` y no con `//`, o agregar un `check` en `core.apps.route`.

### H9 — BAJA — En el proxy del panel, las rutas públicas se comparan por prefijo

- **Ubicación:** [`apps/nexo/src/lib/supabase/middleware.ts:39`](../../apps/nexo/src/lib/supabase/middleware.ts). `PUBLIC_PATHS.some((p) => path.startsWith(p))` con `PUBLIC_PATHS = ["/login"]` deja sin sesión cualquier ruta que empiece por `/login` (por ejemplo, una futura `/login-admin` o `/loginx`). Lo detectó `skills-specialist`; el coordinador lo confirmó en el código.
- **Evidencia:** hoy no hay otra ruta con ese prefijo en `apps/nexo`, así que no se puede explotar.
- **Recomendación:** comparar `path === p || path.startsWith(\`${p}/\`)`.

## Lo que está bien (verificado)

- **RLS:** ninguna tabla de los schemas de aplicación (`core`, `rrhh`, `crm`, `productos`, `atencion`, `public`) tiene RLS desactivado. Las 60 tablas con RLS y sin policies (`core.*`, `productos.*`, `atencion.*`, `rrhh.contrato_credenciales`, `rrhh.kiosko_*`, `rrhh.seguridad_accesos`), sumadas a los schemas `core`, `productos` y `atencion` **sin `USAGE` para `authenticated`**, forman un diseño de denegación por defecto: solo se accede por RPC `security definer`. `crm` y `rrhh` sí tienen `USAGE` y sus grants.
- **Permisos en RPC:** las 69 funciones `security definer` que `authenticated` puede ejecutar validan el permiso. Las de `public.admin_*`, `atencion_*` y `productos_*` lo hacen ellas mismas; los envoltorios `public.*` de RRHH delegan en `rrhh.fn_*`, que llaman a `core.has_permission(auth.uid(), …)` antes de actuar. `rrhh.fn_*` no es ejecutable directamente por `anon` ni por `authenticated`.
- **`anon`:** solo 4 funciones `security definer` le son ejecutables: `get_platform_settings` (pantalla de login), `atencion_pantalla_estado` (TV sin login, decisión del 2026-10-15; el UUID de la pantalla actúa como credencial y no muestra el cliente, el agente ni la factura salvo que se configure), `registrar_marca_kiosko` (H5) y `update_platform_settings` (H4).
- **SSO:** el login de `apps/nexo` valida `next` contra redirecciones abiertas (`destinoSeguro`, [`login/actions.ts:9-11`](../../apps/nexo/src/app/login/actions.ts)) y da un error genérico. `apps/crm/src/app/login/page.tsx` ya solo redirige. `apps/flotilla` conserva su login propio: es deuda conocida hasta que se adapte en su fase.
- **Secretos:** `SUPABASE_SERVICE_ROLE_KEY` aparece solo en `apps/rrhh/src/lib/supabase/admin.ts` y `apps/flotilla/lib/supabase/admin.ts` (servidor). No hay secretos con `NEXT_PUBLIC_`; la key publicada en `.env.local.example` es la publishable (`sb_publishable_…`), que es pública por diseño. Ningún `.env` está versionado.
- **Diff pendiente (`feat/launcher-iconos`):** es casi todo UI (menús, iconos, sidebar, Toast, Launcher). En seguridad **mejora** la situación (Productos deja de mostrar `error.message` en 3 lugares) y no introduce problemas nuevos. Mostrar los P0001 de `productos_guardar_catalogo` es aceptable: se revisaron sus `raise exception` en `20261016214634_productos_esquema.sql` y son mensajes para el usuario en español. `guardarCatalogo` mantiene `requirePermission` antes de la RPC, y el menú sigue ocultando los ítems por permiso. Ocultar el ítem no protege la ruta: las páginas siguen validando en el servidor.

## Skill `nexo-security`

La creó `skills-specialist` en `.claude/skills/nexo-security/`: `SKILL.md`, `consultas-remotas.md` (5 consultas SQL de solo lectura + advisors) y `SOURCE.md`. Su procedencia quedó en `.claude/skills/README.md`. Es una adaptación sin texto copiado, basada en `anthropics/claude-code-security-review` (MIT), `supabase/agent-skills` `supabase-postgres-best-practices` v1.1.1 (MIT), la guía "Data Security" de Next.js (MIT) y hechos técnicos de las docs de Supabase. Cubre las 7 áreas pedidas y distingue dos patrones de schema que existen en el repo:

- **A, expuesto con GRANT y RLS:** `crm`, `rrhh`.
- **B, privado y solo por RPC:** `productos`, `atencion`, `core`. Este patrón produce a propósito los avisos `rls_enabled_no_policy` y `authenticated_security_definer_function_executable`.

El coordinador comprobó con `git status` que el especialista solo escribió dentro de `.claude/skills/` y agregó `nexo-security` a `skills:` de [`.claude/agents/reviewer.md`](../../.claude/agents/reviewer.md). **El agente la carga recién en una sesión nueva.** No se evaluó la skill sobre un diff real.

Sobre gravedad: la skill clasifica la fuga de `error.message` *pre-existente* como Baja. En H2 se mantiene Media porque el problema está en unas 50 acciones y expone códigos de permiso y nombres internos.

## No se pudo comprobar

- La skill `security-review` incorporada no corrió (git fuera del PATH). Se hizo la revisión manual equivalente.
- Variables de entorno reales de los proyectos de Vercel (si alguno tiene un secreto con `NEXT_PUBLIC_` o le falta `NEXO_KIOSKO_ID`): no se consultó el MCP de Vercel.
- El estado real del kiosco en producción (H1): no se probó en navegador ni se revisaron los logs de Vercel. Que falla se deduce de la firma remota y del código de `main`.
- `apps/flotilla` y `apps/web-corporativo` (otro Supabase): fuera del alcance remoto de esta revisión.
- Pruebas activas (llamadas reales con `anon` a PostgREST): no se hicieron. Todo es lectura de catálogo y definiciones.

## Pruebas ejecutadas

Ninguna prueba automatizada: no hubo cambios de código. Solo consultas SQL de lectura en `nexo-core` y lectura del diff y del código.

## Deuda / próximos pasos propuestos

1. H1: decidir con el usuario cómo integrar `codex/rrhh-piloto-mvp` antes del despliegue.
2. H2: barrido de mensajes de error por módulo (Productos → RRHH → CRM → Atención → Nexo).
3. H4/H5/H6: una migración pequeña de endurecimiento (`revoke … from anon` en `update_platform_settings`) y el secreto de dispositivo del kiosco dentro del piloto; activar la protección de contraseñas filtradas.
4. H3/H8: corregirlos cuando se toquen esos archivos y funciones.
