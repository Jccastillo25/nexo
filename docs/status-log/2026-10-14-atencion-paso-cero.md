# 2026-10-14 — Paso Cero del módulo Atención (turnos de sala de espera)

## Contexto

Sistema de turnos definido por el usuario en una conversación con ChatGPT
(recepción con nombre/teléfono/factura, puestos que llaman, pantalla pública
con entretenimiento) + decisiones de esta sesión. Diseño completo:
[`plan/13-atencion-turnos.md`](../plan/13-atencion-turnos.md).

Decisiones del usuario: numeración que se reinicia cada día; "Iniciar
atención" asigna recepción o el primer puesto libre según el rol; "Cerrar
atención" libera el puesto; cierre automático a medianoche; varias
sucursales (preparado desde el inicio); cualquier agente puede llamar fuera
de orden; sucursales asignadas a cada usuario desde Configuración → Usuarios.
Nombre `atencion` para no confundir con `rrhh.asistencia.turnos` (horarios).

## Estado anterior → estado nuevo

- Sin módulo → **app `atencion` registrada inactiva + matriz de permisos y
  plantillas en el catálogo**. Tablas, RPC y pantallas: sin implementar.

## Verificación previa (solo lectura)

- Sin `atencion`/`turnos` en `core.apps`, sin permisos, sin tablas de sucursales.
- Base de datos en UTC → día local y medianoche con `America/Managua`.
- `pg_cron` disponible, no instalado.

## Prueba en transacción revertida

Registro, trigger de `ver_modulo`, 15 + 2 permisos, plantillas 6/8/15;
owner sin acceso a Atención (app inactiva) y con `sucursales.ver`. Verificado
después que no quedó nada persistido.

## Migración

`20261014222454_atencion_paso_cero` (aprobada explícitamente, aplicada con
`apply_migration`). Postcheck en [MIGRATION_LOG](../MIGRATION_LOG.md).

## Siguiente

1. Migración de tablas (plan 13 §4): `core.sucursales`,
   `core.usuario_sucursales`, `atencion.puestos`, `atencion.sesiones`,
   `atencion.contadores`, `atencion.turnos`, `atencion.turno_eventos`,
   `atencion.pantallas` + RPC + instalación de `pg_cron` — aprobación aparte.
2. Pantallas: sucursales en Configuración, sucursales en el usuario, app
   `apps/atencion` (proyecto Vercel nuevo, zona `/atencion`), pantalla pública.

## Commit

Rama `feat/atencion-paso-cero` (sin push).
