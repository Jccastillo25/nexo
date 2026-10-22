# Los 25 permisos `rrhh.planillas.*` y quién los tiene

Verificado en el repo el 2026-10-21: 8 códigos en
`supabase/migrations/20260902000005_rrhh_permissions_and_roles.sql:48-55`, 2 en
`20260902000008_rrhh_nicaragua_and_contracts.sql:175-178` y 15 en
`20261021160943_rrhh_planilla_paso_cero.sql:40-55`. Conteo por plantilla
según `docs/PERMISSIONS.md` (Planilla): admin 25, especialista 18, consulta 7,
supervisor 2, gestor 1. **Ningún rol de empresa (`core.rol_permisos`) los tiene
todavía**; se asignan en Configuración → Roles. El estado remoto lo verifica el
coordinador.

| Código | Uso en el motor | admin | especialista | supervisor | gestor | consulta |
|---|---|:-:|:-:|:-:|:-:|:-:|
| `planilla.ver` | Leer planillas, renglones, líneas, colillas | ✓ | ✓ | — | — | ✓ |
| `planilla.generar` | Crear período, calcular, recalcular, regenerar | ✓ | ✓ | — | — | — |
| `planilla.aprobar` | Aprobar (distinto de quien calculó) | ✓ | — | — | — | — |
| `planilla.anular` | Anular con motivo | ✓ | — | — | — | — |
| `planilla.pagar` | Marcar pagada | ✓ | — | — | — | — |
| `movimientos.ver` | Ver novedades | ✓ | ✓ | — | — | ✓ |
| `movimientos.crear` | Crear, editar, importar novedades | ✓ | ✓ | — | — | — |
| `movimientos.eliminar` | Eliminar novedad no aplicada en planilla aprobada | ✓ | ✓ | — | — | — |
| `reportes.exportar` | Exportar reportes, detalle de cheques o banco | ✓ | ✓ | — | — | — |
| `parametros.ver` | Ver parámetros y tramos de IR | ✓ | ✓ | — | — | — |
| `parametros.editar` | Nueva vigencia de parámetro o tramo | ✓ | — | — | — | — |
| `regimen.ver` | Ver régimen, historial y simulador de costo | ✓ | ✓ | — | ✓ | ✓ |
| `regimen.cambiar` | Cambiar régimen; descartar aviso | ✓ | — | — | — | — |
| `conceptos.ver` | Ver conceptos y tipos de planilla | ✓ | ✓ | — | — | ✓ |
| `conceptos.gestionar` | Crear y editar conceptos y tipos | ✓ | ✓ | — | — | — |
| `vacaciones.ver` | Saldos y movimientos | ✓ | ✓ | ✓ | — | ✓ |
| `vacaciones.registrar` | Registrar goce, pago o ajuste | ✓ | ✓ | — | — | — |
| `vacaciones.aprobar` | Aprobar o rechazar solicitudes | ✓ | — | ✓ | — | — |
| `prestamos.ver` | Préstamos, adelantos, embargos | ✓ | ✓ | — | — | ✓ |
| `prestamos.gestionar` | Crear y editar préstamos, adelantos, embargos | ✓ | ✓ | — | — | — |
| `liquidaciones.ver` | Ver liquidaciones y simulaciones | ✓ | ✓ | — | — | ✓ |
| `liquidaciones.calcular` | Simular y preparar | ✓ | ✓ | — | — | — |
| `liquidaciones.aprobar` | Aprobar (distinto de quien calculó) | ✓ | — | — | — | — |
| `declaraciones.generar` | INSS, INATEC, DGI-VET | ✓ | ✓ | — | — | — |
| `colillas.enviar` | Publicar y enviar colillas de planilla aprobada | ✓ | ✓ | — | — | — |

Notas:
- La columna "consulta" de `planilla.ver` y `movimientos.ver` sale de `20260902000005:155-156`; la de `parametros.ver` del especialista de `20260902000008:190-194`. Conteo: especialista 18 = 9 previos − 2 quitados + 11 nuevos.
- Feriados usan `rrhh.asistencia.feriados.*`, no un código de planillas.
- Las cuentas bancarias del empleado siguen con `rrhh.expedientes.cuentas_bancarias.*` (solo admin).

## Huecos conocidos (no inventar códigos)

| Acción | Situación |
|---|---|
| Pagar una liquidación | Sin código. ¿`planilla.pagar` o `liquidaciones.aprobar`? Decide el usuario |
| Anular una liquidación aprobada | Sin código |
| Devolver una planilla calculada a borrador (rechazo del aprobador) | Sin código; puede bastar con que el aprobador no apruebe y el especialista recalcule |
| Ver declaraciones sin generarlas | Solo existe `declaraciones.generar` |
| Autoservicio del empleado (colilla, solicitar vacaciones) | Paso Cero aparte `rrhh.autoservicio.*` (plan 20 §8.1) |
| Visibilidad de una app "Planilla" separada | Si se decide el mosaico propio (decisión 5), el slug en `core.apps` crea `planilla.ver_modulo` por trigger |
