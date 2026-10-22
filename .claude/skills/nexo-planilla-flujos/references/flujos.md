# Flujos clave

Prefijo `rrhh.planillas.` omitido en los permisos. RPC = nombre propuesto en
nexo-planilla-motor (no existe todavía). Cada paso que escribe pasa por
Server Action → `requirePermission` → RPC.

## F1. Abrir período

Quién: especialista o admin [`planilla.generar`].
1. "Nueva planilla": tipo (de `planilla_tipos`) y período sugerido (el siguiente al último, p. ej. 1–15 o 16–fin de mes).
2. La RPC valida: no hay otra planilla no anulada del mismo tipo y período; existen parámetros y tramos de IR vigentes. Si falta uno, `Alert tone="error"` con el nombre del parámetro y un enlace a Parámetros (si tiene `parametros.ver`).
3. Resultado: planilla `borrador` con la lista de contratos que entran (activos o finalizados dentro del período) y avisos (régimen a revisar, sin cuenta bancaria, sin jornada).

## F2. Capturar novedades

Quién: [`movimientos.crear`]; ver [`movimientos.ver`]; borrar [`movimientos.eliminar`].
- Alta individual: contrato, concepto, cantidad o monto, fecha.
- Importación de Excel: plantilla descargable → carga → **vista previa** con errores por fila (contrato inexistente, concepto inactivo, monto inválido) → confirmar. Nada se guarda antes de confirmar.
- Horas extra y faltas desde Asistencia: "Pendiente de integración" hasta PL3 (resumen diario aprobado por el supervisor).
- Una novedad de una planilla aprobada no se edita ni se borra.

## F3. Calcular

Quién: [`planilla.generar`].
- "Calcular planilla" (y "Volver a calcular" si cambió algo). Mientras corre: botón deshabilitado con spinner; nada de doble envío.
- Resultado: tabla por persona (devengado, deducciones, neto, aporte patronal, provisiones) con totales; detalle por persona con sus líneas (concepto, cantidad, base, tasa, monto, artículo).
- Bloqueos con motivo (no calcula): parámetro faltante, salario bajo el mínimo, horas extra sobre el límite, neto negativo, saldo de vacaciones negativo, embargo sobre el tope.
- Avisos (calcula igual): régimen a revisar, dato "verificar" en uso, contrato sin cuenta si el pago es por banco.
- Si hubo cambios después del cálculo: `Alert tone="warning"` "Hubo cambios después del último cálculo. Vuelve a calcular antes de aprobar."

## F4. Revisar contra el período anterior

Quién: [`planilla.ver`].
Por persona: neto, devengado y deducciones de este período y del anterior del mismo tipo, diferencia en C$ y %, y el motivo cuando se puede saber (ingreso, egreso, novedad, cambio de salario, cambio de parámetro). Las diferencias grandes se resaltan con texto, no solo color. Sin período anterior: "No hay un período anterior para comparar".

## F5. Aprobar

Quién: admin [`planilla.aprobar`], **distinto de quien calculó**.
- `ConfirmDialog` con período, personas, total neto y costo del empleador: "Aprobar planilla". Texto: "Después de aprobarla no se puede editar. Para corregirla habrá que anularla y generar otra."
- Si el usuario calculó esa planilla: botón deshabilitado con "La aprobación la hace otra persona".
- Al aprobar: estado `aprobada`, huella visible (abreviada) y quién y cuándo.

## F6. Pagar

Quién: admin [`planilla.pagar`].
- Método: cheque (hoy) o transferencia ("Pronto" hasta decidir banco). Con cheque: número por persona.
- "Detalle para cheques" exportable [`reportes.exportar`].
- Pagar no cambia montos; queda `pagada` con quién y cuándo.

## F7. Colillas

- Ver la colilla de cualquier persona [`planilla.ver`]: encabezado (empresa, período, contrato, régimen), ingresos, deducciones, neto, artículo de cada concepto y "Recibí conforme". Los aportes patronales y las provisiones no van en la colilla (propuesta).
- Publicar o enviar [`colillas.enviar`], solo `aprobada` o `pagada`. El autoservicio y "recibido" esperan el Paso Cero de `rrhh.autoservicio.*`.
- Impresión: una colilla por página.

## F8. Anular y regenerar

Quién: admin [`planilla.anular`].
`ConfirmDialog` destructivo con motivo obligatorio. Resultado: `anulada`, novedades y cuotas liberadas, y la acción "Generar planilla de reemplazo" [`planilla.generar`]. Una planilla `pagada` no muestra "Anular" (decisión pendiente).

## F9. Vacaciones

- Saldo por persona y movimientos [`vacaciones.ver`] (acumulado, gozado, pagado, ajustes; el saldo nunca se edita a mano).
- Registrar goce, pago o ajuste [`vacaciones.registrar`]; aprobar o rechazar [`vacaciones.aprobar`] por otra persona (supervisor o admin).
- Bloqueo: saldo negativo. Solicitud del empleado desde el celular: Paso Cero de autoservicio pendiente.

## F10. Préstamos, adelantos y embargos

[`prestamos.ver`] / [`prestamos.gestionar`].
- Préstamo o adelanto: monto, cuotas, fecha de la primera; vista previa del plan de cuotas antes de guardar; saldo calculado.
- Embargo: tipo (alimentos u otro), monto o %, tope, referencia de la orden; aviso "Tope pendiente de confirmar con el abogado" mientras sea dato "verificar".
- Cuotas aplicadas en una planilla aprobada no se editan.

## F11. Liquidación

- **Simulador** [`liquidaciones.calcular`] (no guarda): contrato, fecha de egreso, causa (despido sin causa, renuncia, mutuo acuerdo, despido con causa justa art. 48, vencimiento) → líneas con días, diario, monto y artículo. Texto fijo: "Simulación: no se guarda ni cambia el contrato".
- Preparar [`liquidaciones.calcular`] → aprobar [`liquidaciones.aprobar`] por otra persona.
- Pago de la liquidación y enlace con "Finalizar contrato": decisión pendiente (no hay permiso propio; `fn_finalizar_contrato` no guarda causa).

## F12. Declaraciones INSS, INATEC y DGI-VET

[`declaraciones.generar`]. Por mes, desde planillas `aprobada`/`pagada`: lista por persona y totales, exportable. Formato de archivo oficial: "Pendiente de integración" hasta PL6. Plazos de pago: dato "verificar".

## F13. Simulador de régimen

[`regimen.ver`]. Por contrato y total: costo en régimen laboral vs servicios profesionales (fórmula en nexo-planilla-legal, regimenes.md), con los parámetros vigentes. No guarda. Si hay datos "verificar", lo dice.
El aviso "Revisar régimen con el contador" aparece en la ficha del contrato y en la planilla; "Descartar aviso" [`regimen.cambiar`] pide motivo.

## F14. Configuración

- Parámetros y tabla de IR [`parametros.ver`/`.editar`]: historial por vigencia; "Nueva vigencia" cierra la anterior; nunca se edita una fila pasada.
- Conceptos y tipos [`conceptos.ver`/`.gestionar`]: los conceptos legales del sistema se muestran bloqueados; uno usado en planilla aprobada no cambia sus reglas.
- Régimen por contrato [`regimen.ver`/`.cambiar`]: fecha efectiva y motivo; historial.
