---
type: source
date: 2026-08-22
kind: migration
ref: ../../supabase/migrations/0012_split_users_into_admins_and_drivers.sql
---

# Migraciones 0012–0013 — separación admins/drivers, perfil de conductor ampliado

Pedido explícito del usuario: *"Existe los usuarios administrativos del sistema y conductores.
estos deben de ser completamente independientes y ninguno mezclarse con el otro ya que estan
dirigidos a paneles diferentes"*. Y después, sobre cupos: *"Usuarios son todos los
administradores etc y drivers son independiente, deben de tener conteos y limites diferentes"*.

## Qué cambió (0012)

- `public.users` (una tabla, columna `role`) → **`admins`** y **`drivers`**, tablas físicamente
  independientes. Una fila de `auth.users` solo puede existir en una de las dos, nunca en
  ambas — el aislamiento es estructural, no una condición de RLS.
- `trips.driver_id` pasa a referenciar `drivers` (antes `users`).
- `auth_company_id()` / `auth_role()` reescritas: prueban primero `admins`, luego `drivers`.
- **`drivers` no tiene policy de auto-`UPDATE`** — antes, con la tabla `users` compartida, un
  conductor podía en teoría auto-editar su propia fila (incluido su rol) vía RLS. Ese vector se
  cerró como efecto colateral positivo del rediseño.
- Perfil de conductor ampliado: `first_name`/`last_name`/`full_name`, `username` (único en toda
  la plataforma, para poder resolver el login antes de conocer la empresa), `pin_code`
  (autogenerado, único por empresa), `national_id`, `license_number`, `license_type`,
  `license_expiry`. Nuevas tablas `license_categories` (catálogo por empresa) y
  `driver_license_categories` (asignación M:N).
- Login de conductor cambia de **correo + PIN** a **usuario + PIN** — el conductor no tiene
  contraseña (`auth.users` se crea sin `password`).

## Qué cambió (0013)

- `companies.max_drivers` (nullable, independiente de `max_users`) — antes existía un único
  cupo combinado.

## Bug encontrado y corregido en esta misma sesión (no es de la migración, es de código)

`supabase.auth.verifyOtp({ email, token_hash, type })` era rechazado por Supabase Auth
(`validation_failed: "Only the token_hash and type should be provided"`). Corregido en
`app/login/LoginForm.tsx` quitando `email` de la llamada. Era la causa real detrás del reporte
original del usuario de "no me deja ingresar" como conductor.

## Páginas que actualiza

- [[modelo-de-roles-y-aislamiento]]
- [[autenticacion]]
- [[admins]]
- [[drivers]]
- [[fleet]] (categorías de licencia)
- [[roadmap]]
