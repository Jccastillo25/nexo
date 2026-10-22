# 2026-10-20 — Planilla y prestaciones: análisis de AG Planilla y marco legal

- **Subfase:** F1.7 (motor de planillas), solo análisis. **Diseño:** [plan 20](../plan/20-planilla.md).
- **Estado:** ⏳ pendiente → 🟡 análisis documentado. Sin código, sin migraciones, sin commit.

## Pedido del usuario

- "Quiero analizar el sistema que estoy usando actualmente para el control de planilla y prestaciones, me gustaría traerlo a nexo en funcionalidad pero teniendo optimizaciones" (`agplanilla.net/materialesjcastillo`).
- Ante la falla del servidor: analizar la documentación de AG Planilla y la ley (MITRAB, INSS, INATEC, etc.), y probar el servidor mañana.

## Qué se hizo

1. **AG Planilla.** Se abrió en el navegador integrado y en el Chrome del usuario. El usuario no pudo iniciar sesión: el servidor respondió con un error interno. No se capturó la respuesta de red porque el seguimiento empezó después del intento, y Claude no envía formularios con contraseña.
   - La app es Flutter web compilado. El sitio comercial (`agplanilla.com/5` y `/6`) solo tiene la lista de funciones y los precios; no publica manuales.
2. **Marco legal.** Se investigaron el Código del Trabajo (Ley 185, arts. 42–45, 51, 57, 58, 62, 64, 66, 68, 76–78, 82, 86–97 y 141), la tabla de IR de la DGI (Ley 822, art. 23), las tasas del INSS (Decreto 06-2019), INATEC y el salario mínimo 2026. Cada dato quedó marcado como oficial, coincidente o por verificar.
3. **Verificación remota** (solo lectura, `nexo-core`):
   - RRHH tiene 6 empleados, 5 contratos activos y 1 jornada. `feriados`, `planillas` y `planilla_detalles` tienen 0 filas.
   - Existen 10 permisos `rrhh.planillas.*`.
   - `parametros_ley` tiene INSS laboral 7%, patronal 22.5%, INATEC 2% y techo C$100,000.

## Hallazgos

- **INSS patronal:** la semilla es 22.5%, pero con menos de 50 trabajadores la tasa es 21.5%. AG Negocio muestra 11 empleados. Hay que confirmarlo con la factura del INSS.
- **Techo del INSS:** C$100,000 es un valor de ejemplo de 2026-09-02 que nunca se verificó. La mayoría de las fuentes dicen que no hay techo desde la reforma 2018–2019.
- **`planilla_detalles`:** no tiene `contrato_id` (lo pide el plan 03 §8.7) y usa columnas fijas sin catálogo de conceptos.
- **Feriados:** la tabla está vacía.
- **Art. 43 del Código del Trabajo:** la renuncia conserva la indemnización por antigüedad del art. 45. La liquidación de Nexo debe calcularla también en renuncias.

## Recorrido con sesión (2026-10-21)

El usuario inició sesión en Chrome, en la pestaña del grupo de Claude.
- AG guarda la sesión por pestaña.
- El menú Flutter se leyó activando su capa de accesibilidad. Las pantallas antiguas, que van dentro de un marco de otro origen, se leyeron con capturas.
- No se guardó ni se envió nada: los formularios se cerraron sin guardar, y no se usaron "Enviar colillas" ni "Activar planilla".
- Detalle en el plan 20 §1.2–§1.4.

Hechos clave:
- **Menú:** unas 120 opciones.
- **Empleadores:** dos, Materiales J Castillo (régimen Integral) y Ferretería La Máxima, esta sin personal.
- **Plantillas:** una quincenal en C$ y una de aguinaldo.
- **Personal:** 136 fichas, **6 contratos vigentes** y 31 liquidaciones desde 2023.
- **Cuotas INSS:** 7% / **21.5%**, con salario mínimo de C$11,350 (comercio).
- **Tabla IR:** igual a la de la DGI.
- **Cálculo:** salario diario sobre 30 días; provisiones del 25%.
- **Pago y contabilidad:** se paga con cheque y las cuentas contables están vacías.
- **Feriados 2026:** 14.
- **Hallazgo principal:** los 6 contratos vigentes están como **"Free-lance" con IR al 0%**. En las planillas de septiembre de 2026 y de junio de 2024 no hay INSS laboral, IR, INSS patronal ni INATEC. Queda como decisión 0 del plan 20, para el contador o el abogado. Nexo no da asesoría legal.
- **Caso de prueba dorado:** una liquidación real anonimizada de C$45,021.66, con indemnización de 95 días por el art. 45.

## Decisión 0 y Paso Cero propuesto (2026-10-21)

- **Usuario:** "Hay que dejar preparado para ambas opciones". El régimen (laboral o servicios profesionales) va por contrato y con vigencia, en la tabla `contrato_regimen`, con simulador de costo y aviso sin bloqueo (plan 20 §8.3).
- **Paso Cero propuesto** (plan 20 §8): 15 códigos `rrhh.planillas.*` y 34 asignaciones a plantillas. Con eso quedan 25 permisos de planilla.
  - Se ensayó en `nexo-core` dentro de una transacción revertida: dio 34 asignaciones, todos los códigos tienen 4 segmentos y no quedó nada.
  - Hay un cambio opcional: quitarle `planilla.aprobar` y `planilla.anular` a `especialista_planillas`.
## Paso Cero aplicado (2026-10-21)

- **Aprobación del usuario:** "Apruebo el Paso Cero de Planilla, incluyendo quitarle aprobar y anular al especialista de planillas. Aplícalo."
- **Migración:** `20261021160943_rrhh_planilla_paso_cero`, aplicada con `apply_migration` y guardada en local con la versión remota. Pasó sus prechequeos y poschequeos dentro de la misma migración.
- **Verificado en remoto:**
  - 25 permisos de planillas y 85 de RRHH;
  - por plantilla: admin 25, especialista 18 (del recurso planilla solo conserva `ver` y `generar`), consulta 7, supervisor 2 y gestor 1;
  - ningún rol de empresa con los códigos nuevos.
- **Documentación actualizada:** `MIGRATION_LOG`, `PERMISSIONS`, plan 20, `RRHH_MVP` e `IMPLEMENTATION_STATUS`.
- Sin tablas, sin código de app y sin commit.

## Skills de Planilla para los subagentes (2026-10-21)

- **Pedido del usuario:** crear las skills que necesitan los subagentes para reconstruir el módulo de Planilla con lo aprendido de AG Planilla.
- **Las escribió el `skills-specialist`; las revisó el coordinador.** Las tres son de creación propia, sin scripts, sin `allowed-tools` y sin datos personales:

  | Skill | Contenido |
  |---|---|
  | `nexo-planilla-legal` | Marco legal, fórmulas, regímenes y casos dorados G1–G8 |
  | `nexo-planilla-motor` | Modelo de datos, RPC, estados, pruebas en PGlite y checklist de revisión |
  | `nexo-planilla-flujos` | Navegación, 14 flujos, permiso por pantalla y KPIs |

- **Asignadas en `skills:`:**
  - ux-planner y ui-frontend: legal y flujos;
  - reviewer: las tres.
  - Están registradas en `CLAUDE.md` y en `.claude/skills/README.md`.
- **Hallazgos del especialista contra el plan 20 §3:** no se corrigieron todavía en el plan; los resuelve PL2 o el contador.
  1. **Indemnización y causa de terminación.**
     - El art. 45 aplica a contratos indeterminados.
     - El art. 48 (despido con causa justa) paga solo vacaciones y aguinaldo.
     - El art. 47 (personal de confianza) suma de 2 a 6 meses.
     - Nexo no guarda la causa de terminación.
  2. **Aguinaldo:** el art. 97 prohíbe descontarle préstamos, también en la liquidación.
  3. **Exención de IR de la indemnización** (Ley 822 art. 19): está exenta hasta C$500,000 y el excedente lleva una retención del 15%.
  4. **Salario diario:** el caso dorado solo cuadra con el diario redondeado a 4 decimales.
  5. **Aguinaldo y provisiones:**
     - el caso dorado sugiere que el período del aguinaldo es el año calendario;
     - AG provisiona la indemnización a 1/12 fijo.
  6. **Estados y permisos:**
     - el estado intermedio se llama `calculada`;
     - con un solo admin nadie puede aprobar;
     - faltan permisos para pagar y anular una liquidación;
     - `consulta` ve salarios a través de `planilla.ver`.
  7. **Antigüedad entre contratos:** un aumento de salario crea otro contrato, así que hace falta una fecha de antigüedad.
  8. **Particiones:** hay que decidir si también se particionan los movimientos de vacaciones, las cuotas de préstamo y las provisiones.
  9. **Runner de PGlite:** solo muestra mensajes `FALLO P2–P7`.
- **Pendiente:** la sesión nueva que carga las skills y empieza PL2.

## Pendiente

- PL2: esquema (`contrato_regimen`, conceptos, planillas por línea, préstamos, vacaciones y liquidaciones) y motor en RPC, con pruebas doradas. Incluye corregir `parametros_ley` a 21.5% y cargar los 14 feriados de 2026.
- Decisiones 4, 5, 7 y 8 del plan 20 §9.
- La validación del contador.
- El Paso Cero de §8: está propuesto, no aprobado.
