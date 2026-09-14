# Reconciliación funcional y visual — Marca, navegación, Expediente/Contratación (2026-09-14)

> Entrada del log detallado de [`IMPLEMENTATION_STATUS.md`](../IMPLEMENTATION_STATUS.md).
> Bloque pedido explícitamente por el usuario ("bloque completo de
> reconciliación funcional y visual de Nexo/RRHH antes de continuar con
> F1.5"), con instrucción explícita de **no iniciar F1.5** — ver sección
> "Confirmación" al final. No es una subfase del Plan Maestro — es una
> corrección de arquitectura de UI/navegación + un bug P0 de producción +
> una feature de edición pendiente, sobre decisiones vigentes ya
> aprobadas.

## Lectura previa

Antes de tocar código se leyeron, en orden: `CLAUDE.md`,
`docs/PLAN_MAESTRO_IMPLEMENTACION_NEXO.md`, `docs/RRHH_MVP.md`,
`docs/DESIGN_SYSTEM.md`, `docs/ARCHITECTURE.md`, `docs/MODULES.md`,
`docs/ROADMAP.md`, `docs/DATABASE.md`, `docs/PERMISSIONS.md`,
`docs/MIGRATION_LOG.md`, `docs/DRIVER_ACCESS_AND_KIOSK.md`. Se verificó
`main` local vs `origin/main` (al día, `29950fd`, la restructuración de
documentación de la sesión anterior ya estaba mergeada) y el estado de
Vercel de `nexocore`/`nexo-rrhh`/`nexo-crm` (los 3 en `READY` sobre ese
mismo commit, sin divergencia) antes de crear la rama
`fix/reconciliacion-rrhh-nav-marca`.

## P0 — bug real de producción: configuración de Marca

**Causa raíz confirmada con `get_runtime_errors` de Vercel antes de tocar
código** (no fue una hipótesis): `Error: Body exceeded 1 MB limit.`,
`statusCode 413`, ruta `/configuracion/marca`, 3 ocurrencias entre
2026-09-01 y 2026-09-08. Dos problemas reales:

1. El límite por defecto de Next.js para el body de un Server Action es
   1 MB — el formulario sube hasta 3 imágenes (logo/fondo/favicon) en un
   mismo Server Action; cualquier imagen de fondo real lo superaba.
2. Cuando esa invocación se rechazaba a nivel de transporte (antes de que
   `updateSettings()` llegara a ejecutarse), la promesa rechazada no
   estaba envuelta en try/catch en el cliente — React la propagaba como
   error no controlado hasta el error boundary global, tumbando toda la
   pantalla en vez de quedar contenida en el formulario. Este era el
   problema real detrás del síntoma: aunque se hubiera subido el límite
   de Next.js, cualquier otro fallo futuro habría tenido el mismo camino
   de crash.

Fix (commit `f7e2872`): `experimental.serverActions.bodySizeLimit` de
1 MB a 4 MB en `apps/nexo/next.config.ts` — el techo real no configurable
es el límite de payload de 4.5 MB de **Vercel Functions** (fijo a nivel
de infraestructura, no de Next.js); try/catch alrededor de la invocación
del Server Action en `marca-form.tsx` (la corrección real de "la pantalla
nunca debe caer completa por un fallo de upload", independiente de la
causa); validación de imagen (MIME + tamaño, máx. 1.25 MB por archivo —
dejando margen bajo el techo de 4.5 MB para el caso de subir los 3
archivos juntos) en cliente y servidor; botón "Cancelar" (no existía)
que descarta cambios locales sin escribir nada en backend; textos de
éxito/error exactos. Sin cambios de esquema/migraciones.

## P1 — navegación: App Launcher puro + logo en el sidebar

Commit `a5a7839`. `apps/nexo` en `/` dejó de ser el dashboard "Torre de
Control" (KPIs + saludo + actividad, 2026-09-07) — ahora es exclusivamente
un selector de aplicaciones (`PageHeader` "Aplicaciones" + grilla de
módulos habilitados por categoría, misma fuente real `get_visible_apps`).
`NEXO_NAV_ITEMS` (sidebar del propio panel) ya no lista RRHH/CRM/
Transporte/Fabricación — esos eran saltos a otra app, no navegación
interna de "la app Nexo" (decisión: el sidebar de cada app navega
únicamente dentro de esa app, sin excepción para Nexo mismo).

El logo (`core.platform_settings.logo_url`) se movió del topbar a la
cabecera de `NexoSidebar`, clickeable, `aria-label="Volver al inicio de
Nexo"` — en un módulo navega a `backHref` (cross-zone real, Multi-Zones);
en el propio panel, a `"/"`. El patrón de texto "← Volver a Nexo" se
eliminó por completo (el bloque inferior del sidebar y el atajo "←" del
modo colapsado) — el logo cumple esa función. `BackToPanelLink` (usado en
`sin-acceso` de RRHH/CRM, fuera del layout autenticado normal) se adaptó
al mismo patrón visual; CRM no pedía el logo en absoluto (solo copyright)
— se le agregó `getLogoUrl` a su `platform-settings.ts`, mismo patrón que
RRHH.

## P2 — separar Expediente (persona) de Contratación (relación laboral)

Commit `4acf321`. `/rrhh/expedientes/[id]` todavía tenía el ciclo
contractual completo embebido (`ContratosPanel`: contratos, compensación,
jornada, credencial/PIN, activar, finalizar, regenerar) — contradecía la
decisión vigente "Expediente = persona" / "Contratación = relación
laboral completa" como dominios **separados**, no un tab anidado.

- Expediente del empleado: se retira `ContratosPanel` y toda la sección
  "Expediente laboral" — junto con los 10 chequeos de permiso y las 4
  consultas (contratos/compensación/jornadas/credencial) que solo esa
  sección usaba. Queda exclusivamente el Expediente General: Datos
  personales (real) + 5 pestañas todavía sin modelo de datos, cada una
  con su `EmptyState` explícito de siempre.
- `expedientes/[id]/actions.ts` → `contratacion/contratos/actions.ts`
  (git detectó el rename): misma implementación de
  crear/editar/activar/finalizar/regenerar/asignarJornada/
  verEstadoCredencial — se **movió, no se duplicó**. `empleadoId` se
  retiró de las funciones que solo lo usaban para revalidar
  `/expedientes/[id]` (esa página ya no muestra nada contractual);
  sigue siendo obligatorio únicamente en `crearContrato` (dato de
  negocio real), que ahora devuelve `contratoId` para poder redirigir.
- `contratacion/contratos/[id]/contrato-ficha.tsx` pasa a ser dueña del
  ciclo **completo** (antes solo editaba datos base + jornada): se le
  agregan activar (genera PIN), regenerar PIN, finalizar y el estado de
  la credencial — mismos handlers/RPC que tenía `ContratosPanel`, cero
  lógica nueva.
- `contratacion/contratos/nuevo/` (ruta nueva): "+ Nuevo contrato" en el
  listado — busca/selecciona un empleado **existente** (no crea
  empleados, eso sigue siendo `/expedientes/nuevo`) y crea el contrato en
  borrador con los mismos campos de siempre; redirige a la ficha del
  contrato nuevo. Empleados con un contrato activo/borrador ya abierto
  quedan deshabilitados en el selector (mismo criterio que Expedientes
  usa para la papelera de "Eliminar").

Sin cambios de esquema/migraciones/permisos — solo reubicación de UI y
Server Actions ya existentes.

## P3 — edición real del Expediente General

Commits `fb877d4` (feature) + `4ef5589` (fix de build, ver "Error
encontrado" abajo). "Editar" y "Visualizar" en Expedientes llevaban al
mismo lugar desde 2026-09-08 (deuda documentada explícitamente en esa
entrada del log).

Migración nueva
([`20260914090000_rrhh_editar_empleado.sql`](../../supabase/migrations/20260914090000_rrhh_editar_empleado.sql)),
aplicada y verificada en `nexo-core`:

- `rrhh.fn_editar_empleado` + wrapper público `editar_empleado` — mismo
  patrón que `fn_crear_empleado`/`fn_eliminar_empleado`: `SECURITY
  DEFINER`, chequeo explícito de `rrhh.expedientes.empleados.editar`.
  **Ese permiso ya existía** desde
  `20260902000005_rrhh_permissions_and_roles` y la policy RLS de
  `UPDATE` sobre `rrhh.empleados` ya lo exigía desde el mismo día — Paso
  Cero no aplica (no hay permiso nuevo), solo faltaba el RPC. Valida
  nombre/apellido no vacíos y da un mensaje de dominio legible ante un
  `documento_identidad` duplicado en la misma empresa
  (`unique_violation`) en vez de propagar el error crudo de Postgres.
  Verificado post-aplicación con `has_function_privilege`:
  `editar_empleado` ejecutable por `authenticated`, no por `anon` — mismo
  patrón que sus pares.
- `expedientes/[id]/actions.ts` (recreado tras el rename de P2, ahora
  solo contiene `editarEmpleado`), `expedientes/[id]/editar/` (ruta
  nueva, formulario `[Cancelar] [Guardar cambios]`, idle → Guardando… →
  éxito/error, error deja el formulario abierto sin mutar), botón
  "Editar" en la ficha de solo lectura, ícono ✎ del listado apuntando a
  `/editar`.

### Error encontrado y corregido (build de Vercel)

El primer intento de push de P3 (`fb877d4`) **falló el build** de
`nexo-rrhh` en Vercel (`nexocore`/`nexo-crm` sí quedaron `READY` — no
dependen del código nuevo): `TS2345`, `apps/rrhh/src/lib/supabase/
database.types.ts` no tenía `editar_empleado` en la unión de nombres de
función permitidos para `supabase.rpc()` — el archivo de tipos generados
no se había actualizado tras la migración. Corregido (`4ef5589`)
agregando la entrada manualmente en el mismo formato que sus pares
(`crear_empleado`/`eliminar_empleado`) — **no** se regeneró el archivo
completo con el MCP de Supabase porque esa herramienta solo devuelve el
schema `public` (con `Tables` vacío); este archivo también tipa los
schemas `rrhh`/`core` que usa el resto de la app vía `.schema("rrhh")` —
una regeneración completa los habría borrado, rompiendo mucho más de lo
que arreglaba. Build re-verificado `READY` después del fix (ver
"Verificación real" abajo).

## P4 — documentación

Reconciliados: `CLAUDE.md` (sección `ShellBar` → `NexoShell`, Launcher
como selector no-dashboard, logo en sidebar, "Volver a Nexo" eliminado),
`docs/DESIGN_SYSTEM.md` (regla de Dashboard de KPIs con excepción
explícita para el Launcher, árbol de navegación de referencia
actualizado, sección de logo/`BackToPanelLink` reescrita), `docs/
RRHH_MVP.md` (§4.1/§4.2 — UI objetivo ya no anida Contratación dentro
del Expediente; addendum marcando resuelta la deuda de edición de
2026-09-08), `docs/MODULES.md` (fecha + fila de RRHH). `docs/
PLAN_MAESTRO_IMPLEMENTACION_NEXO.md`/`docs/plan/` no tenían contradicción
vigente (las reglas de dominio — Expediente ≠ Laboral — ya eran
correctas; lo que cambió fue solo la ubicación de la UI, no la regla) —
no se tocaron, según la propia norma de `CLAUDE.md` ("el índice casi
nunca cambia por sí solo"). `docs/README.md` tampoco — no se agregó,
renombró ni retiró ningún documento.

## Verificación real (Vercel)

Los 3 proyectos (`nexocore`, `nexo-rrhh`, `nexo-crm`) construyeron y
quedaron `READY` sobre la rama `fix/reconciliacion-rrhh-nav-marca` para
cada commit — con la única excepción documentada arriba (P3 falló una
vez, corregido y re-verificado). Esto fue verificación de **preview**,
no de producción — el cierre real en producción (merge a `main` +
deployments `target: production` `READY`) se documenta en "Cierre en
producción" más abajo.

## Verificación funcional — límite real de este bloque

**No se pudo ejecutar el recorrido autenticado completo pedido
explícitamente por el usuario** (login → Launcher → RRHH → Expedientes →
Editar → Guardar → Contratación → Nuevo contrato → activar → PIN →
regenerar → finalizar → click logo → Launcher; Marca → subir fondo →
guardar → recargar → cancelar) — mismo límite ya documentado en F1.3/
F1.4/F1.9: el proyecto remoto `nexo-core` no tiene credenciales de prueba
ni usuarios reales para operar la UI autenticada de punta a punta desde
este entorno, y crear una cuenta/datos de prueba nuevos no estaba
autorizado explícitamente para este bloque. Lo que sí se verificó:

- build/type-check reales de Next.js (Turbopack) en Vercel para cada
  commit, no solo lectura de código;
- el RPC nuevo aplicado y ejecutado indirectamente verificado
  (`has_function_privilege`) contra el rol correcto;
- `get_advisors(security)` post-migración: mismo set de hallazgos ya
  documentado (17 `rls_enabled_no_policy` INFO, funciones `SECURITY
  DEFINER` ejecutables por `authenticated`/`anon` — todas ya existentes
  y esperadas por diseño, `editar_empleado` sigue exactamente el mismo
  patrón que sus pares) — sin regresiones nuevas;
- revisión manual de cada archivo modificado (props/imports/tipos
  coherentes entre Server/Client Components, rutas de import relativas
  correctas tras el rename P2→P3, sin referencias colgantes a los
  archivos eliminados).

## Deuda / pendiente

- **Recorrido autenticado real en navegador** de Marca/Launcher/
  Expedientes→Editar/Contratación→Nuevo contrato→ciclo completo —
  **sigue sin ejecutarse**. Al cerrar este bloque en producción
  (2026-09-14, ver sección siguiente) se le ofreció explícitamente al
  usuario dar credenciales de prueba, hacerlo él mismo con una checklist,
  o cerrar el bloque documentando la limitación — eligió la tercera
  opción. No se simuló ningún resultado de estos pasos.
- El límite duro de 4.5 MB de Vercel Functions para `/configuracion/
  marca` sigue siendo una limitación real (no un bug) — una imagen de
  fondo de alta resolución sin comprimir puede seguir superando 1.25 MB;
  la solución definitiva (subida directa del navegador a Supabase
  Storage con signed URL, documentada como próximo paso en el comentario
  de `next.config.ts`) queda fuera de alcance de este bloque.

## Cierre en producción (2026-09-14, mismo día)

Pedido explícito del usuario: "Quiero cerrar y llevar a producción el
bloque ya revisado". Verificación previa al merge: `fix/reconciliacion-
rrhh-nav-marca` terminaba en `4cc8a6a` (igual en local y `origin`),
`main` estaba al día con `origin/main` (`29950fd`, sin commits nuevos
desde la creación de la rama), working tree limpio. `git diff --stat
main...fix/reconciliacion-rrhh-nav-marca` confirmado como exactamente
los 35 archivos de P0-P4 (una sola migración,
`20260914090000_rrhh_editar_empleado.sql`; sin tocar `apps/flotilla` ni
ningún archivo de asistencia/planillas/identidad digital/Mobile) — sin
divergencias inesperadas.

- **Merge**: `git merge --ff-only` — `main` avanzó de `29950fd` a
  `4cc8a6a` por fast-forward puro (no hubo commits nuevos en `main` que
  divergieran), conservando los 6 commits de P0-P4 + el fix de build
  intactos, sin squash. Push a `origin/main` confirmado.
- **Vercel producción**: los 3 proyectos confirmados `target: production`,
  `readyState: READY`, `githubCommitSha: 4cc8a6a...` — `nexocore` (sirve
  `nexo.materialesjcastillo.com`, confirmado en su lista de `alias`),
  `nexo-rrhh`, `nexo-crm`.
- **Smoke test**: sin credenciales de producción disponibles en este
  entorno — el usuario, consultado explícitamente, eligió cerrar el
  bloque documentando la limitación en vez de dar credenciales o
  hacerlo él mismo. Lo único verificado en producción real fue la parte
  no autenticada: `https://nexo.materialesjcastillo.com` redirige a
  `/login`, la página carga (`"Ingresar · Nexo"`, textos de Marca reales
  — `© Grupo CT 2026`, confirma que `get_platform_settings` responde en
  producción), sin errores de consola. Los pasos A-F completos (Launcher
  autenticado, sidebar/logo de RRHH, Marca guardar/cancelar, Expedientes
  ver/editar, Contratación ciclo completo) **no se ejecutaron** — no se
  simuló ningún resultado.
- **Runtime errors post-deploy** (`get_runtime_errors`, ventana 1h): 0 en
  los 3 proyectos.
- **Datos de prueba**: no se creó ninguno (no autorizado en este cierre).

## Confirmación explícita

**F1.5 (consolidación de asistencia) NO fue iniciado en este bloque** —
ningún archivo de `asistencia`/planillas/identidad digital/Mobile/
Transporte fue tocado; tampoco se creó ninguna regla de negocio nueva ni
se duplicó lógica existente; no se editó ninguna migración histórica
(todas las migraciones de este bloque son archivos nuevos).
