-- Pantalla pública de Atención: qué datos se muestran y cuáles se anuncian
-- por voz se eligen por pantalla en Configuración (decisión del usuario
-- 2026-10-15). Guardado en atencion.pantallas.config:
--   "mostrar":  {"cliente": bool, "agente": bool, "puesto": bool}
--   "anunciar": {"cliente": bool, "agente": bool, "puesto": bool}
-- Sin clave = true (comportamiento de 20261015151609). El número siempre sale.
-- El filtro va en la RPC anónima: si un dato no se muestra ni se anuncia, no
-- sale de la base (no basta con ocultarlo en el navegador del televisor).
-- Sin permisos nuevos: lo gestiona atencion.configuracion.pantalla.gestionar.
do $$
begin
  if to_regprocedure('public.atencion_pantalla_estado(uuid)') is null then
    raise exception 'precheck: falta public.atencion_pantalla_estado(uuid)';
  end if;
end;
$$;

create or replace function atencion.fn_pantalla_campo(p_config jsonb, p_campo text)
returns boolean language sql immutable set search_path = '' as $$
  select coalesce((p_config->'mostrar'->>p_campo)::boolean, true)
      or coalesce((p_config->'anunciar'->>p_campo)::boolean, true);
$$;
revoke all on function atencion.fn_pantalla_campo(jsonb, text) from public, anon, authenticated;

create or replace function public.atencion_pantalla_estado(p_pantalla_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_p atencion.pantallas;
  v_sucursal core.sucursales;
  v_hoy date;
  v_cliente boolean;
  v_agente boolean;
  v_puesto boolean;
begin
  select pa.* into v_p from atencion.pantallas pa where pa.id = p_pantalla_id and pa.activa;
  if not found then return null; end if;
  select s.* into v_sucursal from core.sucursales s where s.id = v_p.sucursal_id and s.activa;
  if not found then return null; end if;
  if not exists (
    select 1 from core.apps a
    join core.company_apps ca on ca.app_id = a.id and ca.company_id = v_p.company_id and ca.enabled
    where a.slug = 'atencion' and a.active
  ) then
    return null;
  end if;

  perform atencion.fn_cerrar_vencidas();
  v_hoy := atencion.fn_hoy(v_sucursal.id);
  v_cliente := atencion.fn_pantalla_campo(v_p.config, 'cliente');
  v_agente := atencion.fn_pantalla_campo(v_p.config, 'agente');
  v_puesto := atencion.fn_pantalla_campo(v_p.config, 'puesto');

  return jsonb_build_object(
    'sucursal', v_sucursal.nombre,
    'config', v_p.config,
    'llamados', coalesce((
      select jsonb_agg(jsonb_build_object('numero', t.numero,
                                          'puesto', case when v_puesto then p.nombre end,
                                          'cliente', case when v_cliente then t.cliente_nombre end,
                                          'agente', case when v_agente then pf.nombre_completo end,
                                          'llamado_en', t.llamado_en, 'veces', t.veces_llamado)
                       order by t.llamado_en desc)
      from atencion.turnos t
      join atencion.puestos p on p.id = t.puesto_id
      left join core.perfiles pf on pf.user_id = t.atendido_por
      where t.sucursal_id = v_sucursal.id and t.estado = 'llamado' and t.fecha_local = v_hoy
        and t.creado_en >= now() - interval '2 days'
    ), '[]'::jsonb),
    'proximos', coalesce((
      select jsonb_agg(x.numero order by x.numero) from (
        select t.numero from atencion.turnos t
        where t.sucursal_id = v_sucursal.id and t.estado = 'esperando' and t.fecha_local = v_hoy
          and t.creado_en >= now() - interval '2 days'
        order by t.numero limit 8) x
    ), '[]'::jsonb),
    'generado_en', now()
  );
end;
$$;

revoke all on function public.atencion_pantalla_estado(uuid) from public;
grant execute on function public.atencion_pantalla_estado(uuid) to anon, authenticated;
