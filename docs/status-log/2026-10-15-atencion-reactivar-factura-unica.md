# 2026-10-15 — Atención: Paso Cero de métricas, reactivar "no se presentó" y factura única

## Contexto

Decisiones del usuario (2026-10-15), plan 13 §6:
- Aprueba la matriz de métricas y el permiso de reactivar; quién reactiva se
  configura en el rol.
- El turno reactivado vuelve **al final de la fila** con su número.
- **Una factura nunca se repite en la sucursal.** Un "no se presentó" de un
  día anterior se reemplaza por el turno nuevo.
- Los "no se presentó" no afectan las métricas de atención.

## Estado anterior → estado nuevo

- Sin permisos de métricas/reactivación → **Paso Cero aplicado**.
- "No se presentó" definitivo → **reactivable** (permiso, al final de la fila).
- Factura libre → **única por sucursal**, con aviso y "Reactivar turno N".
- Fila por número → **por `en_fila_desde`** (alta o última reactivación).

## Entregado

- `20261015165620_atencion_paso_cero_metricas_reactivar` (aplicada; archivo
  creado como `20261015210000_…`): `atencion.reportes.mis_metricas.ver`
  (Agente, Supervisor) y `atencion.cola.turno.reactivar` (Recepción,
  Supervisor) en catálogo + plantillas. Postcheck: 4 asignaciones.
- `20261015172012_atencion_reactivar_factura_unica` (aplicada; archivo creado
  como `20261015220000_…`):
  - `atencion.turnos`: `en_fila_desde` (rellenada con `creado_en`, `not null`,
    default `now()`), `reactivaciones`, `reemplazado_en`, `reemplazado_por`.
  - `atencion.fn_factura_normal` (sin espacios, mayúsculas) + índice parcial.
  - `atencion_crear_turno`: candado por factura (`pg_advisory_xact_lock`);
    en espera/atención o atendida → error; "no se presentó" de hoy → error con
    `detail = 'reactivable:<id>:<numero>'`; de otro día → turno nuevo y el viejo
    queda `reemplazado_*`. Anulados y vencidos no ocupan la factura.
  - `atencion_reactivar_turno` (nueva, permiso de reactivar + sucursal):
    `esperando`, `en_fila_desde = clock_timestamp()`, limpia puesto/agente/tiempos;
    evento `devuelto` con `{"reactivado": true}`.
  - `atencion_llamar`: el siguiente es el de menor `en_fila_desde`;
    "fuera de orden" compara contra ese.
  - `atencion_cola_v3` (+ `en_fila_desde`, `reactivaciones`, `reemplazado`).
    `atencion_cola` y `atencion_cola_v2` quedan sin uso.
  - `atencion_pantalla_estado`: "Próximos" en orden de fila.
- `apps/atencion`: acción `reactivarTurno` con `requirePermission`; en
  recepción, el error de factura repetida muestra "Reactivar turno N" (o pide
  a alguien con permiso); sección "No se presentaron hoy" con "Reactivar" en
  recepción y puesto (oculta sin permiso); la espera se mide desde
  `en_fila_desde`; "· reactivado" en la fila del puesto.

## Incidente con el conector MCP de Supabase

Confirmado el patrón: las sentencias que el conector considera destructivas
quedan retenidas hasta cortarse a los 60 s, sin aplicar nada. Pasó con
`DROP FUNCTION` (3 veces) y con un `UPDATE` **sin `WHERE`** en un ensayo. El
mismo bloque con `WHERE` pasó al instante. Regla práctica para migraciones por
MCP: nada de `DROP`, ni `UPDATE`/`DELETE` sin `WHERE`.

## Pruebas ejecutadas

- Bloque revertido sobre la base real, simulando la recepción abierta:
  1) alta con factura `T-100` → turno 3; 2) `" t-1 00 "` → "ya tiene el turno
  3 en espera"; 3) tras marcarlo ausente → "no se presentó" con
  `detail reactivable:<id>:3`; 4) reactivado → orden de espera correcto
  (`2,51,50` en el ensayo con `clock_timestamp()`); 5) segunda reactivación →
  rechazada; 6) `OLD-1` de ayer ausente → turno nuevo y el viejo
  reemplazado; 7) factura atendida → "ya fue atendida (turno 5 del 15/10/2026)";
  8) `atencion_cola_v3` devuelve la fila.
- Remoto después: versiones registradas, `en_fila_desde` sin nulos, `anon`
  sin `EXECUTE` en reactivar, pantalla OK, `atencion_cola_v3` como el agente
  real (revertido) OK.
- `next build` + `eslint` de `apps/atencion` limpios. Sin navegador real.

## Revisión de Codex (PR #27) — 2 hallazgos, ambos corregidos

1. La búsqueda de factura repetida no usaba `turnos_factura_idx` (índice
   parcial `factura is not null`; `fn_factura_normal` no es STRICT, así que el
   planificador no deduce el predicado): recorría todas las particiones.
   Migración `20261015172709_atencion_factura_usa_indice` (archivo creado como
   `20261015230000_…`): `atencion_crear_turno` agrega `t.factura is not null`.
   Verificado con `EXPLAIN`: Index Scan por partición.
2. En recepción, cambiar la factura tras el aviso dejaba el botón "Reactivar
   turno N" apuntando al turno de la factura anterior. Ahora la oferta queda
   ligada a la factura enviada y se descarta al editarla.

## Pendiente

- Merge, deploy y prueba en recepción/puesto.
- Retirar `atencion_cola` y `atencion_cola_v2` (migración con DROP: aplicar
  fuera del conector MCP o con confirmación del usuario).
- Métricas y dashboards (plan 13 §6.2).
