-- =============================================================================
-- App Presupuesto — ajustes de la revisión independiente (2026-10-20)
-- Requiere 20261020184030_presupuesto_esquema. Ver docs/plan/19-presupuesto.md.
--
--   B1. presupuesto_vendedores devolvía el usuario vinculado y su correo a
--       cualquiera con avance_equipo, factura.ver o meta_vendedor. La web los
--       recortaba, pero la RPC es la frontera (Mobile): ahora user_id y
--       usuario_nombre solo salen con presupuesto.configuracion.vendedor.gestionar.
--       Los demás reciben `vinculado` (sí/no).
--   B2. En presupuesto_importar_facturas, un `fila` no entero ("1.5") abortaba
--       el lote entero porque el cast estaba fuera del bloque de cada fila.
--       Ahora un valor no numérico cuenta como fila 0 y no rompe nada.
--   B3. Los helpers de partición pasan a search_path = '' (ya califican todos
--       los nombres).
-- Sin cambios de datos (el schema está vacío).
-- =============================================================================

do $$
begin
  if to_regprocedure('public.presupuesto_vendedores(uuid)') is null
     or to_regprocedure('public.presupuesto_importar_facturas(uuid,uuid,text,jsonb,boolean)') is null then
    raise exception 'precheck: falta el esquema de Presupuesto (20261020184030)';
  end if;
end $$;

-- B1 --------------------------------------------------------------------------
create or replace function public.presupuesto_vendedores(p_company_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid uuid;
  v_admin boolean;
begin
  v_uid := presupuesto.fn_exigir_alguno(p_company_id, array[
    'presupuesto.metas.avance_equipo.ver', 'presupuesto.ventas.factura.ver',
    'presupuesto.metas.meta_vendedor.gestionar', 'presupuesto.configuracion.vendedor.gestionar']);
  -- Quién está vinculado (y su correo) solo lo ve quien administra vendedores.
  v_admin := core.has_permission(v_uid, p_company_id, 'presupuesto.configuracion.vendedor.gestionar');
  return coalesce((select jsonb_agg(jsonb_build_object(
      'id', v.id, 'codigo', v.codigo, 'nombre', v.nombre, 'activo', v.activo,
      'vinculado', v.user_id is not null,
      'user_id', case when v_admin then v.user_id end,
      'usuario_nombre', case when v_admin then coalesce(p.nombre_completo, u.email) end,
      'ultima_venta', (select max(f.fecha) from presupuesto.facturas f where f.vendedor_id = v.id and f.company_id = p_company_id)
    ) order by v.activo desc, v.codigo)
    from presupuesto.vendedores v
    left join auth.users u on u.id = v.user_id
    left join core.perfiles p on p.user_id = v.user_id
    where v.company_id = p_company_id), '[]'::jsonb);
end;
$$;

-- B2 --------------------------------------------------------------------------
create or replace function public.presupuesto_importar_facturas(
  p_company_id uuid, p_importacion_id uuid, p_archivo text, p_filas jsonb, p_confirmar boolean
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid;
  v_imp_id uuid := p_importacion_id;
  v_imp_creado timestamptz;
  r jsonb;
  v_fila integer;
  v_fecha date; v_venc date; v_num text; v_cli text; v_anul boolean; v_cs numeric; v_usd numeric;
  v_vend_raw text; v_cod text; v_nom text; v_vend_id uuid;
  v_nuevas integer := 0; v_act integer := 0; v_vend_nuevos integer := 0;
  v_errores jsonb := '[]'::jsonb;
  v_min date; v_max date;
  v_n integer;
  v_existe boolean;
begin
  v_uid := core.fn_exigir_permiso(p_company_id, 'presupuesto.ventas.factura.importar');
  if jsonb_typeof(p_filas) is distinct from 'array' then raise exception 'Formato de importación inválido.'; end if;
  if jsonb_array_length(p_filas) > 5000 then raise exception 'Máximo 5000 filas por lote.'; end if;

  if v_imp_id is not null then
    select i.creado_en into v_imp_creado from presupuesto.importaciones i
    where i.id = v_imp_id and i.company_id = p_company_id and i.user_id = v_uid
      and i.creado_en > now() - interval '1 day';
    if not found then raise exception 'La importación indicada no existe o ya venció. Vuelve a subir el archivo.'; end if;
  end if;

  begin
    -- El registro de la importación nace dentro del bloque: en la vista previa
    -- se revierte junto con todo lo demás.
    if v_imp_id is null then
      perform presupuesto.fn_asegurar_particion_importaciones(current_date);
      insert into presupuesto.importaciones (company_id, user_id, archivo)
      values (p_company_id, v_uid, left(p_archivo, 200))
      returning id, creado_en into v_imp_id, v_imp_creado;
    end if;

    for r in select x from jsonb_array_elements(p_filas) x loop
      -- Número de fila del Excel, solo para informar errores: si no es un
      -- entero, cuenta como 0 en vez de abortar el lote.
      v_fila := case when (r->>'fila') ~ '^[0-9]{1,9}$' then (r->>'fila')::integer else 0 end;
      begin
        v_num := btrim(coalesce(r->>'numero', ''));
        if v_num = '' then raise exception 'Falta el número de factura.'; end if;
        if length(v_num) > 40 then raise exception 'Número de factura demasiado largo.'; end if;
        v_fecha := nullif(r->>'fecha', '')::date;
        if v_fecha is null then raise exception 'Falta la fecha.'; end if;
        if v_fecha < date '2000-01-01' or v_fecha > current_date + 31 then raise exception 'Fecha fuera de rango: %.', v_fecha; end if;
        v_venc := nullif(r->>'vencimiento', '')::date;
        v_cli := nullif(left(btrim(coalesce(r->>'cliente', '')), 200), '');
        v_anul := coalesce(nullif(r->>'anulada', '')::boolean, false);
        v_cs := nullif(r->>'total_cs', '')::numeric;
        v_usd := nullif(r->>'total_usd', '')::numeric;
        if v_cs is null or v_usd is null then raise exception 'Faltan los totales C$ o US$.'; end if;

        -- Vendedor: "001-Edith  Saballo" -> código 001, nombre "Edith Saballo".
        v_vend_raw := regexp_replace(btrim(coalesce(r->>'vendedor', '')), '\s+', ' ', 'g');
        if v_vend_raw = '' then raise exception 'Falta el vendedor.'; end if;
        if v_vend_raw ~ '^[^-]+-.+$' then
          v_cod := btrim(split_part(v_vend_raw, '-', 1));
          v_nom := btrim(substr(v_vend_raw, length(split_part(v_vend_raw, '-', 1)) + 2));
        else
          v_cod := v_vend_raw;
          v_nom := v_vend_raw;
        end if;
        v_cod := left(v_cod, 40); v_nom := left(v_nom, 120);

        select v.id into v_vend_id from presupuesto.vendedores v
        where v.company_id = p_company_id and lower(v.codigo) = lower(v_cod);
        if not found then
          insert into presupuesto.vendedores (company_id, codigo, nombre) values (p_company_id, v_cod, v_nom)
          returning id into v_vend_id;
          v_vend_nuevos := v_vend_nuevos + 1;
        end if;

        perform presupuesto.fn_asegurar_particion_facturas(v_fecha);
        -- Misma factura con otra fecha (corrección en AG Negocio): se reemplaza.
        delete from presupuesto.facturas f where f.company_id = p_company_id and f.numero = v_num and f.fecha <> v_fecha;
        get diagnostics v_n = row_count;
        v_existe := exists (select 1 from presupuesto.facturas f
                            where f.company_id = p_company_id and f.numero = v_num and f.fecha = v_fecha);

        insert into presupuesto.facturas as f (fecha, company_id, numero, vencimiento, cliente, anulada, total_cs, total_usd, vendedor_id, importacion_id)
        values (v_fecha, p_company_id, v_num, v_venc, v_cli, v_anul, v_cs, v_usd, v_vend_id, v_imp_id)
        on conflict (company_id, numero, fecha) do update
          set vencimiento = excluded.vencimiento, cliente = excluded.cliente, anulada = excluded.anulada,
              total_cs = excluded.total_cs, total_usd = excluded.total_usd, vendedor_id = excluded.vendedor_id,
              importacion_id = excluded.importacion_id, updated_at = now();
        if v_existe or v_n > 0 then v_act := v_act + 1; else v_nuevas := v_nuevas + 1; end if;

        v_min := least(coalesce(v_min, v_fecha), v_fecha);
        v_max := greatest(coalesce(v_max, v_fecha), v_fecha);
      exception when others then
        if sqlstate = '42501' then raise; end if;
        v_errores := v_errores || jsonb_build_object('fila', v_fila, 'numero', v_num, 'error', sqlerrm);
      end;
    end loop;

    if not coalesce(p_confirmar, false) then
      raise exception using errcode = 'P0001', message = 'nexo:vista_previa';
    end if;
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'nexo:vista_previa' then raise; end if;
    -- Vista previa: todo lo de arriba se revirtió.
    return jsonb_build_object('confirmado', false, 'filas', jsonb_array_length(p_filas),
      'nuevas', v_nuevas, 'actualizadas', v_act, 'vendedores_nuevos', v_vend_nuevos,
      'errores', v_errores, 'fecha_min', v_min, 'fecha_max', v_max);
  end;

  update presupuesto.importaciones i
    set filas = i.filas + jsonb_array_length(p_filas), nuevas = i.nuevas + v_nuevas, actualizadas = i.actualizadas + v_act,
        errores = i.errores + jsonb_array_length(v_errores), vendedores_nuevos = i.vendedores_nuevos + v_vend_nuevos,
        fecha_min = least(i.fecha_min, v_min), fecha_max = greatest(i.fecha_max, v_max)
    where i.id = v_imp_id and i.creado_en = v_imp_creado;

  perform core.fn_auditar(v_uid, p_company_id, 'presupuesto.facturas.importar', 'presupuesto.importaciones', v_imp_id::text,
    jsonb_build_object('archivo', left(p_archivo, 200), 'filas', jsonb_array_length(p_filas), 'nuevas', v_nuevas,
                       'actualizadas', v_act, 'errores', jsonb_array_length(v_errores)));

  return jsonb_build_object('confirmado', true, 'importacion_id', v_imp_id, 'filas', jsonb_array_length(p_filas),
    'nuevas', v_nuevas, 'actualizadas', v_act, 'vendedores_nuevos', v_vend_nuevos,
    'errores', v_errores, 'fecha_min', v_min, 'fecha_max', v_max);
end;
$$;

-- B3 --------------------------------------------------------------------------
alter function presupuesto.fn_asegurar_particion_facturas(date) set search_path = '';
alter function presupuesto.fn_asegurar_particion_importaciones(date) set search_path = '';

-- `create or replace` conserva los permisos de ejecución; se comprueba igual.
do $$
begin
  if has_function_privilege('anon', 'public.presupuesto_vendedores(uuid)', 'execute')
     or has_function_privilege('anon', 'public.presupuesto_importar_facturas(uuid,uuid,text,jsonb,boolean)', 'execute')
     or not has_function_privilege('authenticated', 'public.presupuesto_vendedores(uuid)', 'execute')
     or not has_function_privilege('authenticated', 'public.presupuesto_importar_facturas(uuid,uuid,text,jsonb,boolean)', 'execute') then
    raise exception 'Poscheque: permisos de ejecución alterados';
  end if;
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
             where n.nspname = 'presupuesto' and p.proname like 'fn_asegurar_particion_%'
               and not ('search_path=""' = any(coalesce(p.proconfig, '{}')))) then
    raise exception 'Poscheque: los helpers de partición deben quedar con search_path vacío';
  end if;
end $$;
