-- =============================================================================
-- Seguridad — kiosco heredado, tope de filas en reportes, firma del PDF y
-- auditoría de la exportación de Productos
-- (revisión integral 2026-10-20, hallazgos N5, N6, N7/H5 y N11;
--  docs/status-log/2026-10-20-revision-integral.md).
--
-- N7/H5  public.registrar_marca_kiosko seguía ejecutable por anon: con el UUID
--        del kiosco (visible para quien tenga kioskos.ver o marcas.ver) se podía
--        marcar desde fuera de la terminal. Verificado el 2026-10-20 que
--        NEXO_KIOSKO_ID no existe en el proyecto Vercel nexo-rrhh, así que el
--        camino heredado no se usa; el código que lo llamaba se retiró en
--        apps/rrhh/src/app/kiosco. La terminal usa registrar_marca_terminal
--        (token de 256 bits), que no cambia.
-- N6     Con solo rrhh.asistencia.reportes.ver, las RPC de reportes devolvían
--        hasta 5 000 filas por llamada sin pasar por la auditoría de
--        exportación. Ahora, más de 200 filas exige reportes.exportar. Única
--        excepción: el diario de UN contrato (la tarjeta), acotado a 62 días
--        por rrhh.fn_reporte_validar. Se hace con un envoltorio: la función
--        original pasa a rrhh.*_base (sin EXECUTE para nadie) y la pública
--        valida el tope y la llama; firma, nombres de parámetros y resultado
--        no cambian. El resumen (sin p_limit, una fila por contrato) se
--        envuelve igual: sin `exportar` entrega las primeras 200 filas con
--        `truncado: true` y los totales completos (revisión independiente).
-- N11    El "Emitido por" del PDF salía de raw_user_meta_data, que el propio
--        usuario puede editar. Ahora sale de core.perfiles.nombre_completo
--        (o el correo).
-- N5     productos_exportar devolvía todo el catálogo (con costos si hay
--        permiso) sin dejar rastro. Ahora cada exportación se audita.
-- Sin permisos nuevos: no aplica Paso Cero.
-- =============================================================================

do $$
begin
  if to_regprocedure('public.registrar_marca_kiosko(text,uuid,uuid,text)') is null then
    raise exception 'precheck: falta public.registrar_marca_kiosko';
  end if;
  if to_regprocedure('public.asistencia_reporte_diario(uuid,date,date,uuid,uuid,uuid,uuid,text,boolean,integer,integer)') is null
     or to_regprocedure('rrhh.asistencia_reporte_diario_base(uuid,date,date,uuid,uuid,uuid,uuid,text,boolean,integer,integer)') is not null then
    raise exception 'precheck: estado inesperado de asistencia_reporte_diario';
  end if;
end $$;

-- ------------------------------------------------------------- N7/H5 kiosco
revoke execute on function public.registrar_marca_kiosko(text, uuid, uuid, text) from public, anon, authenticated;

-- ------------------------------------------------------------- N6 reportes
alter function public.asistencia_reporte_diario(uuid,date,date,uuid,uuid,uuid,uuid,text,boolean,integer,integer)
  rename to asistencia_reporte_diario_base;
alter function public.asistencia_reporte_diario_base(uuid,date,date,uuid,uuid,uuid,uuid,text,boolean,integer,integer)
  set schema rrhh;
alter function public.asistencia_reporte_tardanzas(uuid,date,date,uuid,uuid,uuid,uuid,text,integer,integer)
  rename to asistencia_reporte_tardanzas_base;
alter function public.asistencia_reporte_tardanzas_base(uuid,date,date,uuid,uuid,uuid,uuid,text,integer,integer)
  set schema rrhh;
alter function public.asistencia_reporte_incidencias(uuid,date,date,uuid,uuid,uuid,uuid,text,integer,integer)
  rename to asistencia_reporte_incidencias_base;
alter function public.asistencia_reporte_incidencias_base(uuid,date,date,uuid,uuid,uuid,uuid,text,integer,integer)
  set schema rrhh;
-- El resumen no recibe p_limit (devuelve una fila por contrato, hasta 2000):
-- también se envuelve, y sin `exportar` entrega las primeras 200 filas (los
-- totales siguen completos; la pantalla avisa que el reporte llegó cortado).
alter function public.asistencia_reporte_resumen(uuid,date,date,uuid,uuid,uuid,uuid)
  rename to asistencia_reporte_resumen_base;
alter function public.asistencia_reporte_resumen_base(uuid,date,date,uuid,uuid,uuid,uuid)
  set schema rrhh;

revoke execute on function rrhh.asistencia_reporte_diario_base(uuid,date,date,uuid,uuid,uuid,uuid,text,boolean,integer,integer) from public, anon, authenticated;
revoke execute on function rrhh.asistencia_reporte_tardanzas_base(uuid,date,date,uuid,uuid,uuid,uuid,text,integer,integer) from public, anon, authenticated;
revoke execute on function rrhh.asistencia_reporte_incidencias_base(uuid,date,date,uuid,uuid,uuid,uuid,text,integer,integer) from public, anon, authenticated;
revoke execute on function rrhh.asistencia_reporte_resumen_base(uuid,date,date,uuid,uuid,uuid,uuid) from public, anon, authenticated;

-- Más de 200 filas por llamada = exportación.
create function rrhh.fn_reporte_exigir_tope(p_company_id uuid, p_limit integer)
returns void language plpgsql stable security definer set search_path = '' as $$
begin
  if p_limit is not null and p_limit > 200
     and not core.has_permission(auth.uid(), p_company_id, 'rrhh.asistencia.reportes.exportar') then
    raise exception 'Para consultar más de 200 filas se necesita el permiso de exportar reportes.'
      using errcode = '42501';
  end if;
end $$;
revoke execute on function rrhh.fn_reporte_exigir_tope(uuid, integer) from public, anon, authenticated;

create function public.asistencia_reporte_diario(
  p_company_id uuid, p_desde date, p_hasta date,
  p_departamento_id uuid default null, p_puesto_id uuid default null,
  p_empleado_id uuid default null, p_contrato_id uuid default null,
  p_estado text default null, p_incluir_no_laborables boolean default false,
  p_limit integer default 100, p_offset integer default 0)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  -- La tarjeta (un solo contrato, máx. 62 días) puede pedir el rango entero.
  if p_contrato_id is null then
    perform rrhh.fn_reporte_exigir_tope(p_company_id, p_limit);
  end if;
  return rrhh.asistencia_reporte_diario_base(p_company_id, p_desde, p_hasta, p_departamento_id, p_puesto_id,
    p_empleado_id, p_contrato_id, p_estado, p_incluir_no_laborables, p_limit, p_offset);
end $$;

create function public.asistencia_reporte_tardanzas(
  p_company_id uuid, p_desde date, p_hasta date,
  p_departamento_id uuid default null, p_puesto_id uuid default null,
  p_empleado_id uuid default null, p_contrato_id uuid default null,
  p_tipo text default null, p_limit integer default 100, p_offset integer default 0)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform rrhh.fn_reporte_exigir_tope(p_company_id, p_limit);
  return rrhh.asistencia_reporte_tardanzas_base(p_company_id, p_desde, p_hasta, p_departamento_id, p_puesto_id,
    p_empleado_id, p_contrato_id, p_tipo, p_limit, p_offset);
end $$;

create function public.asistencia_reporte_incidencias(
  p_company_id uuid, p_desde date, p_hasta date,
  p_departamento_id uuid default null, p_puesto_id uuid default null,
  p_empleado_id uuid default null, p_contrato_id uuid default null,
  p_tipo text default null, p_limit integer default 100, p_offset integer default 0)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform rrhh.fn_reporte_exigir_tope(p_company_id, p_limit);
  return rrhh.asistencia_reporte_incidencias_base(p_company_id, p_desde, p_hasta, p_departamento_id, p_puesto_id,
    p_empleado_id, p_contrato_id, p_tipo, p_limit, p_offset);
end $$;

create function public.asistencia_reporte_resumen(
  p_company_id uuid, p_desde date, p_hasta date,
  p_departamento_id uuid default null, p_puesto_id uuid default null,
  p_empleado_id uuid default null, p_contrato_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v jsonb;
begin
  v := rrhh.asistencia_reporte_resumen_base(p_company_id, p_desde, p_hasta, p_departamento_id, p_puesto_id,
    p_empleado_id, p_contrato_id);
  if jsonb_array_length(coalesce(v->'filas', '[]'::jsonb)) > 200
     and not core.has_permission(auth.uid(), p_company_id, 'rrhh.asistencia.reportes.exportar') then
    v := jsonb_set(v, '{filas}', (
      select coalesce(jsonb_agg(e.valor order by e.n), '[]'::jsonb)
      from jsonb_array_elements(v->'filas') with ordinality as e(valor, n)
      where e.n <= 200)) || jsonb_build_object('truncado', true);
  end if;
  return v;
end $$;

revoke execute on function public.asistencia_reporte_resumen(uuid,date,date,uuid,uuid,uuid,uuid) from public, anon;
grant execute on function public.asistencia_reporte_resumen(uuid,date,date,uuid,uuid,uuid,uuid) to authenticated;
revoke execute on function public.asistencia_reporte_diario(uuid,date,date,uuid,uuid,uuid,uuid,text,boolean,integer,integer) from public, anon;
revoke execute on function public.asistencia_reporte_tardanzas(uuid,date,date,uuid,uuid,uuid,uuid,text,integer,integer) from public, anon;
revoke execute on function public.asistencia_reporte_incidencias(uuid,date,date,uuid,uuid,uuid,uuid,text,integer,integer) from public, anon;
grant execute on function public.asistencia_reporte_diario(uuid,date,date,uuid,uuid,uuid,uuid,text,boolean,integer,integer) to authenticated;
grant execute on function public.asistencia_reporte_tardanzas(uuid,date,date,uuid,uuid,uuid,uuid,text,integer,integer) to authenticated;
grant execute on function public.asistencia_reporte_incidencias(uuid,date,date,uuid,uuid,uuid,uuid,text,integer,integer) to authenticated;

-- ------------------------------------------------------------- N11 firma del PDF
create or replace function public.asistencia_registrar_exportacion(
  p_company_id uuid, p_reporte text, p_formato text, p_filtros jsonb, p_filas integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_empresa text; v_ruc text; v_por text; v_ahora timestamptz := clock_timestamp();
begin
 if p_company_id is null or not core.has_permission(auth.uid(), p_company_id, 'rrhh.asistencia.reportes.exportar') then
   raise exception 'Sin permiso' using errcode = '42501';
 end if;
 if p_reporte is null or p_reporte not in ('diaria','resumen','tardanzas','incidencias','tarjeta')
    or p_formato is null or p_formato not in ('pdf','impresion')
    or p_filas is null or p_filas < 0 or (p_filtros is not null and jsonb_typeof(p_filtros) <> 'object') then
   raise exception 'Filtros invalidos' using errcode = '22023';
 end if;
 select co.name, co.tax_id into v_empresa, v_ruc from core.companies co where co.id = p_company_id;
 -- Nombre administrado (core.perfiles), no el metadato que el usuario puede editar.
 select coalesce(nullif(btrim(pf.nombre_completo), ''), u.email) into v_por
   from auth.users u left join core.perfiles pf on pf.user_id = u.id
  where u.id = auth.uid();
 perform core.fn_auditar(auth.uid(), p_company_id, 'rrhh.asistencia.reporte.exportado', 'asistencia_reporte',
   p_reporte, jsonb_build_object('formato', p_formato, 'filtros', coalesce(p_filtros, '{}'::jsonb), 'filas', p_filas));
 return jsonb_build_object('emitido_en', v_ahora, 'emitido_por', v_por, 'empresa', v_empresa, 'empresa_ruc', v_ruc);
end $$;

-- ------------------------------------------------------------- N5 exportación de Productos
create or replace function public.productos_exportar(p_company_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid;
  v_costo boolean;
  v_res jsonb;
begin
  v_uid := core.fn_exigir_permiso(p_company_id, 'productos.catalogo.producto.exportar');
  v_costo := productos.fn_puede(p_company_id, 'productos.catalogo.costo.ver');
  v_res := coalesce((
    select jsonb_agg(jsonb_build_object(
      'nombre', p.nombre, 'codigo', p.codigo, 'codigo_barras', p.codigo_barras,
      'exento_ventas', p.exento_ventas, 'exento_compras', p.exento_compras,
      'descontinuado_ventas', p.descontinuado_ventas, 'descontinuado_compras', p.descontinuado_compras,
      'es_servicio', p.es_servicio, 'no_inventariable', not p.inventariable,
      'cuenta_ingreso', ci.codigo || ' / ' || ci.nombre,
      'cuenta_inventario', cv.codigo || ' / ' || cv.nombre,
      'cuenta_costo', cc.codigo || ' / ' || cc.nombre,
      'unidad', u.nombre, 'fecha_ingreso', p.fecha_ingreso,
      'existencia_minima', p.existencia_minima, 'existencia_maxima', p.existencia_maxima,
      'proveedor', pr.nombre, 'marca', m.nombre,
      'clase', case when cl.id is not null then cl.nombre || coalesce(' (' || cl.codigo_erp || ')', '') end,
      'tipo', case when ti.id is not null then ti.nombre || coalesce(' (' || ti.codigo_erp || ')', '') end,
      'categoria', case when ca.id is not null then ca.nombre || coalesce(' (' || ca.codigo_erp || ')', '') end,
      'descripcion', p.descripcion, 'codigo_sac', p.codigo_sac, 'centro_costo', ce.codigo,
      'centro_costo_unico', p.centro_costo_unico, 'lote_por_vencimiento', p.lote_por_vencimiento,
      'plazo_vencimiento_dias', p.plazo_vencimiento_dias, 'margen_dias_vencer', p.margen_dias_vencer,
      'costo_moneda', case when v_costo then p.costo_moneda end,
      'costo_referencia', case when v_costo then p.costo_referencia end,
      'notas', p.notas, 'peso', p.peso,
      'numero_id', p.numero_id, 'erp_producto_id', p.erp_producto_id) order by p.codigo)
    from productos.productos p
    left join productos.unidades u on u.id = p.unidad_id
    left join productos.marcas m on m.id = p.marca_id
    left join productos.proveedores pr on pr.id = p.proveedor_id
    left join productos.clasificaciones cl on cl.id = p.clase_id
    left join productos.clasificaciones ti on ti.id = p.tipo_id
    left join productos.clasificaciones ca on ca.id = p.categoria_id
    left join productos.cuentas_contables ci on ci.id = p.cuenta_ingreso_id
    left join productos.cuentas_contables cv on cv.id = p.cuenta_inventario_id
    left join productos.cuentas_contables cc on cc.id = p.cuenta_costo_id
    left join productos.centros_costo ce on ce.id = p.centro_costo_id
    where p.company_id = p_company_id), '[]'::jsonb);
  perform core.fn_auditar(v_uid, p_company_id, 'productos.catalogo.exportado', 'productos', null,
    jsonb_build_object('filas', jsonb_array_length(v_res), 'con_costo', v_costo));
  return v_res;
end;
$$;

-- Poscheque ------------------------------------------------------------------
do $$
begin
  if has_function_privilege('anon', 'public.registrar_marca_kiosko(text,uuid,uuid,text)', 'execute')
     or has_function_privilege('authenticated', 'public.registrar_marca_kiosko(text,uuid,uuid,text)', 'execute') then
    raise exception 'Poscheque: registrar_marca_kiosko sigue ejecutable';
  end if;
  if has_function_privilege('authenticated', 'rrhh.asistencia_reporte_diario_base(uuid,date,date,uuid,uuid,uuid,uuid,text,boolean,integer,integer)', 'execute')
     or has_function_privilege('authenticated', 'rrhh.asistencia_reporte_tardanzas_base(uuid,date,date,uuid,uuid,uuid,uuid,text,integer,integer)', 'execute')
     or has_function_privilege('authenticated', 'rrhh.asistencia_reporte_incidencias_base(uuid,date,date,uuid,uuid,uuid,uuid,text,integer,integer)', 'execute') then
    raise exception 'Poscheque: las funciones base de reportes no deben ser ejecutables';
  end if;
  if not has_function_privilege('authenticated', 'public.asistencia_reporte_diario(uuid,date,date,uuid,uuid,uuid,uuid,text,boolean,integer,integer)', 'execute')
     or has_function_privilege('anon', 'public.asistencia_reporte_diario(uuid,date,date,uuid,uuid,uuid,uuid,text,boolean,integer,integer)', 'execute') then
    raise exception 'Poscheque: privilegios inesperados en asistencia_reporte_diario';
  end if;
  if has_function_privilege('anon', 'public.productos_exportar(uuid)', 'execute') then
    raise exception 'Poscheque: anon no debe ejecutar productos_exportar';
  end if;
  if has_function_privilege('authenticated', 'rrhh.asistencia_reporte_resumen_base(uuid,date,date,uuid,uuid,uuid,uuid)', 'execute')
     or not has_function_privilege('authenticated', 'public.asistencia_reporte_resumen(uuid,date,date,uuid,uuid,uuid,uuid)', 'execute') then
    raise exception 'Poscheque: privilegios inesperados en asistencia_reporte_resumen';
  end if;
end $$;

-- PostgREST recarga el esquema (funciones renombradas y nuevas).
notify pgrst, 'reload schema';
