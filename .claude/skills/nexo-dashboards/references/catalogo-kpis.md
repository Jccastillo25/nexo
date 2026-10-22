# Catálogo de KPIs por dominio

Punto de partida para la tabla de KPIs del planner. **Estado** dice si la fuente
existe en el repo (verificado el 2026-10-20 leyendo el código citado) o si es
**propuesta** (no existe la fuente o la decisión). Una propuesta no se
implementa sin RPC, permiso en `core.permissions_catalog` y aprobación del
usuario (Paso Cero).

Convenciones de fórmula: `f` = fracción (0.85 = 85 %), mostrada con `pct()`;
variación con signo `pctSigno()`; ambas en `apps/presupuesto/src/lib/metas/formato.ts`.
"Mismo período anterior" = mismo rango de días del año anterior, no el mes completo.

## Ventas / Presupuesto (`apps/presupuesto`)

| KPI | Fórmula | Comparación | Umbral | Fuente | Estado |
|---|---|---|---|---|---|
| Venta del mes (número principal) | Σ `vendido_usd` de vendedores | vs. meta del mes y vs. ritmo | `UMBRAL_RIESGO` 0.9 | `presupuesto_equipo` / `presupuesto_mi_avance` | Verificado |
| Cumplimiento | vendido / meta (null si meta ≤ 0) | vs. 100 % | ≥1 cumplida · ≥0.9 en riesgo · resto baja | `cumplimiento()` | Verificado |
| Ritmo a la fecha | vendido / (meta × díasTrans / díasMes) | vs. 100 % | mismo umbral | `calcularRitmo().fraccionALaFecha` | Verificado |
| Proyección al cierre | vendido / díasTrans × díasMes | vs. meta | mismo umbral | `calcularRitmo().proyeccion` | Verificado |
| Necesario por día hábil | (meta − vendido) / días restantes | vs. promedio diario actual | — | `requeridoPorDia`, `promedioDiario` | Verificado |
| Vs. año anterior | (vendido − anterior a la fecha) / anterior | mismo período del año anterior | signo | `presupuesto_indicadores.anio_anterior.a_la_fecha_usd` | Verificado |
| Acumulado del año | `ytd.vendido_usd` | vs. `meta_previa_usd` + meta del mes × fracción transcurrida; no comparar si el mes es posterior al corte | mismo umbral | `presupuesto_indicadores.ytd` | Verificado |
| Vendedores que van a cumplir | n con proyección/meta ≥ 1, de los que tienen meta > 0 | — | — | `estadoProyeccion()` | Verificado |
| Ticket promedio | vendido / facturas | vs. mismo período anterior | — | `mes.facturas` | Verificado (sin comparación hoy) |
| Clientes atendidos / nuevos | `mes.clientes`, `mes.clientes_nuevos` | vs. mismo período anterior | — | `presupuesto_indicadores.mes` | Verificado (sin comparación) |
| Venta de contado | `contado_usd` / vendido | — | — | idem | Verificado |
| Concentración top 10 | `top10_usd` / `ventas_usd` (12 meses) | — | alto = riesgo (umbral a definir) | `clientes_12m` | Verificado; umbral propuesta |
| Clientes por recuperar | frecuentes con ≥ 45 días sin comprar | — | ≥ 90 días negativo | `en_riesgo`, `en_riesgo_total` | Verificado |
| Segmentación RFM (recencia, frecuencia, monto) | puntaje por cuantiles | — | — | — | Propuesta |

Días hábiles en Presupuesto: lunes a sábado hasta el corte (última factura importada), **sin feriados** (`ritmo.ts`).

## RRHH (`apps/rrhh`, `/dashboard`)

| KPI | Fórmula | Comparación | Fuente | Estado |
|---|---|---|---|---|
| Expedientes | conteo `rrhh.empleados` | — | consulta directa en `page.tsx` | Verificado |
| Contratos activos | conteo `rrhh.contratos` estado `activo` | vs. mes anterior | idem | Verificado (sin comparación) |
| Planillas pendientes | conteo `rrhh.planillas` estado `borrador` | — (acción: aprobar) | idem | Verificado |
| Rotación mensual | bajas del mes / plantilla promedio | vs. promedio 12 meses | — | Propuesta (sin fuente de bajas por fecha verificada) |
| Contratos por vencer (30 días) | conteo por fecha fin | — | — | Propuesta |

Nota: los conteos de RRHH se hacen hoy con `.from()` desde la vista; para Mobile, un KPI nuevo va en RPC.

## Asistencia (`apps/rrhh`, `/asistencia/dashboard`)

| KPI | Fórmula | Comparación | Fuente | Estado |
|---|---|---|---|---|
| Marcas de hoy | conteo `rrhh.asistencia_marcas` en el día de America/Managua | vs. mismo día de la semana anterior | `page.tsx` (`hoyManagua`) | Verificado (sin comparación) |
| Dispositivos activos | activos / registrados | — | `rrhh.kiosko_dispositivos` | Verificado |
| Envíos no aceptados hoy | — | — | sin fuente legible | Pendiente de integración (así se muestra) |
| Puntualidad del período | `dias_puntuales` / `dias_evaluables` | vs. período anterior | `asistencia_reporte_resumen` (`FilaResumen.puntualidad`) | Fuente verificada; KPI de dashboard propuesta |
| Ausencias | Σ `ausencias` / Σ `dias_laborables` | vs. período anterior | idem | Fuente verificada; propuesta |
| Tardanzas | Σ `tardanzas`, `promedio_tardanza` (min) | vs. período anterior | idem / `asistencia_reporte_tardanzas` | Fuente verificada; propuesta |
| Jornadas incompletas | Σ `incompletos` | — (acción: revisar incidencias) | idem / `asistencia_reporte_incidencias` | Fuente verificada; propuesta |

Las RPC de reportes devuelven filas por persona: un KPI agregado para el dashboard conviene como RPC propia (o `totales`), no sumando miles de filas en la vista.

## Productos / inventario (`apps/productos`)

| KPI | Fórmula | Fuente | Estado |
|---|---|---|---|
| Productos activos | `activos` (+ `servicios` en hint) | `productos_resumen` | Verificado |
| Sin clasificación completa | `sin_clasificacion` | idem | Verificado |
| Con código de barras | `con_codigo_barras` / `total` | idem | Verificado |
| Sin costo de referencia | `sin_costo` (null = sin permiso de costo) | idem | Verificado |
| Descontinuados | `descontinuados` | idem | Verificado |
| Rotación de inventario, días de inventario, quiebres de stock | costo de ventas / inventario promedio; existencia / venta diaria | — | Propuesta (no hay existencias en Nexo; app Inventario "Próximamente") |
| Margen bruto por clase | (precio − costo) / precio | — | Propuesta (Listas de precios pendiente) |

Es un dashboard de **calidad de catálogo**: la comparación natural es "pendientes por resolver" (acción), no tendencia.

## Atención al cliente (`apps/atencion`)

| KPI | Fórmula | Comparación | Fuente | Estado |
|---|---|---|---|---|
| En espera ahora | turnos `esperando` | — | `atencion_cola_v3` | Verificado |
| Atendidos hoy | turnos `atendido` | vs. mismo día semana anterior | idem / `atencion_metricas.por_dia` | Verificado (sin comparación) |
| No se presentó | `no_se_presento` / turnos | vs. período anterior | `atencion_metricas.resumen` | Verificado |
| Espera promedio / mediana / máxima | `espera_prom`, `espera_mediana`, `espera_max` (segundos) | vs. objetivo de servicio | idem | Fuente verificada; objetivo (SLA) propuesta |
| Duración de atención | `atencion_prom`, `atencion_mediana` | vs. período anterior | idem | Verificado |
| Atendidos fuera de orden | `fuera_de_orden` / atendidos | — | idem | Verificado |
| Puestos ocupados | ocupados / activos | — | `atencion_listar_puestos` | Verificado |
| Demanda por hora | `por_hora[].turnos` | — | `atencion_metricas.por_hora` | Verificado (forma: columnas por hora) |

Preferir la **mediana** para tiempos (la media se infla con un solo caso largo).

## Agencia / marketing (`apps/agencia`)

Hoy el dashboard usa `DEMO_DATASET` (fixtures) con aviso en pantalla: **no hay
fuente real**. Todo es propuesta hasta que exista tabla/RPC:

| KPI | Fórmula | Estado |
|---|---|---|
| Tickets por estado | conteo por estado | Propuesta (hoy fixtures) |
| Avance global | etapas completadas / etapas | Propuesta |
| Tiempo de ciclo | fecha cierre − fecha apertura (mediana) | Propuesta |
| Leads, costo por lead, conversión | — | Propuesta (sin integración con plataformas) |

## Flotilla (`apps/flotilla`)

Sin adaptar a Nexo (Supabase propio, sin `@nexo/ui`). Tablas vistas en el
código: `trips`, `trip_events`, `trip_anomalies`, `vehicles`, `drivers`,
`settlements`. Todo propuesta hasta su fase de adaptación:

| KPI | Fórmula | Estado |
|---|---|---|
| Viajes del día / en curso | conteo `trips` por estado | Propuesta |
| Vehículos con anomalía abierta | distintos `vehicle_id` en `trip_anomalies` abiertas | Propuesta |
| Liquidaciones pendientes | conteo `settlements` pendientes | Propuesta |
| Utilización de flota | vehículos con viaje / vehículos activos | Propuesta |

## Panel / administración (`apps/nexo`)

El Launcher **no** lleva KPIs. Si se pide un tablero de administración, va
dentro de Configuración y es propuesta: usuarios activos / invitados
(`admin_listar_usuarios`), roles sin usuarios (`admin_listar_roles`), eventos
de auditoría del día (`admin_listar_auditoria`). Requiere decisión del usuario.
