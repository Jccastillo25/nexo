# Casos dorados

Cifras que el motor debe reproducir **exactamente** (al centavo). Sin nombres,
cédulas ni datos de personas: son casos anonimizados (plan 20 §1.4) o
construidos.

Tipos:
- **Observado en AG**: cifra real de AG Planilla, recorrida el 2026-10-21. Obligatorio.
- **Derivado**: calculado por el especialista con las fórmulas y tasas de esta skill. No validado por el contador ni contra AG; sirve como prueba de regresión y se confirma en la corrida en paralelo (PL7).

## G1 — Liquidación (observado en AG, obligatorio en PL2)

Contrato de facturador, indeterminado (se infiere de que AG pagó art. 45),
ingreso **2023-06-01**, egreso **2026-09-01**, salario mensual **C$11,350.00**.

| Paso | Cálculo | Resultado |
|---|---|---|
| Salario diario | `round(11350 / 30, 4)` | **378.3333** |
| Antigüedad | meses completos 2023-06-01 → 2026-09-01 | 39 meses (3 años y 3 meses) |
| Días de indemnización | 36 × 30/12 + 3 × 20/12 = 90 + 5 | **95** (entre 30 y 150) |
| Indemnización | `round(95 × 378.3333, 2)` = round(35,941.6635) | **35,941.66** |
| Aguinaldo proporcional | 20 días × 378.3333 = 7,566.666 | **7,566.67** |
| Vacaciones pendientes | 4 días × 378.3333 = 1,513.3332 | **1,513.33** |
| **Total** | 35,941.66 + 7,566.67 + 1,513.33 | **45,021.66** |

Por qué el diario va a 4 decimales: con el diario sin redondear
(378.3333…), la indemnización daría 35,941.67 y el total 45,021.67. Calcular
por meses (3 × 11,350 + 5 días) también da 35,941.67. Solo `días × diario a 4
decimales` reproduce AG. Truncar o redondear el diario da lo mismo en este caso
(el quinto decimal es 3): falta un caso que los distinga.

Lo que este caso **no** explica y queda como insumo de la prueba, no como regla:
- **20 días de aguinaldo** = 8 meses × 2.5. Corresponde a enero–agosto de 2026, no a diciembre 2025–agosto 2026 (que daría 9 meses = 22.5 días). Sugiere que la empresa corta el aguinaldo por año calendario. Confirmar con el contador (marco-legal.md §4).
- **4 días de vacaciones**: es el saldo a la fecha (depende de lo gozado); la prueba lo carga como saldo, no lo calcula.
- La causa de terminación no está registrada en el plan; se asume una con derecho a art. 45 (despido sin causa o renuncia, art. 43).

Aserciones mínimas de la prueba: diario 378.3333; días 95; cada línea; total
45,021.66; sin préstamos que descontar.

## G2 — Provisiones de una quincena (observado en AG)

Salario mensual C$11,350 → quincena **C$5,675.00**.

| Provisión | Cálculo | Monto |
|---|---|---|
| Vacaciones | 1.25 días × 378.3333 = 472.9166 | 472.92 |
| Aguinaldo | 5,675 / 12 = 472.9166 | 472.92 |
| Indemnización (método AG, 1/12) | 5,675 / 12 | 472.92 |
| **Total** | suma de líneas redondeadas | **1,418.76** |

Si la prueba da 1,418.18 está usando 8.33% literal; si da 1,418.75, está
redondeando el total en vez de cada línea.

## G3 — Aportes patronales (derivado; coincide con plan 20 §9)

Salario C$11,350, régimen laboral integral, menos de 50 trabajadores:
INSS patronal `round(11350 × 0.215, 2)` = **2,440.25**; INATEC
`round(11350 × 0.02, 2)` = **227.00**; total **2,667.25**.

## G4 — IR mensual, salario mínimo de comercio (derivado)

C$11,350 mensual, régimen laboral, método de proyección:
INSS laboral 794.50 → neta 10,555.50 → anual 126,666.00 → tramo 15% sobre
26,666.00 = 3,999.90 → ÷ 12 = 333.325 → **333.33**.
Detecta el modo de redondeo: mitad al par daría 333.32, y `Number` de
JavaScript con `toFixed(2)` también puede dar 333.32.

## G5 — IR mensual, tramo del 20% (derivado)

C$20,000 mensual: INSS 1,400.00 → neta 18,600.00 → anual 223,200.00 →
15,000 + 23,200 × 20% = 19,640.00 → ÷ 12 = 1,636.6667 → **1,636.67**.

## G6 — Tope de indemnización (derivado)

C$11,350, 10 años exactos, indeterminado: 90 + 7 × 20 = 230 días → tope
**150 días** → `round(150 × 378.3333, 2)` = round(56,749.995) = **56,750.00**.

## G7 — Servicios profesionales (observado en AG)

Contrato `servicios_profesionales`, IR exento (0%): INSS laboral, IR, INSS
patronal e INATEC = **0.00**. Las provisiones siguen si el contrato las tiene
configuradas. Debe aparecer el aviso "Revisar régimen con el contador" si tiene
jornada o marcas.

## G8 — Causa de terminación (derivado, depende de verificación)

Mismo contrato de G1:
- Renuncia con preaviso → igual que G1 (art. 43).
- Despido con causa justa (art. 48) → indemnización 0; total 7,566.67 + 1,513.33 = **9,080.00**.
- Antigüedad de 4 meses, despido sin causa → días por fórmula 10, mínimo legal 30 → **30 días** (verificar que el mínimo aplica con menos de un año).

## Pendientes de caso dorado

- Una planilla quincenal completa de AG (devengado, INSS, IR, neto) con un contrato en régimen laboral: **no existe** en la empresa hoy (todos son "Free-lance"). Se necesita un caso calculado por el contador.
- Totales de septiembre de 2026 (plan 20 §1.3): devengado 34,700.00, otras deducciones 2,102.71, neto 32,597.29, costo con provisiones 43,036.82. La diferencia costo − devengado (8,336.82) **no es el 25%** de 34,700 (8,675.00); sin el detalle por persona no se puede reconstruir. Pedir el detalle anonimizado para PL7.
