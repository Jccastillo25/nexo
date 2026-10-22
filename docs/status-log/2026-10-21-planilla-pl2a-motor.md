# 2026-10-21 — Planilla PL2a: esquema y motor de cálculo en RPC

- **Subfase:** F1.7 (motor de planillas), etapa PL2a del [plan 20](../plan/20-planilla.md).
- **Estado:** 🟡 análisis → 🟡 PL2a **APLICADA en `nexo-core`** el 2026-10-21 (versión `20261021191441`), con aprobación del usuario ("Si"). Sin commit y sin UI.
- **Migración:** `supabase/migrations/20261021191441_rrhh_planilla_pl2a_motor.sql`. Se escribió con el prefijo local `20261021220000` y se renombró a la versión remota al aplicarla.
- **Pruebas:** `supabase/tests/rrhh_planilla_entorno.sql` y `supabase/tests/rrhh_planilla_pl2a.prueba.sql`, en el script `test:rrhh:planilla-pl2a`, que ya es parte de `test:db`.
- **Otros archivos tocados:**
  - `supabase/tests/run_rrhh_pglite.mjs` muestra los mensajes `FALLO PL2: …` con cifras;
  - `package.json` tiene el script nuevo.

## Pedido

Encargo de la sesión de análisis de Planilla, en nombre del usuario: reconstruir el módulo de Planilla con las skills nuevas, empezando por la etapa PL2 (esquema y motor en RPC). La UI (PL4) va después, con subagentes, y la decisión 5 (app propia o dentro de RRHH) sigue abierta.

## Verificación remota previa (solo lectura, `nexo-core`)

| Pieza | Hallazgo |
|---|---|
| `parametros_ley` | 4 filas desde 2026-09-02: INSS laboral 7%, **patronal 22.5%**, INATEC 2% y techo C$100,000 (ejemplo). Tenía escritura directa con `parametros.editar`, sin auditoría |
| `feriados`, `planillas`, `planilla_detalles` | 0 filas. `planillas` y `planilla_detalles` tienen policies y grants de escritura directa que ninguna app usa |
| Contratos | 5 activos, ninguno finalizado ni en borrador, un contrato por persona. **4 tienen compensación y los 4 están en `mensual`**, mientras AG paga quincenal. Los 5 tienen jornada y ninguno tiene fecha de fin prevista. Empiezan los días 1, 15 y 16 |
| Empresas | 1 (`materiales-jcastillo`) |
| Permisos | 25 `rrhh.planillas.*`: admin 25, especialista 18, consulta 7, supervisor 2, gestor 1. **Ningún rol de empresa** los tiene, así que hoy solo entra la persona propietaria |
| Esquema | `rrhh` sin default privileges (solo `public` los tiene); pgcrypto en `extensions`; `asistencia_marcas` con `contrato_id`; Postgres 17.6 |

## Decisiones del usuario (en el chat de esta sesión)

| Pregunta | Respuesta |
|---|---|
| Período del aguinaldo | Ene–dic, como AG |
| "Quien calcula no aprueba" con una sola persona | Estricta |
| Particiones extra | Provisiones y vacaciones; las cuotas de préstamo no |
| Antigüedad al cambiar el salario | "Al cambiar el salario todas las prestaciones se mantienen pero cambian su valor ya que aumenta y se tiene que recalcular únicamente el valor no el tiempo" |
| Régimen de los 5 contratos activos | Servicios profesionales exentos, como AG |
| IR quincenal | Ajuste en la 2.ª quincena |
| Provisión de indemnización | 1/12 fijo, como AG |
| Frecuencia mensual de los contratos de Nexo frente a la quincenal de AG | Pasarlos a quincenal, y que las RPC de contrato reciban la frecuencia |
| Permiso para fijar la antigüedad | `liquidaciones.aprobar` |

Quedaron en el plan 20 §3.1. Los 9 hallazgos de las skills contra el plan 20 §3 se resolvieron así:

| Hallazgo | Resolución en PL2a |
|---|---|
| 1. Causa de terminación (arts. 45, 47, 48) | El simulador recibe la causa. Las de despido sin causa, renuncia, mutuo acuerdo y confianza pagan el art. 45; la de causa justa solo paga vacaciones y aguinaldo. Vencimiento y fallecimiento fallan con "pendiente de definir con el contador". Guardar la causa en el documento de liquidación es de PL2b |
| 2. Aguinaldo intocable (art. 97) | El simulador no descuenta nada; se corrigió la fila "Liquidación" del plan 20 §3 |
| 3. Exención de IR de la indemnización | El art. 45 tiene tope de 5 meses y está exento. Si la indemnización pasa la exención, sale un aviso; la retención del excedente queda para verificar |
| 4. Diario a 4 decimales | `round(mensual / dias_mes_comercial, 4)`. Una prueba de mutación lo confirma: con 2 decimales, G1 falla |
| 5. Período del aguinaldo | Decidido: ene–dic, parámetro `aguinaldo_mes_inicio` |
| 6. Estados y permisos | El estado se llama `calculada`. Con un solo admin la aprobación es estricta. Pagar y anular una liquidación van al Paso Cero de PL2b. Que `consulta` vea salarios por `planilla.ver` es de la matriz aprobada y no se cambió |
| 7. Antigüedad entre contratos | `contratos.fecha_antiguedad`, con RPC propia y herencia |
| 8. Particiones adicionales | Decidido; se aplican en PL2b, cuando existan esas tablas |
| 9. Runner de PGlite | Ahora muestra los mensajes `FALLO PL2: …` con cifras |

## Revisión independiente (`reviewer`, 1.ª ronda)

No hubo hallazgos críticos de acceso. Hubo 2 altos, 10 medios y 10 bajos, varios reproducidos en PGlite. Todos se corrigieron en la misma migración, que todavía no estaba aplicada:

| Hallazgo | Corrección |
|---|---|
| Alta 1: un régimen con fecha a mitad de período bloqueaba la planilla y no se podía corregir | La vigencia es el inicio del contrato o el día 1 o 16. La vigencia abierta sin usar se corrige y queda auditada como `regimen_corregido`. Se acepta régimen en contratos finalizados |
| Alta 2: IR y techo del INSS calculados por contrato (el IR daba 0.00 en vez de 212.00 al cambiar de contrato) | Se calculan por persona: suman los otros contratos de la planilla y la 1.ª quincena de la persona |
| Media: 2.ª quincena sin la 1.ª | Falla con motivo, salvo que el contrato haya empezado después del 15 |
| Media: la planilla sembrada no incluía a nadie | Decisión del usuario: frecuencia quincenal (ver arriba) |
| Media: un contrato se pagaba en dos tipos de planilla | Un solo tipo activo por clase y frecuencia, y guarda en el motor |
| Media: días de calendario sobre una base de 30 | Regla 30/360 (`fn_planilla_dia_comercial`) |
| Media: se podía anular la 1.ª quincena con la 2.ª aprobada | Se rechaza mientras la 2.ª esté viva |
| Media: concurrencia en la huella y en las novedades | La huella se toma al inicio y se compara al final; las novedades bloquean `for share` |
| Media: `fecha_antiguedad` escribible sin auditoría | Trigger que bloquea la escritura directa, más la RPC `planilla_contrato_antiguedad_fijar` |
| Media: `parametros_ley` escribible sin auditoría | Se retiró la escritura directa y se agregó la RPC `planilla_parametro_vigencia_nueva` |
| Media: contratos finalizados sin régimen | `regimen_cambiar` acepta finalizados hasta su `fecha_fin_real`. En remoto no hay ninguno |
| Media: faltaban pruebas | Ver la tabla de pruebas |
| Bajas | Provisión de aguinaldo por parámetro; huella en epoch, solo de los contratos de la planilla y con los valores de los tramos; mensajes legibles; `unique_violation` atrapado; clave de idempotencia en novedades; IVM rechazado sin tasas; poscheques y prechequeos completos; FK compuestas; fecha de pago validada; rollback completo |

## Revisión independiente (`reviewer`, 2.ª ronda)

Encontró 1 hallazgo alto y 1 medio nuevos, más residuos bajos. Todos se corrigieron:

| Hallazgo | Corrección |
|---|---|
| Alta: dos cambios de régimen en un contrato finalizado se solapaban y bloqueaban el período | La vigencia nueva queda abierta también en contratos finalizados (el motor la acota por la fecha de fin), y se rechaza cualquier solape. Hay prueba de dos cambios y del cálculo de diciembre |
| Media: `crear_contrato` con frecuencia fallaba con 42702 (columna ambigua) | Columna calificada. El entorno ahora tiene catálogos mínimos y la prueba ejecuta de verdad `crear_contrato` y `editar_contrato`, con y sin frecuencia |
| Bajas | Rangos de parámetros (sin cero en divisores ni días; mes del 1 al 12). Orden de bloqueo de `novedad_anular` contra el cálculo. La migración de frecuencia incluye borradores y guarda el valor anterior real. Fecha de inicio anterior a la antigüedad, con mensaje propio. `unique_violation` de la clave de idempotencia, atrapado. IVM exige las dos tasas vigentes. El día 16 se rechaza en contratos mensuales. La huella incluye el descarte del aviso. Mensajes de validación en P0001, que es lo que la UI muestra tal cual. Comentarios de las RPC de contrato restaurados. Provisiones sin tasa redondeada |

## Qué crea la migración

- **Parámetros:**
  - cierra el 22.5% patronal el día de su semilla y abre el 21.5% desde 2026-09-03;
  - agrega `certeza` y `fuente`;
  - agrega 16 parámetros desde 2026-01-01;
  - deja la escritura solo por RPC;
  - agrega `ir_tramos` 2015 (5 tramos de la DGI).
- **Feriados:** columna `tipo` y los 14 de 2026: 9 nacionales (CT art. 66) y 5 asuetos, como en AG. El 1 y el 10 de agosto de Managua no se cargaron.
- **Contratos:**
  - `fecha_antiguedad`, protegida por trigger;
  - frecuencia quincenal en los activos, y default quincenal;
  - `crear_contrato` y `editar_contrato` con `p_frecuencia_pago`.
- **Tablas nuevas:**
  - `contrato_regimen` (con la carga inicial de los contratos activos);
  - `planilla_tipos` ("Planilla quincenal") y `conceptos` (16);
  - `planilla_empleados`;
  - `planilla_lineas` y `novedades`, particionadas por mes desde 2026-01.
- **`planillas`:** se amplía, y `planilla_detalles` queda en desuso.
- **Motor `rrhh.fn_planilla_calcular_nucleo`:** idempotente, en el orden de la skill `nexo-planilla-motor`, por persona y con huella sha256 de insumos y de líneas.
- **Triggers de inmutabilidad:** `trg_planilla_proteger`, `trg_planilla_empleados_proteger` y `trg_planilla_lineas_proteger`.
- **12 RPC `public.planilla_*`:** ver [`DATABASE.md`](../DATABASE.md).
- **Auditoría:** cada transición, novedad, cambio o corrección de régimen, descarte de aviso, antigüedad, parámetro y la migración de frecuencia se registran con `core.fn_auditar`.
- **Prechequeos, poscheques y rollback** comentado en el encabezado.

## Pruebas (PGlite, `npx.cmd --yes pnpm@9.15.9 test:db` en verde, exit 0)

| Caso | Resultado |
|---|---|
| G1, liquidación real | Diario 378.3333; 95 días = 35,941.66; aguinaldo 20 días = 7,566.67; vacaciones 1,513.33; **total 45,021.66** |
| G8, renuncia y causa justa | Renuncia igual a G1; causa justa 9,080.00; 4 meses llevan el mínimo de 30 días (11,350.00) con aviso |
| G6, tope | 150 días = 56,750.00 |
| G2, provisiones de la quincena | 472.92 × 3 = 1,418.76 |
| G7, servicios profesionales | 0 de INSS, IR y aportes, más el aviso "Revisar régimen con el contador" (por jornada y por marcas) |
| G3, G4 y G5, mensual laboral | INSS 794.50, IR 333.33, patronal 2,440.25 e INATEC 227.00; IR del tramo del 20%: 1,636.67 |
| IR quincenal | 166.66 + 166.67 = 333.33. Falla si la 1.ª no está aprobada o no existe |
| IR por persona | Contrato de C$11,350 hasta el 15 y otro de C$12,000 desde el 16: **212.00** |
| Antigüedad heredada | 22 meses con el último salario (diario 400): 55 días = 22,000.00 |
| Días 30/360 | Egreso el 25 de febrero: 9,458.33. Ingreso el 16: 5,675.00 |
| Techo del INSS | Salario de 150,000: 7,000.00 y 21,500.00 |
| Horas extra y ausencias | 2 h = 189.17; 13 días = 4,918.33. Tope diario, tope semanal y neto negativo, rechazados |
| Retención fija de servicios profesionales | 10% de 20,000 = 2,000.00, sin aportes ni provisiones |
| Reglas | Idempotencia de líneas y huella; insumo cambiado; quien crea o quien calcula no aprueba; transiciones ilegales; inmutabilidad de aprobada, pagada y anulada (también el INSERT); pago por cheque y por transferencia; anulación que libera novedades y reemplazo enlazado; anular la 1.ª con la 2.ª viva, rechazado; régimen incoherente, a mitad de período, sin usar (corregido), ya usado, faltante e IVM sin tasas; parámetro faltante y vigencia nueva auditada; código exacto del 42501 en las 12 RPC y sin sesión; empresa ajena; partición nueva con RLS y sin grants; privilegios; huella calculada en UTC y aprobada en America/Managua; reintento sin duplicar; frecuencia migrada en el contrato existente; escritura directa de antigüedad, rechazada; auditoría de 12 acciones |
| Mutaciones | Diario a 2 decimales: G1 falla. IR por contrato: 0 en vez de 212.00. Días de calendario: 4,918.33 en vez de 5,675.00. Las tres se detectan |

**Lo que PGlite no prueba:** RLS efectiva con roles reales, PostgREST, `pg_cron`, concurrencia ni el planificador de `nexo-core` ([CI_CHECKS](../CI_CHECKS.md)).

## Ensayo en `nexo-core` (transacción revertida)

- Se ejecutaron la migración completa y una corrida real en una sola llamada, y al final se forzó una excepción para revertir todo. La corrida fue crear y calcular la 1.ª quincena de octubre de 2026 como la persona propietaria, más una simulación de liquidación de cada contrato activo.
- **Primer intento:** fue incompleto, porque se omitieron por error secciones de la migración. Mostró "no tiene régimen" y se repitió.
- **Ensayo final, con las correcciones de la 2.ª ronda:** mismos resultados del ensayo completo de abajo. Además:
  - la auditoría de frecuencia registra el valor anterior real ("mensual" en los 4);
  - `editar_contrato` con la firma nueva sobre un contrato activo responde "Solo se puede editar un contrato en estado borrador";
  - después se volvió a confirmar que no quedó nada.
- **Ensayo completo:**
  - los prechequeos y los poscheques pasaron;
  - INSS patronal vigente en octubre: 0.2150;
  - 20 parámetros abiertos, 14 feriados, 5 tramos y 16 conceptos;
  - régimen de servicios profesionales exento en 5 contratos;
  - frecuencias: 4 quincenales y 1 contrato sin salario;
  - 13 particiones por tabla;
  - la quincena se calculó con **4 personas**, 4 avisos de régimen y los avisos "1 contrato activo sin salario" y "provision indemnizacion divisor";
  - las líneas fueron SALARIO y las 3 provisiones;
  - la simulación de liquidación dio OK;
  - 4 auditorías de frecuencia migrada.
- **Verificado después de cada ensayo:**
  - sin tablas, particiones ni RPC nuevas;
  - 4 parámetros y 0 feriados;
  - las compensaciones siguen en mensual;
  - `crear_contrato` con la firma original;
  - 0 auditorías de planilla.
- No se mostraron salarios ni nombres. Las secuencias de `core.audit_log` pueden haber avanzado aunque se haya revertido.

## Aplicación en `nexo-core` (2026-10-21)

- **Aprobación del usuario:** "Si", a la pregunta "¿Aplico la migración PL2a en `nexo-core` ahora?".
- **Cómo:** `apply_migration` (`rrhh_planilla_pl2a_motor`), versión remota **`20261021191441`**. El archivo local se renombró a esa versión y las referencias de la documentación y de `package.json` se actualizaron. Los prechequeos y poscheques de la migración pasaron dentro de la misma transacción.
- **Poscheque remoto:**
  - 7 tablas nuevas, 26 particiones (13 por tabla) y 12 RPC `public.planilla_*`;
  - INSS patronal vigente hoy: 0.2150;
  - 20 parámetros abiertos y 14 feriados de 2026;
  - régimen de servicios profesionales exento en 5 contratos;
  - 4 compensaciones en quincenal y 1 contrato activo sin salario;
  - `crear_contrato` con la firma nueva;
  - 4 auditorías `rrhh.planilla.frecuencia_migrada`;
  - 0 planillas.
- **Advisors de seguridad:** sin hallazgos nuevos fuera del patrón.
  - Las 26 particiones aparecen en `rls_enabled_no_policy` (INFO), porque tienen RLS sin policies a propósito.
  - Las 12 RPC y las 2 de contrato aparecen en `authenticated_security_definer_function_executable` (WARN); cada una valida su permiso.
  - `anon_security_definer_function_executable` sigue en 5, ninguna de planilla.
- **`pnpm test:rrhh:planilla-pl2a`:** en verde con el archivo renombrado.

## Pendiente

- Regenerar `apps/rrhh/src/lib/supabase/database.types.ts`, que no conoce las tablas ni las RPC nuevas.
- **Antes de la primera planilla real:**
  - dar el rol de aprobador o de especialista a una segunda persona;
  - asignar salario al contrato activo que no lo tiene;
  - confirmar con el contador los valores "verificar", el régimen de cada persona, la regla 30/360 y los feriados locales.
- **Etapas siguientes:**
  - PL2b, con su Paso Cero para pagar y anular una liquidación;
  - las pantallas (PL4), donde el formulario de contratos enviará la frecuencia y un contrato nuevo recibirá régimen al activarse;
  - la decisión 5;
  - la corrida en paralelo con AG (PL7).
- **Sin implementar:**
  - validación de salario mínimo (falta el sector por contrato);
  - IR semanal (falla con motivo);
  - descuento parcial de deducciones que no caben (hoy falla con motivo).
- **Deuda pre-existente que se mantiene:** el mensaje de `core.fn_exigir_permiso` usa voseo ("No tenés permiso").
