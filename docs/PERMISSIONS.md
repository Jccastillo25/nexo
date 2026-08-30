# Norma de permisos v3.0 — guía obligatoria

Extiende la norma de permisos v2.0 de Gestor360 a toda la suite Nexo, para
el escenario de **un solo usuario para todos los módulos**. Esta guía se
repite, literal, en el `CLAUDE.md` raíz del repo — por eso se dispara sola
cada vez que se trabaja en este monorepo con Claude Code, sin depender de
que alguien se acuerde de leer este documento primero.

## Principio (sin cambios respecto a v2.0)

**DENY BY DEFAULT.** Todo permiso arranca en `FALSE`/inexistente. Un
usuario `owner`/`admin` tiene acceso total **solo si no hay fila explícita**
en `core.user_permissions` para ese código de permiso.

## Lo que cambia en v3.0 (y por qué)

Con un solo usuario para Gestor360, Ruta360 y el CRM, un permiso ambiguo o
mal registrado en un módulo ya no es un bug aislado — es una fuga entre
productos distintos. Por eso v3.0 agrega una regla que v2.0 no tenía:

> **Un `permission_code` que no existe en `core.permissions_catalog` se
> trata como INVÁLIDO, no como "sin definir".** Toda la lógica de la norma
> vive en una sola función SQL, `core.has_permission()` (ver
> [`supabase/migrations/20260830000001_core_schema.sql`](../supabase/migrations/20260830000001_core_schema.sql)),
> y deniega en ese caso — para todos, incluidos owners/admins. Las apps la
> llaman vía RPC (`public.has_permission`) desde
> [`packages/permissions/index.ts`](../packages/permissions/index.ts); las
> políticas de RLS la llaman directo. **Una sola fuente de verdad**, no una
> copia en SQL y otra en TypeScript que se puedan desincronizar.

Consecuencia práctica: si alguien escribe una función nueva y llama a
`requirePermission(ctx, "flotilla.viajes.cancelar")` pero nadie insertó ese
código en `permissions_catalog`, **la función no funciona para nadie** —
falla cerrada, en vez de quedar abierta por accidente. Esto reemplaza la
dependencia de que un humano se acuerde de "agregar el checkbox al
matrix de permisos".

## Qué se dispara SOLO (automático, a nivel de base de datos)

Al insertar una fila en `core.apps` (registrar un módulo nuevo), un
trigger de Postgres (`trg_seed_module_permission`, ver
[`supabase/migrations/20260830000001_core_schema.sql`](../supabase/migrations/20260830000001_core_schema.sql))
crea automáticamente el permiso `<slug>.ver_modulo` en
`core.permissions_catalog`. **Nadie tiene que acordarse de esto** — se
verificó en vivo el 2026-08-30: los 4 módulos actuales generaron sus 4
permisos de visibilidad solos, sin ningún INSERT manual a
`permissions_catalog`.

Esto cubre la creación de **módulos**. La creación de **funciones/acciones
dentro de un módulo ya existente** no puede detectarse desde la base de
datos sola (es código de aplicación) — para eso está el checklist de abajo
y la regla en `CLAUDE.md`.

## Checklist obligatorio al crear una función/acción/página nueva

Se aplica a: server actions, route handlers, botones/checkboxes/toggles
nuevos en cualquier `apps/<módulo>`.

1. **Define el código de permiso** siguiendo la convención
   `<modulo>.<dominio>.<recurso>.<verbo>`, ej.
   `rrhh.talento.empleados.crear`, `flotilla.viajes.cancelar`.
2. **Regístralo en `permissions_catalog`** con una migración nueva en
   `supabase/migrations/`:
   ```sql
   insert into core.permissions_catalog (code, module_slug, domain, label, description)
   values ('flotilla.viajes.cancelar', 'flotilla', 'viajes', 'Cancelar viajes', '...');
   ```
3. **Envuelve la función** con el helper de `packages/permissions` antes de
   cualquier otra lógica:
   ```ts
   import { requirePermission } from "@nexo/permissions";

   export async function cancelarViaje(supabase: SupabaseClient, companyId: string, viajeId: string) {
     await requirePermission({ supabase, companyId }, "flotilla.viajes.cancelar");
     // ... el resto de la funcion
   }
   ```
   `requirePermission` llama a `public.has_permission` (RPC) — el `user_id`
   sale de la sesión autenticada del lado del servidor, nunca de un
   parámetro que el llamador pueda falsear.
4. **Oculta/deshabilita en la UI** el botón/checkbox correspondiente cuando
   `hasPermission(...)` devuelva `false` — la verificación de servidor de
   arriba es la que de verdad protege, esto es solo UX.
5. Si el permiso debe verse en el panel de administración de permisos,
   agrégalo también a `packages/permissions` (matriz visual) — pendiente de
   construir en la Fase 4.

Si falta el paso 2, el paso 3 deniega solo (ver sección anterior) — el
checklist existe para que la función funcione, no solo para "cumplir la
norma".

## Dominios

Ya no son un enum fijo de 6-7 valores compartido por toda la suite (como en
v2.0, pensado solo para RRHH). En v3.0, `domain` es un texto libre **scoped
por módulo** en `permissions_catalog.module_slug` — cada módulo define sus
propios dominios según su negocio:

| Módulo | Dominios (heredados/propuestos) |
|---|---|
| RRHH | Centro de Control, Talento, Turnos, Asistencia, Nómina, Sistema *(los 6 de v2.0, sin cambios)* |
| Flotilla | Viajes, Conductores, Flota, Reportes |
| CRM | Clientes, Oportunidades |
| Todos (incluye `nexo`) | `acceso` — dominio reservado para el permiso `<slug>.ver_modulo` que crea el trigger |

## Dos capas de enforcement, no solo una

1. **RLS en la base de datos** (la capa fuerte): cualquier tabla de un
   módulo que use `core.has_permission()` en sus policies queda protegida
   aunque alguien se salte por completo el código de la app (una query
   directa, un bug en la server action, etc.). Ejemplo real en
   `crm.clientes` (ver [`supabase/migrations/20260830000003_crm_schema.sql`](../supabase/migrations/20260830000003_crm_schema.sql)).
2. **`requirePermission()` en la server action** (la capa de UX): permite
   devolver un mensaje de error entendible en vez de que la query falle con
   un error crudo de Postgres. No es la que de verdad protege los datos —
   eso lo hace la policy de RLS — pero sin ella el usuario ve un error feo
   en vez de "No tienes permiso para esto".

`core.has_permission()` necesita saber el **rol** del usuario en la empresa
para el bypass owner/admin — eso vive en `core.company_memberships`
(`user_id`, `company_id`, `role`), una tabla que no estaba en el diseño
original de la Fase 2 y se agregó al implementar la Fase 3 porque
`hasPermission()` no tenía de dónde sacar el rol sin ella.

## Multi-tenant: `core.company_apps`

Un permiso técnico concedido (`granted = true`) no basta para ver un
módulo si la empresa del usuario no lo tiene contratado. El panel siempre
cruza `core.company_apps` (¿la empresa tiene el módulo activo?) **y**
`core.user_permissions` (¿el usuario tiene `<slug>.ver_modulo` concedido?)
— las dos condiciones, no una sola.
