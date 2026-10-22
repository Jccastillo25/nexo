# 20 — Planilla y prestaciones (reemplazo de AG Planilla)

**Estado:** ANÁLISIS. Es un borrador del 2026-10-20 y no tiene nada aplicado.
- El marco legal está investigado, con fuentes al final.
- AG Planilla se recorrió con sesión el 2026-10-21 (§1.2–§1.4). El día anterior su servidor había fallado.
- **El Paso Cero de §8 está aprobado y aplicado** (`20261021160943`, 2026-10-21), con la separación de funciones incluida. Todavía no hay tablas.
- Dos modalidades: decidido el 2026-10-21 (§8.3).
- **PL2a (esquema y motor de la planilla ordinaria, más el simulador de liquidación)** está **aplicada en `nexo-core`** (`20261021191441`, 2026-10-21, con aprobación del usuario) y probada en PGlite. Las decisiones del motor del 2026-10-21 están en §3.1.
- **PL2b (prestaciones) y PL2c (reportes, declaraciones, Asistencia y configuración)** están **aplicadas en `nexo-core`** el 2026-10-22 (versiones `20261021235639` a `20261022001922`), con el Paso Cero de §8.5. Las pantallas de PL4 a PL6 (menos el archivo del banco y el asiento) están construidas en `apps/rrhh`, sin commit y sin verificación visual con sesión. Ver el [detalle](../status-log/2026-10-21-planilla-pl2b-pl2c-pantallas.md).

**Pedido del usuario (2026-10-20):**
- "Quiero analizar el sistema que estoy usando actualmente para el control de planilla y prestaciones, me gustaría traerlo a nexo en funcionalidad pero teniendo optimizaciones".
- Después, ante la falla del servidor: "podrías analizar su documentación, y ver la documentación legal sobre la ley del ministerio del trabajo, INSS, INATEC etc para poderlo aplicar y mañana probar si el servidor responde".

Este plan detalla **F1.7 (motor de planillas)** del [plan 04](04-fase1-rrhh.md) y la sección 8.7 del [plan 03](03-rrhh-dominio.md), que ya pedían planillas sobre contrato y asistencia. No cambia el orden de fases. Lo que agrega es la referencia funcional, AG Planilla, igual que AG Negocio en el [plan 18](18-replica-ag-negocio.md).

## 1. Qué es AG Planilla

- Es un sistema de nómina en la nube de **AG Software, S.A.** (Managua), el mismo proveedor de AG Negocio. Es software propietario, sin código abierto.
- La instancia de la empresa es `agplanilla.net/materialesjcastillo`. La versión del 2026-10-20 es `20261020`.
- La aplicación es Flutter web compilado, así que no tiene rutas legibles como AG Negocio.
- El sitio comercial [agplanilla.com](https://agplanilla.com/) no publica manuales. Lo que sigue sale de su página de funciones.
- Cobra USD 25 de cargo básico más USD 2 por colaborador activo al mes. Anuncia "planes desde C$ 6,300".
- Nexo copia **el funcionamiento**, no su código, su marca ni sus textos.

### 1.1 Funciones que AG Planilla declara

| Grupo | Funciones |
|---|---|
| Gestión de personal | Control de contratos, liquidaciones automáticas, ficha de colaboradores activos y no vigentes, cartas administrativas y constancias, impresión de contratos laborales |
| Nómina | Cálculo semanal, quincenal y mensual; INSS e IR automáticos; colillas de pago generadas y enviadas por correo; archivo de pago electrónico para el banco |
| Control | Vacaciones, préstamos, convenios, embargos salariales, prestaciones sociales y adelantos de salario |
| Cargas masivas | Horas extra, comisiones, deducciones, salarios, contratos y liquidaciones por Excel |
| Declaraciones | INSS, DGI e INATEC "a un clic" |
| Informes | Más de 50: consolidado de nómina, consolidado de provisiones, informes gerenciales y contables |
| Contabilidad | Comprobantes contables de la nómina y de las liquidaciones; nómina y personal por centro de costo |
| Configuración | Multimoneda, varias planillas, catálogo de ingresos y deducciones propio, tabla de IR y tabla de INSS |
| Aguinaldo | Cálculo, pago electrónico y colillas del décimo tercer mes |

### 1.2 Recorrido con sesión (2026-10-21)

Se recorrió el 2026-10-21 en el Chrome del usuario, en solo lectura y sin guardar nada. Los formularios se abrieron y se cerraron sin guardar, y no se usaron "Enviar colillas" ni "Activar planilla".
- La aplicación tiene dos capas: un menú Flutter y pantallas web más antiguas dentro de un marco.
- Para leer el menú se activó la capa de accesibilidad de Flutter.
- Aquí no se copian datos personales: solo estructura, configuración y totales.

**Menú completo (unas 120 opciones):**

| Grupo | Opciones |
|---|---|
| Compañía | Compañía (crear, buscar); Departamentos; Cargos; Catálogos (Ingresos, Tarifas, Provisiones, Deducciones, Incentivos, Tipos de subsidios); Tipo colaborador; Inatec |
| Planillas | Plantillas; Adelanto salarial; Planillas (crear, editar, listar, colillas de pago, carga masiva); Aguinaldo |
| Contrataciones | Contrato (crear, buscar, acciones masivas, préstamo, formatos de contratos, agrupaciones); Empleado (crear, buscar, acciones masivas); Ingresos fijos; Deducciones fijas; Deducciones embargo; Préstamos bancarios; Programa de ahorro; Adelantos; Días descansados (agregar, buscar, carga masiva, actualización masiva); Días de vacaciones; Liquidaciones (carga masiva, actualización masiva, editar, listar); Subsidios (registro, buscar) |
| Contabilidad | Catálogo contable; Centros de costo; Proyectos |
| Informes, Listado | Personal; Lista de empleados; Lista de empresas; Empresas y trabajadores; Estadístico; Cambio de salario; Histórico de centro de costo |
| Informes, Planilla | Consolidados; Resumen de nómina; Adelanto de salario; Consolidado de liquidación; Consolidado de aguinaldo; Comparativo de nómina |
| Informes, Provisiones | Detalle; Consolidado; Ajuste de provisiones; Diferencia del personal liquidado; Acumulado por empresa; Vacaciones (saldo, control) |
| Informes, Banco | Detalle banco; Detalle banco de liquidaciones; Detalle de pago de adelanto; Detalle de pago de aguinaldo; Detalle de pagos adicionales; Depósitos; Pago con cheques; Préstamos bancarios |
| Informes, Impuesto | IR (por empleado, por empresa, **declaración DGI-VET**, carta IR, constancia de retención, auxiliar de cálculo IR, saldos iniciales); INSS (por empleado, por empresa, por empleado y empresa cliente, pago del INSS, **novedades**, colillas INSS); INATEC; diferencias de impuestos en conciliaciones |
| Informes, Contabilidad | Comprobante de planilla; Comprobante de liquidación; Comprobante de aguinaldo; Costo del empleador; Listado de centros de costo; Configuración de centro de costo |
| Informes, Préstamos y embargos | Detalle y consolidado de préstamos; detalle y consolidado de embargos |
| Configuración | Transacciones (bitácora); Usuarios; Cambiar contraseña; Roles; Cuotas INSS; Tabla IR; Bancos; Coeficientes; Otros (activar planilla, liquidación, adelanto, presupuesto y aguinaldo; T/C de planillas en córdobas; firmas predeterminadas); Respaldo; Constantes; **AGP Móvil** (usuarios, calendario de feriados, variables, sucursales, **puntos de marcación**, roles); Jornadas 4x4; Calendario |
| Ayuda | Recursos |

### 1.3 Cómo está configurado y cómo se usa hoy

| Tema | Lo que se vio en AG |
|---|---|
| Compañías | **Dos empleadoras:** Materiales J Castillo (código 005, régimen INSS **Integral**) y Ferretería La Máxima (006). La Máxima tiene sus plantillas con **0 empleados**: hoy no se usa |
| Plantillas | Materiales J Castillo: "Jcastillo" **quincenal** y "Aguinaldo Jcastillo", en córdobas, con 6 empleados cada una. AG permite frecuencias mensual, quincenal, semanal y catorcenal |
| Personal | 136 fichas habilitadas, pero solo **6 contratos vigentes**, todos de Materiales J Castillo. Hay **31 liquidaciones** desde enero de 2023 (5 en 2026), así que la rotación es alta |
| Ficha del empleado | Pestañas de datos personales, información complementaria, cuentas bancarias y beneficiario: es lo mismo que ya tiene el expediente de Nexo |
| Contrato | Clave de nómina INSS, número de colaborador, plantilla, determinado o no, plantilla de aguinaldo, ingreso, cargo, departamento, tipo de colaborador, **modalidad**, salario variable, ciudad, moneda, salario mensual, **tipo y % de IR**, movimiento (traslado o promoción) y observaciones. Pestañas de centros de costo, saldos iniciales y configuración (pago por horas, pagar vacaciones, aguinaldo o indemnización mensualmente, días a provisionar 2.5, temporal, horario, jornada de 8 h, ingresos y deducciones fijos, embargo, jubilado, suspendido, cuenta de banco, tarifa). Acciones: incrementos programados, liquidar, cartas varias, imprimir contrato |
| **Modalidad real** | Los **6 contratos vigentes están como "Free-lance"**, con tipo de IR "por servicio profesional" al **0%**. En la planilla del 16 al 30 de septiembre de 2026, el INSS laboral, el IR, el INSS patronal y el INATEC dan **C$ 0.00** para todos. En junio de 2024 (9 personas) pasa lo mismo. Ver §5.5 |
| Cuotas INSS | Tabla con vigencia por régimen: Integral 7% laboral y **21.5%** patronal desde 2022, con salario mínimo de cotización de C$11,350 desde marzo de 2025. El techo dice C$99,999.99 en Integral y C$999,999.99 en "Zona Gypsum". También hay histórico de 2014: IVM 4.25%/9% e Integral 6.25%/17% |
| Tabla IR | **Igual a la de la DGI** (§2.1). Tiene otra tabla "IR por indemnización", vacía |
| Coeficientes | Salario diario sobre 22, 30 o 30.4167 días. La empresa usa **30 días** y año de **360 días** |
| Compañía, configuración | INATEC normal 2%; período fiscal desde enero; horas extra solo sobre el salario base; séptimo día para nuevos ingresos; sin provisión mensual ni contable; liquidación con indemnización y pago por cuenta bancaria; colilla con "recibí conforme" y salario del contrato. Hay unas 60 opciones más |
| Compañía, contabilidad | Las cuentas de IR, INSS, INATEC, sueldos, aguinaldo, vacaciones, indemnización y adelantos están **vacías**: hoy no se usa el comprobante contable |
| Catálogo de ingresos | 16 filas entre las dos compañías: aguinaldo, bono solidario, complemento al salario mínimo, horas extra, indemnización, reversión de INSS laboral, reversión de IR, vacaciones y viáticos. Cada uno marca ordinario, sujeto a IR, sujeto a INSS, horas extra nocturnas o mixtas y si cuenta para aguinaldo, vacaciones e indemnización. **Un concepto ya usado en una planilla no se puede editar** |
| Catálogo de deducciones | 17 filas entre las dos compañías: adelanto al día, adelanto salarial, ausencia injustificada, compra de insumos, diferencia de precio, faltante de caja, faltante de producto, llegadas tarde, pérdida de material, préstamo laboral, préstamo personal, producto cambiado y producto dañado |
| Provisiones | Vacaciones, aguinaldo e indemnización al 8.33% cada una, es decir **25%** del salario. En la planilla de septiembre: C$1,418.76 sobre C$5,675 de la quincena |
| Planilla de septiembre de 2026 (16 al 30) | Salario devengado C$34,700; otras deducciones C$2,102.71; neto C$32,597.29; costo del empleador con provisiones C$43,036.82. Se pagó **con cheque** |
| Departamentos y cargos | Materiales J Castillo: 1 departamento (General) y 7 cargos (administrador o administradora, bodeguero, cajera o cajero, despachador, facturador). La Máxima tiene los suyos |
| Feriados 2026 (AGP Móvil) | 14: 1-ene, 18-ene (Rubén Darío), 2-feb (Obando y Bravo), 21-feb (Sandino), Jueves y Viernes Santo (Managua), 1-may, 30-may (Madres), 19-jul, 14 y 15-sep, 8-nov (Carlos Fonseca), 8-dic y 25-dic. **No incluye el 1 y el 10 de agosto** |
| Vacaciones, tipos de colaborador e INATEC | Sin registros |

### 1.4 Caso de prueba dorado (liquidación real, sin nombres)

Contrato de un facturador, ingreso el 1-jun-2023 y egreso el 1-sep-2026 (3 años y 3 meses), con salario de C$11,350 y diario de C$378.3333.

| Concepto | Días | Monto |
|---|---|---|
| Indemnización (art. 45: 3 × 30 + 20 × 3/12) | 95 | C$35,941.66 |
| Aguinaldo proporcional | 20 | C$7,566.67 |
| Vacaciones pendientes | 4 | C$1,513.33 |
| **Total** | | **C$45,021.66** |

El motor de Nexo debe dar exactamente esto. Se agrega a las pruebas doradas de PL2.

## 2. Marco legal vigente (Nicaragua, octubre de 2026)

**Regla de diseño:** ningún porcentaje ni monto de esta tabla va escrito en el código. Todo va en tablas de parámetros con vigencia (`vigente_desde`, `vigente_hasta`), como ya hace `rrhh.parametros_ley`. Cuando la ley cambia se cierra la fila vieja y se crea una nueva, y una planilla cerrada nunca se recalcula con la tasa de hoy.

La columna "Estado" dice qué tan firme es el dato:
- **Oficial:** sale del texto de la ley o de la DGI.
- **Coincidente:** varias fuentes secundarias coinciden.
- **Verificar:** las fuentes chocan, o el dato depende de la empresa. Lo confirma el contador o la factura del INSS antes de producción.

| Concepto | Valor | Base legal | Estado |
|---|---|---|---|
| INSS laboral, régimen integral | 7% del salario bruto | Decreto 06-2019, desde el 15-feb-2019 | Coincidente |
| INSS patronal, régimen integral | **21.5%** con menos de 50 trabajadores; 22.5% con 50 o más | Decreto 06-2019 | Coincidente. Verificar el régimen y el número de trabajadores de la empresa |
| INSS régimen IVM-RP (si aplica) | Laboral 4.75% a 5%; patronal 12.5% a 16.5% según la fuente | Decreto 06-2019 | Verificar: las fuentes no coinciden |
| Techo de cotización INSS | Sin techo según la mayoría de fuentes (resolución RI-112-2018). Una guía usa un techo de C$132,267.50 (2024) | Reforma 2018–2019 | Verificar con la factura del INSS |
| INATEC | 2% patronal sobre la planilla bruta; lo cobra el INSS en su misma factura | Decreto 40-94 | Coincidente |
| IR rentas del trabajo | Tabla anual de §2.1, sobre la renta neta (bruto menos INSS laboral) | Ley 822, art. 23, reformado por la Ley 891 (2014) | Oficial (DGI) |
| Retención mensual de IR | Proyección anual de la renta neta del mes, impuesto anual entre 12 | Reglamento de la Ley 822, art. 19 | Oficial (DGI). Verificar el método acumulado para salarios variables |
| Décimo tercer mes | Exento de IR, INSS y descuentos; inembargable salvo alimentos | CT art. 97; Ley 822 art. 19 | Oficial |
| Indemnización por antigüedad | Exenta de IR hasta 5 meses de salario | Ley 822 art. 19 | Oficial |
| Salario mínimo | Por sector, desde el 01-mar-2026 hasta el 28-feb-2027, con 4% de aumento | Acuerdo ministerial del MITRAB, 5-mar-2026 | Coincidente. Verificar el sector de la empresa |

### 2.1 Tabla de IR (renta neta anual, en C$)

| Desde | Hasta | Impuesto base | % sobre el exceso | Sobre el exceso de |
|---|---|---|---|---|
| 0.01 | 100,000.00 | 0 | 0% | 0 |
| 100,000.01 | 200,000.00 | 0 | 15% | 100,000.00 |
| 200,000.01 | 350,000.00 | 15,000.00 | 20% | 200,000.00 |
| 350,000.01 | 500,000.00 | 45,000.00 | 25% | 350,000.00 |
| 500,000.01 | en adelante | 82,500.00 | 30% | 500,000.00 |

Cálculo mensual según la DGI:
1. Renta neta del mes = ingresos que afectan IR − INSS laboral (− aportes a fondos de ahorro).
2. Expectativa anual = renta neta del mes × 12.
3. Impuesto anual = impuesto base + (expectativa − "sobre el exceso de") × %.
4. Retención del mes = impuesto anual ÷ 12.

Con salario variable (comisiones u horas extra) la práctica común es el **método acumulado**:
1. Sumar la renta neta del año hasta el mes.
2. Dividirla entre los meses transcurridos y multiplicar por 12.
3. Calcular el impuesto anual y prorratearlo a los meses transcurridos.
4. Restar lo ya retenido.

Para usar este método hay que conocer las retenciones del año que ya se hicieron en AG. Ver §9, decisión 7.

### 2.2 Salario mínimo 2026 (mensual, en C$)

| Sector | Monto |
|---|---|
| Construcción; establecimientos financieros y seguros | 13,848.23 |
| Electricidad, gas y agua; comercio, restaurantes y hoteles; transporte, almacenamiento y comunicaciones | 11,350.08 |
| Minas y canteras | 11,113.46 |
| Zona franca (acuerdo aparte) | 9,986.46 |
| Pesca | 9,409.09 |
| Servicios comunales, sociales y personales | 8,674.94 |
| Industria manufacturera | 8,320.48 |
| Gobierno central y municipal | 7,716.70 |
| Micro y pequeña industria artesanal y turística | 6,519.58 |
| Agropecuario (más alimentación) | 6,188.02 |

Materiales J Castillo vende materiales (comercio, C$ 11,350.08), pero también puede tener personal de fábrica o de obra. El sector se guarda **por contrato o puesto**, no por empresa.

### 2.3 Código del Trabajo (Ley 185)

| Tema | Regla | Artículo |
|---|---|---|
| Jornada ordinaria | Diurna 8 h al día y 48 a la semana; nocturna 7 y 42; mixta 7.5 y 45 | 51 |
| Horas extra | Máximo 3 al día y 9 a la semana. Se pagan con 100% de recargo (doble) | 57, 58, 62 |
| Trabajo en día de descanso o feriado | Es trabajo extraordinario y se paga doble | 57, 62, 68 |
| Séptimo día | Un día de descanso pagado por cada 6 trabajados. En la planilla quincenal o mensual ya está incluido en el salario | 64, 87 |
| Feriados nacionales | 1 de enero, Jueves y Viernes Santo, 1 de mayo, 19 de julio, 14 y 15 de septiembre, 8 y 25 de diciembre. El Ejecutivo puede declarar asuetos. El calendario 2026 de AG suma 5 fechas más (§1.3) y no incluye las fiestas de Managua del 1 y el 10 de agosto: hay que verificarlo | 66 |
| Pago | En córdobas. Plazo máximo de una semana para obreros y 15 días para empleados. El atraso cuesta un décimo de recargo por semana | 86 |
| Salario mínimo | Nadie gana menos que el mínimo de su sector. El mínimo es inembargable salvo alimentos | 82, 92 |
| Vacaciones | 15 días por cada 6 meses (2.5 días por mes, 30 al año). Se pagan con el último salario ordinario o, si es variable, con el promedio de los últimos 6 meses | 76, 78 |
| Décimo tercer mes | Un mes de salario por año, o la parte proporcional si trabajó más de un mes. Base: el último mes de salario o, si es variable, el más alto de los últimos 6 meses. Se paga en los primeros 10 días de diciembre o 10 días después de terminar el contrato. La mora cuesta un día de salario por cada día de atraso | 93, 94, 95 |
| Tiempo que cuenta para el aguinaldo | Vacaciones, ausencias justificadas, permisos, asuetos y subsidios | 96 |
| Terminación | Siempre se pagan las vacaciones y el décimo tercer mes proporcionales | 42, 77 |
| Renuncia | Preaviso escrito de 15 días. **Conserva el derecho a la antigüedad del art. 45** | 43, 44 |
| Indemnización por antigüedad | Un mes por cada uno de los primeros 3 años y 20 días por cada año desde el cuarto. Mínimo un mes y máximo 5 meses; las fracciones se pagan proporcionales | 45 |
| Maternidad | 4 semanas antes del parto y 8 después (10 si el parto es múltiple), con el último o el mejor salario. Cuenta para antigüedad, vacaciones y aguinaldo | 141 |
| Subsidio por enfermedad | El INSS paga el 60% desde el cuarto día. Con hospitalización o accidente, desde el primero. Que la empresa pague los 3 primeros días o complete el 40% es política de la empresa, salvo embarazo | Ley de Seguridad Social y su reglamento |

**Pendiente de confirmar con el contador:**
- los plazos exactos de pago de la factura del INSS (incluye INATEC) y de la declaración mensual de retenciones de IR en la VET de la DGI;
- el tope de embargo por pensión alimenticia (Código de Familia);
- si las vacaciones pagadas y no gozadas cotizan INSS y pagan IR.

## 3. Fórmulas del motor

Convenciones: salario diario = salario mensual ÷ 30 y salario por hora = diario ÷ horas de la jornada. Cada fórmula cita su artículo en el concepto y en el detalle de la colilla.

| Concepto | Fórmula |
|---|---|
| Salario ordinario del período | Salario mensual × días del período ÷ 30 − días no pagados (faltas injustificadas que vienen de asistencia) |
| Horas extra | Horas aprobadas × salario por hora × 2 |
| Feriado o séptimo día trabajado | Horas o días × tarifa × 2 |
| INSS laboral | Ingresos que cotizan × tasa vigente (con techo si existe) |
| IR | §2.1, sobre la renta neta, por proyección o acumulado |
| INSS patronal e INATEC | Ingresos que cotizan × tasa vigente. Son costo de la empresa, no descuento |
| Provisión de vacaciones | 2.5 días por mes × salario diario |
| Provisión de aguinaldo | Salario mensual ÷ 12 por mes |
| Provisión de indemnización | Pasivo calculado por la tabla del art. 45 a la fecha, con tope de 5 meses |
| Liquidación | Salario pendiente + vacaciones no gozadas + aguinaldo proporcional + indemnización (art. 45, también por renuncia según el art. 43). Los préstamos pendientes se descuentan solo del salario, las vacaciones y la indemnización, **nunca del aguinaldo** (art. 97, ver §2) |

### 3.1 Decisiones del motor (usuario, 2026-10-21)

| Tema | Decisión |
|---|---|
| Período del aguinaldo | **Año calendario, enero a diciembre**, como AG. Es lo que reproduce el caso dorado (8 meses = 20 días). Queda como parámetro `aguinaldo_mes_inicio`, marcado "verificar con el contador" |
| Separación de funciones | **Estricta.** Quien crea o calcula una planilla no la aprueba, sin excepción. Antes de la primera planilla real hay que dar el rol de aprobador o de especialista a una segunda persona |
| Particiones | Además de líneas y novedades, se particionan por mes las **provisiones** y los **movimientos de vacaciones** (PL2b). Las cuotas de préstamo no: son el plan acotado de un préstamo |
| Antigüedad y cambio de salario | "Al cambiar el salario todas las prestaciones se mantienen pero cambian su valor; se recalcula únicamente el valor, no el tiempo." Columna `contratos.fecha_antiguedad`, heredada del contrato anterior; los montos usan el diario del último salario |
| Régimen inicial | Los contratos activos entran como **servicios profesionales exentos con prestaciones**, igual que AG ("Free-lance"). Se cambia contrato por contrato con `regimen.cambiar` |
| IR en planilla quincenal | **Ajuste en la 2.ª quincena.** En la 1.ª se retiene la mitad del IR proyectado (renta × 24 ÷ 24). En la 2.ª se calcula el IR del mes con todo lo devengado y se resta lo de la 1.ª, que tiene que estar aprobada. Con salario fijo, las dos quincenas quedan iguales. Marcado "verificar con el contador" |
| Provisión de indemnización | **1/12 fijo**, como AG (caso G2, C$1,418.76), parámetro `provision_indemnizacion_divisor` |
| Frecuencia de pago | Los contratos activos de Nexo estaban en `mensual`, pero AG paga quincenal. **Se pasan a quincenal** en la migración, con auditoría. Las RPC de contrato reciben la frecuencia y el default queda en quincenal |
| Quién fija la antigüedad | `rrhh.planillas.liquidaciones.aprobar` (solo admin), por RPC auditada. Si no se indica fecha, se hereda del contrato anterior que terminó el día antes. Nadie la escribe directo |

Convenciones fijadas en PL2a:
- `salario_base` es mensual;
- diario = mensual ÷ 30, redondeado a 4 decimales;
- cada línea se redondea a centavos y los totales suman líneas;
- días del período con la **regla 30/360**: la quincena tiene 15 días y el último día del mes cuenta como el 30. Se confirma con AG en la corrida en paralelo;
- las faltas y los días fuera de contrato se descuentan en días;
- **el IR y el techo del INSS se calculan por persona**: suman los contratos de la misma persona en el mes;
- un cambio de régimen empieza el día de inicio del contrato o el 1 o el 16 de un mes. La vigencia abierta se puede corregir mientras ninguna planilla la haya usado.

## 4. Lo que Nexo ya tiene (verificado en `nexo-core` el 2026-10-20)

| Pieza | Estado real |
|---|---|
| Expediente, contratos, compensación y jornada | Existen: 6 empleados, 5 contratos activos y 1 jornada. `contrato_compensacion` guarda el salario base y la frecuencia (mensual, quincenal o semanal) |
| Cuentas bancarias del empleado | Existe `rrhh.empleado_cuentas_bancarias`; sirve para el archivo del banco |
| Puestos, departamentos y plantillas de contrato | Existen y sirven para cartas y constancias |
| Asistencia | Kiosco con marcas por contrato, reportes de asistencia y tardanzas, y la función `rrhh.fn_asistencia_dias`. Falta el resumen diario consolidado de F1.5 con horas ordinarias y extra |
| Feriados | La tabla existe, pero tiene **0 filas** |
| `rrhh.parametros_ley` | Tiene 4 filas: INSS laboral 7%, INSS patronal **22.5%**, INATEC 2% y techo INSS **C$100,000**. El techo es un valor de ejemplo que nunca se verificó. **Ver §5** |
| `rrhh.planillas` y `rrhh.planilla_detalles` | Existen desde 2026-09-02 con 0 filas. El detalle tiene columnas fijas (salario, horas extra, bonos, deducciones) y **no tiene `contrato_id`**. El plan 03 §8.7 ya lo pide |
| Permisos `rrhh.planillas.*` | 10 códigos: `planilla.{ver,generar,aprobar,anular}`, `movimientos.{ver,crear,eliminar}`, `parametros.{ver,editar}` y `reportes.exportar` |
| Motor de cálculo, IR, vacaciones, préstamos, liquidaciones, aguinaldo, colillas, declaraciones y asiento contable | **No existen** |

## 5. Correcciones que salen de este análisis

1. **INSS patronal.** La semilla dice 22.5%. AG tiene configurado **21.5%** en régimen Integral, que corresponde a menos de 50 trabajadores. Se corrige a 21.5%.
2. **Techo del INSS.** El valor de C$100,000 es un ejemplo. AG usa C$99,999.99, que parece un valor de relleno, y la mayoría de las fuentes dicen que no hay techo. Se confirma con la factura del INSS antes de cerrarlo o corregirlo.
3. **`planilla_detalles` no sirve como está.** Las columnas fijas no permiten un catálogo de conceptos ni guardar la base de cálculo. Se reemplaza por líneas por concepto con `contrato_id` (§7).
4. **Feriados vacíos.** Se cargan los 14 de 2026 que tiene AG (§1.3).
5. **Modalidad "Free-lance" sin INSS.** En AG, los 6 contratos vigentes son "Free-lance": no se les retiene INSS ni IR, y no se paga INSS patronal ni INATEC. Pasa por lo menos desde 2024. Hechos que se ven en los propios sistemas de la empresa:
   - Esas personas tienen cargo de facturador, cajera o bodeguero.
   - Tienen jornada de 8 horas.
   - Se les provisionan vacaciones, aguinaldo e indemnización, y se les liquida por el art. 45.
   - Marcan en el kiosco de Nexo contra una jornada.

   Todo eso describe una relación laboral. El Código del Trabajo y la Ley de Seguridad Social obligan a afiliar al INSS a quien trabaja así. **Nexo no da asesoría legal:** la calificación la decide el contador o el abogado de la empresa.

   **Decisión del usuario (2026-10-21):** dejar preparadas las dos opciones. El diseño está en §8.3.
6. **Dos empleadores.** AG maneja Materiales J Castillo y Ferretería La Máxima. Nexo ya es multiempresa (`company_id`). Falta decidir si La Máxima entra.
7. **Pago con cheque.** El archivo bancario no es urgente. Primero va el detalle para cheques (§10, PL6).

## 6. Optimizaciones frente a AG Planilla

| AG Planilla | Nexo |
|---|---|
| Las horas extra, las faltas y las tardanzas se cargan a mano o por Excel | Salen **de las marcas del kiosco** ya revisadas por el supervisor (F1.5–F1.6). El Excel queda solo para comisiones y casos especiales |
| La tabla de INSS e IR la mantiene el usuario | Parámetros con vigencia y una **alerta** cuando falta la tasa de un período. Una planilla cerrada guarda la tasa que usó |
| El cierre depende del usuario | **Separación de funciones:** quien genera la planilla no la aprueba. Al aprobar se congela una copia con su huella (hash), y anular deja rastro |
| Liquidación al final | **Simulador de liquidación** en cualquier momento, sin guardar nada, para decidir antes de un despido o una renuncia |
| Consolidado de provisiones como informe | **Pasivo laboral vivo** por empleado (vacaciones, aguinaldo e indemnización) en el Dashboard |
| Comprobante contable para importar | Asiento directo al ERP de Nexo cuando exista la contabilidad (plan 18, R2), con los mismos centros de costo |
| Colilla por correo | Colilla en el autoservicio y en Nexo Mobile, con "recibido" registrado. El correo queda como respaldo |
| Vacaciones controladas por RRHH | El empleado pide vacaciones desde el celular, el jefe aprueba y el saldo se actualiza solo |
| Validaciones no documentadas | Bloqueos con motivo: salario bajo el mínimo del sector, más de 3 horas extra al día o 9 a la semana, saldo de vacaciones negativo, embargo por encima del tope o contrato sin cuenta bancaria al pagar por banco |
| Más de 50 informes | Primero los que se usan de verdad, en el recorrido de §1.2, y un Dashboard con KPIs: costo total de la planilla, costo patronal, horas extra contra la meta, pasivo laboral y rotación |
| Bitácora de AG | Auditoría de Nexo en cada acción, incluidos los cambios de parámetros |
| Lógica en la app web | Cálculo en **RPC de Postgres**, reutilizable por Web y Mobile (plan 02). Server Actions solo llaman a las RPC |

**Corrida en paralelo:** antes de dejar AG se calculan al menos dos períodos completos en Nexo y en AG con los mismos datos. Nexo no se usa para pagar hasta que la diferencia sea cero o esté explicada.

## 7. Modelo de datos propuesto (borrador, sin aplicar)

Todo en el schema `rrhh`, con `company_id`, RLS por permiso y escritura solo por RPC `security definer`, igual que el resto de RRHH.

| Tabla | Para qué | Notas |
|---|---|---|
| `parametros_ley` (existe) | Tasas y montos con vigencia | Se agregan `inss_patronal_menos_50`, `salario_minimo_<sector>`, `ir_servicios_profesionales` y otros |
| `contrato_regimen` | Régimen de cada contrato con vigencia: `laboral` o `servicios_profesionales`; régimen INSS (integral, IVM o ninguno); método de IR (tabla progresiva, retención fija con % o exento); si lleva prestaciones; motivo y quién lo aprobó | §8.3. Un contrato nuevo nace con un régimen; el cambio en un contrato activo pide `regimen.cambiar` |
| `ir_tramos` | Tabla de IR con vigencia | Una fila por tramo |
| `planilla_tipos` | Las distintas planillas: nombre, frecuencia, moneda y centro de costo | Equivale a "multiplanilla" |
| `conceptos` | Catálogo de ingresos, deducciones, aportes patronales y provisiones | Indica si afecta INSS, IR o INATEC; método (fijo, porcentaje, horas o fórmula); cuenta contable; si sale en la colilla |
| `planillas` (existe) | Corrida de un período | Se agregan tipo, más estados (borrador → calculada → aprobada → pagada, o anulada) y la huella de la copia aprobada |
| `planilla_empleados` | Un renglón por contrato y corrida | Guarda salario, jornada, sector y modalidad congelados |
| `planilla_lineas` | Una línea por concepto | Con base, cantidad, tasa y monto. **Particionada por mes**, por ser tabla de hechos |
| `novedades` | Movimientos del período: comisiones, bonos y deducciones puntuales | Con importación de Excel. **Particionada por mes** |
| `prestamos`, `prestamo_cuotas` | Préstamos y adelantos con plan de cuotas | La cuota entra sola como deducción |
| `embargos` | Orden judicial, monto o porcentaje y tope | Respeta el mínimo inembargable |
| `vacaciones_movimientos` | Acumulación, goce, pago y ajustes | El saldo se calcula; nunca se escribe a mano |
| `provisiones` | Copia mensual del pasivo por empleado | Alimenta el Dashboard y el asiento |
| `liquidaciones`, `liquidacion_lineas` | Cálculo final al terminar el contrato | Se conecta con `fn_finalizar_contrato` |

`planilla_detalles` se deja de usar sin borrarla (deprecación gradual, plan 03 §8).

**PL2a (2026-10-21, aplicada como `20261021191441`):**
- **Crea:** `contrato_regimen`, `ir_tramos`, `planilla_tipos`, `conceptos` (16 de sistema y de catálogo base), `planilla_empleados`, `planilla_lineas` y `novedades`. Las dos últimas van particionadas por mes.
- **Amplía:**
  - `planillas`: estados `borrador → calculada → aprobada → pagada`, o `anulada`; tipo, huellas, pago y reemplazo;
  - `parametros_ley`: certeza, fuente y 16 parámetros nuevos. Su escritura pasa a una RPC auditada;
  - `feriados`: tipo y los 14 de 2026;
  - `contratos`: `fecha_antiguedad`;
  - `contrato_compensacion`: contratos activos a frecuencia quincenal y default quincenal;
  - `crear_contrato` y `editar_contrato`: reciben la frecuencia.
- **Deja para PL2b:** `prestamos`, `prestamo_cuotas`, `embargos`, `vacaciones_movimientos`, `provisiones`, `liquidaciones`, `liquidacion_lineas` y `saldos_iniciales`.
- **Detalle:** [`DATABASE.md`](../DATABASE.md) y el [status-log](../status-log/2026-10-21-planilla-pl2a-motor.md).

## 8. Paso Cero (aprobado y aplicado el 2026-10-21, `20261021160943`)

Verificado en `nexo-core` el 2026-10-21:
- RRHH tiene 70 permisos y 10 de ellos son `rrhh.planillas.*`.
- Las plantillas de rol son `admin`, `gestor_expedientes`, `supervisor_asistencia`, `especialista_planillas` y `consulta`.
- **Ningún rol de empresa** (`core.rol_permisos`) tiene permisos de planilla; hoy solo entra la persona propietaria.
- Hoy `especialista_planillas` puede generar **y también aprobar y anular** su propia planilla.

### 8.1 Códigos nuevos (15, con 4 segmentos)

| Código | Para qué |
|---|---|
| `rrhh.planillas.regimen.ver` | Ver el régimen de cada contrato (laboral o servicios profesionales) y su historial |
| `rrhh.planillas.regimen.cambiar` | Cambiar el régimen de un contrato activo, con fecha efectiva y motivo. Queda auditado |
| `rrhh.planillas.conceptos.ver` / `.gestionar` | Catálogo de ingresos y deducciones y tipos de planilla |
| `rrhh.planillas.planilla.pagar` | Marcar la planilla aprobada como pagada (cheque o banco) |
| `rrhh.planillas.vacaciones.ver` / `.registrar` / `.aprobar` | Saldo, goce y pago de vacaciones |
| `rrhh.planillas.prestamos.ver` / `.gestionar` | Préstamos, adelantos y embargos |
| `rrhh.planillas.liquidaciones.ver` / `.calcular` / `.aprobar` | Simulación y liquidación final |
| `rrhh.planillas.declaraciones.generar` | Informes de INSS, INATEC y DGI-VET |
| `rrhh.planillas.colillas.enviar` | Publicar y enviar colillas |

Las colillas y las vacaciones del propio empleado (`rrhh.autoservicio.*`) van en un Paso Cero aparte, cuando exista el vínculo entre empleado y usuario.

### 8.2 Matriz

| Código | Admin | Especialista planillas | Supervisor asistencia | Gestor expedientes | Consulta |
|---|:-:|:-:|:-:|:-:|:-:|
| `regimen.ver` | ✓ | ✓ | — | ✓ | ✓ |
| `regimen.cambiar` | ✓ | — | — | — | — |
| `conceptos.ver` | ✓ | ✓ | — | — | ✓ |
| `conceptos.gestionar` | ✓ | ✓ | — | — | — |
| `planilla.pagar` | ✓ | — | — | — | — |
| `vacaciones.ver` | ✓ | ✓ | ✓ | — | ✓ |
| `vacaciones.registrar` | ✓ | ✓ | — | — | — |
| `vacaciones.aprobar` | ✓ | — | ✓ | — | — |
| `prestamos.ver` | ✓ | ✓ | — | — | ✓ |
| `prestamos.gestionar` | ✓ | ✓ | — | — | — |
| `liquidaciones.ver` | ✓ | ✓ | — | — | ✓ |
| `liquidaciones.calcular` | ✓ | ✓ | — | — | — |
| `liquidaciones.aprobar` | ✓ | — | — | — | — |
| `declaraciones.generar` | ✓ | ✓ | — | — | — |
| `colillas.enviar` | ✓ | ✓ | — | — | — |
| **Total** | 15 | 11 | 2 | 1 | 5 |

**Cambio a lo existente (separación de funciones), aprobado y aplicado:** `especialista_planillas` ya no tiene `planilla.aprobar` ni `planilla.anular`. Aprobar, pagar y anular quedan en `admin`.

### 8.3 Las dos modalidades (decisión del usuario del 2026-10-21)

"Hay que dejar preparado para ambas opciones." El régimen se guarda **por contrato y con vigencia** (tabla `contrato_regimen`, §7). No se decide en la compañía ni en un interruptor global. Cambiar de régimen no rehace el contrato ni toca planillas ya cerradas: aplica desde su fecha efectiva.

| Componente | Laboral (Código del Trabajo) | Servicios profesionales (como AG hoy) |
|---|---|---|
| INSS laboral y patronal | Sí, según régimen (integral o IVM) y tasa vigente | No |
| INATEC | Sí, 2% | No |
| IR | Tabla progresiva de rentas del trabajo (§2.1) | Retención fija sobre honorarios con % configurable. AG usa 0%; la retención general por servicios profesionales es 10%, pero el contador lo verifica |
| Vacaciones, aguinaldo e indemnización | Sí, por ley | Configurable por contrato (AG hoy las provisiona y las liquida) |
| Constancia | Colilla de pago | Colilla o recibo de honorarios |

**Simulador de costo:** con los mismos contratos, el Dashboard muestra lo que costaría la planilla en cada régimen. Así la empresa ve con números lo que hablará con el contador.

**Aviso, no bloqueo:** un contrato en servicios profesionales que tiene jornada y marca en el kiosco muestra el aviso "Revisar régimen con el contador". Quien tenga `regimen.cambiar` lo puede descartar, y el descarte queda auditado.

### 8.4 SQL (borrador; lo aplicado está en `supabase/migrations/20261021160943_rrhh_planilla_paso_cero.sql`, que además quita aprobar y anular al especialista)

```sql
-- Paso Cero de Planilla (docs/plan/20-planilla.md §8). Solo catálogo y plantillas:
-- no crea tablas ni asigna nada a roles de empresa.
do $$
declare n integer;
begin
  if exists (select 1 from core.permissions_catalog where code in (
      'rrhh.planillas.regimen.ver','rrhh.planillas.regimen.cambiar',
      'rrhh.planillas.conceptos.ver','rrhh.planillas.conceptos.gestionar',
      'rrhh.planillas.planilla.pagar',
      'rrhh.planillas.vacaciones.ver','rrhh.planillas.vacaciones.registrar','rrhh.planillas.vacaciones.aprobar',
      'rrhh.planillas.prestamos.ver','rrhh.planillas.prestamos.gestionar',
      'rrhh.planillas.liquidaciones.ver','rrhh.planillas.liquidaciones.calcular','rrhh.planillas.liquidaciones.aprobar',
      'rrhh.planillas.declaraciones.generar','rrhh.planillas.colillas.enviar')) then
    raise exception 'precheck: algún permiso de planilla ya existe';
  end if;
  if (select count(*) from core.app_roles where module_slug = 'rrhh'
        and role_key in ('admin','gestor_expedientes','supervisor_asistencia','especialista_planillas','consulta')) <> 5 then
    raise exception 'precheck: faltan plantillas de rol de rrhh';
  end if;

  insert into core.permissions_catalog (code, module_slug, domain, label, description) values
    ('rrhh.planillas.regimen.ver', 'rrhh', 'planillas', 'Ver régimen de contratación', 'Ver si cada contrato es laboral o de servicios profesionales y su historial.'),
    ('rrhh.planillas.regimen.cambiar', 'rrhh', 'planillas', 'Cambiar régimen de contratación', 'Cambiar el régimen de un contrato activo con fecha efectiva y motivo. Queda auditado.'),
    ('rrhh.planillas.conceptos.ver', 'rrhh', 'planillas', 'Ver conceptos de planilla', 'Ver el catálogo de ingresos, deducciones y tipos de planilla.'),
    ('rrhh.planillas.conceptos.gestionar', 'rrhh', 'planillas', 'Gestionar conceptos de planilla', 'Crear y editar ingresos, deducciones y tipos de planilla. Un concepto usado en una planilla cerrada no cambia sus reglas.'),
    ('rrhh.planillas.planilla.pagar', 'rrhh', 'planillas', 'Pagar planillas', 'Marcar una planilla aprobada como pagada, por cheque o banco.'),
    ('rrhh.planillas.vacaciones.ver', 'rrhh', 'planillas', 'Ver vacaciones', 'Ver saldos y movimientos de vacaciones.'),
    ('rrhh.planillas.vacaciones.registrar', 'rrhh', 'planillas', 'Registrar vacaciones', 'Registrar días gozados, pagados o ajustes de vacaciones.'),
    ('rrhh.planillas.vacaciones.aprobar', 'rrhh', 'planillas', 'Aprobar vacaciones', 'Aprobar o rechazar solicitudes de vacaciones.'),
    ('rrhh.planillas.prestamos.ver', 'rrhh', 'planillas', 'Ver préstamos', 'Ver préstamos, adelantos y embargos con sus cuotas.'),
    ('rrhh.planillas.prestamos.gestionar', 'rrhh', 'planillas', 'Gestionar préstamos', 'Crear y editar préstamos, adelantos y embargos.'),
    ('rrhh.planillas.liquidaciones.ver', 'rrhh', 'planillas', 'Ver liquidaciones', 'Ver liquidaciones y simulaciones.'),
    ('rrhh.planillas.liquidaciones.calcular', 'rrhh', 'planillas', 'Calcular liquidaciones', 'Simular y preparar la liquidación final de un contrato.'),
    ('rrhh.planillas.liquidaciones.aprobar', 'rrhh', 'planillas', 'Aprobar liquidaciones', 'Aprobar una liquidación preparada. Quien la calcula no la aprueba.'),
    ('rrhh.planillas.declaraciones.generar', 'rrhh', 'planillas', 'Generar declaraciones', 'Generar los informes de INSS, INATEC y DGI-VET.'),
    ('rrhh.planillas.colillas.enviar', 'rrhh', 'planillas', 'Enviar colillas', 'Publicar y enviar las colillas de una planilla aprobada.');

  insert into core.app_role_permissions (app_role_id, permission_code)
  select ar.id, x.code
  from core.app_roles ar
  join (values
    ('admin','rrhh.planillas.regimen.ver'), ('admin','rrhh.planillas.regimen.cambiar'),
    ('admin','rrhh.planillas.conceptos.ver'), ('admin','rrhh.planillas.conceptos.gestionar'),
    ('admin','rrhh.planillas.planilla.pagar'),
    ('admin','rrhh.planillas.vacaciones.ver'), ('admin','rrhh.planillas.vacaciones.registrar'), ('admin','rrhh.planillas.vacaciones.aprobar'),
    ('admin','rrhh.planillas.prestamos.ver'), ('admin','rrhh.planillas.prestamos.gestionar'),
    ('admin','rrhh.planillas.liquidaciones.ver'), ('admin','rrhh.planillas.liquidaciones.calcular'), ('admin','rrhh.planillas.liquidaciones.aprobar'),
    ('admin','rrhh.planillas.declaraciones.generar'), ('admin','rrhh.planillas.colillas.enviar'),
    ('especialista_planillas','rrhh.planillas.regimen.ver'),
    ('especialista_planillas','rrhh.planillas.conceptos.ver'), ('especialista_planillas','rrhh.planillas.conceptos.gestionar'),
    ('especialista_planillas','rrhh.planillas.vacaciones.ver'), ('especialista_planillas','rrhh.planillas.vacaciones.registrar'),
    ('especialista_planillas','rrhh.planillas.prestamos.ver'), ('especialista_planillas','rrhh.planillas.prestamos.gestionar'),
    ('especialista_planillas','rrhh.planillas.liquidaciones.ver'), ('especialista_planillas','rrhh.planillas.liquidaciones.calcular'),
    ('especialista_planillas','rrhh.planillas.declaraciones.generar'), ('especialista_planillas','rrhh.planillas.colillas.enviar'),
    ('supervisor_asistencia','rrhh.planillas.vacaciones.ver'), ('supervisor_asistencia','rrhh.planillas.vacaciones.aprobar'),
    ('gestor_expedientes','rrhh.planillas.regimen.ver'),
    ('consulta','rrhh.planillas.regimen.ver'), ('consulta','rrhh.planillas.conceptos.ver'),
    ('consulta','rrhh.planillas.vacaciones.ver'), ('consulta','rrhh.planillas.prestamos.ver'),
    ('consulta','rrhh.planillas.liquidaciones.ver')
  ) as x(role_key, code) on x.role_key = ar.role_key
  where ar.module_slug = 'rrhh';
  get diagnostics n = row_count;
  if n <> 34 then raise exception 'postcheck: se esperaban 34 asignaciones (%).', n; end if;

  -- Opcional (separación de funciones): quien genera no aprueba ni anula.
  -- delete from core.app_role_permissions rp using core.app_roles ar
  --  where rp.app_role_id = ar.id and ar.module_slug = 'rrhh' and ar.role_key = 'especialista_planillas'
  --    and rp.permission_code in ('rrhh.planillas.planilla.aprobar','rrhh.planillas.planilla.anular');
end;
$$;
```

Rollback antes de uso: borrar esas 15 filas de `core.app_role_permissions` y de `core.permissions_catalog`.

### 8.5 Paso Cero de PL2b (aprobado el 2026-10-21)

Pagar y anular una liquidación no tenían código. Decisión del usuario: "Dos permisos nuevos, solo admin".

| Código | Para qué | Admin | Resto |
|---|---|:-:|:-:|
| `rrhh.planillas.liquidaciones.pagar` | Marcar una liquidación aprobada como pagada (cheque o transferencia) | ✓ | — |
| `rrhh.planillas.liquidaciones.anular` | Anular una liquidación calculada o aprobada, con motivo; devuelve el saldo de vacaciones y las cuotas de préstamo | ✓ | — |

Con esto hay 27 códigos `rrhh.planillas.*`. SQL: `supabase/migrations/20261022000001_rrhh_planilla_pl2b_paso_cero.sql` (nombre local; se renombra con la versión remota al aplicarla).

## 9. Decisiones pendientes del usuario

0. ~~Modalidad de los contratos (§5.5)~~. **Decidido el 2026-10-21:** "Hay que dejar preparado para ambas opciones". Nexo soporta el régimen laboral y el de servicios profesionales por contrato y con vigencia (§8.3). El contador decide cuál aplica a cada persona. Con INSS patronal e INATEC, cada C$11,350 cuesta unos C$2,667 más al mes.
1. ~~Régimen INSS~~: AG tiene configurado **Integral, 21.5%**. Solo falta confirmar el techo con la factura del INSS.
2. ~~Sector de salario mínimo~~: AG usa C$11,350, el de **comercio**. Queda por definir si hay puestos de otro sector.
3. ~~Planillas~~: una **quincenal** en C$, más la de aguinaldo. Falta decidir si **Ferretería La Máxima** (sin personal hoy) entra a Nexo.
4. **Política de subsidios:** ¿la empresa paga los 3 primeros días o completa el 40%?
5. ~~Dónde vive~~. **Decidido el 2026-10-21:** "Dentro del menú de RRHH". Las pantallas viven en `apps/rrhh` bajo `/rrhh/planillas/...`, con los grupos Nómina, Prestaciones, Análisis y Configuración del menú de RRHH. No hay fila nueva en `core.apps` ni permiso `planilla.ver_modulo`.
6. ~~Banco~~: hoy se paga **con cheque**. Falta decidir si se quiere pasar a transferencia y con qué banco.
7. **Arranque y migración:** idealmente en enero, por el IR acumulado. Si se arranca a mitad de año hay que importar de AG lo acumulado del año (rentas y retenciones), los saldos de vacaciones, los préstamos vigentes y el histórico de las 31 liquidaciones.
8. **Contador:** quién valida la tabla de parámetros y la corrida en paralelo.

## 10. Etapas

| Etapa | Contenido | Depende de |
|---|---|---|
| PL0 | Recorrido de AG Planilla: **hecho el 2026-10-21** (§1.2–§1.4). Faltan las respuestas de §9, empezando por la decisión 0 | Usuario y contador |
| PL1 | Paso Cero (§8): **aplicado el 2026-10-21**. Faltan los parámetros corregidos (§5) y los feriados 2026, que van con el esquema de PL2 | PL0 |
| PL2a | Esquema base (§7) y motor de la planilla ordinaria en RPC, más el simulador de liquidación, con **pruebas doradas**. **Aplicada en `nexo-core` el 2026-10-21** (`20261021191441`) | PL1 |
| PL2b | Documentos de liquidación con aprobación, vacaciones, préstamos y embargos, provisiones mensuales, saldos iniciales de AG y planilla de aguinaldo. Pide un Paso Cero nuevo: pagar y anular una liquidación no tienen permiso. **Aplicada en `nexo-core` el 2026-10-22** (Paso Cero `20261021235639` y cinco partes, `20261022000001` a `20261022001314`) | PL2a |
| PL3 | F1.5 mínimo: resumen diario con horas ordinarias y extra desde el kiosco. **Mínimo hecho en PL2c** (`20261022001530` a `20261022001922`): propuesta e importación de horas extra y ausencias desde Asistencia | Asistencia actual |
| PL4 | Pantallas: Dashboard, planillas, novedades, colillas y parámetros. **Construidas el 2026-10-22**, sin verificación visual con sesión | PL2 |
| PL5 | Vacaciones, préstamos y embargos, liquidaciones y aguinaldo. **Construidas el 2026-10-22**, sin verificación visual con sesión | PL2 |
| PL6 | Archivo del banco, declaraciones y asiento contable (cuando exista el ERP R2). **Hechos:** declaraciones INSS, INATEC e IR en pantalla y CSV, y el detalle para cheques. **Faltan:** archivo del banco, formato oficial SIE/VET y asiento contable | PL4 |
| PL7 | Corrida en paralelo con AG durante 2 períodos, y corte | PL4–PL5 |

## 11. Referencias

Normas:
- Ley 185, Código del Trabajo: [texto en Normas Jurídicas de Nicaragua](https://nicaragua.justia.com/nacionales/codigos/codigo-del-trabajo-oct-30-1996/gdoc/).
- Ley 822, Ley de Concertación Tributaria, con sus reformas: [nicatributos.com](https://nicatributos.com/ley-de-concertacion-tributaria/).
- Tarifa y retención del IR, de la DGI: [preguntas frecuentes](https://www.dgi.gob.ni/FAQ/periodo_fiscal_y_tarifa_del_im.htm).

INSS:
- Decreto 06-2019: [nota de Mercer](https://mercer.com/insights/law-and-policy/nicaragua-revises-social-security-arrangements).

Salario mínimo 2026:
- [EY](https://www.ey.com/es_ce/technical/tax/tax-alerts/nicaragua-salario-minimo-2026).
- [Bloomberg Línea](https://www.bloomberglinea.com/2026/03/06/salario-minimo-en-nicaragua-2026-estos-son-los-nuevos-montos-tras-el-aumento-del-4/).

Guías de nómina 2026 (secundarias):
- [Nortex](https://somosnortex.com/blog/como-calcular-nomina-nicaragua-2026).

AG Planilla:
- [funciones](https://agplanilla.com/5).
- [precios](https://agplanilla.com/6).

Referencia de código abierto para comparar el modelo:
- **Coati Payroll** de BMO Soluciones, con configuración para Nicaragua: [guía](https://bmosoluciones.github.io/coati-payroll/guia/prestaciones/).
- Su licencia no está confirmada, así que solo sirve como referencia funcional.
