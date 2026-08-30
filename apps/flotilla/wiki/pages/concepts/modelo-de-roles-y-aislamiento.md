---
type: concept
updated: 2026-08-22
sources: [[2026-08-22-baseline-migraciones-0001-0011]], [[2026-08-22-migraciones-0012-0013-split-admins-drivers]]
---

# Modelo de roles y aislamiento

El sistema tiene tres niveles de acceso, **cada uno en su propia tabla de identidad**, que nunca
se mezclan entre sí: [[platform|`platform_admins`]] (Super Admin), [[admins|`admins`]] (admin de
empresa), [[drivers|`drivers`]] (conductor).

## Por qué tablas separadas y no un enum `role`

Cada nivel tiene datos y necesidades de acceso genuinamente distintos: un Super Admin no
pertenece a ninguna empresa; un conductor necesita usuario/PIN/licencia, un admin no; un admin
puede auto-gestionar su fila, un conductor no debería poder auto-editarse el rol. Guardarlos en
una tabla compartida con una columna discriminadora habría exigido replicar esa separación a
mano en cada policy RLS, con el riesgo de que un bug la rompiera silenciosamente.

Con tablas separadas, un usuario de una tabla **no puede existir físicamente** como fila de
otra — el aislamiento es estructural, no solo una condición de RLS.

`platform_admins` se diseñó así desde el principio (migración `0008`). `admins`/`drivers` se
separaron después, en la migración `0012`, reemplazando una tabla única `users` con columna
`role` — a pedido explícito del usuario: *"estos deben de ser completamente independientes y
ninguno mezclarse con el otro ya que estan dirigidos a paneles diferentes"*. Efecto colateral
positivo: bajo el diseño viejo, un conductor podía auto-editar su propia fila (incluido, en
teoría, su rol) vía RLS; `drivers` ya no tiene policy de auto-`UPDATE`.

## Resolución de identidad

Dos funciones `SECURITY DEFINER` (`auth_company_id()`, `auth_role()`) son la única fuente de
verdad para "a qué empresa pertenece este usuario y con qué rol" — usadas en *todas* las
policies. Prueban primero `admins`, luego `drivers` (una fila de `auth.users` solo puede existir
en una de las dos). Exigen `companies.is_active = true`: desactivar una empresa corta el acceso
de todos sus usuarios sin tocar policies una por una.

## Cupos independientes

`companies.max_users` (administradores) y `companies.max_drivers` (conductores) se cuentan y
limitan por separado (`lib/company-quota.ts`) — antes de la migración `0013` era un único cupo
combinado. A pedido del usuario: *"Usuarios son todos los administradores etc y drivers son
independiente, deben de tener conteos y limites diferentes"*.

## Login

Cada nivel tiene su propio flujo — ver [[autenticacion]].

## Fuentes

- [[2026-08-22-baseline-migraciones-0001-0011]]
- [[2026-08-22-migraciones-0012-0013-split-admins-drivers]]
