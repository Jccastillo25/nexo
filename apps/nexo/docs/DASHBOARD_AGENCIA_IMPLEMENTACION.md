# Dashboard de agencia digital — implementación (ticket 13, etapa 3)

Estado: IMPLEMENTADO, pendiente de revisión de Claude CLI y aprobación humana. Solo lectura, datos de ejemplo.
Base: `23ee9f2e1860f4168b4589264967ce84eebf9f71`. Ticket #13, etapa 3.

## 1. Evidencia real (verificada en este commit)

- Rutas existentes en `apps/nexo/src/app`: `layout.tsx` raíz, `page.tsx` (Launcher `/`), `login/page.tsx` y `LoginForm.tsx`, `ajustes/page.tsx`, `(app)/layout.tsx`, `(app)/configuracion/marca/{page,marca-form,actions}.tsx`. **No existía `/dashboard` ni `/sin-acceso` en Nexo antes de esta etapa.**
- `src/lib/nav.ts` alimenta `NEXO_NAV_ITEMS`, consumido por `(app)/layout.tsx`. El sidebar es de Nexo; saltar de app es del Launcher.
- **`packages/ui/src` y `packages/permissions/src` NO existen**: los paquetes son planos — `packages/ui/*.tsx` + `packages/ui/index.ts` y `packages/permissions/index.ts`. Ambos quedan **fuera** de la zona editable (solo lectura).
- `middleware.ts`: `PUBLIC_PATHS=["/login"]`, **solo autentica** (redirige a `/login` sin sesión). No autoriza.
- `hasPermission` → RPC `public.has_permission` con `auth.uid()`; **fail-closed** (false ante error o código no registrado). `requirePermission` lanza `PermissionDeniedError`.
- Migración (solo lectura) `20260830000001_core_schema.sql`: trigger `trg_seed_module_permission` crea `<slug>.ver_modulo` al registrar el módulo; existe `nexo.ver_modulo`. `20260902000001_app_scoped_roles.sql`: un `granted=false` explícito deniega incluso a owner/admin; el fallback de membresía owner/admin **no** es bypass total.
- `StatusBadge`/`StatusTone` reales: `neutral|positive|warning|negative|info` (no existe `success` ni `danger`). `NexoIcon` no tiene `"dashboard"`. Los candidatos iniciales se corrigieron a valores vigentes.

## 2. Archivos cambiados (8, dentro del límite)

1. `src/app/(app)/dashboard/page.tsx` — página Server Component.
2. `src/app/(app)/dashboard/labels.ts` — etiquetas español + tonos.
3. `src/app/(app)/dashboard/progress-bar.tsx` — barra HTML/CSS propia.
4. `src/app/(app)/dashboard/agent-card.tsx` — tarjeta de agente.
5. `src/app/(app)/dashboard/ticket-card.tsx` — tarjeta de ticket.
6. `src/app/sin-acceso/page.tsx` — patrón CRM/RRHH, fuera de `(app)`.
7. `src/lib/nav.ts` — entrada de navegación (edición).
8. `docs/DASHBOARD_AGENCIA_IMPLEMENTACION.md` — este documento.

Sin librerías nuevas, sin migraciones, sin integraciones operativas, sin archivos borrados. `(app)/layout.tsx` queda intacto.

## 3. Matriz de acceso

| Capa | Mecanismo | Estado |
| --- | --- | --- |
| Autenticación | middleware de sesión | vigente (protege `/dashboard` igual que el resto) |
| Autorización de ruta | guard de servidor `hasPermission` | implementado en la página |
| Código de permiso | `nexo.ver_modulo` (ya creado por trigger) | **usado, PENDIENTE de aprobación humana de su semántica** |
| Empresa | `getCompanyId()` por env | sin cambios |
| Datos mostrados | fixtures locales (`DEMO_DATASET`) | solo lectura, sin RPC de negocio |

Contrastado: un comentario histórico en `(app)/layout.tsx` afirma que "no hace falta un guard de permiso adicional". Es cierto para `/configuracion/marca`, pero **el middleware solo autentica**, así que `/dashboard` sí necesita su guard. Se registra como **documentación desactualizada** (igual que el alcance del grupo `(app)` descrito en `README`/docs, menor que el real).

## 4. Acceso denegado — decisión PENDIENTE

Lanzar `PermissionDeniedError` **no** renderiza una página de acceso denegado: no hay handler que la convierta. En esta etapa `/dashboard` **no redirige** a `/sin-acceso`; muestra un `EmptyState` "Sin acceso a este Dashboard" en línea y mantiene el shell con sesión. Se creó `apps/nexo/src/app/sin-acceso/page.tsx` (patrón CRM/RRHH, fuera de `(app)` para evitar bucles), pero su **uso desde el Dashboard y el paso de `<html>`/shell quedan pendientes de aprobación humana** — crear la página no equivale a autorizar la redirección.

## 5. Boceto responsivo (360 / 768 / 1440)

- Encabezado `PageHeader`; **sin** `BackToPanelLink` (Nexo ya es el panel).
- Aviso persistente de datos de ejemplo (`role="note"`), siempre visible.
- Métricas: 1 col (360) → 2 (`sm`, 768) → 4 (`lg`, 1440), con `MetricCard`.
- Agentes: 1 col → 2 (`md`); tickets y progreso: 1 col → 2 (`lg`).
- Todo contenedor usa `min-w-0`, `break-words` y `flex-wrap`; sin anchos fijos: sin desbordamiento horizontal esperado.

## 6. Validaciones ejecutadas y pendientes

Ejecutado (por el agente): inspección estática de solo lectura (rutas, `nav.ts`, `middleware.ts`, `company.ts`, `packages/ui/index.ts` y componentes reales, `packages/permissions/index.ts`, migraciones citadas); `tsc -p tsconfig.json` del panel; comprobación focalizada de `src/lib/agency/checks.ts` compilada a /tmp (importaciones relativas **sin** `.ts`, TS5097 evitado sin tocar `tsconfig`); contraste docs vs. código.

Verificado en la página: cada agente muestra estado y tickets; cada ticket muestra responsable, estado y avance por etapa; no hay acciones de crear/asignar/editar/ejecutar/cambiar estado; etiquetas textuales junto al color; aviso persistente; estados vacíos; textos en español; `aria-labelledby`/`role=progressbar`/`aria-valuenow` y foco visible en enlaces.

Pendiente (controlador independiente): acceso real con usuario sin permiso, caso negativo de ruta mal formada, colisión en runtime con rewrites, lint/build completos y capturas visuales a 360/768/1440.

Fuera de alcance: migraciones, permisos nuevos en catálogo, dependencias, integraciones operativas y cualquier sustitución del Launcher o de módulos ajenos.
