# F1.0 — Auditoría real (2026-09-07)

> Parte del log detallado de [`IMPLEMENTATION_STATUS.md`](../IMPLEMENTATION_STATUS.md). Referenciada ahí como sección 0 (antes de la reestructuración de 2026-09-11 en la que este contenido se movió a su propio archivo).

Ejecutada íntegramente antes de tocar código/migraciones de F1.1 en adelante, tal como exige el Plan Maestro §21. Alcance: comparación explícita `Plan Maestro` vs `IMPLEMENTATION_STATUS` (esta misma versión, antes de editarla) vs `main` vs migraciones versionadas vs `nexo-core` remoto vs Vercel vs permisos/roles vs datos reales.

## 0.1 Hallazgo de proceso — `main` local estaba 13 commits atrás de `origin/main`

Antes de auditar nada de RRHH, se detectó que el checkout local de `main` apuntaba a `4ec848e` mientras `origin/main` ya tenía `fd381e7` (13 commits `docs:` adelante, sin ningún cambio de código — verificado con `git diff --stat` excluyendo `docs/**`/`CLAUDE.md`, resultado vacío). Esos 13 commits son exactamente los que introdujeron `PLAN_MAESTRO_IMPLEMENTACION_NEXO.md`, `IMPLEMENTATION_STATUS.md` (este archivo) y `DRIVER_ACCESS_AND_KIOSK.md`, además de reescribir `CLAUDE.md`, `RRHH_MVP.md`, `ARCHITECTURE.md`, `MODULES.md`, `ROADMAP.md` y `README.md`. Es decir: la documentación "vigente" que este mismo protocolo pide leer primero no estaba en el `main` local hasta este momento.

Causa: la sesión anterior había dejado una rama `feat/rrhh-jornadas-y-horas` con cambios sin commitear (consolidación de permisos v3.0 para el diseño de jornadas) ramificada desde el `main` viejo (`4ec848e`), y nunca se hizo `git pull`/`fetch` de `main` desde entonces.

Resolución aplicada, sin perder nada:

1. `git stash push -u` de los 5 archivos sin commitear en `feat/rrhh-jornadas-y-horas` (quedan en el stash, rama intacta, recuperables con `git stash pop` — no se tocó la carpeta `Grupo CT/`, ajena a este trabajo).
2. `git checkout main && git merge --ff-only origin/main` — fast-forward limpio (`main` local no tenía commits propios que `origin/main` no tuviera).
3. Rama nueva `docs/f1-0-auditoria-rrhh` desde el `main` ya actualizado, para los cambios de esta auditoría.

El trabajo de jornadas/evidencia fotográfica sigue intacto en el stash de `feat/rrhh-jornadas-y-horas`; no se descartó ni se fusionó con este `main`. Queda pendiente de una decisión aparte (ver sección "Decisiones de negocio pendientes" del reporte de esta sesión) porque ese diseño se escribió *antes* de que `PLAN_MAESTRO_IMPLEMENTACION_NEXO.md`/`DRIVER_ACCESS_AND_KIOSK.md` existieran y no fue revisado contra el modelo de contratos/PIN contractual que el Plan Maestro define ahora.

## 0.2 `main` vs código real en `apps/rrhh` y `apps/flotilla`

Sin divergencia de código detectada: `apps/rrhh` en `main` es exactamente el código ya auditado en la sesión de seguridad del 2026-09-05 (`fn_crear_empleado`, `fn_set_pin_empleado`, `fn_registrar_marca_kiosko`, `fn_validar_acceso_operativo`, proxy/middleware). `apps/flotilla` (Ruta360) sigue siendo una app autocontenida con su propio `app/login`, `app/driver`, `app/supadmin/login` y su propio `supabase/migrations` — no consume ni referencia `rrhh.fn_validar_acceso_operativo` ni ninguna tabla de `nexo-core` todavía. No aparece como proyecto en el Vercel de Nexo (`julio-s-projects7`); el único proyecto de Transporte ahí es `transporte-saas`, de otro repo. Confirma D-07: la adaptación de identidad de conductor es trabajo de Fase 4 aún no iniciado, sin código que lo contradiga hoy.

## 0.3 Migraciones — `main` vs remoto

`list_migrations` contra `nexo-core` (proyecto `yrbjlmiqhkyxtlcerowh`) devuelve 30 migraciones aplicadas, la última `20260905000005_rrhh_public_auth_hardening`. Coincide 1:1 con las migraciones versionadas en `supabase/migrations/` de `main`. Sin migraciones pendientes de aplicar ni aplicadas fuera de Git.

## 0.4 Datos reales en `nexo-core` (verificado 2026-09-07, vía `execute_sql`)

| Tabla | Filas |
|---|---|
| `rrhh.empleados` | 0 |
| `rrhh.empleado_compensacion` | 0 |
| `rrhh.asistencia_marcas` | 0 |
| `rrhh.seguridad_accesos` | 0 |
| `rrhh.planillas` | 0 |
| `rrhh.kiosko_dispositivos` | 1 (`Kiosko principal`, activo) |
| `core.companies` | 1 (`materiales-jcastillo`) |
| `core.company_memberships` | 1 |
| `core.permissions_catalog` | 45 (36 de `rrhh` + `rrhh.ver_modulo`) |
| `core.app_roles` (`module_slug='rrhh'`) | 5 |

**Consecuencia directa para F1.1–F1.3**: cero filas dependientes del diseño `nombre_usuario`/PIN-de-doble-propósito. La separación Expediente General/Laboral y el PIN contractual pueden implementarse mediante migraciones nuevas (columnas/tablas) sin backfill de datos reales de empleados — solo hay que decidir qué hacer con `rrhh.kiosko_dispositivos` (1 fila, no afectada por el refactor) y las 45 filas de `permissions_catalog`/5 `app_roles` ya seedeados (sin tocar, se extienden).

## 0.5 Roles RRHH reales — 5, no 4

`core.app_roles` filtrado por `module_slug='rrhh'` en remoto: `admin` (36 permisos), `supervisor_asistencia` (16), `especialista_planillas` (12), `gestor_expedientes` (9) y **`consulta`** (7) — un quinto rol de solo-lectura que no aparecía mencionado en el resumen de sesiones anteriores. Cualquier matriz nueva de permisos (contratos, credenciales) debe decidir explícitamente el alcance de `consulta`, no solo de los otros cuatro.

## 0.6 Hallazgo de seguridad — `public.validar_acceso_operativo` expuesto a `anon` en producción (CERRADO en F1.0.1)

`get_advisors(security)` sobre `nexo-core` (2026-09-07, durante F1.0) reportó, sin cambios desde la auditoría del 2026-09-05, que `public.validar_acceso_operativo(p_nombre_usuario, p_pin)` es `SECURITY DEFINER` y tenía `EXECUTE` concedido a `anon` **y** `authenticated` (confirmado también con `has_function_privilege` directo). Es la función que implementa el "PIN de doble propósito" que `DRIVER_ACCESS_AND_KIOSK.md` rechaza como arquitectura final (sección 10 de ese documento).

Verificado además: **ningún archivo de `apps/`/`packages/` llama a este RPC** — ni desde `apps/rrhh` ni desde `apps/flotilla` ni desde ningún otro módulo. Era infraestructura muerta a nivel de frontend, pero no a nivel de superficie de ataque: cualquiera podía llamar `POST /rest/v1/rpc/validar_acceso_operativo` sin sesión y sin ningún rate-limit por IP (el único freno era el bloqueo a 3 fallos consecutivos *dentro* de la función).

**Cerrado el mismo día en F1.0.1** ([ver entrada dedicada](2026-09-07-f1-0-1-cierre-pin-heredado.md), aprobado explícitamente por el usuario como hotfix inmediato, sin esperar a F1.3): `EXECUTE` revocado de `anon`/`authenticated` vía `20260907151106`. Ver esa entrada para el detalle y la verificación post-aplicación.

## 0.7 Vercel — `nexo-rrhh`

- Proyecto `nexo-rrhh` (`prj_6nP4PUDQZH5iq6Cp2t7ytxzrqerM`), equipo `julio-s-projects7`.
- Último deployment de producción: `dpl_23CzM4LQgVGwi7g7LTGj4itcfRFL`, commit `fd381e7` (el mismo HEAD real de `origin/main`), estado `READY`. Vercel ya había desplegado los 13 commits de documentación que el checkout local tenía atrasados.
- `get_runtime_errors` (ventana de 7 días, hasta 2026-09-07): sin errores nuevos. Los únicos 2 grupos de error registrados son del 2026-09-04 (`Falta NEXO_COMPANY_ID`, `No se pudo cargar el dashboard`), anteriores a los fixes de `a3bcc5d`/`ac9a487`/`4ec848e` ya documentados — no hay señal de regresión desde entonces.
- `/rrhh` y `/rrhh/kiosco` operativos según esta misma evidencia (sin errores runtime recientes en `/dashboard` ni otras rutas).
- No existe proyecto Vercel para `apps/flotilla` en este equipo — confirma que Transporte sigue sin desplegarse bajo Nexo.

## 0.8 Deuda general no bloqueante para RRHH (detectada de paso)

`get_advisors(performance)` reporta deuda pre-existente fuera del alcance de F1.0: `auth_rls_initplan` sin optimizar todavía en 3 policies de `core.company_memberships`, `core.user_app_roles` y `crm.clientes` (no en `rrhh` — las 25 policies de RRHH ya usan el patrón `(select auth.uid())` desde el 2026-09-05), más FKs sin índice de cobertura e índices sin uso (esperable con 0 filas). No se toca en esta sesión — es candidato a una migración de rendimiento aparte, sin relación con el refactor de contratos/PIN.

> Nota: esta subsección aparecía originalmente después de la 0.16 en el archivo monolítico (se agregó "de paso" en una sesión posterior), pero se agrupa aquí por pertenecer temáticamente a la auditoría F1.0.
