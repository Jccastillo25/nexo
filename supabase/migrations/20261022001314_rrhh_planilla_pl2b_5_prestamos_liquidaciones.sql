-- =============================================================================
-- PL2b de Planilla, parte 5 de 5: préstamos, embargos, liquidaciones, pasivo, privilegios y poscheques
-- El detalle, la aprobación del usuario y el rollback están en la parte 1.
-- Se dividió para aplicarla en nexo-core por partes; en PGlite corre en orden.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 9. RPC nuevas: préstamos y embargos
-- -----------------------------------------------------------------------------
-- Núcleo de la creación de préstamos, con la fecha de hoy como argumento (las
-- pruebas la fijan). La RPC pública valida el permiso y pasa la fecha de Managua.
create or replace function rrhh.fn_planilla_prestamo_crear(
  p_uid uuid, p_company_id uuid, p_contrato_id uuid, p_tipo text, p_monto numeric, p_cuotas integer, p_fecha_primera date,
  p_nota text, p_origen text, p_hoy date)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := p_uid;
  c record;
  co rrhh.conceptos;
  v_cuota numeric;
  v_ultima numeric;
  v_fecha date;
  v_id uuid;
  i integer;
begin
  if p_tipo is null or p_tipo not in ('prestamo', 'adelanto') then
    raise exception 'Indica si es préstamo o adelanto.';
  end if;
  if p_origen is null or p_origen not in ('nexo', 'ag') then
    raise exception 'Origen no válido.';
  end if;
  if p_monto is null or p_monto <= 0 or p_monto >= 100000000 or p_monto <> round(p_monto, 2) then
    raise exception 'Indica un monto válido.';
  end if;
  if p_cuotas is null or p_cuotas not between 1 and 120 then
    raise exception 'Indica entre 1 y 120 cuotas.';
  end if;
  if p_fecha_primera is null then
    raise exception 'Indica la fecha de la primera cuota.';
  end if;
  if p_nota is not null and length(p_nota) > 300 then
    raise exception 'La nota es demasiado larga.';
  end if;
  select ct.id, ct.empleado_id, ct.estado, ct.fecha_inicio, cc.frecuencia_pago into c
  from rrhh.contratos ct left join rrhh.contrato_compensacion cc on cc.contrato_id = ct.id
  where ct.id = p_contrato_id and ct.company_id = p_company_id for share of ct;
  if not found or c.estado <> 'activo' then
    raise exception 'Solo se registran préstamos de contratos activos.';
  end if;
  if c.frecuencia_pago is null then
    raise exception 'El contrato no tiene salario ni frecuencia de pago.';
  end if;
  select * into co from rrhh.conceptos where company_id = p_company_id and activo
    and codigo = case p_tipo when 'prestamo' then 'PRESTAMO' else 'ADELANTO' end;
  if not found then
    raise exception 'Falta el concepto % activo en el catálogo.', case p_tipo when 'prestamo' then 'PRESTAMO' else 'ADELANTO' end;
  end if;
  v_cuota := round(p_monto / p_cuotas, 2);
  v_ultima := p_monto - v_cuota * (p_cuotas - 1);
  if v_cuota <= 0 or v_ultima <= 0 then
    raise exception 'El monto no alcanza para tantas cuotas.';
  end if;
  v_fecha := rrhh.fn_planilla_fin_periodo(greatest(p_fecha_primera, c.fecha_inicio), c.frecuencia_pago);
  -- Una cuota en un período ya pasado se cobraría de golpe como vencida.
  if v_fecha < rrhh.fn_planilla_fin_periodo(p_hoy, c.frecuencia_pago) then
    raise exception 'La primera cuota no puede caer en un período ya pasado. Usa una fecha del período actual o de uno siguiente.';
  end if;
  if p_fecha_primera > p_hoy + 366 then
    raise exception 'La primera cuota no puede ser de más de un año adelante.';
  end if;
  if exists (select 1 from rrhh.planillas q join rrhh.planilla_tipos pt on pt.id = q.planilla_tipo_id and pt.clase = 'ordinaria'
             where q.company_id = p_company_id and q.estado in ('aprobada', 'pagada')
               and v_fecha between q.periodo_inicio and q.periodo_fin
               and exists (select 1 from rrhh.planilla_empleados e where e.planilla_id = q.id and e.contrato_id = p_contrato_id)) then
    raise exception 'La primera cuota cae en una planilla ya aprobada. Elige una fecha del período siguiente.';
  end if;

  insert into rrhh.prestamos (company_id, contrato_id, empleado_id, tipo, origen, monto, cuotas, monto_cuota,
    fecha_primera, frecuencia, nota, registrado_por)
  values (p_company_id, p_contrato_id, c.empleado_id, p_tipo, p_origen, p_monto, p_cuotas, v_cuota,
    v_fecha, c.frecuencia_pago, nullif(btrim(p_nota), ''), v_uid)
  returning id into v_id;

  for i in 1..p_cuotas loop
    perform rrhh.fn_asegurar_particion_novedades(v_fecha);
    insert into rrhh.novedades (fecha, company_id, contrato_id, empleado_id, concepto_id, monto, nota, origen,
                                prestamo_id, cuota_numero, creado_por)
    values (v_fecha, p_company_id, p_contrato_id, c.empleado_id, co.id,
            case when i = p_cuotas then v_ultima else v_cuota end,
            format('Cuota %s de %s', i, p_cuotas), 'prestamo', v_id, i, v_uid);
    v_fecha := rrhh.fn_planilla_fin_periodo(v_fecha + 1, c.frecuencia_pago);
  end loop;

  perform core.fn_auditar(v_uid, p_company_id, 'rrhh.planilla.prestamo_creado', 'rrhh.prestamos', v_id::text,
    jsonb_build_object('contrato_id', p_contrato_id, 'tipo', p_tipo, 'monto', p_monto, 'cuotas', p_cuotas, 'origen', p_origen));
  return v_id;
end;
$$;

create or replace function public.planilla_prestamo_crear(
  p_company_id uuid, p_contrato_id uuid, p_tipo text, p_monto numeric, p_cuotas integer, p_fecha_primera date,
  p_nota text default null, p_origen text default 'nexo')
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := core.fn_exigir_permiso(p_company_id, 'rrhh.planillas.prestamos.gestionar');
begin
  return rrhh.fn_planilla_prestamo_crear(v_uid, p_company_id, p_contrato_id, p_tipo, p_monto, p_cuotas, p_fecha_primera,
    p_nota, p_origen, (now() at time zone 'America/Managua')::date);
end;
$$;

create or replace function public.planilla_prestamo_anular(p_company_id uuid, p_prestamo_id uuid, p_motivo text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := core.fn_exigir_permiso(p_company_id, 'rrhh.planillas.prestamos.gestionar');
  pt rrhh.prestamos;
begin
  if p_motivo is null or length(btrim(p_motivo)) not between 5 and 500 then
    raise exception 'Indica el motivo (5 a 500 caracteres).';
  end if;
  select * into pt from rrhh.prestamos where id = p_prestamo_id and company_id = p_company_id for update;
  if not found then
    raise exception 'Préstamo no encontrado.';
  end if;
  if pt.estado <> 'activo' then
    raise exception 'El préstamo está % y no se anula.', pt.estado;
  end if;
  if exists (select 1 from rrhh.novedades n join rrhh.planillas q on q.id = n.planilla_id
             where n.prestamo_id = pt.id and n.estado = 'aplicada' and q.estado in ('aprobada', 'pagada')) then
    raise exception 'El préstamo ya tiene cuotas cobradas en planillas aprobadas. Cancélalo en vez de anularlo.';
  end if;
  update rrhh.novedades set estado = 'anulada', planilla_id = null, anulada_por = v_uid, anulada_en = now(), updated_at = now()
  where prestamo_id = pt.id and company_id = p_company_id and estado <> 'anulada';
  update rrhh.prestamos set estado = 'anulado', cerrado_por = v_uid, cerrado_en = now(), motivo_cierre = btrim(p_motivo),
    updated_at = now()
  where id = pt.id;
  perform core.fn_auditar(v_uid, p_company_id, 'rrhh.planilla.prestamo_anulado', 'rrhh.prestamos', pt.id::text,
    jsonb_build_object('contrato_id', pt.contrato_id, 'motivo', btrim(p_motivo)));
end;
$$;

create or replace function public.planilla_prestamo_cancelar(p_company_id uuid, p_prestamo_id uuid, p_motivo text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := core.fn_exigir_permiso(p_company_id, 'rrhh.planillas.prestamos.gestionar');
  pt rrhh.prestamos;
  v_n integer;
begin
  if p_motivo is null or length(btrim(p_motivo)) not between 5 and 500 then
    raise exception 'Indica el motivo (5 a 500 caracteres).';
  end if;
  select * into pt from rrhh.prestamos where id = p_prestamo_id and company_id = p_company_id for update;
  if not found then
    raise exception 'Préstamo no encontrado.';
  end if;
  if pt.estado <> 'activo' then
    raise exception 'El préstamo está % y no se cancela.', pt.estado;
  end if;
  update rrhh.novedades n set estado = 'anulada', planilla_id = null, anulada_por = v_uid, anulada_en = now(), updated_at = now()
  where n.prestamo_id = pt.id and n.company_id = p_company_id and n.estado <> 'anulada'
    and (n.planilla_id is null or not exists (select 1 from rrhh.planillas q where q.id = n.planilla_id
                                               and q.estado in ('aprobada', 'pagada')));
  get diagnostics v_n = row_count;
  if v_n = 0 then
    raise exception 'El préstamo no tiene cuotas pendientes.';
  end if;
  update rrhh.prestamos set estado = 'cancelado', cerrado_por = v_uid, cerrado_en = now(), motivo_cierre = btrim(p_motivo),
    updated_at = now()
  where id = pt.id;
  perform core.fn_auditar(v_uid, p_company_id, 'rrhh.planilla.prestamo_cancelado', 'rrhh.prestamos', pt.id::text,
    jsonb_build_object('contrato_id', pt.contrato_id, 'cuotas_anuladas', v_n, 'motivo', btrim(p_motivo)));
end;
$$;

create or replace function public.planilla_prestamos_saldos(p_company_id uuid)
returns table (prestamo_id uuid, contrato_id uuid, numero_contrato bigint, empleado_nombre text, tipo text, origen text,
               monto numeric, cuotas integer, monto_cuota numeric, fecha_primera date, estado text, aplicado numeric,
               pendiente numeric, condonado numeric, cuotas_pendientes integer, proxima_fecha date, nota text,
               created_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid uuid := core.fn_exigir_permiso(p_company_id, 'rrhh.planillas.prestamos.ver');
begin
  -- aplicado = cuotas cobradas en planillas aprobadas + lo descontado en la
  -- liquidación; condonado = lo que la liquidación no pudo descontar (art. 97).
  return query
  select pt.id, pt.contrato_id, c.numero_contrato, e.nombre || ' ' || e.apellido, pt.tipo, pt.origen, pt.monto, pt.cuotas,
         pt.monto_cuota, pt.fecha_primera,
         case when pt.estado = 'activo' and coalesce(s.pendiente, 0) = 0 then 'pagado' else pt.estado end,
         (coalesce(s.aplicado, 0) + coalesce(pt.monto_liquidado, 0))::numeric, coalesce(s.pendiente, 0)::numeric,
         greatest(0, coalesce(s.saldado, 0) - coalesce(pt.monto_liquidado, 0))::numeric,
         coalesce(s.n_pend, 0)::integer, s.proxima, pt.nota, pt.created_at
  from rrhh.prestamos pt
  join rrhh.contratos c on c.id = pt.contrato_id
  join rrhh.empleados e on e.id = pt.empleado_id
  left join lateral (
    select sum(n.monto) filter (where n.estado = 'aplicada' and q.estado in ('aprobada', 'pagada')) as aplicado,
           sum(n.monto) filter (where n.estado = 'anulada' and n.liquidacion_id is not null) as saldado,
           sum(n.monto) filter (where n.estado <> 'anulada' and (q.id is null or q.estado not in ('aprobada', 'pagada'))) as pendiente,
           count(*) filter (where n.estado <> 'anulada' and (q.id is null or q.estado not in ('aprobada', 'pagada'))) as n_pend,
           min(n.fecha) filter (where n.estado <> 'anulada' and (q.id is null or q.estado not in ('aprobada', 'pagada'))) as proxima
    from rrhh.novedades n left join rrhh.planillas q on q.id = n.planilla_id
    where n.prestamo_id = pt.id and n.company_id = pt.company_id
  ) s on true
  where pt.company_id = p_company_id
  order by (pt.estado = 'activo') desc, pt.created_at desc;
end;
$$;

create or replace function public.planilla_prestamo_cuotas(p_company_id uuid, p_prestamo_id uuid)
returns table (novedad_id uuid, cuota_numero integer, fecha date, monto numeric, estado text, planilla_id uuid,
               planilla_estado text, saldada_en_liquidacion boolean)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid uuid := core.fn_exigir_permiso(p_company_id, 'rrhh.planillas.prestamos.ver');
begin
  if not exists (select 1 from rrhh.prestamos pt where pt.id = p_prestamo_id and pt.company_id = p_company_id) then
    raise exception 'Préstamo no encontrado.';
  end if;
  return query
  select n.id, n.cuota_numero, n.fecha, n.monto, n.estado, n.planilla_id, q.estado, n.liquidacion_id is not null
  from rrhh.novedades n left join rrhh.planillas q on q.id = n.planilla_id
  where n.prestamo_id = p_prestamo_id and n.company_id = p_company_id
  order by n.cuota_numero, n.fecha;
end;
$$;

create or replace function public.planilla_embargo_crear(
  p_company_id uuid, p_contrato_id uuid, p_tipo text, p_metodo text, p_valor numeric, p_tope_total numeric,
  p_referencia text, p_vigente_desde date, p_vigente_hasta date default null, p_nota text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := core.fn_exigir_permiso(p_company_id, 'rrhh.planillas.prestamos.gestionar');
  c record;
  v_id uuid;
begin
  if p_tipo is null or p_tipo not in ('alimentos', 'judicial') then
    raise exception 'Indica el tipo de embargo: alimentos o judicial.';
  end if;
  if p_metodo is null or p_metodo not in ('porcentaje', 'monto') then
    raise exception 'Indica si el embargo es un porcentaje o un monto mensual.';
  end if;
  if p_valor is null or p_valor <= 0 or (p_metodo = 'porcentaje' and p_valor > 1)
     or (p_metodo = 'monto' and (p_valor >= 100000000 or p_valor <> round(p_valor, 2))) then
    raise exception 'Indica un valor válido (porcentaje de 0 a 100%% o monto mensual).';
  end if;
  if p_tope_total is not null and (p_tope_total <= 0 or p_tope_total >= 100000000) then
    raise exception 'El monto total de la orden no es válido.';
  end if;
  if p_referencia is null or length(btrim(p_referencia)) not between 3 and 200 then
    raise exception 'Indica la referencia de la orden judicial (3 a 200 caracteres).';
  end if;
  if p_vigente_desde is null or (p_vigente_hasta is not null and p_vigente_hasta < p_vigente_desde) then
    raise exception 'Indica una vigencia válida.';
  end if;
  if p_nota is not null and length(p_nota) > 300 then
    raise exception 'La nota es demasiado larga.';
  end if;
  select ct.id, ct.empleado_id, ct.estado, ct.fecha_inicio into c
  from rrhh.contratos ct where ct.id = p_contrato_id and ct.company_id = p_company_id;
  if not found or c.estado <> 'activo' then
    raise exception 'Solo se registran embargos de contratos activos.';
  end if;
  if p_vigente_desde < c.fecha_inicio then
    raise exception 'El embargo no puede empezar antes del contrato.';
  end if;
  insert into rrhh.embargos (company_id, contrato_id, empleado_id, tipo, metodo, valor, tope_total, referencia,
    vigente_desde, vigente_hasta, nota, registrado_por)
  values (p_company_id, p_contrato_id, c.empleado_id, p_tipo, p_metodo, p_valor, p_tope_total, btrim(p_referencia),
    p_vigente_desde, p_vigente_hasta, nullif(btrim(p_nota), ''), v_uid)
  returning id into v_id;
  perform core.fn_auditar(v_uid, p_company_id, 'rrhh.planilla.embargo_creado', 'rrhh.embargos', v_id::text,
    jsonb_build_object('contrato_id', p_contrato_id, 'tipo', p_tipo, 'metodo', p_metodo, 'valor', p_valor, 'desde', p_vigente_desde));
  return v_id;
end;
$$;

create or replace function public.planilla_embargo_terminar(p_company_id uuid, p_embargo_id uuid, p_vigente_hasta date, p_motivo text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := core.fn_exigir_permiso(p_company_id, 'rrhh.planillas.prestamos.gestionar');
  em rrhh.embargos;
  v_ultima date;
begin
  if p_motivo is null or length(btrim(p_motivo)) not between 5 and 500 then
    raise exception 'Indica el motivo (5 a 500 caracteres).';
  end if;
  select * into em from rrhh.embargos where id = p_embargo_id and company_id = p_company_id for update;
  if not found then
    raise exception 'Embargo no encontrado.';
  end if;
  if em.estado <> 'activo' then
    raise exception 'El embargo ya está terminado.';
  end if;
  if p_vigente_hasta is null or p_vigente_hasta < em.vigente_desde - 1 then
    raise exception 'La fecha de término no puede ser anterior al día antes del inicio del embargo.';
  end if;
  select max(q.periodo_fin) into v_ultima from rrhh.planilla_lineas l join rrhh.planillas q on q.id = l.planilla_id
  where l.company_id = p_company_id and l.contrato_id = em.contrato_id and em.id = any (l.origen_ids)
    and q.estado in ('aprobada', 'pagada');
  if v_ultima is not null and p_vigente_hasta < v_ultima then
    raise exception 'El embargo ya se aplicó en planillas aprobadas hasta el %.', to_char(v_ultima, 'YYYY-MM-DD');
  end if;
  -- Terminado antes de empezar (registro por error, sin cobros aprobados): queda anulado y el motor lo ignora.
  update rrhh.embargos set estado = case when p_vigente_hasta < em.vigente_desde then 'anulado' else 'terminado' end,
    vigente_hasta = case when p_vigente_hasta < em.vigente_desde then em.vigente_hasta else p_vigente_hasta end,
    terminado_por = v_uid, terminado_en = now(), motivo_termino = btrim(p_motivo), updated_at = now()
  where id = em.id;
  perform core.fn_auditar(v_uid, p_company_id,
    case when p_vigente_hasta < em.vigente_desde then 'rrhh.planilla.embargo_anulado' else 'rrhh.planilla.embargo_terminado' end,
    'rrhh.embargos', em.id::text,
    jsonb_build_object('contrato_id', em.contrato_id, 'hasta', p_vigente_hasta, 'motivo', btrim(p_motivo)));
end;
$$;

create or replace function public.planilla_embargos_saldos(p_company_id uuid)
returns table (embargo_id uuid, contrato_id uuid, numero_contrato bigint, empleado_nombre text, tipo text, metodo text,
               valor numeric, tope_total numeric, aplicado numeric, pendiente numeric, referencia text,
               vigente_desde date, vigente_hasta date, estado text)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid uuid := core.fn_exigir_permiso(p_company_id, 'rrhh.planillas.prestamos.ver');
begin
  return query
  select em.id, em.contrato_id, c.numero_contrato, e.nombre || ' ' || e.apellido, em.tipo, em.metodo, em.valor,
         em.tope_total, coalesce(s.aplicado, 0)::numeric,
         case when em.tope_total is null then null else greatest(0, em.tope_total - coalesce(s.aplicado, 0)) end,
         em.referencia, em.vigente_desde, em.vigente_hasta, em.estado
  from rrhh.embargos em
  join rrhh.contratos c on c.id = em.contrato_id
  join rrhh.empleados e on e.id = em.empleado_id
  left join lateral (
    select sum(l.monto) as aplicado from rrhh.planilla_lineas l join rrhh.planillas q on q.id = l.planilla_id
    where l.company_id = em.company_id and l.contrato_id = em.contrato_id and em.id = any (l.origen_ids)
      and q.estado in ('aprobada', 'pagada')
  ) s on true
  where em.company_id = p_company_id
  order by (em.estado = 'activo') desc, em.vigente_desde desc;
end;
$$;

-- -----------------------------------------------------------------------------
-- 10. RPC nuevas: liquidaciones
-- -----------------------------------------------------------------------------
create or replace function public.planilla_liquidacion_crear(
  p_company_id uuid, p_contrato_id uuid, p_fecha_egreso date, p_causa text,
  p_dias_salario_pendiente numeric default 0, p_meses_confianza numeric default null, p_nota text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := core.fn_exigir_permiso(p_company_id, 'rrhh.planillas.liquidaciones.calcular');
  v jsonb;
  x jsonb;
  v_id uuid;
  v_pend numeric(6,2);
  v_conf numeric(4,2);
  i integer := 0;
begin
  if p_nota is not null and length(p_nota) > 500 then
    raise exception 'La nota es demasiado larga.';
  end if;
  if coalesce(p_dias_salario_pendiente, 0) not between 0 and 31 or coalesce(p_meses_confianza, 0) not between 0 and 99 then
    raise exception 'Días de salario pendiente o meses de confianza fuera de rango.';
  end if;
  -- Con el mismo tipo que se guarda: la huella al aprobar se calcula con los valores guardados.
  v_pend := round(coalesce(p_dias_salario_pendiente, 0), 2);
  v_conf := round(p_meses_confianza, 2);
  perform 1 from rrhh.contratos where id = p_contrato_id and company_id = p_company_id for no key update;
  if exists (select 1 from rrhh.liquidaciones l where l.contrato_id = p_contrato_id and l.estado <> 'anulada') then
    raise exception 'El contrato ya tiene una liquidación. Anúlala para hacer otra.';
  end if;
  v := rrhh.fn_liquidacion_preparar(p_company_id, p_contrato_id, p_fecha_egreso, p_causa,
    v_pend, v_conf, null, true, null);
  insert into rrhh.liquidaciones (company_id, contrato_id, empleado_id, contrato_regimen_id, fecha_egreso, causa,
    meses_confianza, dias_salario_pendiente, salario_mensual, salario_diario, fecha_antiguedad, dias_vacaciones,
    aguinaldo_desde, total_devengado, total_deducciones, neto, avisos, resultado, hash_insumos, nota, creada_por, calculada_por)
  values (p_company_id, p_contrato_id, (v->>'empleado_id')::uuid, (v->>'contrato_regimen_id')::uuid, p_fecha_egreso, p_causa,
    v_conf, v_pend, (v->>'salario_mensual')::numeric, (v->>'diario')::numeric,
    (v->>'fecha_antiguedad')::date, (v->>'dias_vacaciones')::numeric, (v->>'aguinaldo_desde')::date,
    (v->>'total_devengado')::numeric, (v->>'total_deducciones')::numeric, (v->>'neto')::numeric,
    array(select jsonb_array_elements_text(v->'avisos')), v,
    encode(extensions.digest(v::text, 'sha256'), 'hex'), nullif(btrim(p_nota), ''), v_uid, v_uid)
  returning id into v_id;
  for x in select * from jsonb_array_elements(v->'lineas') loop
    i := i + 1;
    insert into rrhh.liquidacion_lineas (company_id, liquidacion_id, concepto, nombre, tipo, dias, diario, monto, articulo, orden)
    values (p_company_id, v_id, x->>'concepto', x->>'nombre', 'devengado', (x->>'dias')::numeric, (x->>'diario')::numeric,
            (x->>'monto')::numeric, x->>'articulo', i * 10);
  end loop;
  for x in select * from jsonb_array_elements(v->'deducciones') loop
    i := i + 1;
    insert into rrhh.liquidacion_lineas (company_id, liquidacion_id, concepto, nombre, tipo, monto, articulo, orden, origen_id)
    values (p_company_id, v_id, x->>'concepto', x->>'nombre', 'deduccion', (x->>'monto')::numeric, x->>'articulo',
            900 + i, (x->>'origen_id')::uuid);
  end loop;
  perform core.fn_auditar(v_uid, p_company_id, 'rrhh.planilla.liquidacion_calculada', 'rrhh.liquidaciones', v_id::text,
    jsonb_build_object('contrato_id', p_contrato_id, 'causa', p_causa, 'egreso', p_fecha_egreso, 'neto', v->'neto'));
  return v_id;
end;
$$;

create or replace function public.planilla_liquidacion_recalcular(p_company_id uuid, p_liquidacion_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := core.fn_exigir_permiso(p_company_id, 'rrhh.planillas.liquidaciones.calcular');
  l rrhh.liquidaciones;
  v jsonb;
  x jsonb;
  i integer := 0;
begin
  select * into l from rrhh.liquidaciones where id = p_liquidacion_id and company_id = p_company_id for update;
  if not found then
    raise exception 'Liquidación no encontrada.';
  end if;
  if l.estado <> 'calculada' then
    raise exception 'La liquidación está % y no se recalcula. Para corregirla, anúlala y haz otra.', l.estado;
  end if;
  v := rrhh.fn_liquidacion_preparar(p_company_id, l.contrato_id, l.fecha_egreso, l.causa,
    l.dias_salario_pendiente, l.meses_confianza, null, true, l.id);
  delete from rrhh.liquidacion_lineas where liquidacion_id = l.id;
  update rrhh.liquidaciones set contrato_regimen_id = (v->>'contrato_regimen_id')::uuid,
    salario_mensual = (v->>'salario_mensual')::numeric, salario_diario = (v->>'diario')::numeric,
    fecha_antiguedad = (v->>'fecha_antiguedad')::date, dias_vacaciones = (v->>'dias_vacaciones')::numeric,
    aguinaldo_desde = (v->>'aguinaldo_desde')::date, total_devengado = (v->>'total_devengado')::numeric,
    total_deducciones = (v->>'total_deducciones')::numeric, neto = (v->>'neto')::numeric,
    avisos = array(select jsonb_array_elements_text(v->'avisos')), resultado = v,
    hash_insumos = encode(extensions.digest(v::text, 'sha256'), 'hex'),
    calculada_por = v_uid, calculada_en = now(), updated_at = now()
  where id = l.id;
  for x in select * from jsonb_array_elements(v->'lineas') loop
    i := i + 1;
    insert into rrhh.liquidacion_lineas (company_id, liquidacion_id, concepto, nombre, tipo, dias, diario, monto, articulo, orden)
    values (p_company_id, l.id, x->>'concepto', x->>'nombre', 'devengado', (x->>'dias')::numeric, (x->>'diario')::numeric,
            (x->>'monto')::numeric, x->>'articulo', i * 10);
  end loop;
  for x in select * from jsonb_array_elements(v->'deducciones') loop
    i := i + 1;
    insert into rrhh.liquidacion_lineas (company_id, liquidacion_id, concepto, nombre, tipo, monto, articulo, orden, origen_id)
    values (p_company_id, l.id, x->>'concepto', x->>'nombre', 'deduccion', (x->>'monto')::numeric, x->>'articulo',
            900 + i, (x->>'origen_id')::uuid);
  end loop;
  perform core.fn_auditar(v_uid, p_company_id, 'rrhh.planilla.liquidacion_recalculada', 'rrhh.liquidaciones', l.id::text,
    jsonb_build_object('neto_anterior', l.neto, 'neto', v->'neto'));
end;
$$;

-- Aprueba otra persona. Recalcula y exige la misma huella. Si el contrato sigue
-- activo, lo finaliza con la fecha de egreso (exige además el permiso de
-- finalizar contratos). Registra las vacaciones liquidadas y salda las cuotas
-- de préstamo descontadas.
create or replace function public.planilla_liquidacion_aprobar(p_company_id uuid, p_liquidacion_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := core.fn_exigir_permiso(p_company_id, 'rrhh.planillas.liquidaciones.aprobar');
  l rrhh.liquidaciones;
  c rrhh.contratos;
  v jsonb;
  x jsonb;
begin
  select * into l from rrhh.liquidaciones where id = p_liquidacion_id and company_id = p_company_id;
  if not found then
    raise exception 'Liquidación no encontrada.';
  end if;
  select * into c from rrhh.contratos where id = l.contrato_id for no key update;
  select * into l from rrhh.liquidaciones where id = p_liquidacion_id for update;
  if l.estado <> 'calculada' then
    raise exception 'Solo se aprueba una liquidación calculada. Esta está %.', l.estado;
  end if;
  if v_uid = l.calculada_por or v_uid = l.creada_por then
    raise exception 'Quien crea o calcula una liquidación no puede aprobarla. Pide la aprobación a otra persona.';
  end if;
  v := rrhh.fn_liquidacion_preparar(p_company_id, l.contrato_id, l.fecha_egreso, l.causa,
    l.dias_salario_pendiente, l.meses_confianza, null, true, l.id);
  if encode(extensions.digest(v::text, 'sha256'), 'hex') is distinct from l.hash_insumos then
    raise exception 'Hubo cambios después del cálculo. Recalcula la liquidación.';
  end if;
  if c.estado = 'activo' then
    if l.fecha_egreso > (now() at time zone 'America/Managua')::date then
      raise exception 'La fecha de egreso todavía no llega. Aprueba la liquidación a partir del %.', to_char(l.fecha_egreso, 'YYYY-MM-DD');
    end if;
    if not core.has_permission(v_uid, p_company_id, 'rrhh.expedientes.contratos.finalizar') then
      raise exception 'Para aprobar, el contrato debe quedar finalizado y no tienes permiso para finalizar contratos.';
    end if;
    perform rrhh.fn_finalizar_contrato(c.id, p_company_id);
    update rrhh.contratos set fecha_fin_real = l.fecha_egreso where id = c.id;
  end if;
  if l.dias_vacaciones > 0 then
    perform rrhh.fn_asegurar_particion_vacaciones_movimientos(l.fecha_egreso);
    insert into rrhh.vacaciones_movimientos (company_id, contrato_id, empleado_id, tipo, fecha_inicio, fecha_fin, dias,
      estado, motivo, registrado_por, aprobado_por, aprobado_en, liquidacion_id)
    values (p_company_id, l.contrato_id, l.empleado_id, 'liquidacion', l.fecha_egreso, l.fecha_egreso, l.dias_vacaciones,
      'aprobada', 'Vacaciones pagadas en la liquidación', l.calculada_por, v_uid, now(), l.id);
  end if;
  for x in select * from jsonb_array_elements(v->'deducciones') loop
    update rrhh.novedades n set estado = 'anulada', planilla_id = null, liquidacion_id = l.id, anulada_por = v_uid,
      anulada_en = now(), updated_at = now()
    where n.prestamo_id = (x->>'origen_id')::uuid and n.company_id = p_company_id and n.estado <> 'anulada'
      and (n.planilla_id is null or not exists (select 1 from rrhh.planillas q where q.id = n.planilla_id
                                                 and q.estado in ('aprobada', 'pagada')));
    update rrhh.prestamos set estado = 'cancelado', liquidacion_id = l.id, monto_liquidado = (x->>'monto')::numeric,
      cerrado_por = v_uid, cerrado_en = now(),
      motivo_cierre = case when (x->>'monto')::numeric < (x->>'pendiente')::numeric
                           then format('Saldado en la liquidación; quedaron C$ %s sin descontar (condonado)',
                                       to_char((x->>'pendiente')::numeric - (x->>'monto')::numeric, 'FM999999990.00'))
                           else 'Saldado en la liquidación' end,
      updated_at = now()
    where id = (x->>'origen_id')::uuid;
  end loop;
  update rrhh.liquidaciones set estado = 'aprobada', aprobada_por = v_uid, aprobada_en = now(), updated_at = now()
  where id = l.id;
  perform core.fn_auditar(v_uid, p_company_id, 'rrhh.planilla.liquidacion_aprobada', 'rrhh.liquidaciones', l.id::text,
    jsonb_build_object('contrato_id', l.contrato_id, 'neto', l.neto, 'contrato_finalizado', c.estado = 'activo'));
end;
$$;

create or replace function public.planilla_liquidacion_pagar(
  p_company_id uuid, p_liquidacion_id uuid, p_metodo_pago text, p_referencia text default null, p_fecha_pago date default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := core.fn_exigir_permiso(p_company_id, 'rrhh.planillas.liquidaciones.pagar');
  l rrhh.liquidaciones;
begin
  if p_metodo_pago is null or p_metodo_pago not in ('cheque', 'transferencia') then
    raise exception 'Indica el método de pago: cheque o transferencia.';
  end if;
  if p_referencia is not null and length(p_referencia) > 120 then
    raise exception 'La referencia de pago es demasiado larga.';
  end if;
  select * into l from rrhh.liquidaciones where id = p_liquidacion_id and company_id = p_company_id for update;
  if not found then
    raise exception 'Liquidación no encontrada.';
  end if;
  if l.estado <> 'aprobada' then
    raise exception 'Solo se paga una liquidación aprobada. Esta está %.', l.estado;
  end if;
  if p_fecha_pago is not null and (p_fecha_pago < l.fecha_egreso - 31
                                   or p_fecha_pago > (now() at time zone 'America/Managua')::date + 31) then
    raise exception 'La fecha de pago está fuera de rango.';
  end if;
  if p_metodo_pago = 'transferencia' and not exists (select 1 from rrhh.empleado_cuentas_bancarias b
       where b.empleado_id = l.empleado_id and b.company_id = l.company_id and b.activo) then
    raise exception 'La persona no tiene cuenta bancaria activa. Paga con cheque o registra la cuenta.';
  end if;
  update rrhh.liquidaciones set estado = 'pagada', pagada_por = v_uid, pagada_en = now(), metodo_pago = p_metodo_pago,
    referencia_pago = nullif(btrim(p_referencia), ''), fecha_pago = coalesce(p_fecha_pago, (now() at time zone 'America/Managua')::date), updated_at = now()
  where id = l.id;
  perform core.fn_auditar(v_uid, p_company_id, 'rrhh.planilla.liquidacion_pagada', 'rrhh.liquidaciones', l.id::text,
    jsonb_build_object('metodo', p_metodo_pago, 'neto', l.neto));
end;
$$;

create or replace function public.planilla_liquidacion_anular(p_company_id uuid, p_liquidacion_id uuid, p_motivo text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := core.fn_exigir_permiso(p_company_id, 'rrhh.planillas.liquidaciones.anular');
  l rrhh.liquidaciones;
begin
  if p_motivo is null or length(btrim(p_motivo)) not between 5 and 500 then
    raise exception 'Indica el motivo de la anulación (5 a 500 caracteres).';
  end if;
  select * into l from rrhh.liquidaciones where id = p_liquidacion_id and company_id = p_company_id for update;
  if not found then
    raise exception 'Liquidación no encontrada.';
  end if;
  if l.estado = 'pagada' then
    raise exception 'Una liquidación pagada no se anula. La corrección de un pago está pendiente de definir con el contador.';
  elsif l.estado = 'anulada' then
    raise exception 'La liquidación ya está anulada.';
  end if;
  if l.estado = 'aprobada' then
    update rrhh.vacaciones_movimientos set estado = 'anulada', anulado_por = v_uid, anulado_en = now(), updated_at = now()
    where liquidacion_id = l.id and estado = 'aprobada';
    update rrhh.novedades set estado = 'pendiente', liquidacion_id = null, anulada_por = null, anulada_en = null, updated_at = now()
    where liquidacion_id = l.id and company_id = p_company_id;
    update rrhh.prestamos set estado = 'activo', liquidacion_id = null, monto_liquidado = null, cerrado_por = null,
      cerrado_en = null, motivo_cierre = null, updated_at = now()
    where liquidacion_id = l.id;
  end if;
  update rrhh.liquidaciones set estado = 'anulada', anulada_por = v_uid, anulada_en = now(),
    motivo_anulacion = btrim(p_motivo), updated_at = now()
  where id = l.id;
  perform core.fn_auditar(v_uid, p_company_id, 'rrhh.planilla.liquidacion_anulada', 'rrhh.liquidaciones', l.id::text,
    jsonb_build_object('estado_anterior', l.estado, 'motivo', btrim(p_motivo),
      'nota', case when l.estado = 'aprobada' then 'El contrato sigue finalizado: un contrato finalizado no se reabre.' end));
end;
$$;

create or replace function public.planilla_liquidaciones_listado(p_company_id uuid)
returns table (id uuid, contrato_id uuid, numero_contrato bigint, empleado_nombre text, fecha_egreso date, causa text,
               estado text, total_devengado numeric, total_deducciones numeric, neto numeric, calculada_por uuid,
               calculada_en timestamptz, aprobada_por uuid, aprobada_en timestamptz, pagada_en timestamptz)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid uuid := core.fn_exigir_permiso(p_company_id, 'rrhh.planillas.liquidaciones.ver');
begin
  return query
  select l.id, l.contrato_id, c.numero_contrato, e.nombre || ' ' || e.apellido, l.fecha_egreso, l.causa, l.estado,
         l.total_devengado, l.total_deducciones, l.neto, l.calculada_por, l.calculada_en, l.aprobada_por, l.aprobada_en,
         l.pagada_en
  from rrhh.liquidaciones l
  join rrhh.contratos c on c.id = l.contrato_id
  join rrhh.empleados e on e.id = l.empleado_id
  where l.company_id = p_company_id
  order by l.fecha_egreso desc, l.created_at desc;
end;
$$;

create or replace function public.planilla_liquidacion_detalle(p_company_id uuid, p_liquidacion_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid uuid := core.fn_exigir_permiso(p_company_id, 'rrhh.planillas.liquidaciones.ver');
  v jsonb;
begin
  select jsonb_build_object(
    'liquidacion', to_jsonb(l) - 'resultado' - 'hash_insumos'
       || jsonb_build_object('numero_contrato', c.numero_contrato, 'empleado_nombre', e.nombre || ' ' || e.apellido,
                             'fecha_inicio', c.fecha_inicio, 'regimen', r.regimen, 'contrato_estado', c.estado,
                             'meses_antiguedad', l.resultado->'meses_antiguedad',
                             'dias_vacaciones_saldo', l.resultado->'dias_vacaciones_saldo'),
    'empresa', (select jsonb_build_object('nombre', co.name, 'ruc', co.tax_id) from core.companies co where co.id = l.company_id),
    'lineas', (select coalesce(jsonb_agg(jsonb_build_object('concepto', ll.concepto, 'nombre', ll.nombre, 'tipo', ll.tipo,
                 'dias', ll.dias, 'diario', ll.diario, 'monto', ll.monto, 'articulo', ll.articulo) order by ll.orden), '[]'::jsonb)
               from rrhh.liquidacion_lineas ll where ll.liquidacion_id = l.id))
    into v
  from rrhh.liquidaciones l
  join rrhh.contratos c on c.id = l.contrato_id
  join rrhh.empleados e on e.id = l.empleado_id
  join rrhh.contrato_regimen r on r.id = l.contrato_regimen_id
  where l.id = p_liquidacion_id and l.company_id = p_company_id;
  if v is null then
    raise exception 'Liquidación no encontrada.';
  end if;
  return v;
end;
$$;

-- -----------------------------------------------------------------------------
-- 11. RPC nuevas: pasivo laboral y provisiones
-- -----------------------------------------------------------------------------
create or replace function public.planilla_pasivo_laboral(p_company_id uuid, p_fecha date default null)
returns table (contrato_id uuid, empleado_id uuid, numero_contrato bigint, empleado_nombre text,
               salario_mensual numeric, salario_diario numeric, vacaciones_dias numeric, vacaciones_monto numeric,
               aguinaldo_dias numeric, aguinaldo_monto numeric, indemnizacion_dias numeric, indemnizacion_monto numeric,
               total numeric)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid uuid := core.fn_exigir_permiso(p_company_id, 'rrhh.planillas.planilla.ver');
begin
  return query select * from rrhh.fn_planilla_pasivo(p_company_id, coalesce(p_fecha, (now() at time zone 'America/Managua')::date));
end;
$$;

create or replace function public.planilla_provisiones_generar(p_company_id uuid, p_mes date)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := core.fn_exigir_permiso(p_company_id, 'rrhh.planillas.planilla.generar');
  v_hoy date := (now() at time zone 'America/Managua')::date;
  v_mes date;
  v_corte date;
  v_n integer;
begin
  if p_mes is null then
    raise exception 'Indica el mes.';
  end if;
  v_mes := date_trunc('month', p_mes)::date;
  if v_mes > v_hoy then
    raise exception 'No se generan provisiones de meses futuros.';
  end if;
  if v_mes < date '2020-01-01' then
    raise exception 'Indica un mes desde enero de 2020.';
  end if;
  v_corte := least(v_hoy, (v_mes + interval '1 month - 1 day')::date);
  perform rrhh.fn_asegurar_particion_provisiones(v_mes);
  delete from rrhh.provisiones where company_id = p_company_id and mes = v_mes;
  insert into rrhh.provisiones (mes, company_id, contrato_id, empleado_id, fecha_corte, salario_mensual, salario_diario,
    vacaciones_dias, vacaciones_monto, aguinaldo_dias, aguinaldo_monto, indemnizacion_dias, indemnizacion_monto, total,
    generado_por)
  select v_mes, p_company_id, x.contrato_id, x.empleado_id, v_corte, x.salario_mensual, x.salario_diario,
         x.vacaciones_dias, x.vacaciones_monto, x.aguinaldo_dias, x.aguinaldo_monto, x.indemnizacion_dias,
         x.indemnizacion_monto, x.total, v_uid
  from rrhh.fn_planilla_pasivo(p_company_id, v_corte) x;
  get diagnostics v_n = row_count;
  perform core.fn_auditar(v_uid, p_company_id, 'rrhh.planilla.provisiones_generadas', 'rrhh.provisiones', to_char(v_mes, 'YYYY-MM'),
    jsonb_build_object('mes', v_mes, 'corte', v_corte, 'filas', v_n));
  return v_n;
end;
$$;

-- -----------------------------------------------------------------------------
-- 12. Privilegios de funciones
-- -----------------------------------------------------------------------------
revoke all on function
  rrhh.fn_asegurar_particion_provisiones(date), rrhh.fn_asegurar_particion_vacaciones_movimientos(date),
  rrhh.fn_meses_comerciales(date, date, numeric), rrhh.fn_planilla_fin_periodo(date, text),
  rrhh.fn_planilla_aguinaldo_periodo(uuid, date), rrhh.fn_planilla_meses_regimen(uuid, date, date, text, numeric),
  rrhh.fn_planilla_aguinaldo_dias(uuid, date, date), rrhh.fn_vacaciones_saldo(uuid, date),
  rrhh.fn_planilla_pasivo(uuid, date), rrhh.fn_planilla_novedades(uuid),
  rrhh.fn_planilla_calcular_aguinaldo(uuid, uuid),
  rrhh.fn_liquidacion_calcular(uuid, numeric, date, date, text, boolean, numeric, numeric, numeric, boolean, boolean, boolean, date),
  rrhh.fn_liquidacion_preparar(uuid, uuid, date, text, numeric, numeric, numeric, boolean, uuid),
  rrhh.fn_liquidacion_proteger(), rrhh.fn_liquidacion_lineas_proteger(),
  rrhh.fn_planilla_prestamo_crear(uuid, uuid, uuid, text, numeric, integer, date, text, text, date)
from public, anon, authenticated;

revoke all on function
  public.planilla_vacaciones_registrar(uuid, uuid, text, date, date, numeric, text),
  public.planilla_vacaciones_aprobar(uuid, uuid), public.planilla_vacaciones_rechazar(uuid, uuid, text),
  public.planilla_vacaciones_anular(uuid, uuid, text), public.planilla_vacaciones_saldos(uuid, date),
  public.planilla_vacaciones_movimientos(uuid, uuid, text),
  public.planilla_prestamo_crear(uuid, uuid, text, numeric, integer, date, text, text),
  public.planilla_prestamo_anular(uuid, uuid, text), public.planilla_prestamo_cancelar(uuid, uuid, text),
  public.planilla_prestamos_saldos(uuid), public.planilla_prestamo_cuotas(uuid, uuid),
  public.planilla_embargo_crear(uuid, uuid, text, text, numeric, numeric, text, date, date, text),
  public.planilla_embargo_terminar(uuid, uuid, date, text), public.planilla_embargos_saldos(uuid),
  public.planilla_liquidacion_crear(uuid, uuid, date, text, numeric, numeric, text),
  public.planilla_liquidacion_recalcular(uuid, uuid), public.planilla_liquidacion_aprobar(uuid, uuid),
  public.planilla_liquidacion_pagar(uuid, uuid, text, text, date), public.planilla_liquidacion_anular(uuid, uuid, text),
  public.planilla_liquidaciones_listado(uuid), public.planilla_liquidacion_detalle(uuid, uuid),
  public.planilla_pasivo_laboral(uuid, date), public.planilla_provisiones_generar(uuid, date)
from public, anon;
grant execute on function
  public.planilla_vacaciones_registrar(uuid, uuid, text, date, date, numeric, text),
  public.planilla_vacaciones_aprobar(uuid, uuid), public.planilla_vacaciones_rechazar(uuid, uuid, text),
  public.planilla_vacaciones_anular(uuid, uuid, text), public.planilla_vacaciones_saldos(uuid, date),
  public.planilla_vacaciones_movimientos(uuid, uuid, text),
  public.planilla_prestamo_crear(uuid, uuid, text, numeric, integer, date, text, text),
  public.planilla_prestamo_anular(uuid, uuid, text), public.planilla_prestamo_cancelar(uuid, uuid, text),
  public.planilla_prestamos_saldos(uuid), public.planilla_prestamo_cuotas(uuid, uuid),
  public.planilla_embargo_crear(uuid, uuid, text, text, numeric, numeric, text, date, date, text),
  public.planilla_embargo_terminar(uuid, uuid, date, text), public.planilla_embargos_saldos(uuid),
  public.planilla_liquidacion_crear(uuid, uuid, date, text, numeric, numeric, text),
  public.planilla_liquidacion_recalcular(uuid, uuid), public.planilla_liquidacion_aprobar(uuid, uuid),
  public.planilla_liquidacion_pagar(uuid, uuid, text, text, date), public.planilla_liquidacion_anular(uuid, uuid, text),
  public.planilla_liquidaciones_listado(uuid), public.planilla_liquidacion_detalle(uuid, uuid),
  public.planilla_pasivo_laboral(uuid, date), public.planilla_provisiones_generar(uuid, date)
to authenticated;

-- -----------------------------------------------------------------------------
-- 13. Poscheques
-- -----------------------------------------------------------------------------
do $$
declare
  v_t text;
  v_f text;
  e record;
begin
  for e in select distinct company_id from rrhh.conceptos where codigo = 'SALARIO' loop
    if (select count(*) from rrhh.conceptos where company_id = e.company_id
        and codigo in ('PRESTAMO', 'EMBARGO_ALIMENTOS', 'EMBARGO_JUDICIAL', 'VACACIONES_PAGADAS', 'AGUINALDO')) <> 5 then
      raise exception 'postcheck: faltan conceptos de PL2b';
    end if;
  end loop;
  if exists (select 1 from (select distinct company_id from rrhh.planilla_tipos where clase = 'ordinaria') o
             where not exists (select 1 from rrhh.planilla_tipos t where t.company_id = o.company_id
                               and t.clase = 'aguinaldo' and t.activo)) then
    raise exception 'postcheck: falta el tipo de planilla de aguinaldo';
  end if;
  if (select count(*) from core.tablas_particionadas where schema_nombre = 'rrhh'
      and tabla_nombre in ('provisiones', 'vacaciones_movimientos')) <> 2 then
    raise exception 'postcheck: provisiones o vacaciones_movimientos no quedaron registradas como particionadas';
  end if;
  if exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
             where n.nspname = 'rrhh' and c.relkind in ('r', 'p')
               and (c.relname in ('liquidaciones', 'liquidacion_lineas', 'prestamos', 'embargos')
                    or c.relname like 'provisiones%' or c.relname like 'vacaciones\_movimientos%')
               and not c.relrowsecurity) then
    raise exception 'postcheck: hay una tabla o partición de PL2b sin RLS';
  end if;
  foreach v_t in array array['liquidaciones', 'liquidacion_lineas', 'vacaciones_movimientos', 'prestamos', 'embargos',
                             'provisiones', 'novedades', 'planilla_lineas'] loop
    if has_table_privilege('authenticated', 'rrhh.' || v_t, 'INSERT') or has_table_privilege('authenticated', 'rrhh.' || v_t, 'UPDATE')
       or has_table_privilege('authenticated', 'rrhh.' || v_t, 'DELETE') or has_table_privilege('anon', 'rrhh.' || v_t, 'SELECT')
       or not has_table_privilege('authenticated', 'rrhh.' || v_t, 'SELECT') then
      raise exception 'postcheck: privilegios incorrectos en rrhh.%', v_t;
    end if;
  end loop;
  foreach v_f in array array[
      'public.planilla_vacaciones_registrar(uuid,uuid,text,date,date,numeric,text)', 'public.planilla_vacaciones_aprobar(uuid,uuid)',
      'public.planilla_vacaciones_rechazar(uuid,uuid,text)', 'public.planilla_vacaciones_anular(uuid,uuid,text)',
      'public.planilla_vacaciones_saldos(uuid,date)', 'public.planilla_vacaciones_movimientos(uuid,uuid,text)',
      'public.planilla_prestamo_crear(uuid,uuid,text,numeric,integer,date,text,text)', 'public.planilla_prestamo_anular(uuid,uuid,text)',
      'public.planilla_prestamo_cancelar(uuid,uuid,text)', 'public.planilla_prestamos_saldos(uuid)',
      'public.planilla_prestamo_cuotas(uuid,uuid)',
      'public.planilla_embargo_crear(uuid,uuid,text,text,numeric,numeric,text,date,date,text)',
      'public.planilla_embargo_terminar(uuid,uuid,date,text)', 'public.planilla_embargos_saldos(uuid)',
      'public.planilla_liquidacion_crear(uuid,uuid,date,text,numeric,numeric,text)', 'public.planilla_liquidacion_recalcular(uuid,uuid)',
      'public.planilla_liquidacion_aprobar(uuid,uuid)', 'public.planilla_liquidacion_pagar(uuid,uuid,text,text,date)',
      'public.planilla_liquidacion_anular(uuid,uuid,text)', 'public.planilla_liquidaciones_listado(uuid)',
      'public.planilla_liquidacion_detalle(uuid,uuid)', 'public.planilla_pasivo_laboral(uuid,date)',
      'public.planilla_provisiones_generar(uuid,date)', 'public.planilla_crear(uuid,uuid,date,date,date,uuid)',
      'public.planilla_anular(uuid,uuid,text)', 'public.planilla_novedad_crear(uuid,uuid,uuid,date,numeric,numeric,text,uuid,uuid)',
      'public.planilla_novedad_anular(uuid,uuid)', 'public.planilla_liquidacion_simular(uuid,uuid,date,text,numeric,numeric,numeric)',
      'public.planilla_regimen_cambiar(uuid,uuid,text,text,text,numeric,boolean,boolean,boolean,date,text)',
      'public.planilla_parametro_vigencia_nueva(uuid,text,numeric,date,text,text)'] loop
    if has_function_privilege('anon', v_f, 'EXECUTE') or not has_function_privilege('authenticated', v_f, 'EXECUTE') then
      raise exception 'postcheck: EXECUTE incorrecto en %', v_f;
    end if;
  end loop;
  foreach v_f in array array[
      'rrhh.fn_planilla_calcular_nucleo(uuid,uuid)', 'rrhh.fn_planilla_calcular_aguinaldo(uuid,uuid)',
      'rrhh.fn_planilla_novedades(uuid)', 'rrhh.fn_planilla_contratos(uuid)', 'rrhh.fn_planilla_huella_insumos(uuid)',
      'rrhh.fn_liquidacion_calcular(uuid,numeric,date,date,text,boolean,numeric,numeric,numeric,boolean,boolean,boolean,date)',
      'rrhh.fn_liquidacion_preparar(uuid,uuid,date,text,numeric,numeric,numeric,boolean,uuid)',
      'rrhh.fn_vacaciones_saldo(uuid,date)', 'rrhh.fn_planilla_pasivo(uuid,date)',
      'rrhh.fn_planilla_aguinaldo_dias(uuid,date,date)', 'rrhh.fn_planilla_aguinaldo_periodo(uuid,date)',
      'rrhh.fn_planilla_meses_regimen(uuid,date,date,text,numeric)', 'rrhh.fn_meses_comerciales(date,date,numeric)',
      'rrhh.fn_planilla_fin_periodo(date,text)', 'rrhh.fn_asegurar_particion_provisiones(date)',
      'rrhh.fn_asegurar_particion_vacaciones_movimientos(date)',
      'rrhh.fn_planilla_prestamo_crear(uuid,uuid,uuid,text,numeric,integer,date,text,text,date)'] loop
    if has_function_privilege('authenticated', v_f, 'EXECUTE') or has_function_privilege('anon', v_f, 'EXECUTE') then
      raise exception 'postcheck: el núcleo % es ejecutable por la API', v_f;
    end if;
  end loop;
end;
$$;
