-- =============================================================================
-- PL2b de Planilla, parte 4 de 5: RPC de PL2a que cambian y RPC de vacaciones
-- El detalle, la aprobación del usuario y el rollback están en la parte 1.
-- Se dividió para aplicarla en nexo-core por partes; en PGlite corre en orden.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 7. RPC de PL2a que cambian
-- -----------------------------------------------------------------------------
create or replace function public.planilla_crear(
  p_company_id uuid, p_planilla_tipo_id uuid, p_periodo_inicio date, p_periodo_fin date,
  p_fecha_pago date default null, p_reemplaza_a uuid default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := core.fn_exigir_permiso(p_company_id, 'rrhh.planillas.planilla.generar');
  t rrhh.planilla_tipos;
  v_ultimo date;
  v_ag_ini date;
  v_ag_fin date;
  v_id uuid;
begin
  if p_periodo_inicio is null or p_periodo_fin is null or p_periodo_fin < p_periodo_inicio then
    raise exception 'Indica un período válido.';
  end if;
  select * into t from rrhh.planilla_tipos where id = p_planilla_tipo_id and company_id = p_company_id and activo;
  if not found then
    raise exception 'Tipo de planilla no encontrado.';
  end if;
  if t.clase = 'aguinaldo' then
    select x.ini, x.fin into v_ag_ini, v_ag_fin from rrhh.fn_planilla_aguinaldo_periodo(p_company_id, p_periodo_fin) x;
    if p_periodo_inicio <> v_ag_ini or p_periodo_fin <> v_ag_fin then
      raise exception 'El período del aguinaldo va del % al %.', to_char(v_ag_ini, 'YYYY-MM-DD'), to_char(v_ag_fin, 'YYYY-MM-DD');
    end if;
  else
    v_ultimo := (date_trunc('month', p_periodo_inicio) + interval '1 month - 1 day')::date;
    if (t.frecuencia = 'mensual' and not (extract(day from p_periodo_inicio) = 1 and p_periodo_fin = v_ultimo))
       or (t.frecuencia = 'quincenal' and not (
            (extract(day from p_periodo_inicio) = 1 and p_periodo_fin = p_periodo_inicio + 14)
            or (extract(day from p_periodo_inicio) = 16 and p_periodo_fin = v_ultimo)))
       or (t.frecuencia = 'semanal' and p_periodo_fin <> p_periodo_inicio + 6) then
      raise exception 'El período no corresponde a una planilla %.', t.frecuencia;
    end if;
  end if;
  if p_fecha_pago is not null and p_fecha_pago < p_periodo_inicio then
    raise exception 'La fecha de pago no puede ser anterior al período.';
  end if;
  if p_reemplaza_a is not null and not exists (
       select 1 from rrhh.planillas q where q.id = p_reemplaza_a and q.company_id = p_company_id and q.estado = 'anulada'
         and q.planilla_tipo_id = p_planilla_tipo_id and q.periodo_inicio = p_periodo_inicio and q.periodo_fin = p_periodo_fin) then
    raise exception 'Solo se reemplaza una planilla anulada del mismo tipo y período.';
  end if;
  if exists (select 1 from rrhh.planillas q where q.company_id = p_company_id and q.planilla_tipo_id = p_planilla_tipo_id
             and q.periodo_inicio = p_periodo_inicio and q.periodo_fin = p_periodo_fin and q.estado <> 'anulada') then
    raise exception 'Ya existe una planilla de este tipo para ese período.';
  end if;
  perform rrhh.fn_planilla_parametro(p_company_id, 'dias_mes_comercial', p_periodo_fin);
  perform rrhh.fn_asegurar_particion_planilla_lineas(p_periodo_fin);

  begin
    insert into rrhh.planillas (company_id, planilla_tipo_id, periodo_inicio, periodo_fin, fecha_pago, estado, total,
                                generada_por, generada_en, reemplaza_a)
    values (p_company_id, p_planilla_tipo_id, p_periodo_inicio, p_periodo_fin, p_fecha_pago, 'borrador', 0,
            v_uid, now(), p_reemplaza_a)
    returning id into v_id;
  exception when unique_violation then
    raise exception 'Ya existe una planilla de este tipo para ese período, o esa anulada ya tiene reemplazo.';
  end;
  perform core.fn_auditar(v_uid, p_company_id, 'rrhh.planilla.creada', 'rrhh.planillas', v_id::text,
    jsonb_build_object('tipo', p_planilla_tipo_id, 'clase', t.clase, 'inicio', p_periodo_inicio, 'fin', p_periodo_fin,
                       'reemplaza_a', p_reemplaza_a));
  return v_id;
end;
$$;

create or replace function public.planilla_anular(p_company_id uuid, p_planilla_id uuid, p_motivo text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := core.fn_exigir_permiso(p_company_id, 'rrhh.planillas.planilla.anular');
  p rrhh.planillas;
begin
  if p_motivo is null or length(btrim(p_motivo)) not between 5 and 500 then
    raise exception 'Indica el motivo de la anulación (5 a 500 caracteres).';
  end if;
  select * into p from rrhh.planillas where id = p_planilla_id and company_id = p_company_id for update;
  if not found then
    raise exception 'Planilla no encontrada.';
  end if;
  if p.estado = 'pagada' then
    raise exception 'Una planilla pagada no se anula. La corrección de un pago está pendiente de definir con el contador.';
  elsif p.estado = 'anulada' then
    raise exception 'La planilla ya está anulada.';
  end if;
  -- El IR de la 2.ª quincena usa la 1.ª: no se anula la 1.ª mientras la 2.ª siga viva.
  if exists (select 1 from rrhh.planillas q where q.company_id = p.company_id and q.planilla_tipo_id = p.planilla_tipo_id
             and q.estado in ('calculada', 'aprobada', 'pagada') and q.periodo_inicio > p.periodo_fin
             and date_trunc('month', q.periodo_inicio) = date_trunc('month', p.periodo_inicio)) then
    raise exception 'Anula primero la planilla de la segunda quincena: su IR depende de esta.';
  end if;
  -- Libera las novedades, también las cuotas vencidas que tomó de períodos anteriores.
  update rrhh.novedades set estado = 'pendiente', planilla_id = null
  where planilla_id = p.id and estado = 'aplicada' and fecha <= p.periodo_fin;
  update rrhh.planillas set estado = 'anulada', anulada_por = v_uid, anulada_en = now(),
    motivo_anulacion = btrim(p_motivo), updated_at = now()
  where id = p.id;
  perform core.fn_auditar(v_uid, p_company_id, 'rrhh.planilla.anulada', 'rrhh.planillas', p.id::text,
    jsonb_build_object('estado_anterior', p.estado));
end;
$$;

create or replace function public.planilla_novedad_crear(
  p_company_id uuid, p_contrato_id uuid, p_concepto_id uuid, p_fecha date,
  p_cantidad numeric default null, p_monto numeric default null, p_nota text default null,
  p_planilla_tipo_id uuid default null, p_clave uuid default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := core.fn_exigir_permiso(p_company_id, 'rrhh.planillas.movimientos.crear');
  c record;
  co rrhh.conceptos;
  v_id uuid;
begin
  if p_fecha is null then
    raise exception 'Indica la fecha de la novedad.';
  end if;
  -- Reintento con la misma clave (Mobile): devuelve la novedad ya creada.
  if p_clave is not null then
    select n.id into v_id from rrhh.novedades n
    where n.company_id = p_company_id and n.clave_idempotencia = p_clave and n.fecha = p_fecha;
    if v_id is not null then
      if not exists (select 1 from rrhh.novedades n where n.id = v_id and n.fecha = p_fecha
                     and n.contrato_id = p_contrato_id and n.concepto_id = p_concepto_id) then
        raise exception 'Esa clave ya se usó para otra novedad.';
      end if;
      return v_id;
    end if;
  end if;
  select ct.id, ct.empleado_id, ct.estado, ct.fecha_inicio, ct.fecha_fin_real, cc.frecuencia_pago into c
  from rrhh.contratos ct left join rrhh.contrato_compensacion cc on cc.contrato_id = ct.id
  where ct.id = p_contrato_id and ct.company_id = p_company_id;
  if not found or c.estado not in ('activo', 'finalizado') then
    raise exception 'Contrato no encontrado o no vigente.';
  end if;
  if (c.fecha_inicio is not null and p_fecha < c.fecha_inicio) or (c.fecha_fin_real is not null and p_fecha > c.fecha_fin_real) then
    raise exception 'La fecha está fuera de la vigencia del contrato.';
  end if;
  select * into co from rrhh.conceptos where id = p_concepto_id and company_id = p_company_id and activo and permite_novedad;
  if not found then
    raise exception 'Concepto no encontrado o no admite novedades.';
  end if;
  if co.metodo in ('horas', 'dias') then
    if p_cantidad is null or p_monto is not null or p_cantidad <= 0 or p_cantidad > (case co.metodo when 'horas' then 24 else 31 end) then
      raise exception 'Indica una cantidad válida de %.', co.metodo;
    end if;
  elsif p_monto is null or p_cantidad is not null or p_monto <= 0 or p_monto >= 100000000 then
    raise exception 'Indica un monto válido.';
  end if;
  if p_nota is not null and length(p_nota) > 300 then
    raise exception 'La nota es demasiado larga.';
  end if;
  if p_planilla_tipo_id is not null and not exists (
       select 1 from rrhh.planilla_tipos pt where pt.id = p_planilla_tipo_id and pt.company_id = p_company_id
         and pt.clase = 'ordinaria' and pt.frecuencia = c.frecuencia_pago) then
    raise exception 'Tipo de planilla no encontrado o de otra frecuencia que el contrato.';
  end if;
  -- Un día de vacaciones aprobadas no es ausencia. Mismo candado que
  -- planilla_vacaciones_aprobar (contrato, después planillas): no hay carrera.
  if co.codigo = 'AUSENCIA' then
    perform 1 from rrhh.contratos where id = p_contrato_id and company_id = p_company_id for no key update;
    if exists (select 1 from rrhh.vacaciones_movimientos v
               where v.company_id = p_company_id and v.contrato_id = p_contrato_id and v.tipo = 'goce'
                 and v.estado = 'aprobada' and v.fecha_inicio <= p_fecha and v.fecha_fin >= p_fecha) then
      raise exception 'El % el contrato tiene vacaciones aprobadas: no es una ausencia.', to_char(p_fecha, 'DD/MM/YYYY');
    end if;
  end if;
  -- Bloquea las planillas de esa fecha frente a una aprobación concurrente.
  perform 1 from rrhh.planillas q where q.company_id = p_company_id and q.estado <> 'anulada'
    and p_fecha between q.periodo_inicio and q.periodo_fin for share;
  if exists (select 1 from rrhh.planillas q join rrhh.planilla_tipos pt on pt.id = q.planilla_tipo_id and pt.clase = 'ordinaria'
             where q.company_id = p_company_id and q.estado in ('aprobada', 'pagada')
               and p_fecha between q.periodo_inicio and q.periodo_fin
               and (p_planilla_tipo_id is null or q.planilla_tipo_id = p_planilla_tipo_id)
               and exists (select 1 from rrhh.planilla_empleados e where e.planilla_id = q.id and e.contrato_id = p_contrato_id)) then
    raise exception 'La planilla de esa fecha ya está aprobada. Registra la novedad en el período siguiente.';
  end if;
  perform rrhh.fn_asegurar_particion_novedades(p_fecha);
  begin
    insert into rrhh.novedades (fecha, company_id, contrato_id, empleado_id, concepto_id, planilla_tipo_id,
                                cantidad, monto, nota, clave_idempotencia, creado_por)
    values (p_fecha, p_company_id, p_contrato_id, c.empleado_id, p_concepto_id, p_planilla_tipo_id,
            p_cantidad, p_monto, nullif(btrim(p_nota), ''), p_clave, v_uid)
    returning id into v_id;
  exception when unique_violation then
    -- Dos reintentos simultáneos con la misma clave: gana el primero.
    select n.id into v_id from rrhh.novedades n
    where n.company_id = p_company_id and n.clave_idempotencia = p_clave and n.fecha = p_fecha;
    return v_id;
  end;
  perform core.fn_auditar(v_uid, p_company_id, 'rrhh.planilla.novedad_creada', 'rrhh.novedades', v_id::text,
    jsonb_build_object('contrato_id', p_contrato_id, 'concepto', co.codigo, 'fecha', p_fecha));
  return v_id;
end;
$$;

create or replace function public.planilla_novedad_anular(p_company_id uuid, p_novedad_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := core.fn_exigir_permiso(p_company_id, 'rrhh.planillas.movimientos.eliminar');
  n rrhh.novedades;
  v_fecha date;
begin
  -- Mismo orden de bloqueo que el cálculo (planilla y después novedad).
  select x.fecha into v_fecha from rrhh.novedades x where x.id = p_novedad_id and x.company_id = p_company_id;
  if v_fecha is null then
    raise exception 'Novedad no encontrada.';
  end if;
  perform 1 from rrhh.planillas q where q.company_id = p_company_id and q.estado <> 'anulada'
    and v_fecha between q.periodo_inicio and q.periodo_fin for share;
  select * into n from rrhh.novedades where id = p_novedad_id and company_id = p_company_id and fecha = v_fecha for update;
  if n.origen = 'prestamo' then
    raise exception 'Esta novedad es una cuota de préstamo: anúlala o cancélala desde Préstamos.';
  elsif n.origen = 'vacaciones' then
    raise exception 'Esta novedad es un pago de vacaciones: anúlalo desde Vacaciones.';
  end if;
  if n.estado = 'anulada' then
    raise exception 'La novedad ya está anulada.';
  end if;
  if n.planilla_id is not null and exists (select 1 from rrhh.planillas q where q.id = n.planilla_id
                                           and q.estado in ('aprobada', 'pagada')) then
    raise exception 'La novedad ya está en una planilla aprobada y no se anula.';
  end if;
  update rrhh.novedades set estado = 'anulada', planilla_id = null, anulada_por = v_uid, anulada_en = now(), updated_at = now()
  where id = n.id and fecha = n.fecha;
  perform core.fn_auditar(v_uid, p_company_id, 'rrhh.planilla.novedad_anulada', 'rrhh.novedades', n.id::text,
    jsonb_build_object('contrato_id', n.contrato_id, 'fecha', n.fecha));
end;
$$;

-- Régimen (PL2a) sin el bloqueo de la planilla de aguinaldo: solo las planillas
-- ordinarias impiden una fecha efectiva; una de aguinaldo aprobada o pagada
-- solo la impide si el cambio toca paga_aguinaldo (una calculada se invalida
-- por su huella y se recalcula).
create or replace function public.planilla_regimen_cambiar(
  p_company_id uuid, p_contrato_id uuid, p_regimen text, p_regimen_inss text, p_metodo_ir text,
  p_porcentaje_ir numeric, p_paga_vacaciones boolean, p_paga_aguinaldo boolean, p_paga_indemnizacion boolean,
  p_vigente_desde date, p_motivo text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := core.fn_exigir_permiso(p_company_id, 'rrhh.planillas.regimen.cambiar');
  c record;
  r rrhh.contrato_regimen;
  r_prev rrhh.contrato_regimen;
  v_corrige boolean := false;
  v_id uuid;
begin
  select ct.id, ct.empleado_id, ct.estado, ct.fecha_inicio, ct.fecha_fin_real into c
  from rrhh.contratos ct where ct.id = p_contrato_id and ct.company_id = p_company_id for no key update;
  if not found then
    raise exception 'Contrato no encontrado.';
  end if;
  if p_motivo is null or length(btrim(p_motivo)) not between 5 and 500 then
    raise exception 'Indica el motivo del cambio (5 a 500 caracteres).';
  end if;
  if p_vigente_desde is null or (c.fecha_inicio is not null and p_vigente_desde < c.fecha_inicio) then
    raise exception 'La fecha efectiva no puede ser anterior al inicio del contrato.';
  end if;
  if c.estado = 'finalizado' and p_vigente_desde > c.fecha_fin_real then
    raise exception 'El contrato ya terminó: la fecha efectiva debe estar dentro de su vigencia.';
  end if;
  if p_vigente_desde is distinct from c.fecha_inicio
     and (extract(day from p_vigente_desde) not in (1, 16)
          or (extract(day from p_vigente_desde) = 16 and exists (select 1 from rrhh.contrato_compensacion cc
                where cc.contrato_id = p_contrato_id and cc.frecuencia_pago = 'mensual'))) then
    raise exception 'La fecha efectiva debe ser el inicio del contrato o el inicio de un período (día 1, o 16 en quincenal).';
  end if;
  if p_regimen is null or p_regimen not in ('laboral', 'servicios_profesionales') then
    raise exception 'Régimen no válido.';
  elsif p_regimen = 'laboral' and not coalesce(p_regimen_inss in ('integral', 'ivm') and p_metodo_ir = 'tabla_progresiva'
       and p_porcentaje_ir is null and p_paga_vacaciones and p_paga_aguinaldo and p_paga_indemnizacion, false) then
    raise exception 'El régimen laboral lleva INSS integral o IVM, IR por tabla y todas las prestaciones.';
  elsif p_regimen = 'servicios_profesionales' and not coalesce(p_regimen_inss = 'ninguno'
       and ((p_metodo_ir = 'retencion_fija' and coalesce(p_porcentaje_ir between 0 and 1, false))
            or (p_metodo_ir = 'exento' and p_porcentaje_ir is null))
       and p_paga_vacaciones is not null and p_paga_aguinaldo is not null and p_paga_indemnizacion is not null, false) then
    raise exception 'Servicios profesionales va sin INSS, con retención fija (0 a 100%%) o exento de IR.';
  end if;
  if p_regimen_inss = 'ivm' and (select count(distinct pl.codigo) from rrhh.parametros_ley pl
                                 where pl.company_id = p_company_id and pl.codigo in ('inss_laboral_ivm', 'inss_patronal_ivm')
                                   and (pl.vigente_hasta is null or pl.vigente_hasta >= p_vigente_desde)) < 2 then
    raise exception 'El régimen IVM todavía no tiene tasas cargadas. Pídelas al contador.';
  end if;

  select * into r from rrhh.contrato_regimen where contrato_id = p_contrato_id and vigente_hasta is null;
  if r.id is not null and p_vigente_desde <= r.vigente_desde then
    -- Corrección: solo si ninguna planilla ordinaria viva, ni de aguinaldo aprobada, usó la vigencia abierta.
    if exists (select 1 from rrhh.planilla_empleados e join rrhh.planillas q on q.id = e.planilla_id
               join rrhh.planilla_tipos t on t.id = q.planilla_tipo_id
               where e.contrato_regimen_id = r.id and q.estado <> 'anulada'
                 and (t.clase = 'ordinaria' or q.estado in ('aprobada', 'pagada'))) then
      raise exception 'La vigencia actual ya se usó en una planilla. La nueva debe empezar después del %.',
        to_char(r.vigente_desde, 'YYYY-MM-DD');
    end if;
    select * into r_prev from rrhh.contrato_regimen where contrato_id = p_contrato_id and vigente_hasta = r.vigente_desde - 1;
    if r_prev.id is not null and p_vigente_desde <= r_prev.vigente_desde then
      raise exception 'La corrección debe empezar después del %.', to_char(r_prev.vigente_desde, 'YYYY-MM-DD');
    end if;
    v_corrige := true;
  end if;
  if exists (select 1 from rrhh.planilla_empleados e join rrhh.planillas q on q.id = e.planilla_id
             join rrhh.planilla_tipos t on t.id = q.planilla_tipo_id
             where e.contrato_id = p_contrato_id and q.estado in ('calculada', 'aprobada', 'pagada')
               and q.periodo_fin >= p_vigente_desde
               and (t.clase = 'ordinaria'
                    or (q.estado in ('aprobada', 'pagada') and p_paga_aguinaldo is distinct from coalesce(r.paga_aguinaldo, p_paga_aguinaldo)))) then
    raise exception 'Ya hay una planilla calculada o aprobada después de esa fecha con el régimen actual. Anúlala o elige otra fecha.';
  end if;

  if v_corrige then
    if r_prev.id is not null then
      update rrhh.contrato_regimen set vigente_hasta = p_vigente_desde - 1 where id = r_prev.id;
    end if;
    update rrhh.contrato_regimen set regimen = p_regimen, regimen_inss = p_regimen_inss, metodo_ir = p_metodo_ir,
      porcentaje_ir = p_porcentaje_ir, paga_vacaciones = p_paga_vacaciones, paga_aguinaldo = p_paga_aguinaldo,
      paga_indemnizacion = p_paga_indemnizacion, vigente_desde = p_vigente_desde, motivo = btrim(p_motivo),
      aprobado_por = v_uid, aviso_descartado_por = null, aviso_descartado_en = null, aviso_motivo = null
    where id = r.id;
    perform core.fn_auditar(v_uid, p_company_id, 'rrhh.planilla.regimen_corregido', 'rrhh.contrato_regimen', r.id::text,
      jsonb_build_object('contrato_id', p_contrato_id,
        'anterior', jsonb_build_object('regimen', r.regimen, 'regimen_inss', r.regimen_inss, 'metodo_ir', r.metodo_ir,
                                       'porcentaje_ir', r.porcentaje_ir, 'desde', r.vigente_desde),
        'nuevo', jsonb_build_object('regimen', p_regimen, 'desde', p_vigente_desde)));
    return r.id;
  end if;

  -- Nueva vigencia: queda abierta también en contratos finalizados (el motor la
  -- acota por la fecha de fin), y nunca se solapa con otra.
  if exists (select 1 from rrhh.contrato_regimen x where x.contrato_id = p_contrato_id
             and x.id is distinct from r.id and (x.vigente_hasta is null or x.vigente_hasta >= p_vigente_desde)) then
    raise exception 'La nueva vigencia se solaparía con otra del mismo contrato.';
  end if;
  if r.id is not null then
    update rrhh.contrato_regimen set vigente_hasta = p_vigente_desde - 1 where id = r.id;
  end if;
  insert into rrhh.contrato_regimen (company_id, contrato_id, empleado_id, regimen, regimen_inss, metodo_ir, porcentaje_ir,
    paga_vacaciones, paga_aguinaldo, paga_indemnizacion, vigente_desde, motivo, aprobado_por)
  values (p_company_id, p_contrato_id, c.empleado_id, p_regimen, p_regimen_inss, p_metodo_ir, p_porcentaje_ir,
    p_paga_vacaciones, p_paga_aguinaldo, p_paga_indemnizacion, p_vigente_desde, btrim(p_motivo), v_uid)
  returning id into v_id;
  perform core.fn_auditar(v_uid, p_company_id, 'rrhh.planilla.regimen_cambiado', 'rrhh.contrato_regimen', v_id::text,
    jsonb_build_object('contrato_id', p_contrato_id, 'anterior', r.regimen, 'nuevo', p_regimen, 'desde', p_vigente_desde));
  return v_id;
end;
$$;

-- Parámetros (PL2a): una planilla de aguinaldo aprobada solo impide la nueva
-- vigencia de los parámetros que el aguinaldo usa.
create or replace function public.planilla_parametro_vigencia_nueva(
  p_company_id uuid, p_codigo text, p_valor numeric, p_vigente_desde date, p_certeza text, p_fuente text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := core.fn_exigir_permiso(p_company_id, 'rrhh.planillas.parametros.editar');
  r rrhh.parametros_ley;
  v_id uuid;
begin
  select * into r from rrhh.parametros_ley where company_id = p_company_id and codigo = p_codigo and vigente_hasta is null for update;
  if not found then
    raise exception 'Parámetro no encontrado.';
  end if;
  if p_valor is null or p_valor < 0 or p_valor >= 100000000 or (r.unidad = 'porcentaje' and p_valor > 1)
     or (r.unidad = 'numero' and p_valor <= 0)
     or (p_codigo = 'aguinaldo_mes_inicio' and (p_valor <> trunc(p_valor) or p_valor not between 1 and 12))
     or (p_codigo = 'horas_extra_fraccion_minutos' and (p_valor <> trunc(p_valor) or p_valor not between 1 and 60)) then
    raise exception 'Indica un valor válido para %.', replace(p_codigo, '_', ' ');
  end if;
  if p_certeza is null or p_certeza not in ('oficial', 'coincidente', 'verificar') then
    raise exception 'Indica el grado de certeza: oficial, coincidente o verificar.';
  end if;
  if p_fuente is null or length(btrim(p_fuente)) not between 3 and 200 then
    raise exception 'Indica la fuente del valor (3 a 200 caracteres).';
  end if;
  if p_vigente_desde is null or p_vigente_desde <= r.vigente_desde then
    raise exception 'La nueva vigencia debe empezar después del %.', to_char(r.vigente_desde, 'YYYY-MM-DD');
  end if;
  if exists (select 1 from rrhh.planillas q join rrhh.planilla_tipos t on t.id = q.planilla_tipo_id
             where q.company_id = p_company_id and q.estado in ('aprobada', 'pagada') and q.periodo_fin >= p_vigente_desde
               and (t.clase = 'ordinaria' or p_codigo in ('aguinaldo_mes_inicio', 'aguinaldo_dias_por_mes', 'dias_mes_comercial'))) then
    raise exception 'Hay planillas aprobadas después de esa fecha. La nueva vigencia debe empezar después de ellas.';
  end if;
  update rrhh.parametros_ley set vigente_hasta = p_vigente_desde - 1 where id = r.id;
  insert into rrhh.parametros_ley (company_id, codigo, unidad, valor, vigente_desde, certeza, fuente, created_by)
  values (p_company_id, p_codigo, r.unidad, p_valor, p_vigente_desde, p_certeza, btrim(p_fuente), v_uid)
  returning id into v_id;
  perform core.fn_auditar(v_uid, p_company_id, 'rrhh.planilla.parametro_cambiado', 'rrhh.parametros_ley', v_id::text,
    jsonb_build_object('codigo', p_codigo, 'anterior', r.valor, 'nuevo', p_valor, 'desde', p_vigente_desde, 'certeza', p_certeza));
  return v_id;
end;
$$;

-- Simulador: con p_dias_vacaciones null usa el saldo registrado.
create or replace function public.planilla_liquidacion_simular(
  p_company_id uuid, p_contrato_id uuid, p_fecha_egreso date, p_causa text,
  p_dias_vacaciones numeric, p_dias_salario_pendiente numeric default 0, p_meses_confianza numeric default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid uuid := core.fn_exigir_permiso(p_company_id, 'rrhh.planillas.liquidaciones.calcular');
begin
  return rrhh.fn_liquidacion_preparar(p_company_id, p_contrato_id, p_fecha_egreso, p_causa,
    p_dias_salario_pendiente, p_meses_confianza, p_dias_vacaciones, false, null);
end;
$$;

-- -----------------------------------------------------------------------------
-- 8. RPC nuevas: vacaciones
-- -----------------------------------------------------------------------------
create or replace function public.planilla_vacaciones_registrar(
  p_company_id uuid, p_contrato_id uuid, p_tipo text, p_fecha_inicio date, p_fecha_fin date, p_dias numeric, p_motivo text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := core.fn_exigir_permiso(p_company_id, 'rrhh.planillas.vacaciones.registrar');
  c record;
  v_fin date;
  v_id uuid;
begin
  if p_tipo is null or p_tipo not in ('goce', 'pago', 'ajuste', 'saldo_inicial') then
    raise exception 'Tipo de movimiento no válido.';
  end if;
  if p_fecha_inicio is null then
    raise exception 'Indica la fecha.';
  end if;
  v_fin := case when p_tipo = 'goce' then p_fecha_fin else p_fecha_inicio end;
  if v_fin is null or v_fin < p_fecha_inicio then
    raise exception 'La fecha final no puede ser anterior a la inicial.';
  end if;
  if p_dias is null or abs(p_dias) >= 1000 or p_dias <> round(p_dias, 2)
     or (p_tipo = 'ajuste' and p_dias = 0) or (p_tipo in ('goce', 'pago') and p_dias <= 0)
     or (p_tipo = 'saldo_inicial' and p_dias < 0) then
    raise exception 'Indica una cantidad de días válida (hasta dos decimales).';
  end if;
  if p_tipo = 'goce' and p_dias > v_fin - p_fecha_inicio + 1 then
    raise exception 'Los días no pueden ser más que los del rango de fechas.';
  end if;
  if p_tipo in ('ajuste', 'saldo_inicial') and (p_motivo is null or length(btrim(p_motivo)) not between 5 and 500) then
    raise exception 'Indica el motivo (5 a 500 caracteres).';
  end if;
  if p_motivo is not null and length(p_motivo) > 500 then
    raise exception 'El motivo es demasiado largo.';
  end if;
  -- Contrato bloqueado: serializa los movimientos del contrato (saldo inicial único).
  select ct.id, ct.empleado_id, ct.estado, ct.fecha_inicio, ct.fecha_fin_real into c
  from rrhh.contratos ct where ct.id = p_contrato_id and ct.company_id = p_company_id for no key update;
  if not found or c.estado not in ('activo', 'finalizado') then
    raise exception 'Contrato no encontrado o no vigente.';
  end if;
  if p_fecha_inicio < c.fecha_inicio or (c.fecha_fin_real is not null and v_fin > c.fecha_fin_real) then
    raise exception 'Las fechas están fuera de la vigencia del contrato.';
  end if;
  if v_fin > (now() at time zone 'America/Managua')::date + 366 then
    raise exception 'La fecha no puede ser de más de un año adelante.';
  end if;
  if p_tipo = 'saldo_inicial' then
    if p_fecha_inicio > (now() at time zone 'America/Managua')::date then
      raise exception 'La fecha de corte del saldo inicial no puede ser futura.';
    end if;
    if exists (select 1 from rrhh.vacaciones_movimientos m where m.contrato_id = p_contrato_id
               and m.tipo = 'saldo_inicial' and m.estado in ('solicitada', 'aprobada')) then
      raise exception 'El contrato ya tiene un saldo inicial. Anúlalo para registrar otro.';
    end if;
    if exists (select 1 from rrhh.vacaciones_movimientos m where m.contrato_id = p_contrato_id
               and m.tipo <> 'saldo_inicial' and m.estado in ('solicitada', 'aprobada') and m.fecha_inicio <= p_fecha_inicio) then
      raise exception 'Hay movimientos de vacaciones hasta esa fecha de corte. El saldo inicial ya los incluye: anúlalos o usa otra fecha.';
    end if;
  elsif exists (select 1 from rrhh.vacaciones_movimientos m where m.contrato_id = p_contrato_id
                and m.tipo = 'saldo_inicial' and m.estado in ('solicitada', 'aprobada') and p_fecha_inicio <= m.fecha_inicio) then
    raise exception 'La fecha es anterior o igual al corte del saldo inicial, que ya incluye lo ocurrido hasta ese día.';
  end if;
  if p_tipo = 'goce' and exists (select 1 from rrhh.vacaciones_movimientos m where m.contrato_id = p_contrato_id
       and m.tipo = 'goce' and m.estado in ('solicitada', 'aprobada')
       and m.fecha_inicio <= v_fin and m.fecha_fin >= p_fecha_inicio) then
    raise exception 'Ya hay vacaciones registradas en esas fechas.';
  end if;
  perform rrhh.fn_asegurar_particion_vacaciones_movimientos(p_fecha_inicio);
  insert into rrhh.vacaciones_movimientos (company_id, contrato_id, empleado_id, tipo, fecha_inicio, fecha_fin, dias,
    motivo, registrado_por)
  values (p_company_id, p_contrato_id, c.empleado_id, p_tipo, p_fecha_inicio, v_fin, p_dias,
    nullif(btrim(p_motivo), ''), v_uid)
  returning id into v_id;
  perform core.fn_auditar(v_uid, p_company_id, 'rrhh.planilla.vacaciones_registradas', 'rrhh.vacaciones_movimientos', v_id::text,
    jsonb_build_object('contrato_id', p_contrato_id, 'tipo', p_tipo, 'dias', p_dias, 'desde', p_fecha_inicio));
  return v_id;
end;
$$;

create or replace function public.planilla_vacaciones_aprobar(p_company_id uuid, p_movimiento_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := core.fn_exigir_permiso(p_company_id, 'rrhh.planillas.vacaciones.aprobar');
  m rrhh.vacaciones_movimientos;
  co rrhh.conceptos;
  v_acum numeric;
  v_usado numeric;
  v_disponible numeric;
  v_nov uuid;
  v_aus date;
begin
  select * into m from rrhh.vacaciones_movimientos where id = p_movimiento_id and company_id = p_company_id;
  if not found then
    raise exception 'Movimiento no encontrado.';
  end if;
  -- Una aprobación a la vez por contrato: el saldo se revisa sin carreras.
  perform 1 from rrhh.contratos where id = m.contrato_id for no key update;
  select * into m from rrhh.vacaciones_movimientos where id = p_movimiento_id for update;
  if m.estado <> 'solicitada' then
    raise exception 'Solo se aprueba un movimiento solicitado. Este está %.', m.estado;
  end if;
  -- Separación de funciones (skill nexo-planilla-motor): quien registra no aprueba.
  if v_uid = m.registrado_por then
    raise exception 'Quien registra un movimiento de vacaciones no puede aprobarlo. Pide la aprobación a otra persona.';
  end if;
  if m.tipo in ('goce', 'pago') or (m.tipo = 'ajuste' and m.dias < 0) then
    -- Acumulado hasta la fecha del movimiento menos todo lo ya aprobado después
    -- del corte, aunque sea de otra fecha.
    select s.acumulado into v_acum from rrhh.fn_vacaciones_saldo(m.contrato_id, m.fecha_inicio) s;
    select coalesce(sum(case when x.tipo = 'ajuste' then -x.dias else x.dias end), 0) into v_usado
    from rrhh.vacaciones_movimientos x
    where x.contrato_id = m.contrato_id and x.estado = 'aprobada' and x.tipo <> 'saldo_inicial'
      and not exists (select 1 from rrhh.vacaciones_movimientos si where si.contrato_id = m.contrato_id
                      and si.tipo = 'saldo_inicial' and si.estado = 'aprobada' and x.fecha_inicio <= si.fecha_inicio);
    v_disponible := v_acum - v_usado;
    if v_disponible - abs(m.dias) < 0 then
      raise exception 'El saldo de vacaciones quedaría negativo: hay % días disponibles a esa fecha.',
        trim_scale(round(v_disponible, 2));
    end if;
  end if;
  -- Un día de vacaciones no se descuenta como ausencia: la ausencia se anula primero.
  if m.tipo = 'goce' then
    select n.fecha into v_aus
    from rrhh.novedades n join rrhh.conceptos ca on ca.id = n.concepto_id and ca.company_id = n.company_id
    where n.company_id = p_company_id and n.contrato_id = m.contrato_id and ca.codigo = 'AUSENCIA'
      and n.estado <> 'anulada' and n.fecha between m.fecha_inicio and m.fecha_fin
    order by n.fecha limit 1;
    if v_aus is not null then
      raise exception 'Hay una ausencia registrada el % en esas fechas. Anúlala en Novedades o cambia las fechas de las vacaciones.',
        to_char(v_aus, 'DD/MM/YYYY');
    end if;
  end if;
  if m.tipo = 'pago' then
    select * into co from rrhh.conceptos where company_id = p_company_id and codigo = 'VACACIONES_PAGADAS' and activo;
    if not found then
      raise exception 'Falta el concepto VACACIONES_PAGADAS activo en el catálogo.';
    end if;
    perform 1 from rrhh.planillas q where q.company_id = p_company_id and q.estado <> 'anulada'
      and m.fecha_inicio between q.periodo_inicio and q.periodo_fin for share;
    if exists (select 1 from rrhh.planillas q join rrhh.planilla_tipos pt on pt.id = q.planilla_tipo_id and pt.clase = 'ordinaria'
               where q.company_id = p_company_id and q.estado in ('aprobada', 'pagada')
                 and m.fecha_inicio between q.periodo_inicio and q.periodo_fin
                 and exists (select 1 from rrhh.planilla_empleados e where e.planilla_id = q.id and e.contrato_id = m.contrato_id)) then
      raise exception 'La planilla de esa fecha ya está aprobada. Registra el pago con una fecha del período siguiente.';
    end if;
    perform rrhh.fn_asegurar_particion_novedades(m.fecha_inicio);
    insert into rrhh.novedades (fecha, company_id, contrato_id, empleado_id, concepto_id, cantidad, nota, origen,
                                vacaciones_movimiento_id, creado_por)
    values (m.fecha_inicio, p_company_id, m.contrato_id, m.empleado_id, co.id, m.dias, 'Vacaciones pagadas', 'vacaciones',
            m.id, v_uid)
    returning id into v_nov;
  end if;
  update rrhh.vacaciones_movimientos set estado = 'aprobada', aprobado_por = v_uid, aprobado_en = now(),
    novedad_id = v_nov, novedad_fecha = case when v_nov is not null then m.fecha_inicio end, updated_at = now()
  where id = m.id;
  perform core.fn_auditar(v_uid, p_company_id, 'rrhh.planilla.vacaciones_aprobadas', 'rrhh.vacaciones_movimientos', m.id::text,
    jsonb_build_object('contrato_id', m.contrato_id, 'tipo', m.tipo, 'dias', m.dias));
end;
$$;

create or replace function public.planilla_vacaciones_rechazar(p_company_id uuid, p_movimiento_id uuid, p_motivo text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := core.fn_exigir_permiso(p_company_id, 'rrhh.planillas.vacaciones.aprobar');
  m rrhh.vacaciones_movimientos;
begin
  if p_motivo is null or length(btrim(p_motivo)) not between 5 and 500 then
    raise exception 'Indica el motivo del rechazo (5 a 500 caracteres).';
  end if;
  select * into m from rrhh.vacaciones_movimientos where id = p_movimiento_id and company_id = p_company_id for update;
  if not found then
    raise exception 'Movimiento no encontrado.';
  end if;
  if m.estado <> 'solicitada' then
    raise exception 'Solo se rechaza un movimiento solicitado. Este está %.', m.estado;
  end if;
  update rrhh.vacaciones_movimientos set estado = 'rechazada', rechazo_motivo = btrim(p_motivo),
    aprobado_por = v_uid, aprobado_en = now(), updated_at = now()
  where id = m.id;
  perform core.fn_auditar(v_uid, p_company_id, 'rrhh.planilla.vacaciones_rechazadas', 'rrhh.vacaciones_movimientos', m.id::text,
    jsonb_build_object('contrato_id', m.contrato_id, 'tipo', m.tipo));
end;
$$;

create or replace function public.planilla_vacaciones_anular(p_company_id uuid, p_movimiento_id uuid, p_motivo text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := core.fn_exigir_permiso(p_company_id, 'rrhh.planillas.vacaciones.aprobar');
  m rrhh.vacaciones_movimientos;
  n rrhh.novedades;
  v_ultima date;
begin
  if p_motivo is null or length(btrim(p_motivo)) not between 5 and 500 then
    raise exception 'Indica el motivo de la anulación (5 a 500 caracteres).';
  end if;
  select * into m from rrhh.vacaciones_movimientos where id = p_movimiento_id and company_id = p_company_id for update;
  if not found then
    raise exception 'Movimiento no encontrado.';
  end if;
  if m.tipo = 'liquidacion' then
    raise exception 'Las vacaciones de una liquidación se anulan con la liquidación.';
  end if;
  if m.estado not in ('solicitada', 'aprobada') then
    raise exception 'El movimiento está % y no se anula.', m.estado;
  end if;
  if m.novedad_id is not null then
    perform 1 from rrhh.planillas q where q.company_id = p_company_id and q.estado <> 'anulada'
      and m.novedad_fecha between q.periodo_inicio and q.periodo_fin for share;
    select * into n from rrhh.novedades where id = m.novedad_id and fecha = m.novedad_fecha for update;
    if n.planilla_id is not null and exists (select 1 from rrhh.planillas q where q.id = n.planilla_id
                                             and q.estado in ('aprobada', 'pagada')) then
      raise exception 'Ese pago ya está en una planilla aprobada y no se anula.';
    end if;
    update rrhh.novedades set estado = 'anulada', planilla_id = null, anulada_por = v_uid, anulada_en = now(), updated_at = now()
    where id = n.id and fecha = n.fecha;
  end if;
  update rrhh.vacaciones_movimientos set estado = 'anulada', anulado_por = v_uid, anulado_en = now(),
    rechazo_motivo = coalesce(rechazo_motivo, btrim(p_motivo)), updated_at = now()
  where id = m.id;
  -- Quitar días a favor no puede dejar en negativo ningún goce, pago o ajuste
  -- negativo ya aprobado: se revisa el saldo en la fecha de cada uno.
  if m.estado = 'aprobada' and (m.tipo = 'saldo_inicial' or (m.tipo = 'ajuste' and m.dias > 0)) then
    select min(x.fecha_inicio) into v_ultima from rrhh.vacaciones_movimientos x
    where x.contrato_id = m.contrato_id and x.estado = 'aprobada'
      and (x.tipo in ('goce', 'pago', 'liquidacion') or (x.tipo = 'ajuste' and x.dias < 0))
      and (select s.saldo from rrhh.fn_vacaciones_saldo(m.contrato_id, x.fecha_inicio) s) < 0;
    if v_ultima is not null then
      raise exception 'Al anularlo, el saldo de vacaciones quedaría negativo el %. Anula primero los goces o pagos que dependen de él.',
        to_char(v_ultima, 'YYYY-MM-DD');
    end if;
  end if;
  perform core.fn_auditar(v_uid, p_company_id, 'rrhh.planilla.vacaciones_anuladas', 'rrhh.vacaciones_movimientos', m.id::text,
    jsonb_build_object('contrato_id', m.contrato_id, 'tipo', m.tipo, 'estado_anterior', m.estado, 'motivo', btrim(p_motivo)));
end;
$$;

create or replace function public.planilla_vacaciones_saldos(p_company_id uuid, p_fecha date default null)
returns table (contrato_id uuid, empleado_id uuid, numero_contrato bigint, empleado_nombre text, estado_contrato text,
               fecha_corte date, acumulado numeric, gozado numeric, pagado numeric, ajustes numeric, liquidado numeric,
               saldo numeric, salario_diario numeric, valor numeric)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid uuid := core.fn_exigir_permiso(p_company_id, 'rrhh.planillas.vacaciones.ver');
  v_fecha date := coalesce(p_fecha, (now() at time zone 'America/Managua')::date);
  v_dias_mes numeric := rrhh.fn_planilla_parametro(p_company_id, 'dias_mes_comercial', v_fecha);
  -- El supervisor de asistencia ve días, no salarios.
  v_ver_salario boolean := core.has_permission(v_uid, p_company_id, 'rrhh.planillas.planilla.ver')
                           or core.has_permission(v_uid, p_company_id, 'rrhh.expedientes.compensacion.ver');
begin
  return query
  select c.id, c.empleado_id, c.numero_contrato, e.nombre || ' ' || e.apellido, c.estado,
         s.fecha_corte, s.acumulado, s.gozado, s.pagado, s.ajustes, s.liquidado, s.saldo,
         case when v_ver_salario then round(cc.salario_base / v_dias_mes, 4) end,
         case when v_ver_salario then round(greatest(0, s.saldo) * round(cc.salario_base / v_dias_mes, 4), 2) end
  from rrhh.contratos c
  join rrhh.empleados e on e.id = c.empleado_id
  left join rrhh.contrato_compensacion cc on cc.contrato_id = c.id
  cross join lateral rrhh.fn_vacaciones_saldo(c.id, v_fecha) s
  where c.company_id = p_company_id and c.estado in ('activo', 'finalizado') and c.fecha_inicio is not null
    and (c.estado = 'activo' or not exists (select 1 from rrhh.liquidaciones l where l.contrato_id = c.id
                                            and l.estado in ('aprobada', 'pagada')))
  order by c.estado, e.nombre, e.apellido, c.numero_contrato;
end;
$$;

create or replace function public.planilla_vacaciones_movimientos(p_company_id uuid, p_contrato_id uuid default null,
  p_estado text default null)
returns table (id uuid, contrato_id uuid, numero_contrato bigint, empleado_nombre text, tipo text, fecha_inicio date,
               fecha_fin date, dias numeric, estado text, motivo text, registrado_por uuid, registrado_en timestamptz,
               aprobado_por uuid, aprobado_en timestamptz, rechazo_motivo text)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid uuid := core.fn_exigir_permiso(p_company_id, 'rrhh.planillas.vacaciones.ver');
begin
  if p_estado is not null and p_estado not in ('solicitada', 'aprobada', 'rechazada', 'anulada') then
    raise exception 'Estado no válido.';
  end if;
  return query
  select m.id, m.contrato_id, c.numero_contrato, e.nombre || ' ' || e.apellido, m.tipo, m.fecha_inicio, m.fecha_fin,
         m.dias, m.estado, m.motivo, m.registrado_por, m.registrado_en, m.aprobado_por, m.aprobado_en, m.rechazo_motivo
  from rrhh.vacaciones_movimientos m
  join rrhh.contratos c on c.id = m.contrato_id
  join rrhh.empleados e on e.id = m.empleado_id
  where m.company_id = p_company_id
    and (p_contrato_id is null or m.contrato_id = p_contrato_id)
    and (p_estado is null or m.estado = p_estado)
  order by m.fecha_inicio desc, m.registrado_en desc
  limit 1000;
end;
$$;

-- RPC nuevas de esta parte: solo authenticated.
revoke all on function
  public.planilla_vacaciones_registrar(uuid, uuid, text, date, date, numeric, text),
  public.planilla_vacaciones_aprobar(uuid, uuid),
  public.planilla_vacaciones_rechazar(uuid, uuid, text),
  public.planilla_vacaciones_anular(uuid, uuid, text),
  public.planilla_vacaciones_saldos(uuid, date),
  public.planilla_vacaciones_movimientos(uuid, uuid, text)
from public, anon;
grant execute on function
  public.planilla_vacaciones_registrar(uuid, uuid, text, date, date, numeric, text),
  public.planilla_vacaciones_aprobar(uuid, uuid),
  public.planilla_vacaciones_rechazar(uuid, uuid, text),
  public.planilla_vacaciones_anular(uuid, uuid, text),
  public.planilla_vacaciones_saldos(uuid, date),
  public.planilla_vacaciones_movimientos(uuid, uuid, text)
to authenticated;
