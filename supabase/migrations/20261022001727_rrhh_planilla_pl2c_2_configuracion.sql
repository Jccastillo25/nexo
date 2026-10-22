-- =============================================================================
-- PL2c de Planilla, parte 2 de 3: conceptos, tipos de planilla y tabla de IR
-- El detalle, la aprobación del usuario y el rollback están en la parte 1.
-- Se dividió para aplicarla en nexo-core por partes; en PGlite corre en orden.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 7. Conceptos
-- -----------------------------------------------------------------------------
-- p_concepto_id null crea. En un concepto del sistema solo cambian nombre,
-- en_colilla y cuenta_contable. En uno propio usado en una planilla aprobada o
-- pagada solo cambian nombre, orden, en_colilla, permite_novedad,
-- cuenta_contable y activo. El código de un concepto ya usado (en líneas o
-- novedades) no cambia.
create function public.planilla_concepto_guardar(
  p_company_id uuid, p_concepto_id uuid, p_codigo text, p_nombre text, p_tipo text, p_metodo text,
  p_afecta_inss boolean, p_afecta_ir boolean, p_afecta_inatec boolean, p_cuenta_aguinaldo boolean,
  p_cuenta_vacaciones boolean, p_cuenta_indemnizacion boolean, p_en_colilla boolean, p_permite_novedad boolean,
  p_orden integer, p_cuenta_contable text, p_activo boolean)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := core.fn_exigir_permiso(p_company_id, 'rrhh.planillas.conceptos.gestionar');
  v_codigo text := upper(btrim(coalesce(p_codigo, '')));
  v_nombre text := btrim(coalesce(p_nombre, ''));
  v_cuenta text := nullif(btrim(coalesce(p_cuenta_contable, '')), '');
  c rrhh.conceptos;
  v_reglas boolean := true;
  v_id uuid;
  v_invalidadas integer := 0;
begin
  if v_codigo !~ '^[A-Z][A-Z0-9_]{1,39}$' then
    raise exception 'El código va en mayúsculas y sin espacios: de 2 a 40 letras, números o guion bajo, y empieza con una letra.';
  end if;
  if length(v_nombre) not between 1 and 80 then
    raise exception 'Indica el nombre del concepto (hasta 80 caracteres).';
  end if;
  if p_tipo is null or p_tipo not in ('devengado', 'deduccion', 'aporte_patronal', 'provision')
     or p_metodo is null or p_metodo not in ('sistema', 'fijo', 'horas', 'dias') then
    raise exception 'Tipo o método de concepto no válido.';
  end if;
  if p_afecta_inss is null or p_afecta_ir is null or p_afecta_inatec is null or p_cuenta_aguinaldo is null
     or p_cuenta_vacaciones is null or p_cuenta_indemnizacion is null or p_en_colilla is null
     or p_permite_novedad is null or p_activo is null then
    raise exception 'Indica todas las opciones del concepto.';
  end if;
  if p_orden is null or p_orden not between 1 and 9999 then
    raise exception 'El orden va de 1 a 9999.';
  end if;
  if v_cuenta is not null and length(v_cuenta) > 40 then
    raise exception 'La cuenta contable es demasiado larga (hasta 40 caracteres).';
  end if;

  if p_concepto_id is not null then
    select * into c from rrhh.conceptos x where x.id = p_concepto_id and x.company_id = p_company_id for update;
    if not found then
      raise exception 'Concepto no encontrado.';
    end if;
    if c.es_sistema then
      -- Las reglas, el código, el orden y si admite novedades los fija la ley o el motor.
      if (v_codigo, p_tipo, p_metodo, p_afecta_inss, p_afecta_ir, p_afecta_inatec, p_cuenta_aguinaldo,
          p_cuenta_vacaciones, p_cuenta_indemnizacion, p_permite_novedad, p_orden, p_activo)
         is distinct from (c.codigo, c.tipo, c.metodo, c.afecta_inss, c.afecta_ir, c.afecta_inatec, c.cuenta_aguinaldo,
                           c.cuenta_vacaciones, c.cuenta_indemnizacion, c.permite_novedad, c.orden, c.activo) then
        raise exception 'En un concepto del sistema solo cambian el nombre, si sale en la colilla y la cuenta contable.';
      end if;
      update rrhh.conceptos x set nombre = v_nombre, en_colilla = p_en_colilla, cuenta_contable = v_cuenta,
        updated_at = now()
      where x.id = c.id;
      perform core.fn_auditar(v_uid, p_company_id, 'rrhh.planilla.concepto_editado', 'rrhh.conceptos', c.id::text,
        jsonb_build_object('codigo', c.codigo, 'sistema', true,
          'antes', jsonb_build_object('nombre', c.nombre, 'en_colilla', c.en_colilla, 'cuenta_contable', c.cuenta_contable),
          'despues', jsonb_build_object('nombre', v_nombre, 'en_colilla', p_en_colilla, 'cuenta_contable', v_cuenta)));
      return c.id;
    end if;
    v_reglas :=(p_tipo, p_metodo, p_afecta_inss, p_afecta_ir, p_afecta_inatec, p_cuenta_aguinaldo,
                 p_cuenta_vacaciones, p_cuenta_indemnizacion)
                is distinct from (c.tipo, c.metodo, c.afecta_inss, c.afecta_ir, c.afecta_inatec, c.cuenta_aguinaldo,
                                  c.cuenta_vacaciones, c.cuenta_indemnizacion);
  end if;

  -- Reglas nuevas (al crear o al cambiarlas): un concepto propio es de monto
  -- fijo. Una deducción por días u horas no reduce la base de INSS ni de IR (el
  -- motor la descuenta después del IR; solo AUSENCIA reduce los días pagados), y
  -- los conceptos por días u horas con reglas legales, los aportes y las
  -- provisiones son del sistema.
  if v_reglas then
    if p_tipo not in ('devengado', 'deduccion') or p_metodo <> 'fijo' then
      raise exception 'Los conceptos propios son devengados o deducciones de monto fijo. Los de horas, días, aportes y provisiones son del sistema.';
    end if;
    if p_tipo = 'deduccion' and (p_afecta_inss or p_afecta_ir or p_afecta_inatec or p_cuenta_aguinaldo
                                 or p_cuenta_vacaciones or p_cuenta_indemnizacion) then
      raise exception 'Una deducción no afecta INSS, IR ni INATEC ni cuenta para prestaciones.';
    end if;
  end if;
  if p_permite_novedad and p_metodo not in ('fijo', 'horas', 'dias') then
    raise exception 'Solo un concepto de monto fijo, horas o días admite novedades.';
  end if;

  if p_concepto_id is not null then
    if v_codigo <> c.codigo
       and (exists (select 1 from rrhh.planilla_lineas l where l.concepto_id = c.id and l.company_id = p_company_id)
            or exists (select 1 from rrhh.novedades n where n.concepto_id = c.id and n.company_id = p_company_id)) then
      raise exception 'El código de un concepto ya usado no cambia.';
    end if;
    if v_reglas and exists (select 1 from rrhh.planilla_lineas l join rrhh.planillas q on q.id = l.planilla_id
                            where l.concepto_id = c.id and l.company_id = p_company_id
                              and q.estado in ('aprobada', 'pagada')) then
      raise exception 'El concepto ya se usó en una planilla aprobada: solo cambian el nombre, el orden, la colilla, si admite novedades, la cuenta contable y si está activo.';
    end if;
    begin
      update rrhh.conceptos x set codigo = v_codigo, nombre = v_nombre, tipo = p_tipo, metodo = p_metodo,
        afecta_inss = p_afecta_inss, afecta_ir = p_afecta_ir, afecta_inatec = p_afecta_inatec,
        cuenta_aguinaldo = p_cuenta_aguinaldo, cuenta_vacaciones = p_cuenta_vacaciones,
        cuenta_indemnizacion = p_cuenta_indemnizacion, en_colilla = p_en_colilla, permite_novedad = p_permite_novedad,
        orden = p_orden, cuenta_contable = v_cuenta, activo = p_activo, updated_at = now()
      where x.id = c.id;
    exception when unique_violation then
      raise exception 'Ya existe un concepto con ese código.';
    end;
    -- La huella de insumos (PL2b) incluye las reglas de los conceptos: las
    -- planillas calculadas que lo usan se recalculan antes de aprobar. Aquí solo
    -- se cuentan para la auditoría.
    if v_reglas then
      select count(*) into v_invalidadas from rrhh.planillas q
      where q.company_id = p_company_id and q.estado = 'calculada'
        and exists (select 1 from rrhh.planilla_lineas l
                    where l.planilla_id = q.id and l.periodo_fin = q.periodo_fin and l.concepto_id = c.id);
    end if;
    perform core.fn_auditar(v_uid, p_company_id, 'rrhh.planilla.concepto_editado', 'rrhh.conceptos', c.id::text,
      jsonb_build_object('codigo', v_codigo, 'antes', to_jsonb(c) - 'created_at' - 'updated_at',
        'despues', (select to_jsonb(x) - 'created_at' - 'updated_at' from rrhh.conceptos x where x.id = c.id),
        'planillas_por_recalcular', v_invalidadas));
    return c.id;
  end if;

  begin
    insert into rrhh.conceptos (company_id, codigo, nombre, tipo, metodo, afecta_inss, afecta_ir, afecta_inatec,
      cuenta_aguinaldo, cuenta_vacaciones, cuenta_indemnizacion, es_ordinario, en_colilla, permite_novedad,
      es_sistema, orden, cuenta_contable, activo)
    values (p_company_id, v_codigo, v_nombre, p_tipo, p_metodo, p_afecta_inss, p_afecta_ir, p_afecta_inatec,
      p_cuenta_aguinaldo, p_cuenta_vacaciones, p_cuenta_indemnizacion, false, p_en_colilla, p_permite_novedad,
      false, p_orden, v_cuenta, p_activo)
    returning id into v_id;
  exception when unique_violation then
    raise exception 'Ya existe un concepto con ese código.';
  end;
  perform core.fn_auditar(v_uid, p_company_id, 'rrhh.planilla.concepto_creado', 'rrhh.conceptos', v_id::text,
    jsonb_build_object('codigo', v_codigo, 'tipo', p_tipo, 'metodo', p_metodo, 'afecta_inss', p_afecta_inss,
      'afecta_ir', p_afecta_ir, 'afecta_inatec', p_afecta_inatec, 'activo', p_activo));
  return v_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- 8. Tipos de planilla
-- -----------------------------------------------------------------------------
-- p_tipo_id null crea. La clase no cambia al editar. Un tipo con planillas o
-- novedades no cambia de frecuencia (sus contratos y novedades dependen de ella). Solo un
-- tipo activo por clase y frecuencia (índice planilla_tipos_activo_unico).
create function public.planilla_tipo_guardar(p_company_id uuid, p_tipo_id uuid, p_nombre text, p_clase text,
  p_frecuencia text, p_centro_costo text, p_activo boolean)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := core.fn_exigir_permiso(p_company_id, 'rrhh.planillas.conceptos.gestionar');
  v_nombre text := btrim(coalesce(p_nombre, ''));
  v_centro text := nullif(btrim(coalesce(p_centro_costo, '')), '');
  t rrhh.planilla_tipos;
  v_id uuid;
  v_restriccion text;
begin
  if length(v_nombre) not between 1 and 80 then
    raise exception 'Indica el nombre del tipo de planilla (hasta 80 caracteres).';
  end if;
  if p_clase is null or p_clase not in ('ordinaria', 'aguinaldo') then
    raise exception 'Clase de planilla no válida.';
  end if;
  if p_frecuencia is null or p_frecuencia not in ('mensual', 'quincenal', 'semanal', 'anual') then
    raise exception 'Frecuencia de planilla no válida.';
  end if;
  if p_clase = 'aguinaldo' and p_frecuencia <> 'anual' then
    raise exception 'La planilla de aguinaldo es anual.';
  end if;
  if p_clase = 'ordinaria' and p_frecuencia = 'anual' then
    raise exception 'Una planilla ordinaria es mensual, quincenal o semanal.';
  end if;
  if v_centro is not null and length(v_centro) > 80 then
    raise exception 'El centro de costo es demasiado largo (hasta 80 caracteres).';
  end if;
  if p_activo is null then
    raise exception 'Indica si el tipo de planilla está activo.';
  end if;

  if p_tipo_id is not null then
    select * into t from rrhh.planilla_tipos x where x.id = p_tipo_id and x.company_id = p_company_id for update;
    if not found then
      raise exception 'Tipo de planilla no encontrado.';
    end if;
    -- La clase no cambia nunca (protege el tipo Aguinaldo y las planillas ordinarias).
    if p_clase <> t.clase then
      raise exception 'La clase de un tipo de planilla no cambia. Crea otro tipo.';
    end if;
    if (p_clase, p_frecuencia) is distinct from (t.clase, t.frecuencia)
       and (exists (select 1 from rrhh.planillas q where q.planilla_tipo_id = t.id and q.company_id = p_company_id)
            or exists (select 1 from rrhh.novedades n where n.planilla_tipo_id = t.id and n.company_id = p_company_id
                       and n.estado <> 'anulada')) then
      raise exception 'Un tipo con planillas o novedades no cambia de clase ni de frecuencia.';
    end if;
  end if;

  begin
    if p_tipo_id is null then
      insert into rrhh.planilla_tipos (company_id, nombre, clase, frecuencia, centro_costo, activo)
      values (p_company_id, v_nombre, p_clase, p_frecuencia, v_centro, p_activo)
      returning id into v_id;
    else
      update rrhh.planilla_tipos x set nombre = v_nombre, clase = p_clase, frecuencia = p_frecuencia,
        centro_costo = v_centro, activo = p_activo, updated_at = now()
      where x.id = t.id;
      v_id := t.id;
    end if;
  exception when unique_violation then
    get stacked diagnostics v_restriccion = constraint_name;
    if v_restriccion = 'planilla_tipos_activo_unico' then
      raise exception 'Ya hay un tipo activo de esa clase y frecuencia. Desactiva el otro antes.';
    end if;
    raise exception 'Ya existe un tipo de planilla con ese nombre.';
  end;

  if p_tipo_id is null then
    perform core.fn_auditar(v_uid, p_company_id, 'rrhh.planilla.tipo_creado', 'rrhh.planilla_tipos', v_id::text,
      jsonb_build_object('nombre', v_nombre, 'clase', p_clase, 'frecuencia', p_frecuencia, 'activo', p_activo));
  else
    perform core.fn_auditar(v_uid, p_company_id, 'rrhh.planilla.tipo_editado', 'rrhh.planilla_tipos', v_id::text,
      jsonb_build_object('antes', jsonb_build_object('nombre', t.nombre, 'clase', t.clase, 'frecuencia', t.frecuencia,
                                                     'centro_costo', t.centro_costo, 'activo', t.activo),
                         'despues', jsonb_build_object('nombre', v_nombre, 'clase', p_clase, 'frecuencia', p_frecuencia,
                                                       'centro_costo', v_centro, 'activo', p_activo)));
  end if;
  return v_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- 9. Nueva tabla de IR con vigencia
-- -----------------------------------------------------------------------------
-- Vigencia el día 1 o 16 (inicio de un período). Tramos contiguos desde 0 (cada
-- desde = hasta anterior + 0.01), un solo tramo final sin hasta, porcentajes de
-- 0 a 1 y sin saltos de impuesto: desde el tramo 2, sobre_exceso = hasta del
-- tramo anterior e impuesto_base = round(base_ant + (hasta_ant − exceso_ant) ×
-- pct_ant, 2) (la tabla de la DGI de PL2a cumple exacto: 0, 0, 15000, 45000,
-- 82500). La tabla que rige antes se cierra el día anterior. Las tablas que
-- empiezan en la nueva fecha o después se reemplazan si todavía no rigen y
-- ninguna planilla ordinaria calculada, aprobada o pagada las usó (periodo_fin
-- dentro de su vigencia). No se permite si hay planillas ordinarias aprobadas o
-- pagadas con periodo_fin desde la nueva vigencia; las calculadas cambian de
-- huella y se recalculan. Un candado por empresa serializa las cargas.
create function public.planilla_ir_tabla_nueva(p_company_id uuid, p_vigente_desde date, p_tramos jsonb,
  p_certeza text, p_fuente text)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := core.fn_exigir_permiso(p_company_id, 'rrhh.planillas.parametros.editar');
  t record;
  v_i integer := 0;
  v_n integer;
  v_prev_hasta numeric;
  v_prev_base numeric;
  v_prev_pct numeric;
  v_prev_exceso numeric;
  v_base_esperada numeric;
  v_ultimo_abierto boolean := false;
  v_hoy date := (now() at time zone 'America/Managua')::date;
  v_vigente date;
  v_usada date;
  v_anterior date;
  v_reemplazadas jsonb;
begin
  if p_certeza is null or p_certeza not in ('oficial', 'coincidente', 'verificar') then
    raise exception 'Indica el grado de certeza: oficial, coincidente o verificar.';
  end if;
  if p_fuente is null or length(btrim(p_fuente)) not between 3 and 200 then
    raise exception 'Indica la fuente de la tabla (3 a 200 caracteres).';
  end if;
  if p_vigente_desde is null then
    raise exception 'Indica desde qué fecha rige la tabla.';
  end if;
  if extract(day from p_vigente_desde) not in (1, 16) then
    raise exception 'La tabla de IR empieza el día 1 o el 16 de un mes (inicio de un período).';
  end if;
  if p_tramos is null or jsonb_typeof(p_tramos) <> 'array' or jsonb_array_length(p_tramos) not between 1 and 20 then
    raise exception 'Indica entre 1 y 20 tramos.';
  end if;
  if exists (select 1 from jsonb_array_elements(p_tramos) x where jsonb_typeof(x) <> 'object') then
    raise exception 'Cada tramo lleva desde, hasta, impuesto base, porcentaje y sobre exceso.';
  end if;
  if exists (select 1 from jsonb_array_elements(p_tramos) x, jsonb_object_keys(x) k
             where k not in ('desde', 'hasta', 'impuesto_base', 'porcentaje', 'sobre_exceso'))
     or exists (select 1 from jsonb_array_elements(p_tramos) x
                where jsonb_typeof(x->'desde') is distinct from 'number'
                   or jsonb_typeof(x->'impuesto_base') is distinct from 'number'
                   or jsonb_typeof(x->'porcentaje') is distinct from 'number'
                   or jsonb_typeof(x->'sobre_exceso') is distinct from 'number'
                   or coalesce(jsonb_typeof(x->'hasta'), 'null') not in ('number', 'null')) then
    raise exception 'Cada tramo lleva desde, hasta (vacío solo en el último), impuesto base, porcentaje y sobre exceso, en números.';
  end if;

  for t in select (x->>'desde')::numeric as desde, (x->>'hasta')::numeric as hasta,
                  (x->>'impuesto_base')::numeric as base, (x->>'porcentaje')::numeric as pct,
                  (x->>'sobre_exceso')::numeric as exceso
           from jsonb_array_elements(p_tramos) x
           order by (x->>'desde')::numeric loop
    v_i := v_i + 1;
    if t.desde <> round(t.desde, 2) or t.hasta <> round(t.hasta, 2) or t.base <> round(t.base, 2)
       or t.exceso <> round(t.exceso, 2) or t.pct <> round(t.pct, 4) then
      raise exception 'Los montos van con hasta 2 decimales y el porcentaje con hasta 4.';
    end if;
    if t.desde < 0 or t.base < 0 or t.exceso < 0 or greatest(t.desde, t.hasta, t.base, t.exceso) >= 1000000000000 then
      raise exception 'Los montos de los tramos van de 0 a menos de un billón.';
    end if;
    if t.pct < 0 or t.pct > 1 then
      raise exception 'El porcentaje de cada tramo va de 0 a 1 (por ejemplo 0.15 es 15%%).';
    end if;
    if v_ultimo_abierto then
      raise exception 'Solo el último tramo va sin límite superior.';
    end if;
    if v_i = 1 and t.desde <> 0 then
      raise exception 'El primer tramo empieza en 0.';
    end if;
    if v_i > 1 and t.desde <> v_prev_hasta + 0.01 then
      raise exception 'Los tramos deben ser contiguos: el tramo % empieza en % y debería empezar en %.',
        v_i, t.desde, v_prev_hasta + 0.01;
    end if;
    if t.hasta is not null and t.hasta <= t.desde then
      raise exception 'En el tramo % el límite superior debe ser mayor que el inferior.', v_i;
    end if;
    if v_i = 1 and t.exceso > t.desde then
      raise exception 'En el primer tramo el monto sobre el que se calcula el exceso no puede pasar de su inicio.';
    end if;
    -- Los demás tramos se encadenan desde el primero: un impuesto base ahí se arrastra a toda la tabla.
    if v_i = 1 and t.base <> 0 then
      raise exception 'En el primer tramo el impuesto base es 0.';
    end if;
    -- Sin saltos de impuesto entre tramos.
    if v_i > 1 then
      if t.exceso <> v_prev_hasta then
        raise exception 'En el tramo % el exceso se calcula sobre %, el límite superior del tramo anterior.', v_i, v_prev_hasta;
      end if;
      v_base_esperada := round(v_prev_base + (v_prev_hasta - v_prev_exceso) * v_prev_pct, 2);
      if t.base <> v_base_esperada then
        raise exception 'En el tramo % el impuesto base debe ser %, el impuesto al final del tramo anterior.', v_i, v_base_esperada;
      end if;
    end if;
    v_ultimo_abierto := t.hasta is null;
    v_prev_hasta := t.hasta;
    v_prev_base := t.base;
    v_prev_pct := t.pct;
    v_prev_exceso := t.exceso;
  end loop;
  if not v_ultimo_abierto then
    raise exception 'El último tramo va sin límite superior.';
  end if;

  -- Una carga a la vez por empresa (también cuando todavía no hay tabla).
  perform pg_advisory_xact_lock(hashtextextended('rrhh.ir_tramos:' || p_company_id::text, 0));

  -- Tablas que la nueva reemplaza: las que empiezan en su fecha o después.
  select max(it.vigente_desde) into v_vigente from rrhh.ir_tramos it
  where it.company_id = p_company_id and it.vigente_desde >= p_vigente_desde and it.vigente_desde <= v_hoy;
  if v_vigente is not null then
    raise exception 'La tabla de IR del % ya está vigente: la nueva debe empezar después de esa fecha.', to_char(v_vigente, 'YYYY-MM-DD');
  end if;
  select min(x.desde) into v_usada
  from (select distinct it.vigente_desde as desde, it.vigente_hasta as hasta from rrhh.ir_tramos it
        where it.company_id = p_company_id and it.vigente_desde >= p_vigente_desde) x
  where exists (select 1 from rrhh.planillas q
                join rrhh.planilla_tipos pt on pt.id = q.planilla_tipo_id and pt.company_id = q.company_id and pt.clase = 'ordinaria'
                where q.company_id = p_company_id and q.estado in ('calculada', 'aprobada', 'pagada')
                  and q.periodo_fin >= x.desde and (x.hasta is null or q.periodo_fin <= x.hasta));
  if v_usada is not null then
    raise exception 'La tabla de IR del % ya se usó en una planilla calculada, aprobada o pagada: no se reemplaza.', to_char(v_usada, 'YYYY-MM-DD');
  end if;
  if exists (select 1 from rrhh.planillas q
             join rrhh.planilla_tipos pt on pt.id = q.planilla_tipo_id and pt.company_id = q.company_id and pt.clase = 'ordinaria'
             where q.company_id = p_company_id and q.estado in ('aprobada', 'pagada') and q.periodo_fin >= p_vigente_desde) then
    raise exception 'Hay planillas aprobadas después de esa fecha. La nueva tabla debe empezar después de ellas.';
  end if;

  -- Las reemplazadas quedan en la auditoría y se borran (ninguna FK apunta a ir_tramos).
  select coalesce(jsonb_agg(jsonb_build_object('vigente_desde', it.vigente_desde, 'desde', it.desde, 'hasta', it.hasta,
           'impuesto_base', it.impuesto_base, 'porcentaje', it.porcentaje, 'sobre_exceso', it.sobre_exceso)
           order by it.vigente_desde, it.desde), '[]'::jsonb)
    into v_reemplazadas
  from rrhh.ir_tramos it where it.company_id = p_company_id and it.vigente_desde >= p_vigente_desde;
  delete from rrhh.ir_tramos it where it.company_id = p_company_id and it.vigente_desde >= p_vigente_desde;

  -- La tabla anterior rige hasta el día antes de la nueva.
  select max(it.vigente_desde) into v_anterior from rrhh.ir_tramos it
  where it.company_id = p_company_id and it.vigente_desde < p_vigente_desde;
  update rrhh.ir_tramos it set vigente_hasta = p_vigente_desde - 1
  where it.company_id = p_company_id and it.vigente_desde = v_anterior;

  insert into rrhh.ir_tramos (company_id, vigente_desde, desde, hasta, impuesto_base, porcentaje, sobre_exceso, created_by)
  select p_company_id, p_vigente_desde, (x->>'desde')::numeric, (x->>'hasta')::numeric, (x->>'impuesto_base')::numeric,
         (x->>'porcentaje')::numeric, (x->>'sobre_exceso')::numeric, v_uid
  from jsonb_array_elements(p_tramos) x;
  get diagnostics v_n = row_count;

  -- rrhh.ir_tramos no guarda certeza ni fuente: quedan en la auditoría.
  perform core.fn_auditar(v_uid, p_company_id, 'rrhh.planilla.ir_tabla_nueva', 'rrhh.ir_tramos',
    to_char(p_vigente_desde, 'YYYY-MM-DD'),
    jsonb_build_object('vigente_desde', p_vigente_desde, 'anterior_desde', v_anterior, 'tramos', p_tramos,
      'reemplaza', v_reemplazadas, 'certeza', p_certeza, 'fuente', btrim(p_fuente)));
  return v_n;
end;
$$;
comment on function public.planilla_ir_tabla_nueva(uuid, date, jsonb, text, text) is
  'Nueva vigencia de la tabla de IR (día 1 o 16; cierra la anterior el día antes; reemplaza tablas futuras sin uso; tramos contiguos y sin saltos de impuesto). rrhh.ir_tramos no tiene columnas de certeza ni de fuente: se validan como en planilla_parametro_vigencia_nueva y se guardan en core.audit_log (acción rrhh.planilla.ir_tabla_nueva, metadata certeza, fuente y tablas reemplazadas). Devuelve el número de tramos.';

-- RPC nuevas de esta parte: solo authenticated.
revoke all on function
  public.planilla_concepto_guardar(uuid, uuid, text, text, text, text, boolean, boolean, boolean, boolean, boolean,
    boolean, boolean, boolean, integer, text, boolean),
  public.planilla_tipo_guardar(uuid, uuid, text, text, text, text, boolean),
  public.planilla_ir_tabla_nueva(uuid, date, jsonb, text, text)
from public, anon;
grant execute on function
  public.planilla_concepto_guardar(uuid, uuid, text, text, text, text, boolean, boolean, boolean, boolean, boolean,
    boolean, boolean, boolean, integer, text, boolean),
  public.planilla_tipo_guardar(uuid, uuid, text, text, text, text, boolean),
  public.planilla_ir_tabla_nueva(uuid, date, jsonb, text, text)
to authenticated;
