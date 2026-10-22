-- =============================================================================
-- Índices B-Tree en las llaves foráneas que no tenían uno que las cubriera
-- (revisión integral 2026-10-20; advisor unindexed_foreign_keys: 106 FK en
-- tablas padre; docs/status-log/2026-10-20-revision-integral.md).
--
-- Regla de la suite (CLAUDE.md → "toda tabla de hechos nace particionada"):
-- B-Tree en toda FK. En tablas particionadas el índice se crea en el padre y
-- Postgres lo propaga a cada partición, incluidas las futuras.
-- Cuando una FK compuesta empieza por la misma columna que una FK simple
-- (p. ej. (puesto_id, company_id) y (puesto_id)), un solo índice compuesto
-- cubre las dos: por eso son 101 índices para 106 FK.
-- Lista generada desde el catálogo de nexo-core el 2026-10-20; `if not exists`
-- la hace idempotente. Volúmenes actuales chicos: sin CONCURRENTLY.
--
-- Revisión independiente (2026-10-20): cada `create index` toma un lock SHARE
-- que bloquea escrituras hasta el COMMIT de toda la migración (incluye
-- core.audit_log, atencion.turnos/turno_eventos/sesiones y
-- presupuesto.facturas). Por eso:
--   * lock_timeout: si una tabla está tomada, la migración falla rápido y
--     entera (se reintenta) en vez de formar una cola de escrituras;
--   * aplicar fuera del horario de Atención y del kiosco, y nunca durante una
--     importación de Presupuesto. Medir antes los tamaños con
--     pg_total_relation_size.
-- =============================================================================

set local lock_timeout = '5s';
set local statement_timeout = '300s';

create index if not exists ix_pantallas_sucursal_id_company_id on atencion.pantallas (sucursal_id, company_id);
create index if not exists ix_puestos_sucursal_id_company_id on atencion.puestos (sucursal_id, company_id);
create index if not exists ix_sesiones_cerrado_por on atencion.sesiones (cerrado_por);
create index if not exists ix_sesiones_company_id on atencion.sesiones (company_id);
create index if not exists ix_sesiones_puesto_id on atencion.sesiones (puesto_id);
create index if not exists ix_sesiones_sucursal_id on atencion.sesiones (sucursal_id);
create index if not exists ix_sesiones_user_id on atencion.sesiones (user_id);
create index if not exists ix_sesiones_activas_company_id on atencion.sesiones_activas (company_id);
create index if not exists ix_turno_eventos_company_id on atencion.turno_eventos (company_id);
create index if not exists ix_turno_eventos_puesto_id on atencion.turno_eventos (puesto_id);
create index if not exists ix_turno_eventos_sucursal_id on atencion.turno_eventos (sucursal_id);
create index if not exists ix_turno_eventos_user_id on atencion.turno_eventos (user_id);
create index if not exists ix_turnos_atendido_por on atencion.turnos (atendido_por);
create index if not exists ix_turnos_company_id on atencion.turnos (company_id);
create index if not exists ix_turnos_creado_por on atencion.turnos (creado_por);
create index if not exists ix_turnos_puesto_id on atencion.turnos (puesto_id);
create index if not exists ix_app_role_permissions_permission_code on core.app_role_permissions (permission_code);
create index if not exists ix_audit_log_company_id on core.audit_log (company_id);
create index if not exists ix_audit_log_user_id on core.audit_log (user_id);
create index if not exists ix_company_apps_app_id on core.company_apps (app_id);
create index if not exists ix_company_memberships_rol_id_company_id on core.company_memberships (rol_id, company_id);
create index if not exists ix_permissions_catalog_module_slug on core.permissions_catalog (module_slug);
create index if not exists ix_roles_created_by on core.roles (created_by);
create index if not exists ix_user_app_roles_app_role_id on core.user_app_roles (app_role_id);
create index if not exists ix_user_app_roles_company_id on core.user_app_roles (company_id);
create index if not exists ix_user_app_roles_granted_by on core.user_app_roles (granted_by);
create index if not exists ix_user_permissions_company_id on core.user_permissions (company_id);
create index if not exists ix_user_permissions_granted_by on core.user_permissions (granted_by);
create index if not exists ix_user_permissions_permission_code on core.user_permissions (permission_code);
create index if not exists ix_usuario_sucursales_sucursal_id_company_id on core.usuario_sucursales (sucursal_id, company_id);
create index if not exists ix_facturas_vendedor_id_company_id on presupuesto.facturas (vendedor_id, company_id);
create index if not exists ix_importaciones_company_id on presupuesto.importaciones (company_id);
create index if not exists ix_importaciones_user_id on presupuesto.importaciones (user_id);
create index if not exists ix_metas_vendedor_actualizado_por on presupuesto.metas_vendedor (actualizado_por);
create index if not exists ix_metas_vendedor_vendedor_id_company_id on presupuesto.metas_vendedor (vendedor_id, company_id);
create index if not exists ix_presupuesto_meses_presupuesto_id_company_id on presupuesto.presupuesto_meses (presupuesto_id, company_id);
create index if not exists ix_presupuestos_actualizado_por on presupuesto.presupuestos (actualizado_por);
create index if not exists ix_clasificaciones_padre_id_company_id on productos.clasificaciones (padre_id, company_id);
create index if not exists ix_marca_clases_clase_id_company_id on productos.marca_clases (clase_id, company_id);
create index if not exists ix_marca_clases_marca_id_company_id on productos.marca_clases (marca_id, company_id);
create index if not exists ix_producto_caracteristicas_caracteristica_id_company_id on productos.producto_caracteristicas (caracteristica_id, company_id);
create index if not exists ix_producto_caracteristicas_producto_id_company_id on productos.producto_caracteristicas (producto_id, company_id);
create index if not exists ix_productos_categoria_id_company_id on productos.productos (categoria_id, company_id);
create index if not exists ix_productos_centro_costo_id_company_id on productos.productos (centro_costo_id, company_id);
create index if not exists ix_productos_clase_id_company_id on productos.productos (clase_id, company_id);
create index if not exists ix_productos_created_by on productos.productos (created_by);
create index if not exists ix_productos_cuenta_costo_id_company_id on productos.productos (cuenta_costo_id, company_id);
create index if not exists ix_productos_cuenta_ingreso_id_company_id on productos.productos (cuenta_ingreso_id, company_id);
create index if not exists ix_productos_cuenta_inventario_id_company_id on productos.productos (cuenta_inventario_id, company_id);
create index if not exists ix_productos_marca_id_company_id on productos.productos (marca_id, company_id);
create index if not exists ix_productos_proveedor_id_company_id on productos.productos (proveedor_id, company_id);
create index if not exists ix_productos_tipo_id_company_id on productos.productos (tipo_id, company_id);
create index if not exists ix_productos_unidad_id_company_id on productos.productos (unidad_id, company_id);
create index if not exists ix_productos_updated_by on productos.productos (updated_by);
create index if not exists ix_contrato_compensacion_updated_by on rrhh.contrato_compensacion (updated_by);
create index if not exists ix_contrato_credenciales_creado_by on rrhh.contrato_credenciales (creado_by);
create index if not exists ix_contrato_credenciales_revocado_by on rrhh.contrato_credenciales (revocado_by);
create index if not exists ix_contrato_jornadas_created_by on rrhh.contrato_jornadas (created_by);
create index if not exists ix_contrato_jornadas_jornada_id on rrhh.contrato_jornadas (jornada_id);
create index if not exists ix_contratos_activado_by on rrhh.contratos (activado_by);
create index if not exists ix_contratos_created_by on rrhh.contratos (created_by);
create index if not exists ix_contratos_departamento_id_company_id on rrhh.contratos (departamento_id, company_id);
create index if not exists ix_contratos_empleado_id_company_id on rrhh.contratos (empleado_id, company_id);
create index if not exists ix_contratos_finalizado_by on rrhh.contratos (finalizado_by);
create index if not exists ix_contratos_plantilla_contrato_id_company_id on rrhh.contratos (plantilla_contrato_id, company_id);
create index if not exists ix_contratos_puesto_id_company_id on rrhh.contratos (puesto_id, company_id);
create index if not exists ix_departamentos_created_by on rrhh.departamentos (created_by);
create index if not exists ix_departamentos_updated_by on rrhh.departamentos (updated_by);
create index if not exists ix_empleado_beneficiarios_created_by on rrhh.empleado_beneficiarios (created_by);
create index if not exists ix_empleado_beneficiarios_empleado_id_company_id on rrhh.empleado_beneficiarios (empleado_id, company_id);
create index if not exists ix_empleado_beneficiarios_updated_by on rrhh.empleado_beneficiarios (updated_by);
create index if not exists ix_empleado_compensacion_updated_by on rrhh.empleado_compensacion (updated_by);
create index if not exists ix_empleado_cuentas_bancarias_created_by on rrhh.empleado_cuentas_bancarias (created_by);
create index if not exists ix_empleado_cuentas_bancarias_empleado_id_company_id on rrhh.empleado_cuentas_bancarias (empleado_id, company_id);
create index if not exists ix_empleado_cuentas_bancarias_updated_by on rrhh.empleado_cuentas_bancarias (updated_by);
create index if not exists ix_empleado_direccion_departamento_geo_id on rrhh.empleado_direccion (departamento_geo_id);
create index if not exists ix_empleado_direccion_empleado_id_company_id on rrhh.empleado_direccion (empleado_id, company_id);
create index if not exists ix_empleado_direccion_municipio_geo_id_departamento_geo_id on rrhh.empleado_direccion (municipio_geo_id, departamento_geo_id);
create index if not exists ix_empleado_direccion_updated_by on rrhh.empleado_direccion (updated_by);
create index if not exists ix_empleado_documentos_eliminado_por on rrhh.empleado_documentos (eliminado_por);
create index if not exists ix_empleado_documentos_empleado_id_company_id on rrhh.empleado_documentos (empleado_id, company_id);
create index if not exists ix_empleado_documentos_subido_por on rrhh.empleado_documentos (subido_por);
create index if not exists ix_empleado_info_complementaria_empleado_id_company_id on rrhh.empleado_info_complementaria (empleado_id, company_id);
create index if not exists ix_empleado_info_complementaria_updated_by on rrhh.empleado_info_complementaria (updated_by);
create index if not exists ix_feriados_created_by on rrhh.feriados (created_by);
create index if not exists ix_jornadas_created_by on rrhh.jornadas (created_by);
create index if not exists ix_parametros_ley_created_by on rrhh.parametros_ley (created_by);
create index if not exists ix_planilla_detalles_company_id on rrhh.planilla_detalles (company_id);
create index if not exists ix_planillas_anulada_por on rrhh.planillas (anulada_por);
create index if not exists ix_planillas_aprobada_por on rrhh.planillas (aprobada_por);
create index if not exists ix_planillas_generada_por on rrhh.planillas (generada_por);
create index if not exists ix_plantillas_contrato_created_by on rrhh.plantillas_contrato (created_by);
create index if not exists ix_plantillas_contrato_updated_by on rrhh.plantillas_contrato (updated_by);
create index if not exists ix_puesto_plantillas_created_by on rrhh.puesto_plantillas (created_by);
create index if not exists ix_puesto_plantillas_plantilla_id_company_id on rrhh.puesto_plantillas (plantilla_id, company_id);
create index if not exists ix_puesto_plantillas_puesto_id_company_id on rrhh.puesto_plantillas (puesto_id, company_id);
create index if not exists ix_puestos_created_by on rrhh.puestos (created_by);
create index if not exists ix_puestos_departamento_id_company_id on rrhh.puestos (departamento_id, company_id);
create index if not exists ix_puestos_updated_by on rrhh.puestos (updated_by);
create index if not exists ix_seguridad_accesos_company_id on rrhh.seguridad_accesos (company_id);
create index if not exists ix_seguridad_accesos_empleado_id on rrhh.seguridad_accesos (empleado_id);

-- Poscheque: ninguna FK de estos schemas sin índice que la cubra ---------------
do $$
declare v_n int;
begin
  select count(*) into v_n
  from pg_constraint c
  join pg_class t on t.oid = c.conrelid
  join pg_namespace n on n.oid = t.relnamespace
  where c.contype = 'f' and n.nspname in ('core','rrhh','atencion','productos','presupuesto')
    and not t.relispartition
    and not exists (
      select 1 from pg_index i where i.indrelid = c.conrelid
        and (i.indkey::int2[])[0:cardinality(c.conkey)-1] @> c.conkey
        and (i.indkey::int2[])[0:cardinality(c.conkey)-1] <@ c.conkey);
  if v_n <> 0 then
    raise exception 'Poscheque: quedan % FK sin índice', v_n;
  end if;
end $$;
