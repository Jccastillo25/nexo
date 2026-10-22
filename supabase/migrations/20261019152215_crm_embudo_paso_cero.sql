-- =============================================================================
-- Paso Cero del embudo comercial del CRM: Leads, Oportunidades, Actividades y
-- Cotizaciones (aprobado por el usuario 2026-10-19: "Sí, apruebo la matriz y
-- las plantillas del embudo comercial").
--
--   1. 21 permisos crm.* de 4 segmentos (ver docs/plan/16-crm-embudo-comercial.md §3).
--      Alcance: sin crm.ventas.equipo.ver cada quien opera solo lo que tiene
--      asignado; lo filtran las RPC.
--   2. Se amplían las plantillas existentes:
--      - vendedor: 4 → 17 (ver/crear/editar + lead.convertir);
--      - gerente: 10 → 27 (todo menos *.eliminar y embudo.gestionar);
--      - administrador: 13 → 34 (todo).
-- Sin tablas: el esquema se crea después de la especificación de pantallas.
-- =============================================================================

do $$
begin
  if exists (select 1 from core.permissions_catalog
             where code like 'crm.ventas.lead.%' or code like 'crm.ventas.oportunidad.%'
                or code like 'crm.ventas.actividad.%' or code like 'crm.ventas.cotizacion.%'
                or code in ('crm.ventas.equipo.ver','crm.ventas.asignacion.gestionar',
                            'crm.configuracion.embudo.gestionar')) then
    raise exception 'precheck: los permisos del embudo ya existen';
  end if;
  if (select count(*) from core.app_roles where module_slug = 'crm'
        and role_key in ('vendedor','gerente','administrador')) <> 3 then
    raise exception 'precheck: faltan las plantillas del CRM';
  end if;
end;
$$;

-- 1. Permisos -------------------------------------------------------------------
insert into core.permissions_catalog (code, module_slug, domain, label, description) values
  ('crm.ventas.lead.ver',               'crm', 'ventas',        'Ver leads',              'Ver prospectos (propios, o de todos con equipo.ver).'),
  ('crm.ventas.lead.crear',             'crm', 'ventas',        'Crear leads',            'Registrar prospectos.'),
  ('crm.ventas.lead.editar',            'crm', 'ventas',        'Editar leads',           'Editar, cambiar estado y descartar prospectos.'),
  ('crm.ventas.lead.convertir',         'crm', 'ventas',        'Convertir leads',        'Convertir un prospecto en cliente y oportunidad.'),
  ('crm.ventas.lead.eliminar',          'crm', 'ventas',        'Eliminar leads',         'Borrado lógico de prospectos.'),
  ('crm.ventas.oportunidad.ver',        'crm', 'ventas',        'Ver oportunidades',      'Ver oportunidades y el embudo.'),
  ('crm.ventas.oportunidad.crear',      'crm', 'ventas',        'Crear oportunidades',    'Crear oportunidades de venta.'),
  ('crm.ventas.oportunidad.editar',     'crm', 'ventas',        'Editar oportunidades',   'Editar, mover de etapa, ganar o perder.'),
  ('crm.ventas.oportunidad.eliminar',   'crm', 'ventas',        'Eliminar oportunidades', 'Borrado lógico de oportunidades.'),
  ('crm.ventas.actividad.ver',          'crm', 'ventas',        'Ver actividades',        'Ver llamadas, visitas, reuniones, notas, correos y agenda.'),
  ('crm.ventas.actividad.crear',        'crm', 'ventas',        'Registrar actividades',  'Registrar o agendar actividades.'),
  ('crm.ventas.actividad.editar',       'crm', 'ventas',        'Editar actividades',     'Editar, completar o cancelar actividades.'),
  ('crm.ventas.actividad.eliminar',     'crm', 'ventas',        'Eliminar actividades',   'Borrado lógico de actividades.'),
  ('crm.ventas.cotizacion.ver',         'crm', 'ventas',        'Ver cotizaciones',       'Ver cotizaciones y descargar el PDF.'),
  ('crm.ventas.cotizacion.crear',       'crm', 'ventas',        'Crear cotizaciones',     'Crear cotizaciones en borrador.'),
  ('crm.ventas.cotizacion.editar',      'crm', 'ventas',        'Editar cotizaciones',    'Editar el borrador y enviarlo al cliente.'),
  ('crm.ventas.cotizacion.aprobar',     'crm', 'ventas',        'Aprobar cotizaciones',   'Aprobar cotizaciones con descuento mayor al permitido.'),
  ('crm.ventas.cotizacion.anular',      'crm', 'ventas',        'Anular cotizaciones',    'Anular una cotización enviada.'),
  ('crm.ventas.equipo.ver',             'crm', 'ventas',        'Ver al equipo',          'Ver y operar leads, oportunidades, actividades y cotizaciones de todos.'),
  ('crm.ventas.asignacion.gestionar',   'crm', 'ventas',        'Reasignar responsable',  'Cambiar el responsable de leads, oportunidades y cotizaciones.'),
  ('crm.configuracion.embudo.gestionar','crm', 'configuracion', 'Configurar embudo',      'Etapas, probabilidades, orígenes, motivos de pérdida y descuento máximo.');

-- 2. Plantillas -----------------------------------------------------------------
insert into core.app_role_permissions (app_role_id, permission_code)
select r.id, p.code
from core.app_roles r
join core.permissions_catalog p
  on p.module_slug = 'crm'
 and (p.code like 'crm.ventas.lead.%' or p.code like 'crm.ventas.oportunidad.%'
      or p.code like 'crm.ventas.actividad.%' or p.code like 'crm.ventas.cotizacion.%'
      or p.code in ('crm.ventas.equipo.ver','crm.ventas.asignacion.gestionar',
                    'crm.configuracion.embudo.gestionar'))
where r.module_slug = 'crm'
  and (
    r.role_key = 'administrador'
    or (r.role_key = 'gerente' and p.code not like '%.eliminar'
        and p.code <> 'crm.configuracion.embudo.gestionar')
    or (r.role_key = 'vendedor' and (
          p.code ~ '^crm\.ventas\.(lead|oportunidad|actividad|cotizacion)\.(ver|crear|editar)$'
          or p.code = 'crm.ventas.lead.convertir'))
  );

-- 3. Postcheck ------------------------------------------------------------------
do $$
declare n_cat int; n_v int; n_g int; n_a int;
begin
  select count(*) into n_cat from core.permissions_catalog where module_slug = 'crm';
  select count(*) filter (where r.role_key = 'vendedor'),
         count(*) filter (where r.role_key = 'gerente'),
         count(*) filter (where r.role_key = 'administrador')
    into n_v, n_g, n_a
  from core.app_role_permissions rp join core.app_roles r on r.id = rp.app_role_id
  where r.module_slug = 'crm';
  if n_cat <> 34 or n_v <> 17 or n_g <> 27 or n_a <> 34 then
    raise exception 'postcheck: catálogo %, vendedor %, gerente %, administrador %', n_cat, n_v, n_g, n_a;
  end if;
end;
$$;
