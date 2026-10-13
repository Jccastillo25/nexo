# Propuesta de integración visual del Dashboard de agencia digital (ticket 13, etapa 1)

Estado: PROPUESTA. No implementada. Requiere aprobación humana de ruta, audiencia y navegación.
Commit de referencia: 4b81a00891ccc46d875baa3a971b289097b2715e. Solo lectura sobre migraciones.

## 1. Evidencia inspeccionada (verificado en este commit)

Inventario real de apps/nexo/src/app (search_files, 8 .tsx): `layout.tsx` raíz, `page.tsx` (Launcher "/"), `login/page.tsx`, `login/LoginForm.tsx`, `ajustes/page.tsx`, `(app)/layout.tsx`, `(app)/configuracion/marca/page.tsx` y `marca-form.tsx`.

No existe `/dashboard` en apps/nexo. `apps/crm/src/app/(app)/dashboard/page.tsx` sí existe: `/crm/dashboard` es del CRM. `apps/nexo/next.config.ts` (líneas 40-59) solo declara rewrites de `/crm` y `/rrhh`; no hay rewrite de `/dashboard`.

`src/lib/nav.ts`: solo `Inicio` (`/`) y `Configuración` (`/configuracion/marca`), usados por `(app)/layout.tsx`, que hoy envuelve únicamente `/configuracion/marca`. El Launcher `/` salió del grupo `(app)`.

`src/lib/supabase/middleware.ts`: verifica solo sesión (`PUBLIC_PATHS = ["/login"]`); autenticación, no autorización.

`packages/permissions/index.ts`: `hasPermission` llama la RPC `public.has_permission({p_company_id, p_code})` con `auth.uid()` de sesión y es fail-closed (false ante error de RPC o código no registrado). `requirePermission` lanza `PermissionDeniedError`.

Acceso denegado verificado: `apps/crm/src/app/sin-acceso/page.tsx` y `apps/rrhh/src/app/sin-acceso/page.tsx`; el guard vive en `(app)/layout.tsx` y hace `redirect("/sin-acceso")`. La página está fuera del grupo protegido para evitar el bucle. `EmptyState` es presentación y no autoriza.

Migraciones (solo lectura):
- `20260830000001_core_schema.sql` (líneas 138-163): trigger `trg_seed_module_permission` inserta `<slug>.ver_modulo` en `core.permissions_catalog` al registrar un módulo.
- `20260830000002_core_seed_apps.sql`: registra `nexo` (route `/`), `rrhh`, `flotilla`, `crm`; por el trigger, `nexo.ver_modulo` queda creado.
- `20260902000001_app_scoped_roles.sql` (65-93): `core.has_permission` evalúa 1) código no registrado → false; 2) fila explícita en `core.user_permissions` (un `granted=false` deniega incluso a owner/admin); 3) rol de app (`user_app_roles` + `app_role_permissions`) → true; 4) fallback membresía owner/admin. No es un bypass total. Esas tablas no tienen policy de escritura para `authenticated`: asignar exige `service_role` y proceso administrativo autorizado sujeto a RLS.

`packages/ui/index.ts` exporta, entre otros: `NexoShell`, `NexoSidebar`, `NexoTopbar`, `BackToPanelLink`, `Breadcrumb`, `PageHeader`, `DashboardHero`, `MetricCard`, `ActivityFeed`, `QuickActions`, `DataTable`, `FilterBar`, `StatusBadge`, `FormSection`, `EmptyState`.

`src/lib/company.ts`: `getCompanyId()` devuelve `NEXO_COMPANY_ID` (env); no deriva la empresa de la sesión. Pertenecer a una empresa no equivale a owner/admin.

## 2. Hallazgos verificados vs supuestos

Verificado: rutas y layouts listados; exports de `@nexo/ui`; ausencia de `/dashboard`; contenido de `nav.ts`; fail-closed de `hasPermission`; orden de evaluación de `core.has_permission`; patrón `sin-acceso`; `getCompanyId` por env.
Supuesto (no comprobado): estado real de `nexo-core` en producción (concesiones/denegaciones existentes de `nexo.ver_modulo`). El repo no prueba el estado de datos desplegado. La adecuación semántica de reutilizar `nexo.ver_modulo` para el Dashboard queda pendiente de aprobación humana.

## 3. Ruta (decisión humana pendiente)

- Opción A (recomendada a discusión): `/dashboard` bajo `apps/nexo/src/app/(app)/dashboard/`. No colisiona con rutas de Nexo ni con ningún rewrite de `next.config.ts`.
- Opción B: `/agencia` o anidar bajo un prefijo propio; evita futura discusión con `/crm/dashboard`, pero alarga el href y no aporta protección.
Ambas deben convivir con el Launcher `/` y no alterar rewrites Multi-Zones ni módulos ajenos.

## 4. Navegación (decisión humana pendiente)

Añadir una entrada a `NEXO_NAV_ITEMS` en `src/lib/nav.ts` apuntando a la ruta elegida. Añadir una entrada no modifica el catálogo de permisos; ocultarla en el sidebar no protege la ruta. No se propone sidebar global con las apps: la decisión vigente es que el sidebar navega dentro de la app y el salto entre apps es del Launcher.

## 5. Matriz de acceso (requiere decisión humana)

| Capa | Mecanismo existente | Decisión pendiente |
| --- | --- | --- |
| Autenticación | middleware de sesión | vigente en toda la app |
| Autorización de ruta | guard de servidor con `hasPermission` | qué código se exige |
| Código de permiso | `nexo.ver_modulo` (ya creado) o uno nuevo | elegir; código nuevo exige resolver alcance antes de implementar |
| Empresa | `getCompanyId()` por env | confirmar que no se deriva de la sesión |
| Membresía | `core.company_memberships` (fallback owner/admin) | confirmar si se exige membresía explícita |
| Datos | `user_permissions` / `user_app_roles` | no son cambios de catálogo ni esquema; exigen proceso administrativo autorizado |

Reutilizar `nexo.ver_modulo` con concesiones/denegaciones es técnicamente posible con datos; su significado (permiso del panel vs. del Dashboard) queda pendiente de aprobación humana. Si se exige código nuevo → detener hasta resolver alcance. Sin cambios de catálogo ni esquema en esta etapa.

## 6. Archivos previstos (no creados en esta etapa)

1. `apps/nexo/src/app/(app)/dashboard/page.tsx` — página con datos de ejemplo.
2. Guard de servidor en el layout del Dashboard o dentro de la página, con `redirect("/sin-acceso")`.
3. `apps/nexo/src/app/sin-acceso/page.tsx` — patrón CRM/RRHH, fuera del grupo protegido.
4. `apps/nexo/src/lib/nav.ts` — entrada de navegación (edición).
5. Componentes de sección bajo `apps/nexo/src/app/(app)/dashboard/`.
6. `apps/nexo/src/app/(app)/layout.tsx` sin cambios: no se impone guard global sin aprobación (afectaría a `/configuracion/marca`).

## 7. Boceto de secciones y diseño responsivo

- Encabezado con `PageHeader`; sin `BackToPanelLink` (Nexo ya es el panel).
- Métricas: 3-4 `MetricCard` (agentes activos, en ejecución, tickets abiertos, etapas completadas); 1 columna en móvil, 2 en `sm`, 4 en `lg`.
- Agentes de IA: `DataTable` o tarjetas con `StatusBadge`; en móvil, tarjetas apiladas.
- Estado actual: actividad breve con `ActivityFeed`.
- Tickets asignados: `DataTable` con `StatusBadge`; las columnas concretas quedan pendientes de aprobación, ya que disponer de `DataTable` no aprueba ninguna columna.
- Progreso por etapa: barras simples o lista por etapa, sin librería nueva.
- Vacíos con `EmptyState` (solo presentación). Datos de ejemplo marcados como tales. `NexoShell` aporta sidebar/topbar y responsive del shell.

## 8. Validaciones y límites

Ejecutado (inspección estática de solo lectura): inventario de rutas `.tsx` de apps/nexo; lectura de `nav.ts`, `company.ts`, `middleware.ts`, `next.config.ts`, layouts de Nexo y CRM, `sin-acceso` de CRM, `packages/permissions/index.ts`, `packages/ui/index.ts` y las migraciones citadas. Contraste: el comentario de `(app)/layout.tsx` de Nexo afirma que "no hace falta un guard de permiso adicional"; el código del CRM muestra que el middleware solo autentica, por lo que ese comentario no cubre una ruta nueva con audiencia restringida. Documentación de navegación/`README` describe un alcance del grupo `(app)` mayor que el real (hoy solo `/configuracion/marca`): se registra como documentación desactualizada.

Pendiente (no ejecutado): pruebas de acceso real con usuario sin permiso; caso negativo de ruta mal formada; colisión en runtime con rewrites; lint/typecheck/build completos. Los hará el controlador independiente.

Fuera de alcance: migraciones, permisos nuevos en catálogo, dependencias nuevas, integraciones operativas y cualquier sustitución del Launcher o de módulos ajenos.
