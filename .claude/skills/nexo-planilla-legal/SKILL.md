---
name: nexo-planilla-legal
description: Marco legal de Nicaragua y fórmulas de planilla para Nexo (INSS laboral y patronal, INATEC, IR por tabla progresiva, salario diario, horas extra, feriados, vacaciones, aguinaldo, indemnización art. 45, liquidación, provisiones, préstamos y embargos; régimen laboral o de servicios profesionales por contrato), con el grado de certeza de cada dato y el caso dorado de liquidación. Usar al especificar, programar, probar o revisar cualquier cálculo de nómina, prestación o liquidación de RRHH.
---

# Nexo Planilla — marco legal y fórmulas de Nicaragua

Adaptación estable al proyecto. Fuente: [SOURCE.md](SOURCE.md). Guarda el
**método**; la fuente de verdad de los valores es `docs/plan/20-planilla.md`
(§2, §3, §5, §8.3, §9) y, en ejecución, `rrhh.parametros_ley`. Qué tarea hacer,
los archivos autorizados y las pruebas los da el coordinador en el encargo.

> **Nexo no da asesoría legal.** Esta skill resume normas para programar un
> cálculo reproducible. La calificación de una relación (laboral o de servicios
> profesionales), los valores marcados "verificar" y la corrida en paralelo los
> confirma el contador o el abogado de la empresa (plan 20 §9, decisión 8).

Complementa, no repite:
- [nexo-planilla-motor](../nexo-planilla-motor/SKILL.md): tablas, RPC, estados, pruebas.
- [nexo-planilla-flujos](../nexo-planilla-flujos/SKILL.md): pantallas y flujos.
- [nexo-security](../nexo-security/SKILL.md): permisos y `security definer`.

## Cuándo se utiliza

- ux-planner: reglas, validaciones y textos de una pantalla de planilla, vacaciones, préstamos o liquidación.
- Ejecutor o coordinador: escribir una RPC de cálculo o una prueba dorada.
- reviewer: comprobar que una fórmula, un redondeo o un parámetro coinciden con esta skill.

## Reglas estables

1. **Nada de tasas, montos, tramos ni feriados en el código** (ni TypeScript ni literales dentro de una RPC). Se leen con vigencia a la fecha del período desde `rrhh.parametros_ley`, la tabla de tramos de IR y `rrhh.feriados`. Si falta un valor vigente, la RPC **falla con motivo** ("Falta el parámetro inss_patronal vigente al 2026-09-30"); nunca usa un valor por defecto.
2. **Una planilla aprobada guarda los valores que usó** (copia en sus líneas) y nunca se recalcula con la tasa de hoy (`docs/RRHH_MVP.md` §8).
3. **Grado de certeza visible.** Cada dato es *oficial*, *coincidente* o *verificar* ([references/marco-legal.md](references/marco-legal.md)). Un dato "verificar" sirve para simular y probar; en pantalla de pago se muestra el aviso "Valor pendiente de confirmar con el contador".
4. **Régimen por contrato y con vigencia**, nunca un interruptor de empresa: `laboral` o `servicios_profesionales` ([references/regimenes.md](references/regimenes.md)). El "Free-lance" de AG equivale a `servicios_profesionales`; **no** es `rrhh.contratos.modalidad_contrato` (`nomina_estandar`/`comisionista_destajo`, que dice cómo se paga, no el régimen).
5. **Aviso, no bloqueo**: un contrato de servicios profesionales con jornada o marcas en el kiosco muestra "Revisar régimen con el contador". Solo quien tiene `rrhh.planillas.regimen.cambiar` lo descarta, y queda auditado.
6. **Convención de cálculo** (deducida del caso dorado, confirmar en la corrida en paralelo): salario diario = mensual ÷ 30 **redondeado a 4 decimales**; todo monto por días = `round(días × diario, 2)`; cada línea se redondea a centavos al crearla y los totales suman líneas ya redondeadas. Solo `numeric` en Postgres; nunca `float` ni cálculo en JavaScript.
7. **La causa de terminación decide la indemnización** (arts. 43, 45, 47, 48). Vacaciones y aguinaldo proporcionales se pagan siempre (art. 42).
8. **El aguinaldo es intocable** (art. 97): exento de IR, INSS y de todo descuento; inembargable salvo alimentos. Un préstamo no se descuenta del aguinaldo, tampoco en la liquidación.

## Procedimiento

1. Lista los conceptos que toca la tarea y busca cada uno en [references/formulas.md](references/formulas.md): fórmula, insumos, parámetro, artículo y redondeo.
2. Para cada parámetro, anota su código en `parametros_ley` (o tabla de tramos) y su estado de certeza. Si el código no existe, es una propuesta: repórtala, no la inventes.
3. Escribe o actualiza la prueba dorada con las cifras de [references/caso-dorado.md](references/caso-dorado.md). El caso de liquidación de C$45,021.66 es obligatorio en PL2.
4. Si la tarea toca un punto de la lista "Pendiente de verificar", deja el valor parametrizado y el aviso en pantalla; no lo resuelvas por tu cuenta.

## Pendiente de verificar (resumen; detalle en marco-legal.md)

Techo del INSS · límite exacto de 50 trabajadores · salario mínimo de cotización · tasas IVM · retención del 10% a servicios profesionales · feriados locales de Managua (1 y 10 de agosto) y asuetos · plazos de pago INSS e IR · tope de embargo por alimentos · INSS e IR de vacaciones pagadas no gozadas · IR en planilla quincenal y método acumulado · período del aguinaldo (el caso dorado sugiere enero–diciembre) · indemnización mínima con menos de un año · base con salario variable · política de subsidios (decisión 4).

## Restricciones

- No cambiar `docs/plan/20-planilla.md` para que coincida con un cálculo: si el código y el plan chocan, se reporta al coordinador.
- Nada de datos personales en pruebas ni ejemplos: prefijo `PRUEBA` y cifras anonimizadas.
- No consultar ni copiar textos de AG Planilla; solo su funcionamiento.

## Si falta información

- Falta un valor, una tasa o una decisión: detente y pregunta al coordinador con la pregunta concreta (qué dato, para qué fórmula, qué fuente lo confirmaría).
- Una fuente externa contradice el plan 20: no lo corrijas en silencio; repórtalo con la cita y la fecha.
