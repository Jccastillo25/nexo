# 2026-10-14 — Módulo Atención: esquema, RPC y pg_cron

## Contexto

Segundo paso del módulo Atención (turnos de sala de espera) tras el
[Paso Cero](2026-10-14-atencion-paso-cero.md). Diseño:
[`plan/13-atencion-turnos.md`](../plan/13-atencion-turnos.md) §4. SQL revisado
y aprobado explícitamente por el usuario (incluida la instalación de `pg_cron`).

## Estado anterior → estado nuevo

- Sin tablas → **base de datos completa del módulo + sucursales**, app aún
  **inactiva** (nadie la ve). Pantallas: sin implementar.

## Migración

`20261014224341_atencion_esquema` (archivo creado como `20261015000000_…` y
renombrado a la versión remota sin tocar el SQL):

- `core.sucursales` (zona horaria por sucursal, por defecto `America/Managua`)
  y `core.usuario_sucursales`.
- Schema `atencion` **sin `USAGE` para `authenticated`/`anon`** (excepción
  deliberada a la regla de `GRANT` de `CLAUDE.md`: todo el acceso es por RPC,
  como `core`): `puestos`, `pantallas`, `contadores`, `sesiones_activas`;
  particionadas por mes: `sesiones`, `turnos`, `turno_eventos` (registradas en
  `core.tablas_particionadas`).
- 19 RPC: `admin_listar_sucursales`, `admin_guardar_sucursal`,
  `admin_sucursales_de_usuario`, `admin_asignar_sucursales`,
  `atencion_listar_puestos`, `atencion_guardar_puesto`,
  `atencion_listar_pantallas`, `atencion_guardar_pantalla`,
  `atencion_mi_estado`, `atencion_iniciar`, `atencion_cerrar`,
  `atencion_liberar`, `atencion_crear_turno`, `atencion_cancelar_turno`,
  `atencion_cola`, `atencion_llamar`, `atencion_rellamar`,
  `atencion_terminar`, `atencion_pantalla_estado` (única con `anon`).
- `pg_cron` instalado; jobs `atencion-cierre-vencidas` (`*/5 * * * *`) y
  `nexo-particiones-futuras` (`0 3 1 * *`, cubre también `core.audit_log` y
  `rrhh.*`).

## Prueba previa (transacción revertida, en `nexo-core`)

Con la app activada solo dentro de la prueba y 3 usuarios temporales:
recepción automática y turnos 1-2-3; recepción no puede llamar; asignación
automática Puesto 1 / Puesto 2; llamar, no llamar dos, repetir llamado (2
veces), no cerrar con turno llamado, finalizar; fuera de orden marcado;
pantalla anónima con "3 → Puesto 2", próximo [2] y sin nombres; puesto libre
al cerrar; medianoche simulada cierra la sesión (motivo `medianoche`) y
expira el turno pendiente; owner con ambos permisos debe elegir. 8 eventos,
2 jobs, particiones creadas. Verificado después: nada persistido.

## Postcheck (aplicada)

Versión `20261014224341`; 7 tablas + 12 particiones (2026-10 a 2027-01);
sucursales creadas; 19 RPC; solo `atencion_pantalla_estado` ejecutable por
`anon`; `authenticated` sin `USAGE` sobre `atencion`; 2 jobs activos; app
inactiva; 6 tablas en `core.tablas_particionadas`. `get_advisors(security)`:
solo avisos esperados (RLS sin policies por diseño; RPC security definer
como el resto de la suite; preexistentes sin cambios).

## Siguiente

1. Pantallas: Configuración → Sucursales y sucursales en el usuario
   (`apps/nexo`); app `apps/atencion` (zona `/atencion`, proyecto Vercel nuevo):
   inicio con "Iniciar/Cerrar atención", recepción, puesto, configuración de
   puestos/pantallas, pantalla pública.
2. Activar la app (`core.apps.active` + `core.company_apps`) al terminar.

## Commit

Rama `feat/atencion-paso-cero` (sin push).
