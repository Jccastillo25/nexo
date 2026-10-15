-- Paso Cero: métricas y reactivación de Atención (aprobado por el usuario
-- 2026-10-15, plan 13 §6.1). Solo catálogo + plantillas; sin tablas.
-- Las plantillas son el valor inicial: quién reactiva se configura en el rol.
do $$
begin
  if exists (select 1 from core.permissions_catalog
             where code in ('atencion.reportes.mis_metricas.ver', 'atencion.cola.turno.reactivar')) then
    raise exception 'precheck: alguno de los permisos ya existe';
  end if;
  if (select count(*) from core.app_roles where module_slug = 'atencion'
        and role_key in ('recepcion', 'agente', 'supervisor')) <> 3 then
    raise exception 'precheck: faltan plantillas de Atención';
  end if;
end;
$$;

insert into core.permissions_catalog (code, module_slug, domain, label, description) values
  ('atencion.reportes.mis_metricas.ver', 'atencion', 'reportes', 'Ver mis métricas',
   'Turnos atendidos, tiempos de espera y de atención propios.'),
  ('atencion.cola.turno.reactivar', 'atencion', 'cola', 'Reactivar turnos',
   'Devolver a la fila, al final, un turno marcado como "no se presentó".');

insert into core.app_role_permissions (app_role_id, permission_code)
select r.id, x.code
from core.app_roles r
join (values
  ('agente', 'atencion.reportes.mis_metricas.ver'),
  ('supervisor', 'atencion.reportes.mis_metricas.ver'),
  ('recepcion', 'atencion.cola.turno.reactivar'),
  ('supervisor', 'atencion.cola.turno.reactivar')
) as x(role_key, code) on x.role_key = r.role_key
where r.module_slug = 'atencion';

do $$
begin
  if (select count(*) from core.app_role_permissions
      where permission_code in ('atencion.reportes.mis_metricas.ver', 'atencion.cola.turno.reactivar')) <> 4 then
    raise exception 'postcheck: se esperaban 4 asignaciones a plantillas';
  end if;
end;
$$;
