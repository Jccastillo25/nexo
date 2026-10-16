-- P3: contrato obligatorio, integridad de empresa/empleado y cierre de escritura directa.
-- Precondicion: cero marcas. Rollback: conservar vinculos; corregir hacia adelante,
-- no restaurar escrituras directas ni eliminar columnas con historia.
do $$ begin
 if exists(select 1 from rrhh.asistencia_marcas) then
  raise exception 'P3 abortada: existen marcas; revisar migracion del historial';
 end if;
end $$;
alter table rrhh.contratos add constraint contratos_id_company_empleado_key unique(id,company_id,empleado_id);
alter table rrhh.asistencia_marcas add column contrato_id uuid not null;
alter table rrhh.asistencia_marcas add constraint asistencia_marcas_contrato_fk
 foreign key(contrato_id,company_id,empleado_id) references rrhh.contratos(id,company_id,empleado_id);
create index if not exists asistencia_marcas_company_idx on rrhh.asistencia_marcas(company_id);
create index if not exists asistencia_marcas_empleado_idx on rrhh.asistencia_marcas(empleado_id);
create index if not exists asistencia_marcas_kiosko_idx on rrhh.asistencia_marcas(kiosko_id);
create index if not exists asistencia_marcas_contrato_idx on rrhh.asistencia_marcas(contrato_id,company_id,empleado_id);
create index if not exists asistencia_marcas_autor_idx on rrhh.asistencia_marcas(creado_por);
create index if not exists asistencia_marcas_company_marcado_idx on rrhh.asistencia_marcas(company_id,marcado_en);
revoke insert,update,delete on rrhh.asistencia_marcas from authenticated,anon,public;
drop policy if exists "marcas: crear con permiso" on rrhh.asistencia_marcas;
drop policy if exists "marcas: editar con permiso" on rrhh.asistencia_marcas;
drop policy if exists "marcas: eliminar con permiso" on rrhh.asistencia_marcas;
-- Defensa adicional: no dejar grants heredados en particiones existentes.
do $$ declare p record; begin
 for p in select inhrelid::regclass tabla from pg_inherits where inhparent='rrhh.asistencia_marcas'::regclass loop
  execute format('revoke insert,update,delete on %s from authenticated,anon,public',p.tabla);
 end loop;
end $$;
create or replace function rrhh.fn_registrar_marca_kiosko(p_pin text, p_kiosko_id uuid)
returns table (tipo text, marcado_en timestamptz)
language plpgsql
security definer
set search_path = rrhh, extensions, pg_temp
as $$
declare
  v_kiosko rrhh.kiosko_dispositivos%rowtype;
  v_rl rrhh.kiosko_rate_limits%rowtype;
  v_empleados uuid[];
  v_contratos uuid[];
  v_contrato_id uuid;
  v_coincidencias integer;
  v_empleado_id uuid;
  v_ultimo_tipo text;
  v_tipo text;
  v_ahora timestamptz := now();
  v_marcado_en timestamptz;
begin
  if p_pin is null or p_pin !~ '^[0-9]{4}$' then
    return;
  end if;

  select * into v_kiosko from rrhh.kiosko_dispositivos where id = p_kiosko_id;
  if not found or not v_kiosko.activo then
    return;
  end if;

  insert into rrhh.kiosko_rate_limits (kiosko_id) values (p_kiosko_id)
    on conflict (kiosko_id) do nothing;

  select * into v_rl from rrhh.kiosko_rate_limits where kiosko_id = p_kiosko_id for update;

  if v_rl.bloqueado_hasta is not null and v_rl.bloqueado_hasta > v_ahora then
    return;
  end if;

  if v_ahora - v_rl.window_started_at > interval '1 minute' then
    update rrhh.kiosko_rate_limits
      set window_started_at = v_ahora,
          intentos_en_ventana = 0,
          bloqueado_hasta = null,
          updated_at = v_ahora
      where kiosko_id = p_kiosko_id
      returning * into v_rl;
  end if;

  -- P1: se cuentan TODAS las credenciales vigentes que el kiosco puede
  -- alcanzar (empresa del dispositivo) y aceptan este PIN. Sin `limit 1`:
  -- elegir una sola fila es justamente el bug que este ticket cierra.
  select array_agg(c.empleado_id), array_agg(c.id), count(*)
    into v_empleados, v_contratos, v_coincidencias
  from rrhh.contrato_credenciales cc
  join rrhh.contratos c on c.id = cc.contrato_id
  where c.company_id = v_kiosko.company_id
    and c.estado = 'activo'
    and cc.activo = true
    and not cc.pin_bloqueado
    and crypt(p_pin, cc.pin_hash) = cc.pin_hash;

  if v_coincidencias = 1 then
    v_empleado_id := v_empleados[1];
    v_contrato_id := v_contratos[1];
  elsif v_coincidencias > 1 then
    -- Señal técnica sin PIN: no incluye el valor probado, ni el hash, ni el
    -- empleado, ni el contrato. Solo lo estrictamente necesario para que el
    -- responsable de RRHH pueda detectar y corregir la colisión (P2).
    raise warning
      'rrhh.kiosko: PIN ambiguo rechazado (fallo cerrado) — kiosko_id=%, company_id=%, credenciales_vigentes_coincidentes=%',
      p_kiosko_id, v_kiosko.company_id, v_coincidencias;
  end if;

  if v_empleado_id is null then
    -- Credencial no resoluble: 0 coincidencias (PIN inválido) o varias
    -- (PIN ambiguo). Un solo camino observable para ambos casos.
    update rrhh.kiosko_rate_limits
      set intentos_en_ventana = intentos_en_ventana + 1,
          bloqueado_hasta = case
            when intentos_en_ventana + 1 >= 8 then v_ahora + interval '5 minutes'
            else bloqueado_hasta
          end,
          updated_at = v_ahora
      where kiosko_id = p_kiosko_id;

    return;
  end if;

  update rrhh.kiosko_rate_limits
    set intentos_en_ventana = 0,
        bloqueado_hasta = null,
        updated_at = v_ahora
    where kiosko_id = p_kiosko_id;

  select am.tipo into v_ultimo_tipo
  from rrhh.asistencia_marcas am
  where am.contrato_id = v_contrato_id
  order by am.marcado_en desc
  limit 1;

  v_tipo := case when v_ultimo_tipo = 'entrada' then 'salida' else 'entrada' end;
  v_marcado_en := v_ahora;

  insert into rrhh.asistencia_marcas (company_id, empleado_id, kiosko_id, contrato_id, tipo, marcado_en, origen)
  values (v_kiosko.company_id, v_empleado_id, p_kiosko_id, v_contrato_id, v_tipo, v_marcado_en, 'kiosko');

  return query select v_tipo, v_marcado_en;
end;
$$;
revoke execute on function rrhh.fn_registrar_marca_kiosko(text,uuid) from public,anon,authenticated;
