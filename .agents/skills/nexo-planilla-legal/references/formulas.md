# Fórmulas del motor

Cada fórmula dice: insumos, parámetro (código en `parametros_ley` o tabla),
artículo, redondeo y casos borde. "Propuesta" = no está decidido en el plan 20;
se implementa parametrizado y se reporta.

## 0. Convenciones

| Convención | Regla | Origen |
|---|---|---|
| Mes comercial | 30 días; año de 360 | AG (plan 20 §1.3, "Coeficientes") |
| Salario diario | `round(salario_mensual / 30, 4)` | Deducido del caso dorado (ver caso-dorado.md) |
| Salario por hora | `diario / horas_de_jornada` (8 diurna, 7 nocturna, 7.5 mixta) | Plan 20 §3 |
| Monto por días u horas | `round(cantidad × tarifa, 2)` | Caso dorado |
| Monto por porcentaje | `round(base × tasa, 2)` | Propuesta coherente |
| Totales | Suma de líneas ya redondeadas; nunca se redondea un total aparte | Caso de provisiones (C$1,418.76) |
| Modo de redondeo | `round(numeric, n)` de Postgres: mitad hacia afuera del cero | Postgres; JavaScript con `number` da otro resultado en casos como 333.325 |
| Quincena | 15 días de pago aunque el mes tenga 28 o 31 | Propuesta (mes comercial); confirmar con AG |

## 1. Devengados

| Concepto | Fórmula | Parámetro | Art. |
|---|---|---|---|
| Salario ordinario del período | `round(diario × días_pagables, 2)`; días pagables = días del período (15 o 30) − días no pagados (faltas injustificadas validadas por el supervisor, F1.6) − días fuera de contrato (ingreso o egreso a mitad) | — | 86 |
| Salario ordinario completo | Si el período es completo y sin descuentos: `mensual / 2` (quincena) o `mensual` | — | — |
| Horas extra | `round(horas_aprobadas × (diario / horas_jornada) × 2, 2)`; tope 3 al día y 9 a la semana (bloqueo con motivo) | — | 57, 58, 62 |
| Feriado o descanso trabajado | `round(días_u_horas × tarifa × 2, 2)` | `rrhh.feriados` | 57, 62, 68 |
| Séptimo día | Incluido en salario quincenal o mensual; no genera línea propia | — | 64, 87 |
| Vacaciones gozadas | No cambian el salario del período; se registran como movimiento | — | 76 |
| Vacaciones pagadas (no gozadas) | `round(días × diario_vacaciones, 2)`; diario = último ordinario, o promedio de 6 meses si es variable | — | 78 |
| Comisiones, bonos | Novedad con su concepto; flags del concepto deciden INSS/IR | — | — |
| Subsidio | Según política (decisión 4) | — | LSS |

`horas_jornada` sale de la jornada del contrato (`rrhh.jornada_dias`), no de una
constante. Las horas extra vienen de asistencia consolidada (PL3); mientras no
exista, se capturan como novedad.

## 2. Deducciones y aportes

| Concepto | Fórmula | Parámetro |
|---|---|---|
| Base INSS | Σ líneas devengadas con `afecta_inss`; con techo si existe (`least(base, techo)`) | `techo_inss` (verificar) |
| INSS laboral | `round(base_inss × tasa, 2)` | `inss_laboral` |
| Renta neta del mes | Σ devengados con `afecta_ir` − INSS laboral (− fondo de ahorro) | — |
| IR por proyección | `anual = neta_mes × 12`; buscar tramo; `impuesto = base + (anual − sobre_exceso) × %`; `retención = round(impuesto / 12, 2)` | Tramos de IR vigentes |
| IR acumulado | `proyección = Σ neta del año / meses × 12`; impuesto anual × meses / 12 − retenido del año | Tramos + acumulados (verificar) |
| IR servicios profesionales | `round(honorarios × %_contrato, 2)` o 0 si exento | `contrato_regimen` |
| INSS patronal | `round(base_inss × tasa, 2)`; costo, no descuento | `inss_patronal*` |
| INATEC | `round(base_inatec × 0.02, 2)`; base = planilla bruta | `inatec` |

## 3. Provisiones (pasivo laboral)

| Provisión | Fórmula | Nota |
|---|---|---|
| Vacaciones | `round(2.5 × días_del_período / 30 × diario, 2)` | Quincena: 1.25 días |
| Aguinaldo | `round(devengado_que_cuenta / 12, 2)` | Quincena de C$5,675 → 472.92 |
| Indemnización | Plan 20 §3: pasivo por la tabla del art. 45 a la fecha, con tope de 5 meses. **AG provisiona 1/12 fijo** (8.33%) | Diferencia real desde el 4.º año (20 días/año = 5.56%) y al llegar al tope. Se decide antes de la corrida en paralelo; reportar diferencia esperada |

AG provisiona 25% (tres conceptos × 1/12) y redondea **cada concepto** antes de
sumar: 472.92 × 3 = 1,418.76 sobre C$5,675 (con 8.33% literal daría 1,418.18).

## 4. Liquidación

```
días_antigüedad = meses completos entre ingreso y egreso (fracciones proporcionales)
días_indemnización (art. 45, contrato indeterminado):
    primeros 36 meses: 30 días por año  → meses × 30 / 12
    desde el mes 37:   20 días por año  → meses × 20 / 12
    mínimo 30 días, máximo 150 días (5 meses)
indemnización = round(días_indemnización × diario, 2)
aguinaldo proporcional = round(días_aguinaldo × diario, 2)   (2.5 días por mes del período de aguinaldo)
vacaciones = round(saldo_días × diario, 2)                     (saldo de vacaciones_movimientos)
salario pendiente = días trabajados no pagados × diario
total = Σ líneas redondeadas − deducciones permitidas
```

Reglas por causa (art. 42, 43, 45, 47, 48):

| Causa | Indemnización art. 45 | Otras |
|---|---|---|
| Despido sin causa justificada (indeterminado) | Sí | — |
| Renuncia con preaviso, mutuo acuerdo | Sí (art. 43) | Preaviso de 15 días (art. 44): si no lo da, ¿se descuenta? Verificar |
| Despido con causa justa (art. 48, con autorización del Inspector) | No | Solo vacaciones y aguinaldo proporcionales |
| Trabajador de confianza (art. 47) | Además 2–6 meses, decisión de la empresa | Exención adicional hasta C$500,000 |
| Vencimiento de contrato determinado | Verificar | — |
| Fallecimiento | Verificar (beneficiarios: `rrhh.empleado_beneficiarios`) | — |

Deducciones en liquidación: préstamos y adelantos pendientes **solo contra
salario pendiente, vacaciones e indemnización**, nunca contra el aguinaldo
(art. 97). El plan 20 §3 resta los préstamos del total: diferencia reportada al
coordinador. Respetar el mínimo inembargable del salario (art. 92) si aplica a
la liquidación: verificar.

## 5. Préstamos, adelantos y embargos

| Tipo | Regla | Estado |
|---|---|---|
| Préstamo / adelanto | Cuota del plan de cuotas como deducción del período; nunca deja el neto negativo; saldo = monto − cuotas aplicadas en planillas aprobadas | Plan 20 §7 |
| Embargo por alimentos | Prioridad sobre préstamos; puede tocar el mínimo y el aguinaldo (art. 92, 97); tope del Código de Familia | Tope: verificar |
| Otro embargo judicial | Respeta el mínimo inembargable del sector (art. 92) | Plan 20 §6 |
| Orden de aplicación | INSS → IR → embargo por alimentos → otros embargos → préstamos de la empresa → otras deducciones | Propuesta; si el neto no alcanza, se corta en ese orden y se avisa |

## 6. Validaciones que bloquean con motivo (plan 20 §6)

- Salario del contrato bajo el mínimo del sector vigente.
- Más de 3 horas extra en un día o 9 en una semana.
- Saldo de vacaciones negativo.
- Embargo por encima del tope.
- Pago por banco sin cuenta bancaria del empleado.
- Parámetro o tramo sin fila vigente para la fecha.
- Neto negativo.

Avisos que **no** bloquean: régimen de servicios profesionales con jornada o
marcas; dato "verificar" en uso.
