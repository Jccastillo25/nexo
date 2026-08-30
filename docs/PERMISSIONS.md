# Norma de permisos v3.0

Extiende la norma de permisos v2.0 de Gestor360 (memoria del usuario:
`feedback_permissions_standard.md`) a toda la suite Nexo.

## Principio (sin cambios respecto a v2.0)

**DENY BY DEFAULT.** Todo permiso arranca en `FALSE`. Los owners/admins
tienen acceso total solo si no hay registro explícito en
`core.user_permissions`. Toda acción de UI (botón, checkbox, toggle) y toda
server action debe verificar el permiso correspondiente antes de ejecutar.

## Qué cambia en v3.0

- Los permisos ya no viven en una tabla por producto — viven en
  `core.user_permissions`, con una columna `module_id → core.apps` que
  liga cada permiso a un módulo concreto.
- Se agrega un **7º dominio: "Módulos"** — controla qué apps ve cada
  usuario en la grilla del panel (`nexo.materialesjcastillo.com/`). El
  panel nunca hardcodea qué mostrar: siempre lee `core.company_apps` +
  `core.user_permissions`.
- `core.company_apps` resuelve el caso multi-tenant: una empresa cliente de
  Flotilla no debe ver RRHH (que es interno de Grupo CT), aunque un usuario
  tenga el permiso técnico.

## Dominios (heredados de v2.0 + el nuevo)

1. Centro de Control
2. Talento
3. Turnos
4. Asistencia
5. Nómina
6. Sistema
7. **Módulos** *(nuevo en v3.0)*

## Checklist para registrar un permiso nuevo

- [ ] Migración SQL en `supabase/migrations/` que inserta la fila en
      `core.user_permissions` (deny por default)
- [ ] Entrada en el manifest del módulo si aplica a nivel de app completa
- [ ] Verificación en la UI (botón/checkbox oculto o deshabilitado sin el permiso)
- [ ] Verificación en la server action correspondiente
- [ ] Actualizar `PermissionsMatrix` / el equivalente en `packages/permissions`
