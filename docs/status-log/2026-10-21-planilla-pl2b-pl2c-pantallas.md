# 2026-10-21 — Planilla PL2b, PL2c y pantallas (PL4–PL6)

- **Subfase:** F1.7 (motor de planillas), etapas PL2b, PL2c, PL3 mínimo, PL4, PL5 y parte de PL6 del [plan 20](../plan/20-planilla.md).
- **Pedido del usuario:** "Deja toda la app terminada para luego verificar yo si hace bien los cálculos o hacer correcciones menores. Lanza sub agentes de ser necesario que se encarguen de ir trabajando y luego unir todo".
- **Estado:** 🟡 PL2a aplicada → 🟡 PL2b y PL2c **aplicadas en `nexo-core`** el 2026-10-22 (9 migraciones) y pantallas construidas en local (typecheck, lint y build en 0). Sin commit y sin recorrido visual con sesión.

## Decisiones del usuario (en el chat de esta sesión)

| Pregunta | Respuesta |
|---|---|
| Dónde va Planilla (decisión 5 del plan 20) | "Dentro del menú de RRHH" |
| Permiso para pagar y anular una liquidación | "Dos permisos nuevos, solo admin" (`rrhh.planillas.liquidaciones.pagar` y `.anular`) |
| Aplicación en `nexo-core` | "Aplicar al pasar pruebas y revisión": cada migración se aplica cuando pasa PGlite, la revisión independiente y un ensayo revertido en remoto |

Decisión del coordinador, documentada para la UI: **vacaciones con separación de funciones** (quien registra un movimiento no lo aprueba), como pide la skill `nexo-planilla-motor`; la decisión "Estricta" del usuario era para planilla y liquidación.

## Migraciones

| Versión remota (archivo) | Contenido |
|---|---|
| `20261021235639_rrhh_planilla_pl2b_paso_cero` | 2 permisos nuevos, solo plantilla admin (27 `rrhh.planillas.*`) |
| `20261022000001_rrhh_planilla_pl2b_1_tablas` | Conceptos, tipo Aguinaldo, tablas, particiones, RLS y funciones de apoyo |
| `20261022000431_rrhh_planilla_pl2b_2_motor` | Motor ordinario y de aguinaldo, huella |
| `20261022000640_rrhh_planilla_pl2b_3_liquidacion` | Liquidación pura, preparación e inmutabilidad |
| `20261022000939_rrhh_planilla_pl2b_4_rpc_vacaciones` | RPC de PL2a que cambian y RPC de vacaciones |
| `20261022001314_rrhh_planilla_pl2b_5_prestamos_liquidaciones` | Préstamos, embargos, liquidaciones, pasivo, provisiones, privilegios y poscheques |
| `20261022001530_rrhh_planilla_pl2c_1_lectura` | Parámetro de fracción de horas extra y RPC de lectura |
| `20261022001727_rrhh_planilla_pl2c_2_configuracion` | Conceptos, tipos de planilla y tabla de IR |
| `20261022001922_rrhh_planilla_pl2c_3_declaraciones_asistencia` | Declaraciones e importación desde Asistencia, privilegios y poscheques |

PL2b y PL2c se escribieron como dos archivos y se dividieron en partes en límites de sección, porque cada llamada de `apply_migration` tiene un tamaño máximo. Cada parte revoca el EXECUTE de las funciones nuevas que crea. La cadena dividida pasa las mismas pruebas y da la misma huella de funciones (`md5(prosrc)`) que los archivos sin dividir.

### Aplicación en `nexo-core` (2026-10-22)

- Un ensayo revertido por parte antes de aplicarla, con pruebas como el owner de la empresa sobre los datos reales: quincena del 1 al 15 de octubre (4 personas, neto positivo); aguinaldo 2026 (4 personas); liquidación por renuncia al 31/10 de los 4 contratos con salario; préstamo de 4 cuotas, embargo y liquidación como documento con la deducción del préstamo; aprobación rechazada a quien creó la liquidación y a quien registró vacaciones; provisiones de septiembre; RLS como `authenticated` y escritura directa denegada; propuesta de Asistencia con marcas reales.
- Los poscheques de cada migración pasaron. Comparación de `md5(prosrc)` de 81 funciones: 79 idénticas; `fn_crear_contrato` y `fn_editar_contrato` (de PL2a) difieren solo en comentarios.
- Advisors de seguridad: sin hallazgos nuevos fuera del patrón.
- **Dato real a tener en cuenta:** la propuesta de Asistencia del 1 al 15 de octubre trae 52 ausencias y 0 horas extra para 4 personas, porque casi nadie marca en el kiosco. No hay que importar esas ausencias sin revisar.

### PL2b: qué agrega

- **Tablas:** `liquidaciones`, `liquidacion_lineas`, `prestamos`, `embargos` (documentos, sin particionar, con justificación escrita); `vacaciones_movimientos` y `provisiones` **particionadas por mes** (decisión del usuario de PL2a: "Provisiones y vacaciones"). Las cuotas de préstamo son novedades con `prestamo_id`.
- **Conceptos:** AGUINALDO, VACACIONES_PAGADAS, EMBARGO_ALIMENTOS, EMBARGO_JUDICIAL y PRESTAMO, todos de sistema; ADELANTO pasa a ser de sistema. Tipo de planilla "Aguinaldo" (anual).
- **Motor:** aguinaldo por días de régimen con salario actual y sin deducciones (art. 97); embargos (alimentos primero, tope total, monto mensual prorrateado por días, corte al neto con aviso); cuotas de préstamo que no caben quedan pendientes y se cobran después como vencidas; devengados y deducciones por días u horas; guarda de solape solo entre planillas ordinarias; huella con embargos, liquidaciones y reglas de conceptos.
- **Liquidación:** calculada → aprobada → pagada, o anulada. Vacaciones del saldo, préstamos descontados solo de lo que no es aguinaldo (lo que no cabe queda condonado y se muestra aparte), no la aprueba quien la creó o calculó, la huella se compara al aprobar y aprobar finaliza el contrato con la fecha de egreso. El salario hasta el egreso lo paga la planilla del período: la liquidación rechaza salario pendiente si esa planilla existe, y si una liquidación aprobada ya lo pagó, la planilla paga 0 días a ese contrato con aviso.
- **Vacaciones:** saldo de 2.5 días por mes por vigencia de régimen; saldo inicial de AG al cierre de su fecha de corte; separación de funciones; saldo negativo bloqueado al aprobar y al anular.
- **RPC de PL2a reemplazadas:** `planilla_crear` (aguinaldo), `planilla_anular` y el recálculo (liberan cuotas vencidas), `planilla_novedad_crear/anular`, `planilla_liquidacion_simular` (saldo y deducciones), `planilla_regimen_cambiar` y `planilla_parametro_vigencia_nueva` (sin el bloqueo de la planilla de aguinaldo).

### Revisión independiente de PL2b (`reviewer`)

- **1.ª ronda:** 3 altos (huella de la liquidación con números sin decimales; doble pago del salario pendiente; embargo terminado antes de empezar que seguía cobrando), 5 medios (saldo inicial que restaba dos veces, bloqueo del aguinaldo, VACACIONES_PAGADAS editable, vacaciones sin separación de funciones, préstamo con fecha pasada cobrado de golpe), bajos y huecos de prueba. Todo corregido.
- **2.ª ronda:** una regresión alta de la corrección del doble pago (una liquidación pagada dejaba sin poder calcular la planilla de la empresa) y bajos (aviso con embargo anulado, anulación que dejaba negativo un goce anterior, corte de saldo inicial futuro, poscheque). Todo corregido.
- **Mutaciones:** las que sobrevivían (liberación de cuotas vencidas, prioridad de alimentos, corte del saldo inicial, filtro al aprobar, anulación con saldo negativo, salario pagado en la liquidación) ahora hacen fallar la prueba.

## Pantallas (PL4, PL5 y parte de PL6)

- **Proceso:** `ux-planner` (especificación con paquetes 0, A, B y C) → `ui-frontend` (Paquete 0 primero, después A, B y C en paralelo, cada uno con sus carpetas) → dos `reviewer` en paralelo → dos `ui-frontend` de corrección.
- **Menú:** dentro de RRHH, grupos Nómina (Resumen, Planillas, Novedades), Prestaciones (Vacaciones, Préstamos, Embargos, Liquidaciones, Simulador de liquidación), Análisis (Pasivo laboral, Declaraciones, Simulador de régimen) y Configuración (Régimen por contrato, Parámetros de ley, Tabla de IR, Conceptos, Tipos de planilla). Iconos alternos porque `packages/ui/nexo-icons.tsx` lo cambia otra sesión.
- **Rutas:** 40 bajo `/rrhh/planillas`, más impresión de colillas, detalle para cheques y documento de liquidación, y los CSV de planilla y declaraciones.
- **Contrato con la base:** los nombres de RPC y parámetros se compararon con un script (0 diferencias) y los campos de resultado los revisaron los dos `reviewer` contra el SQL aplicado (0 diferencias).
- **Revisión de la UI:**
  - Nómina y base: 1 alto (Importar de Asistencia venía con todas las ausencias marcadas y se importaban con un clic: con los datos reales, 52 ausencias), 3 medios (texto de planilla pagada que sugería anularla, "Marcar como pagada" sin aviso de que ya no se anula, filas marcadas que harían fallar la importación) y bajos.
  - Configuración y prestaciones: 4 medios (aprobar liquidación exigía siempre el permiso de finalizar contratos, la tabla de IR no validaba en pantalla las reglas nuevas ni avisaba qué tablas futuras reemplaza, los conceptos del sistema no dejaban editar nombre, colilla y cuenta contable) y bajos.
- **Correcciones (2026-10-22, dos `ui-frontend` en paralelo):**
  - Importar de Asistencia: ninguna fila viene marcada; botones "Marcar horas extra" y "Marcar ausencias"; resumen y aviso de que una ausencia descuenta salario; confirmación destructiva antes de importar ausencias; el error deja la selección.
  - Planilla pagada con su propio texto (no se anula); "Marcar como pagada" avisa que después ya no se anula; los diálogos de pagar y anular no se cierran si fallan.
  - Liquidación: el permiso de finalizar contratos y la fecha de egreso futura solo cuentan con el contrato activo; "Preparar liquidación" pide la fecha de fin real si el contrato terminó.
  - Tabla de IR: validaciones iguales a la RPC (primer tramo, exceso y base encadenados, día 1 o 16) y aviso de qué tablas programadas se reemplazan.
  - Conceptos del sistema: formulario reducido (nombre, colilla y cuenta contable); tipos de planilla con la clase fija al editar.
  - Un solo canal de error en los formularios (Alert enfocado), foco devuelto tras los diálogos de préstamos, embargos y vacaciones, Resumen sin el aguinaldo en el costo del empleador, "Honorario mensual" en el recibo de servicios profesionales.
  - Verificación final del coordinador: `rrhh` typecheck, lint y build en 0; script de contrato RPC con 0 diferencias; `npm run test:rrhh:planilla` en 0.
- **Deuda que queda:**
  - quedan detalles de foco sin resolver (al aprobar o anular una liquidación y al descartar un aviso de régimen, el botón desaparece) y toasts de error en Novedades y en el detalle de la planilla;
  - `AlertaError` está repetido en dos carpetas y `PagoDialog` no tiene estilo destructivo (los dos pertenecen a la base compartida o a `packages/ui`);
  - los tipos de `database.types.ts` no se regeneraron (el archivo tiene cambios sin commit de otra sesión); las RPC de planilla se llaman sin tipos generados;
  - componentes repetidos entre las carpetas `_compartido` de cada paquete;
  - la exportación CSV de la planilla no queda auditada (no hay RPC para eso) y cada consulta de una declaración queda auditada como "generada";
  - el encabezado de la migración `20261022001530` dice "NO APLICADA": es el texto que se aplicó y no se edita una migración aplicada;
  - el costo del aguinaldo en el Resumen y otras reglas de presentación quedan para confirmar con el contador.

### Revisión independiente de PL2c (`reviewer`)

- **1.ª ronda:** 1 alto (proponía ausencias en días de vacaciones aprobadas), medios (dos ausencias el mismo día, saltos de impuesto en la tabla de IR, fracción de horas extra fija en el código) y bajos (clase del tipo Aguinaldo, declaraciones solo de planillas ordinarias, vigencia futura del régimen, edición de conceptos del sistema, clave de idempotencia). Todo corregido.
- **2.ª ronda:** los 12 hallazgos cerrados. Quedaban 1 medio (vacaciones aprobadas **después** de importar una ausencia: el día se descontaba igual) y 3 bajos (novedad manual con la clave de Asistencia presentada como "Ya importada", impuesto base distinto de cero en el primer tramo de IR, reemplazo implícito de tablas de IR futuras). Corregidos antes de aplicar: aprobar un goce con una ausencia en esas fechas da error, y crear una ausencia manual en un día de vacaciones aprobadas también (con el mismo candado del contrato); la propuesta distingue la novedad manual; el primer tramo exige impuesto base 0. El aviso de tablas reemplazadas queda para la pantalla.

## Pruebas

- `supabase/tests/rrhh_planilla_pl2b_entorno.sql`, `rrhh_planilla_pl2b.prueba.sql`, `rrhh_planilla_pl2c_entorno.sql`, `rrhh_planilla_pl2c.prueba.sql`.
- Script `test:rrhh:planilla`: cadena completa (entorno, PL2a, entornos, Paso Cero, las 5 partes de PL2b y las 3 de PL2c) y las pruebas de PL2a, PL2b y PL2c. Parte de `test:db`. La prueba de PL2a se ajustó para contar solo sus 16 conceptos y corre también después de PL2b: las cifras doradas no cambian.
- Cifras nuevas comprobadas: G1 como documento (45021.66 menos un préstamo de 3000 = 42021.66), aguinaldo de año completo 11350.00 y proporcional al 30 de septiembre 8480.98, embargo de alimentos 10% = 567.50, tope judicial 1500, cuota vencida cobrada en la quincena siguiente, tope del art. 97 en la liquidación (deducción 945.83 y 5054.17 condonados), pasivo a seis meses 17025.00.

## Pendiente

- **Usuario:** recorrer las pantallas con sesión (no se hizo: el coordinador no usa credenciales reales) y verificar los cálculos; dar el rol de aprobador a una segunda persona (sin eso nadie aprueba planillas, liquidaciones ni vacaciones); asignar salario al contrato que no lo tiene; registrar el número INSS.
- **Contador:** valores "verificar" (techo y tasas, fracción de horas extra de 30 min, período del aguinaldo), tope legal del embargo, INSS e IR de vacaciones pagadas, costo del aguinaldo en el Resumen.
- **Commit:** migraciones, pruebas, pantallas y documentación siguen sin commit, a pedido del usuario.
- Después: corrida en paralelo con AG (PL7), archivo del banco, formato oficial SIE/VET y asiento contable.
