---
type: concept
updated: 2026-08-22
sources: [[2026-08-22-migraciones-0012-0013-split-admins-drivers]]
---

# Autenticación

Todo sobre Supabase Auth nativo (sin JWT propio), pero con tres mecanismos distintos según el
nivel — ver [[modelo-de-roles-y-aislamiento]].

## Usuario + contraseña (admins de empresa y Super Admin)

`supabase.auth.signInWithPassword`, estándar. El campo pedido es el correo.

## Usuario + PIN (solo conductores)

Los conductores **no tienen contraseña** — su cuenta de `auth.users` se crea sin `password`
(`admin.auth.admin.createUser({ email, email_confirm: true })`). El único camino de acceso es
usuario + PIN de 4 dígitos:

1. `POST /api/auth/pin` recibe `username` (no correo) + `pin`.
2. Resuelve el conductor por `drivers.username` (case-insensitive) con el cliente `service_role`.
3. Valida `pin_code`, genera un magic link (`admin.auth.admin.generateLink`).
4. El cliente canjea el magic link con `supabase.auth.verifyOtp({ token_hash, type: "magiclink" })`.

Así se evita firmar JWTs a mano: el PIN es solo la llave para obtener un magic link válido de
Supabase.

### Bug corregido — `verifyOtp` con `email`

`verifyOtp({ email, token_hash, type })` era rechazado por Supabase Auth
(`validation_failed: "Only the token_hash and type should be provided"`). Era la causa real
detrás del reporte del usuario de "no me deja ingresar" como conductor — un bug silencioso, no
un problema de PIN incorrecto. Corregido en `app/login/LoginForm.tsx` quitando `email` de la
llamada.

## Login de conductor: antes correo, ahora usuario

Antes de la migración `0012`, el login por PIN se resolvía por correo. Se cambió a
`drivers.username` (único en toda la plataforma, para poder resolver el login antes de conocer
la empresa) a pedido del usuario, junto con el resto del perfil de conductor ampliado.

## Super Admin

Solo usuario + contraseña, sin PIN — no lo pidió el negocio, y añadirlo sería sobre-ingeniería.
Login aislado en `/supadmin/login`, con su propia rama de gate en `proxy.ts`.

Una misma persona (correo) puede tener sesión como Super Admin **y** ser admin de una empresa —
son registros independientes en `platform_admins` y `admins`.

## Fuentes

- [[2026-08-22-migraciones-0012-0013-split-admins-drivers]]
