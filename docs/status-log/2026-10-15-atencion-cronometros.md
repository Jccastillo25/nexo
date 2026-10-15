# 2026-10-15 — Atención: cronómetros de espera y de atención

## Contexto

Pedido del usuario: (1) en la fila, cuánto lleva esperando cada turno; (2) el
tiempo de la atención, hasta que se finaliza. Es el primer paso hacia los
dashboards de métricas por agente y global (Paso Cero pendiente, ver
[plan 13 §6](../plan/13-atencion-turnos.md#6-métricas-y-dashboards-borrador-para-aprobación)).

## Hallazgo

`atencion.turnos.llamado_en` cambia con cada "Repetir llamado" (la pantalla de
TV lo usa para volver a anunciar). Medir la atención desde ahí la reiniciaba:
con datos reales, el turno 3 del 2026-10-14 (llamado 5 veces) daba 2 s de
atención en lugar de 16 min 27 s, y el turno 1 de hoy lleva 16 llamados.

## Estado anterior → estado nuevo

- Sin tiempos visibles → **cronómetros en vivo** (fila del puesto y de
  recepción: espera; tarjeta "Atendiendo": esperó + en atención; línea
  "Último: turno N · esperó · atención" con los tiempos guardados).
- Sin dato confiable de inicio de atención → **`atencion.turnos.inicio_atencion_en`**.

## Entregado

- Migración `20261015163957_atencion_inicio_atencion` (aplicada en `nexo-core`;
  archivo creado como `20261015200000_…` y renombrado a la versión remota):
  - Columna `inicio_atencion_en`, rellenada para los turnos existentes con el
    último evento `llamado` (rellamar registra `rellamado`). 0 turnos llamados
    quedaron sin valor.
  - `atencion_llamar` la fija; `atencion_rellamar` no la toca.
    espera = `inicio_atencion_en − creado_en`; atención = `finalizado_en −
    inicio_atencion_en`.
  - `atencion_cola_v2` = `atencion_cola` + `inicio_atencion_en`, `finalizado_en`.
    Función nueva y no reemplazo: cambiar las columnas exige borrar la
    función, y **toda migración con DROP se quedó colgada en el conector MCP de
    Supabase** (3 intentos hoy, ninguno aplicó nada). `atencion_cola` queda sin
    uso en el código; retirarla en una migración aparte.
- `apps/atencion`: `cargarCola` usa `atencion_cola_v2` y devuelve la hora del
  servidor (los cronómetros corrigen el reloj de la PC del puesto); `reloj.ts`
  (`useReloj`, `duracion`, `transcurrido`); dashboard del módulo pasado a `v2`.
- Sin permisos nuevos: los tiempos son de turnos que el usuario ya ve.

## Pruebas ejecutadas

- `next build` + `eslint` de `apps/atencion` limpios.
- Bloque revertido antes de aplicar: relleno de `inicio_atencion_en` sobre los
  6 turnos reales, con espera/atención coherentes.
- Remoto después: versión registrada, `anon` sin `EXECUTE` en `v2`,
  `atencion_llamar` fija el inicio, la función vieja sigue disponible;
  `atencion_cola_v2` ejecutada como el agente con puesto abierto (bloque
  revertido) devuelve los tiempos.
- Sin prueba en navegador real.

## Pendiente

- Merge, deploy y prueba en el puesto.
- Retirar `public.atencion_cola` (migración aparte).
- Dashboards: Paso Cero en [plan 13 §6](../plan/13-atencion-turnos.md#6-métricas-y-dashboards-borrador-para-aprobación).
