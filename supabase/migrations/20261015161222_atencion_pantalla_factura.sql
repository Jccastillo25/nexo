-- Pantalla pública de Atención: número de factura del turno como cuarto dato
-- configurable (decisión del usuario 2026-10-15). A diferencia de cliente,
-- agente y puesto, la factura está APAGADA por defecto: sin clave en
-- config.mostrar/anunciar no sale de la RPC anónima. En el plan 13 era un dato
-- protegido por atencion.cliente.datos.ver; solo se expone en las pantallas
-- donde Configuración lo enciende explícitamente.
-- atencion.fn_pantalla_campo (sin clave = sí) no cambia: la factura se evalúa
-- aquí con el valor por defecto invertido.
do $$
begin
  if to_regprocedure('atencion.fn_pantalla_campo(jsonb, text)') is null then
    raise exception 'precheck: falta atencion.fn_pantalla_campo (20261015155035)';
  end if;
  if to_regprocedure('public.atencion_pantalla_estado(uuid)') is null then
    raise exception 'precheck: falta public.atencion_pantalla_estado(uuid)';
  end if;
end;
$$;

create or replace function public.atencion_pantalla_estado(p_pantalla_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_p atencion.pantallas;
  v_sucursal core.sucursales;
  v_hoy date;
  v_cliente boolean;
  v_agente boolean;
  v_puesto boolean;
  v_factura boolean;
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
  -- Factura: opt-in, sin clave = no.
  v_factura := coalesce((v_p.config->'mostrar'->>'factura')::boolean, false)
            or coalesce((v_p.config->'anunciar'->>'factura')::boolean, false);

  return jsonb_build_object(
    'sucursal', v_sucursal.nombre,
    'config', v_p.config,
    'llamados', coalesce((
      select jsonb_agg(jsonb_build_object('numero', t.numero,
                                          'puesto', case when v_puesto then p.nombre end,
                                          'cliente', case when v_cliente then t.cliente_nombre end,
                                          'agente', case when v_agente then pf.nombre_completo end,
                                          'factura', case when v_factura then t.factura end,
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
