# Marco legal vigente y grado de certeza

Resumen operativo del plan 20 §2 con lo verificado por el especialista el
2026-10-21. **Los valores cambian por año**: el valor de esta tabla es el de la
fecha indicada; el que usa el motor es el de `rrhh.parametros_ley` vigente al
período. Antes de usar un valor en producción, el coordinador lo confirma en el
remoto (las semillas actuales tienen errores conocidos, ver abajo).

Estados:
- **Oficial**: texto de la ley o de la DGI.
- **Coincidente**: varias fuentes secundarias coinciden.
- **Verificar**: las fuentes chocan o depende de la empresa. Lo confirma el contador o la factura del INSS.

## 1. Tasas y montos (parametrizados)

| Concepto | Valor (fecha) | Base | Estado | Dónde vive en Nexo |
|---|---|---|---|---|
| INSS laboral, integral | 7% del bruto que cotiza (desde 15-feb-2019) | Decreto 06-2019 | Coincidente | `parametros_ley.inss_laboral` = 0.07 (semilla `20260902000008`, correcta) |
| INSS patronal, integral | 21.5% con menos de 50 trabajadores; 22.5% con 50 o más | Decreto 06-2019 | Coincidente; **verificar el límite exacto**: el plan dice "50 o más", una guía secundaria dice "más de 50". AG tiene 21.5% | `parametros_ley.inss_patronal` = **0.225 en la semilla: incorrecto para la empresa**, corrección pendiente en PL2 (plan 20 §5.1). Propuesto: `inss_patronal_menos_50` |
| INSS IVM-RP | Laboral 4.75%–5%; patronal 12.5%–16.5% | Decreto 06-2019 | Verificar (fuentes no coinciden) | Sin código; solo si un contrato usa IVM |
| Techo de cotización INSS | Sin techo desde 1-feb-2019 según el texto del decreto en una copia secundaria (leybook); una guía usa C$132,267.50 (2024) | Decreto 06-2019 / RI-112-2018 | Verificar con la factura del INSS | `parametros_ley.techo_inss` = 100000 (**valor de ejemplo**, comentario `TODO` en la semilla). AG: C$99,999.99 |
| Salario mínimo de cotización | AG: C$11,350 desde marzo de 2025 | Configuración de AG | Verificar si aplica y cómo | Sin código |
| INATEC | 2% patronal sobre planilla bruta; lo cobra el INSS en su factura | Decreto 40-94 | Coincidente | `parametros_ley.inatec` = 0.02 |
| Salario mínimo | Por sector, 01-mar-2026 a 28-feb-2027 (+4%). Comercio C$11,350.08 | Acuerdo MITRAB 5-mar-2026 | Coincidente; verificar el sector **por contrato o puesto** | Propuesto: `salario_minimo_<sector>`. Tabla completa en plan 20 §2.2 |
| Retención a servicios profesionales | 10% general (AG usa 0%) | Ley 822 y reglamento | Verificar: no se encontró fuente oficial vigente el 2026-10-21 | Propuesto: `ir_servicios_profesionales`, y el % por contrato en `contrato_regimen` |

`parametros_ley.valor` es `numeric(12,4)` y los porcentajes se guardan como
fracción (0.07), verificado en `supabase/migrations/20260902000008_rrhh_nicaragua_and_contracts.sql:36-65`.
Hay un índice único de "una fila abierta por código y empresa"
(`parametros_ley_activo_unico`): cambiar un valor = cerrar la fila
(`vigente_hasta`) y crear otra; no hay policy de `delete`.

## 2. IR de rentas del trabajo

- Tarifa anual sobre renta neta (Ley 822 art. 23, reformado por Ley 891 de 2014): tramos 0 / 15% / 20% / 25% / 30% con cortes en 100,000 · 200,000 · 350,000 · 500,000 e impuesto base 0 · 0 · 15,000 · 45,000 · 82,500. **Oficial** (DGI; coincide con la compilación de nicatributos revisada el 2026-10-21 y con la tabla de AG). Tabla completa: plan 20 §2.1. Va en una tabla de tramos con vigencia, una fila por tramo.
- Renta neta = ingresos que afectan IR − INSS laboral (− aportes a fondos de ahorro).
- Retención mensual por **proyección**: neta del mes × 12 → impuesto anual → ÷ 12. Oficial (reglamento art. 19).
- **Método acumulado** para salario variable: práctica común, no confirmada como obligatoria. Verificar. Requiere lo ya retenido en el año (saldos de AG si se arranca a mitad de año, decisión 7).
- **IR en planilla quincenal: no está definido** en el plan ni en la ley revisada (¿retener por quincena proyectando ×24, o todo en la segunda quincena sobre el mes?). Se decide replicando a AG en la corrida en paralelo. Verificar.

Exenciones (Ley 822 art. 19, reformado por Ley 891; revisado en nicatributos el 2026-10-21):
- Los primeros C$100,000 de renta neta anual (ya incluido en el tramo 0%).
- Décimo tercer mes: exento hasta lo que dispone el Código del Trabajo.
- Indemnizaciones: exentas hasta **5 meses** de salario; lo adicional (p. ej. art. 47) exento hasta **C$500,000**; el excedente lleva retención definitiva del 15% (art. 24 num. 1). *El plan 20 §2 solo menciona los 5 meses; los otros dos datos se agregan aquí y se reportan al coordinador.*

## 3. Código del Trabajo (Ley 185)

Artículos 42, 43, 44, 45, 47, 48, 76, 77, 78 y 93–97 contrastados el
2026-10-21 contra el texto publicado en Justia Nicaragua (resumen, no cita
literal). El resto viene del plan 20 §2.3 sin contrastar.

| Tema | Regla | Art. | Estado |
|---|---|---|---|
| Jornada | Diurna 8 h/día y 48/semana; nocturna 7 y 42; mixta 7.5 y 45 | 51 | Plan 20 |
| Horas extra | Máx. 3 al día y 9 a la semana; pago doble | 57, 58, 62 | Plan 20 |
| Descanso o feriado trabajado | Extraordinario, pago doble | 57, 62, 68 | Plan 20 |
| Séptimo día | 1 por cada 6 trabajados; incluido en salario quincenal o mensual | 64, 87 | Plan 20 |
| Feriados nacionales | 1-ene, Jueves y Viernes Santo, 1-may, 19-jul, 14 y 15-sep, 8 y 25-dic; asuetos por decreto. AG carga 14 fechas en 2026 (plan 20 §1.3), sin el 1 y el 10 de agosto | 66 | Verificar feriados locales y asuetos |
| Pago | En córdobas; máximo 1 semana (obreros) o 15 días (empleados); mora = 1/10 por semana | 86 | Plan 20 |
| Terminación, cualquier causa | Se pagan vacaciones y décimo tercer mes proporcionales | 42, 77 | Contrastado |
| Mutuo acuerdo o renuncia | No afecta el derecho de antigüedad del art. 45 | 43 | Contrastado |
| Preaviso de renuncia | 15 días por escrito (contrato indeterminado) | 44 | Contrastado |
| Indemnización | **Contrato por tiempo indeterminado** terminado sin causa justificada: 1 mes por cada uno de los primeros 3 años, 20 días por año desde el 4.º; mínimo 1 mes, máximo 5 meses; fracciones proporcionales | 45 | Contrastado |
| Trabajadores de confianza | Sin reintegro; 2 a 6 meses de salario si tienen al menos 1 año | 47 | Contrastado; **no está en el plan 20** |
| Despido con causa justa | Solo lo del art. 42 (sin indemnización), con autorización previa del Inspector y dentro de 30 días | 48 | Contrastado; **no está en el plan 20** |
| Vacaciones | 15 días por cada 6 meses ininterrumpidos (2.5 por mes) | 76 | Contrastado |
| Base de vacaciones | Último salario ordinario; si es variable, promedio de 6 meses | 78 | Contrastado |
| Décimo tercer mes | Un mes por año, o proporcional si trabajó más de un mes | 93 | Contrastado |
| Base del aguinaldo | Último mes; con comisiones o destajo, el más alto de 6 meses | 94 | Contrastado |
| Plazo del aguinaldo | Primeros 10 días de diciembre o 10 días tras terminar; mora = 1 día de salario por día | 95 | Contrastado |
| Tiempo que cuenta para aguinaldo | Vacaciones, ausencias justificadas, permisos, asuetos, subsidios | 96 | Contrastado |
| Protección del aguinaldo | Inembargable salvo alimentos; exento de impuestos, descuentos y deducciones | 97 | Contrastado |
| Salario mínimo | Nadie bajo el mínimo de su sector; mínimo inembargable salvo alimentos | 82, 92 | Plan 20 |
| Maternidad | 4 semanas antes y 8 después (10 si múltiple); cuenta para antigüedad, vacaciones y aguinaldo | 141 | Plan 20 |
| Subsidio por enfermedad | INSS paga 60% desde el 4.º día (desde el 1.º con hospitalización o accidente); lo demás es política de la empresa | Ley de Seguridad Social | Plan 20; política pendiente (decisión 4) |

## 4. Lista de verificación pendiente (quién la cierra)

| Punto | Por qué importa | Quién |
|---|---|---|
| Techo del INSS | Cambia INSS en salarios altos | Factura del INSS |
| Límite de 50 trabajadores (≥50 o >50) | 21.5% vs 22.5% | Contador |
| Salario mínimo de cotización | Base mínima de INSS en salarios parciales | Contador / INSS |
| Retención a servicios profesionales | % por defecto del régimen | Contador / DGI |
| Feriados locales y asuetos 2026 | Pago doble de feriado trabajado | MITRAB / alcaldía |
| Plazos de pago INSS e IR (VET) | Alertas del calendario de declaraciones | Contador |
| Tope de embargo por alimentos | Validación de embargos | Abogado (Código de Familia) |
| Vacaciones pagadas no gozadas: INSS e IR | Flags del concepto | Contador |
| IR quincenal y método acumulado | Retención de cada quincena | Corrida en paralelo con AG |
| Período del aguinaldo (dic–nov o ene–dic) | Días proporcionales | Contador; el caso dorado sugiere ene–dic |
| Mínimo de 1 mes de indemnización con menos de 1 año | Liquidaciones de personal nuevo | Abogado |
| Base de indemnización con salario variable | Comisionistas | Abogado |
| Contrato determinado: ¿indemnización al vencer? | El art. 45 habla de contrato indeterminado | Abogado |
| Política de subsidios (3 días / 40%) | Concepto de subsidio | Usuario (decisión 4) |
