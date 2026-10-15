-- Pantalla pública de Atención: anuncia el nombre del cliente y del agente.
-- Decisión del usuario 2026-10-15: "Turno 5, Juan Pérez, será atendido por
-- María López en el Puesto 2". Revierte, solo para los turnos LLAMADOS, la
-- regla original del plan 13 ("solo números y puestos"): el nombre completo
-- del cliente y el nombre del agente (core.perfiles) salen por esta RPC
-- anónima. Los próximos (en espera) siguen siendo solo números; teléfono y
-- factura nunca salen. Sin perfil, agente = null y la pantalla omite la frase.
do $$
begin
  if to_regprocedure('public.atencion_pantalla_estado(uuid)') is null then
    raise exception 'precheck: falta public.atencion_pantalla_estado(uuid)';
  end if;
  if to_regclass('core.perfiles') is null then
    raise exception 'precheck: falta core.perfiles';
  end if;
end;
$$;

create or replace function public.atencion_pantalla_estado(p_pantalla_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_p atencion.pantallas;
  v_sucursal core.sucursales;
  v_hoy date;
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

  return jsonb_build_object(
    'sucursal', v_sucursal.nombre,
    'config', v_p.config,
    'llamados', coalesce((
      select jsonb_agg(jsonb_build_object('numero', t.numero, 'puesto', p.nombre,
                                          'cliente', t.cliente_nombre, 'agente', pf.nombre_completo,
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

-- create or replace conserva los grants; se reafirman igual que en 20261014224341.
revoke all on function public.atencion_pantalla_estado(uuid) from public;
grant execute on function public.atencion_pantalla_estado(uuid) to anon, authenticated;
