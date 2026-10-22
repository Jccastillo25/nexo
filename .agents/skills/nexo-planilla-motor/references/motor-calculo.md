# Motor de cálculo

Fórmulas y valores: [nexo-planilla-legal/references/formulas.md](../../nexo-planilla-legal/references/formulas.md).
Aquí: orden, redondeo, idempotencia, huellas y decisiones abiertas.

## 1. Entrada y copia congelada

Para cada contrato aplicable al período (activo en algún día del período, o
finalizado dentro de él) se lee **a la fecha del período** y se copia en
`planilla_empleados`:

- salario de `contrato_compensacion` y diario `round(mensual / 30, 4)`;
- jornada vigente (`rrhh.contrato_jornadas` por vigencia) y sus horas;
- régimen vigente en `contrato_regimen` (si no hay fila, **error**, no supuesto);
- sector de salario mínimo (propuesta: por puesto o contrato, plan 20 §2.2);
- parámetros (`parametros_ley`) y tramos de IR vigentes al `periodo_fin`. Si falta uno: error "Falta el parámetro X vigente al <fecha>".

## 2. Orden de cálculo por contrato

1. **Días pagables** (formulas.md §1) y salario ordinario.
2. **Devengados**: horas extra, feriados trabajados, vacaciones pagadas, novedades de devengado, subsidios.
3. **Base INSS** = Σ devengados con `afecta_inss` (techo si existe). Régimen sin INSS ⇒ 0.
4. **INSS laboral**.
5. **Renta neta** y **IR** según `metodo_ir`.
6. **Deducciones en orden**: embargo por alimentos → otros embargos → cuotas de préstamos y adelantos → novedades de deducción. Cada una limitada por lo disponible y por el mínimo inembargable; lo que no cabe queda pendiente con aviso.
7. **Neto** = devengados − deducciones. Neto < 0 ⇒ error con motivo.
8. **Aportes patronales** (INSS patronal, INATEC) sobre sus bases.
9. **Provisiones** si el contrato las lleva.
10. **Validaciones** que bloquean (formulas.md §6) y avisos que no.

Cada paso crea líneas en `planilla_lineas` con `round(…, 2)` en el momento; los
pasos siguientes leen las líneas ya redondeadas. Los totales de
`planilla_empleados` y `planillas.totales` son sumas de líneas.

## 3. Idempotencia y recálculo

- `public.planilla_calcular(p_company_id, p_planilla_id)` toma `select … for update` sobre la planilla, exige estado `borrador` o `calculada`, **borra las líneas y renglones de esa planilla** y los regenera en la misma transacción.
- Marca como `aplicada` las novedades y cuotas que usó, con `planilla_id`; las que dejó de usar vuelven a `pendiente`.
- Guarda `hash_insumos` = huella de los insumos (contratos, compensación, régimen, jornada, novedades, cuotas, embargos, parámetros y tramos usados, con sus `id` y `updated_at` o vigencias).
- Prueba obligatoria: calcular dos veces seguidas da líneas idénticas (mismo conjunto de `concepto_codigo, cantidad, base, tasa, monto`) y el mismo `hash_insumos`.
- Cambiar una novedad o insumo después de calcular deja la planilla "desactualizada": aprobar recalcula la huella de insumos y **rechaza** si no coincide ("Hubo cambios después del cálculo. Vuelve a calcular.").

Huella: `encode(extensions.digest(<texto canónico>, 'sha256'), 'hex')` (pgcrypto
vive en `extensions` en Supabase; con `search_path = ''` se califica). Texto
canónico = `jsonb_agg` ordenado por `contrato_id, orden, concepto_codigo` y
convertido a texto. Confirmar que el entorno PGlite crea `pgcrypto` en el mismo
esquema antes de escribir la prueba.

## 4. Estados

```
borrador ──calcular──▶ calculada ──aprobar──▶ aprobada ──pagar──▶ pagada
   ▲   │                  │  ▲                    │
   │   └─(insumo cambia)──┘  └──recalcular        │
   └──────────── anular (borrador/calculada/aprobada, con motivo) ─▶ anulada
```

| Transición | RPC | Permiso | Reglas |
|---|---|---|---|
| crear (período) | `planilla_crear` | `planilla.generar` | Sin otra no anulada del mismo tipo y período; parámetros vigentes presentes |
| calcular / recalcular | `planilla_calcular` | `planilla.generar` | Estado `borrador`/`calculada` |
| aprobar | `planilla_aprobar` | `planilla.aprobar` | Estado `calculada`; huella de insumos igual; **`auth.uid()` distinto de `calculada_por` y de quien creó**; guarda `hash_aprobado` |
| pagar | `planilla_pagar` | `planilla.pagar` | Estado `aprobada`; método y referencias; banco ⇒ cuenta bancaria |
| anular | `planilla_anular` | `planilla.anular` | Motivo obligatorio; libera novedades y cuotas; `pagada` **no** se anula (decisión pendiente) |
| regenerar | `planilla_crear` con `reemplaza_a` | `planilla.generar` | Solo si la anterior está `anulada` |

Defensa en profundidad: trigger `before update or delete` en `planillas`,
`planilla_empleados` y `planilla_lineas` que rechace cambios cuando la planilla
está `aprobada`, `pagada` o `anulada` (salvo la transición permitida), como
`rrhh.fn_validar_transicion_contrato` (`20260907153604:100-132`).

Nombre del estado intermedio: el plan 20 §7 lo llama **`calculada`**; el
encargo del coordinador del 2026-10-21 dijo "generada". La skill usa
`calculada` (texto del plan) hasta que el coordinador lo confirme.

Mismo ciclo para liquidaciones (`liquidaciones.calcular` / `.aprobar`) y para
vacaciones solicitadas (`vacaciones.registrar` / `.aprobar`): quien registra no
aprueba su propio registro.

## 5. Separación de funciones y equipos pequeños

`docs/PERMISSIONS.md` (Planilla) exige que la RPC impida que un mismo usuario
genere y apruebe la misma corrida aunque tenga los dos permisos. Con un solo
usuario `admin` (o la persona propietaria, que pasa todos los permisos) **nadie
podría aprobar**. No se agrega una excepción sin decisión del usuario: se
reporta como riesgo operativo y se muestra el motivo en pantalla.

## 6. Auditoría

`core.fn_auditar(auth.uid(), p_company_id, '<accion>', '<entidad>', <id>::text, <jsonb>)`
(`20261014203144…:239`). Acciones propuestas: `rrhh.planilla.creada`,
`.calculada`, `.aprobada`, `.pagada`, `.anulada`, `rrhh.planilla.parametro_cambiado`,
`rrhh.planilla.regimen_cambiado`, `rrhh.planilla.aviso_regimen_descartado`,
`rrhh.planilla.concepto_cambiado`, `rrhh.planilla.liquidacion_aprobada`,
`rrhh.planilla.colillas_publicadas`, `rrhh.planilla.exportada`. Metadata sin
datos personales innecesarios (ids y totales, no nombres).

## 7. Errores

- Permiso: `core.fn_exigir_permiso` (42501, mensaje para el usuario).
- Filtros o estado inválido: `raise exception '<mensaje en español>' using errcode = '22023'` o `P0001`; mensajes que dicen qué pasó y qué hacer ("La planilla ya está aprobada. Para corregirla, anúlala y genera otra.").
- Nada de SQLSTATE ni nombres de tablas al usuario (nexo-security §4).

## 8. Decisiones abiertas que el motor no debe inventar

| Decisión | Efecto | Fuente |
|---|---|---|
| IR en planilla quincenal | Monto de cada quincena | Corrida en paralelo con AG |
| Método acumulado de IR y saldos iniciales | Requiere `saldos_iniciales` (propuesta) | Plan 20 §9, decisión 7 |
| Período del aguinaldo | Días proporcionales | Caso dorado G1 sugiere ene–dic |
| Provisión de indemnización: 1/12 fijo (AG) o tabla art. 45 (plan 20 §3) | Pasivo y corrida en paralelo | Usuario / contador |
| Antigüedad cuando hay varios contratos seguidos | Un aumento de salario hoy exige contrato nuevo (D-03, salario editable solo en borrador); si la antigüedad se toma del contrato, la indemnización y las vacaciones salen mal | Usuario: compensación con vigencia o "fecha de antigüedad" |
| Causa y fecha de egreso | `fn_finalizar_contrato` no guarda causa y usa `current_date` | Usuario; integración liquidación ↔ finalizar |
| Permisos para pagar y anular una liquidación, y para devolver una planilla calculada | No hay código en el Paso Cero | Paso Cero nuevo si se necesita |
| Anular una planilla pagada | Reverso o planilla complementaria | Usuario / contador |
| Régimen que cambia a mitad de período | Prorrateo o fecha al inicio del período | Usuario |
| Particionar vacaciones, cuotas y provisiones | Regla de `CLAUDE.md` | Coordinador |
| Ferretería La Máxima | Segunda empresa; parámetros por `company_id` | Plan 20 §9, decisión 3 |
