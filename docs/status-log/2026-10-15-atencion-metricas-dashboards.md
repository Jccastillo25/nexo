# 2026-10-15 — Atención: métricas y dashboards (por agente y global)

## Contexto

Plan 13 §6.2, aprobado por el usuario el 2026-10-15. Permisos del Paso Cero
`20261015165620`. Datos de tiempos de `20261015163957` (inicio de atención) y
`20261015172012` (`en_fila_desde`).

## Estado anterior → estado nuevo

- Sin métricas → **dos dashboards**: "Mis métricas" (`/metricas`) y
  "Reportes" (`/reportes`), con filtro de período (hoy / 7 / 30 / 90 días) y de
  sucursal en Reportes.

## Entregado

- Migración `20261015173729_atencion_metricas` (aplicada; archivo creado como
  `20261015240000_…`). Solo funciones nuevas:
  - `public.atencion_metricas(company, desde, hasta, sucursal?, solo_mias)` →
    jsonb con `resumen`, `por_hora`, `por_dia` y, en modo global,
    `por_agente` y `por_puesto`. `solo_mias` exige `reportes.mis_metricas.ver`
    o `reportes.turno.ver`; global exige `reportes.turno.ver`. Solo sucursales
    permitidas (`fn_puede_sucursal`); rango máximo 92 días; recorte de
    particiones con ±2 días sobre la fecha local.
  - Tiempos solo de atendidos: espera = `inicio_atencion_en − en_fila_desde`,
    atención = `finalizado_en − inicio_atencion_en`. "No se presentó" = eventos
    `ausente` (no entra en los tiempos). Tiempo en puesto = `atencion.sesiones`
    tipo puesto.
  - `public.atencion_sucursales_reportes(company)` para el filtro.
- `apps/atencion`:
  - `src/lib/metricas.ts` (tipos, períodos en hora de Nicaragua, formato de
    duraciones) y `src/components/metricas/` (filtros por URL, KPIs con
    `MetricCard`, gráfico por hora, tablas con `DataTable`).
  - `/metricas`: KPIs propios, atenciones por hora, tabla por día.
  - `/reportes`: KPIs de la sucursal, tabla por agente, llegada de clientes por
    hora, tabla por puesto y por día.
  - Menú: "Mis métricas" (con `mis_metricas.ver` o `reportes.turno.ver`) y
    "Reportes" (con `reportes.turno.ver`). Las páginas vuelven al inicio sin
    permiso.
  - Gráfico (guía de visualización): una serie sin leyenda, azul de acento
    validado (`validate_palette.js`: PASS en luz), barras ≤ 24 px con extremo
    redondeado, valor solo en el máximo, tooltip al pasar el mouse o enfocar,
    anclado hacia adentro del gráfico, y vista "Ver como tabla".

## Pruebas ejecutadas

- Transacción revertida con usuarios reales: global (owner) → 6 turnos, 3
  atendidos, atención promedio 535 s, espera máxima 10 579 s (turno de ayer),
  1 "no se presentó", desglose por agente y puesto coherente; "mis métricas"
  del agente = su fila del global; rango de 200 días rechazado. El agente pudo
  ver el global porque su rol "Prueba" tiene `reportes.turno.ver` (verificado).
- Remoto después: versión registrada; usuario sin permisos rechazado en las 3
  llamadas; `anon` sin `EXECUTE`.
- `next build` + `eslint` de `apps/atencion` limpios.
- Captura (Chromium headless) de los componentes con los datos reales y el CSS
  compilado: escritorio, móvil y tooltip. Corregido un tooltip que se cortaba
  en el borde derecho.
- Sin recorrido con sesión real en la app desplegada.

## Pendiente

- ~~Merge y deploy~~: PR #28 fusionado (`main` `bf21845`), los 5 deploys de
  producción READY.
- Prueba con sesión real.
- Marcar "Ver mis métricas" en los roles de empresa que lo necesiten.
- Retirar `atencion_cola` y `atencion_cola_v2` (requiere DROP fuera del
  conector MCP).
