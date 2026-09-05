-- =============================================================================
-- Nexo — aviso de rendimiento RLS en las 25 policies de rrhh (pedido
-- explicito del usuario, 2026-09-05, punto 5: "usando el patron
-- recomendado (select auth.uid()) o equivalente"). No cambia
-- autorizacion: la condicion evaluada es exactamente la misma, solo deja
-- de re-evaluarse `auth.uid()` fila por fila.
--
-- Evidencia consultada: get_advisors(type=performance), 2026-09-05 —
-- WARN "auth_rls_initplan" en las 25 policies de las 7 tablas de rrhh
-- listadas abajo (mismo aviso existe tambien en crm.clientes y 2 tablas
-- de core -- fuera de alcance de esta auditoria, que es especificamente
-- de RRHH; queda anotado en docs/DATABASE.md como pendiente aparte, no se
-- toca aqui para no exceder el pedido).
--
-- Se usa ALTER POLICY (no drop+create): mismo nombre, mismo rol, mismo
-- comando, solo cambia el texto de USING/WITH CHECK -- confirmado que
-- Postgres soporta redefinir la expresion de una policy existente asi,
-- sin perder grants ni tener que recrear la tabla.
-- =============================================================================

alter policy "empleados: ver con permiso" on rrhh.empleados
  using (core.has_permission((select auth.uid()), company_id, 'rrhh.expedientes.empleados.ver'));
alter policy "empleados: crear con permiso" on rrhh.empleados
  with check (core.has_permission((select auth.uid()), company_id, 'rrhh.expedientes.empleados.crear'));
alter policy "empleados: editar con permiso" on rrhh.empleados
  using (core.has_permission((select auth.uid()), company_id, 'rrhh.expedientes.empleados.editar'))
  with check (core.has_permission((select auth.uid()), company_id, 'rrhh.expedientes.empleados.editar'));
alter policy "empleados: eliminar con permiso" on rrhh.empleados
  using (core.has_permission((select auth.uid()), company_id, 'rrhh.expedientes.empleados.eliminar'));

alter policy "compensacion: ver con permiso" on rrhh.empleado_compensacion
  using (core.has_permission((select auth.uid()), company_id, 'rrhh.expedientes.compensacion.ver'));
alter policy "compensacion: crear con permiso" on rrhh.empleado_compensacion
  with check (core.has_permission((select auth.uid()), company_id, 'rrhh.expedientes.compensacion.editar'));
alter policy "compensacion: editar con permiso" on rrhh.empleado_compensacion
  using (core.has_permission((select auth.uid()), company_id, 'rrhh.expedientes.compensacion.editar'))
  with check (core.has_permission((select auth.uid()), company_id, 'rrhh.expedientes.compensacion.editar'));

alter policy "kioskos: ver con permiso" on rrhh.kiosko_dispositivos
  using (core.has_permission((select auth.uid()), company_id, 'rrhh.asistencia.kioskos.ver'));
alter policy "kioskos: crear con permiso" on rrhh.kiosko_dispositivos
  with check (core.has_permission((select auth.uid()), company_id, 'rrhh.asistencia.kioskos.crear'));
alter policy "kioskos: editar con permiso" on rrhh.kiosko_dispositivos
  using (core.has_permission((select auth.uid()), company_id, 'rrhh.asistencia.kioskos.editar'))
  with check (core.has_permission((select auth.uid()), company_id, 'rrhh.asistencia.kioskos.editar'));
alter policy "kioskos: eliminar con permiso" on rrhh.kiosko_dispositivos
  using (core.has_permission((select auth.uid()), company_id, 'rrhh.asistencia.kioskos.eliminar'));

alter policy "marcas: ver con permiso" on rrhh.asistencia_marcas
  using (core.has_permission((select auth.uid()), company_id, 'rrhh.asistencia.marcas.ver'));
alter policy "marcas: crear con permiso" on rrhh.asistencia_marcas
  with check (core.has_permission((select auth.uid()), company_id, 'rrhh.asistencia.marcas.crear'));
alter policy "marcas: editar con permiso" on rrhh.asistencia_marcas
  using (core.has_permission((select auth.uid()), company_id, 'rrhh.asistencia.marcas.editar'))
  with check (core.has_permission((select auth.uid()), company_id, 'rrhh.asistencia.marcas.editar'));
alter policy "marcas: eliminar con permiso" on rrhh.asistencia_marcas
  using (core.has_permission((select auth.uid()), company_id, 'rrhh.asistencia.marcas.eliminar'));

alter policy "planillas: ver con permiso" on rrhh.planillas
  using (core.has_permission((select auth.uid()), company_id, 'rrhh.planillas.planilla.ver'));
alter policy "planillas: crear con permiso" on rrhh.planillas
  with check (core.has_permission((select auth.uid()), company_id, 'rrhh.planillas.planilla.generar'));
alter policy "planillas: editar borrador con permiso" on rrhh.planillas
  using (core.has_permission((select auth.uid()), company_id, 'rrhh.planillas.planilla.generar'))
  with check (core.has_permission((select auth.uid()), company_id, 'rrhh.planillas.planilla.generar'));

alter policy "detalles: ver con permiso" on rrhh.planilla_detalles
  using (core.has_permission((select auth.uid()), company_id, 'rrhh.planillas.movimientos.ver'));
alter policy "detalles: crear con permiso" on rrhh.planilla_detalles
  with check (core.has_permission((select auth.uid()), company_id, 'rrhh.planillas.movimientos.crear'));
alter policy "detalles: editar con permiso" on rrhh.planilla_detalles
  using (core.has_permission((select auth.uid()), company_id, 'rrhh.planillas.movimientos.crear'))
  with check (core.has_permission((select auth.uid()), company_id, 'rrhh.planillas.movimientos.crear'));
alter policy "detalles: eliminar con permiso" on rrhh.planilla_detalles
  using (core.has_permission((select auth.uid()), company_id, 'rrhh.planillas.movimientos.eliminar'));

alter policy "parametros_ley: ver con permiso" on rrhh.parametros_ley
  using (core.has_permission((select auth.uid()), company_id, 'rrhh.planillas.parametros.ver'));
alter policy "parametros_ley: crear con permiso" on rrhh.parametros_ley
  with check (core.has_permission((select auth.uid()), company_id, 'rrhh.planillas.parametros.editar'));
alter policy "parametros_ley: editar con permiso" on rrhh.parametros_ley
  using (core.has_permission((select auth.uid()), company_id, 'rrhh.planillas.parametros.editar'))
  with check (core.has_permission((select auth.uid()), company_id, 'rrhh.planillas.parametros.editar'));
