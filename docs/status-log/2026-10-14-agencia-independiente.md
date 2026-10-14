# Agencia digital — app independiente (ticket #18)

Estado: código separado y controles técnicos locales aprobados; Previews del primer candidato READY; correcciones de redirecciones hechas, revisión final de Claude pendiente. Merge, publicación de producción, activación del Launcher y pruebas manuales pendientes.

## Decisión y alcance

El usuario aprobó el 2026-10-14 el deploy propio y la matriz mínima de lectura. Se reutiliza la interfaz del ticket #13 y sus fixtures, con un aviso persistente de datos de ejemplo. No se conectan agentes, tickets reales ni integraciones operativas.

- App: `apps/agencia`; paquete `nexo-agencia`.
- Proyecto Vercel dedicado: `nexo-agencia`, ID `prj_Oo6DtnsjTq9Dv6aDd8l2BhYupzIZ`, Root Directory `apps/agencia`.
- Zona: `/agencia`, que redirige a `/agencia/dashboard`.
- Nexo aporta el Launcher y los rewrites; el módulo usa `basePath: "/agencia"`.
- `/dashboard` antiguo de Nexo se convierte en una redirección de compatibilidad.
- Las tarjetas del Launcher usan navegación completa con `<a>` entre zonas; la navegación interna del módulo sigue con `next/link`.
- El Dashboard se retira del sidebar de Nexo porque pertenece a otra app.

## Paso Cero aprobado y aplicado

Migración `20261014181353_agencia_dashboard_access.sql` aplicada en `nexo-core`. El archivo se creó mediante Supabase CLI y se renombró al prefijo de versión realmente registrado por el MCP, conservando el SQL.

| Permiso | Autoridad |
| --- | --- |
| `agencia.ver_modulo` | Visibilidad del módulo; generado por el trigger vigente |
| `agencia.dashboard.resumen.ver` | Consulta del Dashboard; cuatro segmentos |

Rol de app `consulta`: ambos permisos. Owner/admin: fallback actual, sujeto al deny explícito. Sin sesión: login central. Sin permiso de módulo: `/agencia/sin-acceso`. Sin permiso de consulta: estado sin acceso, sin datos del Dashboard.

Verificado en remoto tras la migración: app inactiva, 2 permisos, 1 rol, 2 concesiones al rol, 0 usuarios asignados y 0 empresas habilitadas. No se copiaron concesiones de Nexo ni se crearon tablas o funciones de negocio. Se conserva el motor compartido, incluido el orden deny explícito → rol → fallback. Las comprobaciones de permisos de la ruta siguen el patrón del CRM; la activación comercial por empresa controla la visibilidad en el Launcher.

## Entorno

En el proyecto nuevo están configuradas, separadamente de Nexo:
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXO_COMPANY_ID` y `NEXO_PANEL_URL`, para Preview y Production. El proyecto usa `nexo-core`; no hay `service_role` en Agencia.

Nexo necesita `AGENCIA_APP_URL` con el origen del destino, sin `/agencia` al final. Esta variable también se incluye en el allowlist de `turbo.json`. No se genera un rewrite cuando falta el destino; configurar el valor de Production es una precondición del merge, porque el enlace antiguo se redirige a la nueva zona.

`NEXO_PANEL_URL` puede apuntar al Preview de Nexo al probar las dos zonas juntas; el login siempre vive en Nexo. Un acceso aislado al `*.vercel.app` del módulo no comparte las cookies del dominio público. No usar el dominio del módulo como ruta del catálogo.

## Controles ejecutados

- Instalación pnpm 9.15.9 con lockfile congelado: OK. Se añadió únicamente el importer de Agencia, conservando versiones y resoluciones existentes.
- Lint, `next typegen`, `tsc --noEmit --incremental false` y build en Agencia: OK.
- Lint, typegen, tipos y build en Nexo: OK.
- `pnpm --filter nexo-agencia test:access`: 12 casos OK sobre la página real y el wrapper compartido, con RPC y primitivas visuales sustituidas. Cubre ambos permisos concedidos, módulo denegado, consulta denegada, ambos denegados y error de RPC. Incluye además error individual de cada RPC, dato nulo, layout autorizado/denegado y dos pruebas de redirección que usan el formateador real de Next para comprobar el basePath. No usa cuentas ni red.
- Los cuatro archivos de `lib/agency` y las cuatro piezas visuales migradas mantienen su contenido. La página cambia permisos y añade un mensaje cuando un ticket no tiene etapas.
- Advisors de seguridad antes/después: las mismas 4 categorías y 38 hallazgos preexistentes (ignorando únicamente observed_at), sin tablas, políticas ni funciones nuevas.

Estos controles no equivalen a pruebas de navegador ni a pruebas contra cuentas reales.

## Build inicial de Vercel

Al crear el proyecto, Vercel generó automáticamente el primer build del candidato como Production (dpl_HBuNCkreyjiesJAG3A7hYVSpuaVZ), protegido y sin conexión desde Nexo. Se crearon también Previews explícitos de ambas zonas. El dominio público Nexo, su variable de Production y el catálogo activo no se cambiaron. El primer build no constituye una revisión manual ni autorización de merge. Antes de conectar la app, publicar el candidato corregido y revisado.

## Activación coordinada — pendiente de aprobación humana

1. Completar revisión técnica de Claude y confirmar Previews READY de la app nueva y de Nexo.
2. Obtener aprobación humana del PR y de su publicación.
3. Publicar primero el commit revisado de Agencia en su proyecto de Production y comprobar READY; todavía no habilitarla en el Launcher.
4. Configurar `AGENCIA_APP_URL` de Production de `nexocore` con el destino estable de Agencia y fusionar el PR. Confirmar el deploy Nexo READY antes de habilitar la tarjeta.
5. Preparar y aplicar una migración de activación acotada a la empresa configurada de Nexo, verificada en remoto como `materiales-jcastillo`: `core.apps.active = true` y `core.company_apps.enabled = true`. No habilitar otras empresas ni asignar roles de usuarios. El acceso de respaldo para owner/admin de esa empresa es intencional y fue aprobado en la matriz.
6. El usuario verifica visualización en móvil/tablet/escritorio, navegación, login, cuentas con/sin permiso y cierre de sesión en el dominio compartido; registra resultados en GitHub.

No fusionar ni aplicar la activación automáticamente. Antes de los pasos 3–5, `/dashboard` de producción mantiene el código anterior porque este PR no está fusionado.

## Pruebas manuales pendientes

- Icono y tarjeta en Aplicaciones; apertura de `/agencia/dashboard`.
- Diseño 360/768/1440 y uso de teclado.
- Usuario autorizado, sin sesión y usuario sin permiso.
- Denegación explícita sobre rol/owner-admin.
- Regresión de Launcher, login, Marca y acceso a CRM/RRHH.
- Cierre de sesión y regreso a Nexo sin un login propio del módulo.
- Estados vacíos.

El ticket #13 sigue abierto para sus pruebas manuales. Este ticket no inicia el proyecto integral de usuarios/roles/permisos ni certifica pruebas que no se ejecutaron.

## Merge en `feat/usuarios-roles-nexo` (mismo día)

Por pedido del usuario ("mover agencia al dashboard principal"), esta rama se
trajo por merge a `feat/usuarios-roles-nexo`, para probar y fusionar todo
junto. Conflictos resueltos: `apps/nexo/src/lib/nav.ts` (se quita "Dashboard"
y se conserva el grupo Configuración) y `docs/IMPLEMENTATION_STATUS.md`; se
repuso `import Link` en el Launcher (lo usa la tarjeta "Configuración"; las
tarjetas de apps siguen con `<a>` entre zonas). Controles tras el merge:
`pnpm install --frozen-lockfile` sin cambios, lint + build de `nexo-panel` y
`nexo-agencia` OK, `test:access` 12/12 OK.

Con el modelo de roles de empresa (`20261014203144`), el rol de app
`consulta` queda como plantilla; acceso = owner (con la app activa y
habilitada) o un rol de empresa que incluya "Agencia digital".

Entorno pendiente (verificado 2026-10-14, solo lectura) — **cambios de Vercel,
requieren aprobación**:

| Proyecto | Variable | Entorno | Valor previsto |
| --- | --- | --- | --- |
| `nexocore` | `AGENCIA_APP_URL` | Preview, rama `feat/usuarios-roles-nexo` | `https://nexo-agencia-git-feat-usuarios-roles-nexo-julio-s-projects7.vercel.app` |
| `nexo-agencia` | `NEXO_PANEL_URL` | Preview, rama `feat/usuarios-roles-nexo` | `https://nexocore-git-feat-usuarios-roles-nexo-julio-s-projects7.vercel.app` |
| `nexocore` | `AGENCIA_APP_URL` | Production (antes del merge a `main`) | dominio de Production de `nexo-agencia` |

Hoy `AGENCIA_APP_URL` solo existe para la rama `feat/issue-18-…` y `nexo-agencia`
no tiene deploy de Production del código revisado.

**Actualización (mismo día, aprobado por el usuario):** creadas las dos
variables de Preview de la tabla (rama `feat/usuarios-roles-nexo`) en
`nexocore` y `nexo-agencia`. La de Production y la activación en la base de
datos quedan para el merge a `main`, por decisión del usuario.

## SQL de activación propuesto — NO ejecutado

Aplicar únicamente después del deploy coordinado y aprobación humana. Consultar de nuevo el estado remoto antes de generar la migración con Supabase CLI.

Revisado 2026-10-14 tras el merge: el borrador original usaba `$` en vez de
`$$` como delimitador del bloque `do` (no ejecutaba); corregido abajo. Estado
remoto re-verificado ese día: `agencia` con `active = false`, 0 empresas
habilitadas, 2 permisos; `NEXO_COMPANY_ID` = `materiales-jcastillo`.

```sql
begin;
do $$
declare n integer;
begin
  update core.apps set active = true where slug = 'agencia';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'Debe existir exactamente una app Agencia'; end if;
  insert into core.company_apps (company_id, app_id, enabled)
  select c.id, a.id, true
  from core.companies c
  join core.apps a on a.slug = 'agencia'
  where c.slug = 'materiales-jcastillo'
  on conflict (company_id, app_id) do update set enabled = true;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'Debe habilitarse exactamente la empresa de Nexo'; end if;
end;
$$;
commit;
```
