# Modelo de datos (borrador para PL2)

Base: plan 20 §7. Todo en el esquema `rrhh`, con `company_id`. Lo marcado
**propuesta** no está en el plan y se reporta al coordinador antes de
implementarlo.

## 1. Lo que ya existe y cómo se toca

| Objeto | Estado verificado en el repo | Qué hace PL2 |
|---|---|---|
| `rrhh.parametros_ley` | `20260902000008:33-65`. Semillas: `inss_laboral` 0.07, `inss_patronal` **0.225**, `inatec` 0.02, `techo_inss` **100000 (ejemplo)** | Cerrar e insertar filas (nunca `update` del valor): patronal 0.215 según plan 20 §5.1; techo pendiente de factura INSS. Agregar códigos propuestos en plan 20 §7 |
| `rrhh.planillas` | `20260902000006:166-192`. `estado in ('borrador','aprobada','anulada')`, 0 filas | `alter` del check de estados, `planilla_tipo_id`, huellas, columnas de pago y anulación (§2.6) |
| `rrhh.planilla_detalles` | `20260902000006:194-212`. Columnas fijas, sin `contrato_id` | Se deja de usar; no se borra |
| `rrhh.contratos` | `estado in ('borrador','activo','finalizado')`; un activo por empleado; `fn_finalizar_contrato(uuid, uuid)` pone `fecha_fin_real = current_date` y **no guarda causa**. `unique (id, company_id, empleado_id)` en P3 (`20261017131113`, verificar si está aplicada en remoto) | La liquidación necesita fecha de egreso y causa: decisión (motor-calculo.md §8) |
| `rrhh.contrato_compensacion` | 1:1 con contrato; salario solo editable en borrador; `frecuencia_pago in ('mensual','quincenal','semanal')` | Se lee. Un aumento hoy obliga a otro contrato (D-03): ver §8 de motor-calculo.md |
| `rrhh.feriados` | Existe, 0 filas, sin columna de tipo ni de pago (`docs/RRHH_MVP.md` §14) | Cargar los 14 de 2026 (plan 20 §5.4); permisos `rrhh.asistencia.feriados.*` |
| `rrhh.empleado_cuentas_bancarias` | Existe; solo `admin` las ve | Validación de pago por banco |
| `core.tablas_particionadas`, `core.fn_asegurar_particiones_futuras(n)` | `20260902000002`, `…004` | Registrar las tablas particionadas nuevas |

## 2. Tablas nuevas

### 2.1 `contrato_regimen` (dimensión con vigencia)

`id, company_id, contrato_id, regimen ('laboral'|'servicios_profesionales'),
regimen_inss ('integral'|'ivm'|'ninguno'), metodo_ir
('tabla_progresiva'|'retencion_fija'|'exento'), porcentaje_ir numeric(6,4) null,
paga_vacaciones bool, paga_aguinaldo bool, paga_indemnizacion bool, vigente_desde
date, vigente_hasta date null, motivo text, aprobado_por uuid, created_at`.

- Una fila abierta por contrato: índice único parcial `where vigente_hasta is null` (como `parametros_ley_activo_unico`).
- Sin solapes: validación en la RPC con `for update` del contrato. *No usar `exclude using gist`*: necesita `btree_gist` y no se puede probar igual en PGlite.
- Check de coherencia régimen ↔ INSS ↔ IR (nexo-planilla-legal, regimenes.md).
- Escritura solo por `public.planilla_regimen_cambiar` (`regimen.cambiar`). Lectura con `regimen.ver`.
- Avisos descartados: **propuesta** `contrato_regimen_avisos` (contrato, tipo, descartado_por, motivo, fecha) o solo `core.audit_log`; decidir con el coordinador.

### 2.2 `ir_tramos` (con vigencia)

`id, company_id, vigente_desde, vigente_hasta, desde numeric(14,2), hasta
numeric(14,2) null, impuesto_base numeric(14,2), porcentaje numeric(6,4),
sobre_exceso numeric(14,2)`. Una fila por tramo. Poscheque/prueba: tramos
contiguos y sin huecos para cada vigencia. Permisos: `parametros.ver/editar`.

### 2.3 `planilla_tipos`

`id, company_id, nombre, clase ('ordinaria'|'aguinaldo'), frecuencia
('mensual'|'quincenal'|'semanal'), moneda ('NIO'), centro_costo text null,
activo`. Equivale a las "Plantillas" de AG. Permisos: `conceptos.ver/gestionar`.
La liquidación **no** es un tipo de planilla: tiene su propio documento (§2.10),
como dice el plan 20 §7.

### 2.4 `conceptos`

`id, company_id, codigo, nombre, tipo ('devengado'|'deduccion'|'aporte_patronal'|'provision'),
metodo ('sistema'|'fijo'|'porcentaje'|'horas'|'dias'), afecta_inss, afecta_ir,
afecta_inatec, cuenta_aguinaldo, cuenta_vacaciones, cuenta_indemnizacion,
es_ordinario, en_colilla, orden int, cuenta_contable text null, es_sistema bool,
activo, version int`.

- Los legales (salario ordinario, INSS laboral y patronal, IR, INATEC, provisiones) son `es_sistema`: no se editan ni se desactivan.
- Un concepto **usado en una planilla aprobada no cambia sus reglas** (descripción del permiso `conceptos.gestionar`): la RPC lo bloquea o crea una versión nueva. Las líneas copian los flags del concepto de todos modos.
- Catálogo inicial: el de AG (plan 20 §1.3, ingresos y deducciones) sin datos personales.

### 2.5 `planillas` (existe; columnas a agregar)

`planilla_tipo_id, fecha_pago, estado` (nuevo check, §3), `hash_insumos,
calculada_por, calculada_en, hash_aprobado, aprobada_por, aprobada_en,
pagada_por, pagada_en, metodo_pago ('cheque'|'transferencia'), anulada_por,
anulada_en, motivo_anulacion, reemplaza_a uuid null, totales jsonb`.
Único parcial: una planilla no anulada por `(company_id, planilla_tipo_id,
periodo_inicio, periodo_fin)`.

### 2.6 `planilla_empleados` (un renglón por contrato y corrida)

`id, company_id, planilla_id, contrato_id, empleado_id`, copia congelada:
`salario_mensual, salario_diario numeric(14,4), horas_jornada, sector,
regimen, regimen_inss, metodo_ir, porcentaje_ir, frecuencia`, `dias_pagados`,
totales (`devengado, deducciones, neto, aportes, provisiones`), `avisos text[]`,
`referencia_pago` (número de cheque o transferencia). Único `(planilla_id,
contrato_id)`. No particionada (volumen acotado por corrida).

### 2.7 `planilla_lineas` — particionada

`id, periodo_fin date` (**clave de partición**, copiada de `planillas.periodo_fin`),
`company_id, planilla_id, planilla_empleado_id, contrato_id, concepto_id`,
copia del concepto (`concepto_codigo, tipo, afecta_*`), `cantidad numeric(14,4),
unidad ('dias'|'horas'|'monto'|'porcentaje'), base numeric(14,2), tasa
numeric(14,6), monto numeric(14,2)`, `origen ('sistema'|'novedad'|'prestamo'|'embargo')`,
`origen_id uuid` (sin FK, como `importacion_id` en Presupuesto),
`parametro_ref jsonb` (códigos y vigencias usados), `articulo text`, `orden int`.
PK `(id, periodo_fin)`.

### 2.8 `novedades` — particionada

`id, fecha date` (**clave de partición**: fecha del hecho), `company_id,
contrato_id, concepto_id, cantidad, monto, planilla_tipo_id, estado
('pendiente'|'aplicada'|'anulada'), planilla_id null, origen
('manual'|'excel'|'asistencia'), lote uuid null, creado_por, created_at`.
PK `(id, fecha)`. Se editan o eliminan solo si la planilla destino no está
aprobada (`movimientos.crear/eliminar`).

### 2.9 Préstamos, embargos, vacaciones, provisiones

| Tabla | Columnas clave | Nota |
|---|---|---|
| `prestamos` | contrato, tipo ('prestamo'|'adelanto'), monto, n_cuotas, fecha_inicio, estado | Saldo = monto − cuotas aplicadas en planillas aprobadas |
| `prestamo_cuotas` | prestamo, numero, fecha_prevista, monto, estado, planilla_id | La cuota entra sola como deducción |
| `embargos` | contrato, tipo ('alimentos'|'judicial'), monto o porcentaje, tope, referencia de la orden, vigencia, prioridad | Ver orden de aplicación en formulas.md §5 |
| `vacaciones_movimientos` | contrato, fecha, tipo ('acumulacion'|'goce'|'pago'|'ajuste'|'saldo_inicial'), dias (+/−), estado ('solicitada'|'aprobada'|'rechazada'), registrado_por, aprobado_por | El saldo se calcula, nunca se escribe |
| `provisiones` | contrato, mes, vacaciones, aguinaldo, indemnizacion (del mes y acumulado), base | Alimenta Dashboard y asiento |

### 2.10 `liquidaciones`, `liquidacion_lineas`

`liquidaciones`: contrato, fecha_egreso, causa (ver formulas.md §4), estado
(`borrador → calculada → aprobada → pagada`, o `anulada`), copia del contrato,
totales, calculada_por, aprobada_por (distinto), hash. `liquidacion_lineas`:
concepto, días, diario, monto, artículo. La simulación **no** guarda filas.

### 2.11 Propuesta: `saldos_iniciales`

No está en el plan 20 §7. Hace falta si se arranca a mitad de año (decisión 7):
renta neta e IR retenido acumulados del año, saldo de vacaciones y préstamos
vigentes traídos de AG, con `origen = 'ag'` y quién los cargó. Sin esto, el
método acumulado de IR y los saldos no cuadran.

## 3. Particiones

Regla de `CLAUDE.md` y `docs/planning/ARQUITECTURA_MVP_ESCALABLE.md` §2.1:
toda tabla de hechos nace particionada por `RANGE` mensual.

- `planilla_lineas` por `periodo_fin`; `novedades` por `fecha`. PK incluye la clave.
- Función `rrhh.fn_asegurar_particion_<tabla>(p_mes date)` como `presupuesto.fn_asegurar_particion_facturas` (`20261020184030:154-170`): `to_regclass`, `format('%I','%L')`, índices `(company_id, <fecha>)` y de cada FK, y `enable row level security` en cada partición.
- Registrar en `core.tablas_particionadas` y llamar `core.fn_asegurar_particiones_futuras(3)`. Si se importa histórico de AG, crear particiones desde el primer mes importado (como el bucle de Presupuesto desde 2023-01).
- FKs desde una tabla particionada hacia `planillas` o `contratos` (no particionadas) están permitidas. Ninguna tabla debe apuntar con FK a `planilla_lineas` (exigiría `(id, periodo_fin)`).
- **A decidir por el coordinador**: `vacaciones_movimientos`, `prestamo_cuotas` y `provisiones` también son eventos que crecen sin límite. El plan 20 §7 solo particiona líneas y novedades. Por la regla de `CLAUDE.md`, corresponde particionarlas o justificar por escrito por qué no.

## 4. RLS y GRANT

- `alter table … enable row level security` en toda tabla y en cada partición (dentro de la función de partición).
- Policies de `select` con `core.has_permission((select auth.uid()), company_id, '<código>.ver')` (forma con `select`, migración `20260905000003`). Sin policies de escritura.
- `grant select on <tabla> to authenticated;` y poscheque de que `authenticated` no tiene `INSERT/UPDATE/DELETE` (`has_table_privilege`), como `supabase/tests/rrhh_p3_contrato.prueba.sql:31-34`. `anon` sin nada.
- Datos sensibles: salarios en `planilla_empleados`/`planilla_lineas` se ven con `planilla.ver`; las cuentas bancarias siguen siendo solo de `admin`.

## 5. Índices

B-Tree en toda FK (`company_id`, `contrato_id`, `planilla_id`, `concepto_id`,
`planilla_empleado_id`), compuesto `(company_id, <fecha>)`, parcial por estado
vivo (`where estado in ('borrador','calculada')`, `where vigente_hasta is null`).
`jsonb` solo lleva GIN si se filtra por él (§2.2 de la arquitectura).
