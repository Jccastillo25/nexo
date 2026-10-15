-- Atención: hora de inicio de la atención de cada turno (pedido del usuario
-- 2026-10-15: cronómetro de espera en la fila y de duración de la atención,
-- base de los futuros dashboards por agente y global).
--
-- Por qué una columna nueva: `llamado_en` cambia con cada "Repetir llamado"
-- (atencion_rellamar) porque la pantalla de TV lo usa para volver a anunciar.
-- Medir desde ahí reiniciaría el tiempo de atención en cada repetición e
-- inflaría la espera. `inicio_atencion_en` lo fija solo atencion_llamar (el
-- llamado que saca el turno de la espera) y no lo toca rellamar.
--   espera   = inicio_atencion_en - creado_en
--   atención = finalizado_en      - inicio_atencion_en
--
-- atencion_cola_v2 = atencion_cola + `inicio_atencion_en` y `finalizado_en`.
-- Es una función nueva y no un reemplazo de atencion_cola porque (a) cambiar
-- las columnas exige borrar la función, y las migraciones que borran algo se
-- quedan colgadas en el conector MCP de Supabase (3 intentos el 2026-10-15), y
-- (b) así la versión anterior de la app sigue funcionando durante el deploy.
-- atencion_cola queda sin uso en el código: retirarla en una migración aparte.
do $$
begin
  if to_regprocedure('public.atencion_llamar(uuid, uuid)') is null then
    raise exception 'precheck: falta atencion_llamar';
  end if;
  if to_regprocedure('public.atencion_cola_v2(uuid, uuid)') is not null then
    raise exception 'precheck: atencion_cola_v2 ya existe';
  end if;
  if exists (select 1 from information_schema.columns
             where table_schema = 'atencion' and table_name = 'turnos' and column_name = 'inicio_atencion_en') then
    raise exception 'precheck: atencion.turnos.inicio_atencion_en ya existe';
  end if;
end;
$$;

alter table atencion.turnos add column inicio_atencion_en timestamptz;
comment on column atencion.turnos.inicio_atencion_en is
  'Llamado que sacó el turno de la espera (atencion_llamar). No cambia con "Repetir llamado".';

-- Turnos existentes: el último evento "llamado" de cada uno (rellamar registra
-- "rellamado", no "llamado").
update atencion.turnos t
   set inicio_atencion_en = e.ultimo
  from (select ev.turno_id, max(ev.creado_en) as ultimo
          from atencion.turno_eventos ev
         where ev.tipo = 'llamado'
         group by ev.turno_id) e
 where e.turno_id = t.id and t.llamado_en is not null;

create or replace function public.atencion_llamar(p_company_id uuid, p_turno_id uuid default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_a atencion.sesiones_activas;
  v_t atencion.turnos;
  v_siguiente integer;
begin
  v_a := atencion.fn_exigir_sesion(p_company_id, 'atencion.puesto.turno.llamar', 'puesto');
  if p_turno_id is not null then
    perform core.fn_exigir_permiso(p_company_id, 'atencion.puesto.turno.llamar_fuera_orden');
  end if;
  if (atencion.fn_turno_actual(v_a.puesto_id)).id is not null then
    raise exception 'Finalizá o marcá ausente el turno actual antes de llamar otro.';
  end if;

  select min(t.numero) into v_siguiente from atencion.turnos t
  where t.sucursal_id = v_a.sucursal_id and t.estado = 'esperando'
    and t.fecha_local = atencion.fn_hoy(v_a.sucursal_id) and t.creado_en >= now() - interval '2 days';

  update atencion.turnos t
    set estado = 'llamado', puesto_id = v_a.puesto_id, atendido_por = v_a.user_id,
        llamado_en = now(), inicio_atencion_en = now(), veces_llamado = t.veces_llamado + 1,
        fuera_de_orden = (p_turno_id is not null and t.numero <> v_siguiente)
  where t.id = (
      select t2.id from atencion.turnos t2
      where t2.sucursal_id = v_a.sucursal_id and t2.estado = 'esperando'
        and t2.fecha_local = atencion.fn_hoy(v_a.sucursal_id) and t2.creado_en >= now() - interval '2 days'
        and (p_turno_id is null or t2.id = p_turno_id)
      order by t2.numero
      limit 1
      for update skip locked)
    and t.creado_en >= now() - interval '2 days'
  returning * into v_t;

  if not found then
    raise exception '%', case when p_turno_id is null then 'No hay turnos en espera.' else 'Ese turno ya no está en espera.' end;
  end if;
  perform atencion.fn_evento(v_t, 'llamado', v_a.user_id, jsonb_build_object('fuera_de_orden', v_t.fuera_de_orden));
  return jsonb_build_object('id', v_t.id, 'numero', v_t.numero, 'fuera_de_orden', v_t.fuera_de_orden);
end;
$$;

create function public.atencion_cola_v2(p_company_id uuid, p_sucursal_id uuid default null)
returns table (
  id uuid, numero integer, estado text, puesto text, llamado_en timestamptz, veces_llamado integer,
  cliente_nombre text, cliente_telefono text, factura text, creado_en timestamptz,
  inicio_atencion_en timestamptz, finalizado_en timestamptz
)
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
declare
  v_uid uuid;
  v_sucursal uuid := p_sucursal_id;
  v_datos boolean;
begin
  v_uid := core.fn_exigir_permiso(p_company_id, 'atencion.cola.turno.ver');
  perform atencion.fn_cerrar_vencidas();
  if v_sucursal is null then
    select sa.sucursal_id into v_sucursal from atencion.sesiones_activas sa where sa.user_id = v_uid;
  end if;
  if v_sucursal is null or not atencion.fn_puede_sucursal(v_uid, p_company_id, v_sucursal) then
    raise exception 'Elegí una sucursal tuya o iniciá atención.';
  end if;
  v_datos := core.has_permission(v_uid, p_company_id, 'atencion.cliente.datos.ver');

  return query
  select t.id, t.numero, t.estado, p.nombre, t.llamado_en, t.veces_llamado,
         t.cliente_nombre,
         case when v_datos then t.cliente_telefono end,
         case when v_datos then t.factura end,
         t.creado_en,
         t.inicio_atencion_en,
         t.finalizado_en
  from atencion.turnos t
  left join atencion.puestos p on p.id = t.puesto_id
  where t.sucursal_id = v_sucursal
    and t.fecha_local = atencion.fn_hoy(v_sucursal)
    and t.creado_en >= now() - interval '2 days'
  order by (t.estado not in ('esperando', 'llamado')), t.numero;
end;
$$;

revoke all on function public.atencion_cola_v2(uuid, uuid) from public, anon;
grant execute on function public.atencion_cola_v2(uuid, uuid) to authenticated;
