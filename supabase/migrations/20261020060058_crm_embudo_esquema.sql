-- =============================================================================
-- CRM — embudo comercial: esquema + RPC
--
-- Diseño: docs/plan/16-crm-embudo-comercial.md (Paso Cero 20261019152215) y
-- docs/plan/16a-crm-embudo-especificacion-ux.md (especificación; P1–P7 y
-- S1–S6 aceptados por el usuario el 2026-10-19).
--
-- Resumen:
--   1. Tablas nuevas en el schema crm, CERRADAS a la API (RLS sin políticas y
--      sin GRANT): todo pasa por RPC public.crm_* (Web y Mobile).
--        embudo_parametros, etapas, origenes, motivos_perdida, correlativos,
--        leads, oportunidades                                 catálogos/registros
--        actividades, cotizaciones, cotizacion_lineas, eventos  PARTICIONADAS por mes
--   2. Alcance: sin crm.ventas.equipo.ver, cada quien ve y opera solo lo que
--      tiene asignado (responsable_id = auth.uid()). Fuera de alcance = "no
--      encontrado" (no se revela que existe).
--   3. Concurrencia: cada escritura recibe p_version; si el registro cambió,
--      se rechaza con el mensaje de conflicto.
--   4. Las RPC recalculan totales y la necesidad de aprobación; nunca confían
--      en lo que manda el cliente.
--   5. crm.clientes no cambia: las RPC lo leen y lo crean (conversión de lead)
--      con security definer, validando la empresa.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0. Prechecks
-- -----------------------------------------------------------------------------
do $$
begin
  if to_regclass('crm.leads') is not null then
    raise exception 'precheck: el embudo ya existe';
  end if;
  if (select count(*) from core.permissions_catalog where module_slug = 'crm') <> 34 then
    raise exception 'precheck: falta el Paso Cero del embudo (se esperaban 34 permisos crm)';
  end if;
  if to_regclass('productos.productos') is null then
    raise exception 'precheck: falta el catálogo de productos';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- 1. Configuración del embudo
-- -----------------------------------------------------------------------------
create table crm.embudo_parametros (
  company_id uuid primary key references core.companies(id) on delete cascade,
  descuento_maximo numeric(5,2) not null default 5 check (descuento_maximo between 0 and 100),
  iva_porcentaje numeric(5,2) not null default 15 check (iva_porcentaje between 0 and 100),
  tipo_cambio numeric(12,4) not null default 36.6243 check (tipo_cambio > 0 and tipo_cambio < 10000),
  validez_dias integer not null default 15 check (validez_dias between 1 and 365),
  empresa jsonb not null default '{}'::jsonb check (jsonb_typeof(empresa) = 'object'),
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);
create index embudo_parametros_updated_by_idx on crm.embudo_parametros (updated_by);
comment on table crm.embudo_parametros is
  'Parámetros de cotización por empresa: descuento máximo sin aprobación (%), IVA (%), tipo de cambio C$/US$ de referencia, validez por defecto y datos de la empresa para el encabezado del PDF.';

create table crm.etapas (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references core.companies(id) on delete cascade,
  nombre text not null check (length(btrim(nombre)) between 2 and 60),
  probabilidad numeric(5,2) not null check (probabilidad between 0 and 100),
  orden integer not null,
  tipo text not null check (tipo in ('abierta', 'ganada', 'perdida')),
  activa boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, company_id),
  check (tipo = 'abierta' or activa),
  check ((tipo = 'ganada' and probabilidad = 100) or (tipo = 'perdida' and probabilidad = 0) or tipo = 'abierta')
);
create unique index etapas_nombre_uq on crm.etapas (company_id, lower(btrim(nombre)));
create unique index etapas_cierre_uq on crm.etapas (company_id, tipo) where tipo <> 'abierta';
create index etapas_company_orden_idx on crm.etapas (company_id, orden);

create table crm.origenes (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references core.companies(id) on delete cascade,
  nombre text not null check (length(btrim(nombre)) between 2 and 60),
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, company_id)
);
create unique index origenes_nombre_uq on crm.origenes (company_id, lower(btrim(nombre)));

create table crm.motivos_perdida (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references core.companies(id) on delete cascade,
  nombre text not null check (length(btrim(nombre)) between 2 and 60),
  pide_detalle boolean not null default false,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, company_id)
);
create unique index motivos_perdida_nombre_uq on crm.motivos_perdida (company_id, lower(btrim(nombre)));

create table crm.correlativos (
  company_id uuid not null references core.companies(id) on delete cascade,
  serie text not null,
  anio integer not null,
  ultimo bigint not null default 0,
  primary key (company_id, serie, anio)
);
comment on table crm.correlativos is 'Último número usado por serie y año (COT-2026-00001). Nunca se reutiliza.';

-- -----------------------------------------------------------------------------
-- 2. Leads y oportunidades
-- -----------------------------------------------------------------------------
create table crm.leads (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references core.companies(id),
  contacto text not null check (length(btrim(contacto)) between 2 and 120),
  negocio text check (negocio is null or length(negocio) <= 120),
  telefono text check (telefono is null or length(telefono) <= 30),
  correo text check (correo is null or length(correo) <= 160),
  ruc text check (ruc is null or length(ruc) <= 30),
  direccion text check (direccion is null or length(direccion) <= 300),
  origen_id uuid not null,
  tipo_cliente text check (tipo_cliente is null or tipo_cliente in ('mayorista', 'detal')),
  interes text check (interes is null or length(interes) <= 2000),
  estado text not null default 'nuevo' check (estado in ('nuevo', 'contactado', 'calificado', 'descartado', 'convertido')),
  motivo_descarte text check (motivo_descarte is null or length(motivo_descarte) <= 300),
  responsable_id uuid not null references auth.users(id),
  cliente_id uuid references crm.clientes(id),
  oportunidad_id uuid,
  convertido_en timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  version integer not null default 1,
  check (telefono is not null or correo is not null),
  check (estado <> 'descartado' or motivo_descarte is not null),
  foreign key (origen_id, company_id) references crm.origenes (id, company_id)
);
create index leads_company_estado_idx on crm.leads (company_id, estado, created_at desc) where deleted_at is null;
create index leads_responsable_idx on crm.leads (responsable_id);
create index leads_origen_idx on crm.leads (origen_id);
create index leads_cliente_idx on crm.leads (cliente_id);
create index leads_oportunidad_idx on crm.leads (oportunidad_id);
create index leads_created_by_idx on crm.leads (created_by);
create index leads_telefono_idx on crm.leads (company_id, telefono) where deleted_at is null;
create index leads_correo_idx on crm.leads (company_id, lower(correo)) where deleted_at is null;
create index leads_ruc_idx on crm.leads (company_id, ruc) where deleted_at is null;

create table crm.oportunidades (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references core.companies(id),
  nombre text not null check (length(btrim(nombre)) between 3 and 120),
  cliente_id uuid not null references crm.clientes(id),
  lead_id uuid references crm.leads(id),
  etapa_id uuid not null,
  monto_estimado numeric(14,2) not null check (monto_estimado between 0 and 99999999.99),
  fecha_cierre_estimada date not null,
  probabilidad numeric(5,2) not null check (probabilidad between 0 and 100),
  probabilidad_ajustada boolean not null default false,
  estado text not null default 'abierta' check (estado in ('abierta', 'ganada', 'perdida')),
  monto_ganado numeric(14,2) check (monto_ganado is null or monto_ganado >= 0),
  fecha_cierre date,
  motivo_perdida_id uuid,
  detalle_perdida text check (detalle_perdida is null or length(detalle_perdida) <= 500),
  notas text check (notas is null or length(notas) <= 2000),
  responsable_id uuid not null references auth.users(id),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  version integer not null default 1,
  check (estado <> 'perdida' or motivo_perdida_id is not null),
  check (estado <> 'ganada' or (monto_ganado is not null and fecha_cierre is not null)),
  foreign key (etapa_id, company_id) references crm.etapas (id, company_id),
  foreign key (motivo_perdida_id, company_id) references crm.motivos_perdida (id, company_id)
);
create index oportunidades_company_estado_idx on crm.oportunidades (company_id, estado, etapa_id) where deleted_at is null;
create index oportunidades_responsable_idx on crm.oportunidades (responsable_id);
create index oportunidades_cliente_idx on crm.oportunidades (cliente_id);
create index oportunidades_lead_idx on crm.oportunidades (lead_id);
create index oportunidades_etapa_idx on crm.oportunidades (etapa_id);
create index oportunidades_motivo_idx on crm.oportunidades (motivo_perdida_id);
create index oportunidades_created_by_idx on crm.oportunidades (created_by);
create index oportunidades_cierre_idx on crm.oportunidades (company_id, fecha_cierre) where deleted_at is null;

alter table crm.leads add constraint leads_oportunidad_fk foreign key (oportunidad_id) references crm.oportunidades(id);

-- -----------------------------------------------------------------------------
-- 3. Hechos particionados por mes
-- -----------------------------------------------------------------------------
create table crm.actividades (
  id uuid not null default gen_random_uuid(),
  fecha timestamptz not null,
  company_id uuid not null references core.companies(id),
  tipo text not null check (tipo in ('llamada', 'visita', 'reunion', 'nota', 'correo')),
  estado text not null check (estado in ('agendada', 'completada', 'cancelada')),
  asunto text not null check (length(btrim(asunto)) between 3 and 120),
  notas text check (notas is null or length(notas) <= 2000),
  resultado text check (resultado is null or length(resultado) <= 2000),
  lead_id uuid references crm.leads(id),
  oportunidad_id uuid references crm.oportunidades(id),
  cliente_id uuid references crm.clientes(id),
  responsable_id uuid not null references auth.users(id),
  created_by uuid references auth.users(id),
  completada_en timestamptz,
  motivo_cancelacion text check (motivo_cancelacion is null or length(motivo_cancelacion) <= 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  version integer not null default 1,
  primary key (id, fecha),
  check (num_nonnulls(lead_id, oportunidad_id, cliente_id) = 1),
  check (tipo <> 'nota' or estado <> 'agendada')
) partition by range (fecha);
comment on table crm.actividades is
  'Llamadas, visitas, reuniones, notas y correos ligados a exactamente un lead, oportunidad o cliente. Particionada por mes de fecha (cuándo ocurrió o para cuándo está agendada); reprogramar mueve la fila de partición.';

create table crm.cotizaciones (
  id uuid not null default gen_random_uuid(),
  fecha date not null,
  company_id uuid not null references core.companies(id),
  numero text not null,
  cliente_id uuid not null references crm.clientes(id),
  oportunidad_id uuid references crm.oportunidades(id),
  atencion text check (atencion is null or length(atencion) <= 120),
  valida_hasta date not null,
  tipo_cambio numeric(12,4) not null check (tipo_cambio > 0),
  condiciones text check (condiciones is null or length(condiciones) <= 2000),
  exento_iva boolean not null default false,
  iva_porcentaje numeric(5,2) not null,
  descuento_maximo numeric(5,2) not null,
  estado text not null default 'borrador' check (estado in
    ('borrador', 'pendiente_aprobacion', 'aprobada', 'enviada', 'aceptada', 'rechazada', 'anulada')),
  subtotal_bruto numeric(16,2) not null default 0,
  descuento_total numeric(16,2) not null default 0,
  subtotal_neto numeric(16,2) not null default 0,
  iva numeric(16,2) not null default 0,
  total numeric(16,2) not null default 0,
  descuento_efectivo numeric(7,4) not null default 0,
  descuento_max_linea numeric(5,2) not null default 0,
  requiere_aprobacion boolean not null default false,
  comentario_rechazo text check (comentario_rechazo is null or length(comentario_rechazo) <= 500),
  aprobado_por uuid references auth.users(id),
  aprobado_en timestamptz,
  enviada_en timestamptz,
  resultado_en timestamptz,
  motivo_resultado text check (motivo_resultado is null or length(motivo_resultado) <= 300),
  anulada_por uuid references auth.users(id),
  anulada_en timestamptz,
  motivo_anulacion text check (motivo_anulacion is null or length(motivo_anulacion) <= 300),
  duplicada_de uuid,
  responsable_id uuid not null references auth.users(id),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  primary key (id, fecha),
  unique (company_id, numero, fecha),
  check (valida_hasta >= fecha),
  check (estado <> 'anulada' or motivo_anulacion is not null)
) partition by range (fecha);
comment on table crm.cotizaciones is
  'Cotizaciones en US$ con C$ de referencia. Particionada por mes de fecha de emisión. "Vencida" no se guarda: es enviada con valida_hasta pasada.';

create table crm.cotizacion_lineas (
  cotizacion_id uuid not null,
  fecha date not null,
  company_id uuid not null references core.companies(id),
  linea smallint not null check (linea between 1 and 200),
  producto_id uuid not null,
  descripcion text not null check (length(btrim(descripcion)) between 1 and 300),
  unidad text check (unidad is null or length(unidad) <= 40),
  cantidad numeric(14,3) not null check (cantidad > 0),
  precio numeric(14,2) not null check (precio > 0),
  descuento_pct numeric(5,2) not null default 0 check (descuento_pct between 0 and 100),
  subtotal numeric(16,2) not null,
  descuento_monto numeric(16,2) not null,
  total numeric(16,2) not null,
  primary key (cotizacion_id, fecha, linea),
  foreign key (cotizacion_id, fecha) references crm.cotizaciones (id, fecha) on delete cascade,
  foreign key (producto_id, company_id) references productos.productos (id, company_id)
) partition by range (fecha);

create table crm.eventos (
  id uuid not null default gen_random_uuid(),
  creado_en timestamptz not null default now(),
  company_id uuid not null references core.companies(id),
  entidad text not null check (entidad in ('lead', 'oportunidad', 'cotizacion', 'actividad')),
  entidad_id uuid not null,
  oportunidad_id uuid,
  tipo text not null,
  user_id uuid references auth.users(id),
  datos jsonb not null default '{}'::jsonb,
  primary key (id, creado_en)
) partition by range (creado_en);
comment on table crm.eventos is
  'Hitos del embudo (creada, cambio de etapa, aprobada, ganada, reasignada…) para la línea de tiempo. oportunidad_id agrupa los de sus cotizaciones. Particionada por mes.';

create or replace function crm.fn_asegurar_particion_actividades(p_mes date)
returns void language plpgsql set search_path = crm, pg_temp as $$
declare
  particion text := 'actividades_' || to_char(p_mes, 'YYYY_MM');
  inicio date := date_trunc('month', p_mes);
  fin date := inicio + interval '1 month';
begin
  if to_regclass('crm.' || particion) is null then
    execute format('create table crm.%I partition of crm.actividades for values from (%L) to (%L)', particion, inicio, fin);
    execute format('create index on crm.%I (company_id, fecha)', particion);
    execute format('create index on crm.%I (responsable_id, fecha)', particion);
    execute format('create index on crm.%I (id)', particion);
    execute format('create index on crm.%I (lead_id)', particion);
    execute format('create index on crm.%I (oportunidad_id)', particion);
    execute format('create index on crm.%I (cliente_id)', particion);
    execute format('create index on crm.%I (created_by)', particion);
    execute format('alter table crm.%I enable row level security', particion);
  end if;
end;
$$;

-- Crea la partición del mes en cotizaciones y en sus líneas (misma clave).
create or replace function crm.fn_asegurar_particion_cotizaciones(p_mes date)
returns void language plpgsql set search_path = crm, pg_temp as $$
declare
  sufijo text := to_char(p_mes, 'YYYY_MM');
  inicio date := date_trunc('month', p_mes);
  fin date := inicio + interval '1 month';
begin
  if to_regclass('crm.cotizaciones_' || sufijo) is null then
    execute format('create table crm.%I partition of crm.cotizaciones for values from (%L) to (%L)', 'cotizaciones_' || sufijo, inicio, fin);
    execute format('create index on crm.%I (company_id, fecha)', 'cotizaciones_' || sufijo);
    execute format('create index on crm.%I (id)', 'cotizaciones_' || sufijo);
    execute format('create index on crm.%I (cliente_id)', 'cotizaciones_' || sufijo);
    execute format('create index on crm.%I (oportunidad_id)', 'cotizaciones_' || sufijo);
    execute format('create index on crm.%I (responsable_id)', 'cotizaciones_' || sufijo);
    execute format('create index on crm.%I (company_id, estado)', 'cotizaciones_' || sufijo);
    execute format('create index on crm.%I (aprobado_por)', 'cotizaciones_' || sufijo);
    execute format('create index on crm.%I (anulada_por)', 'cotizaciones_' || sufijo);
    execute format('create index on crm.%I (created_by)', 'cotizaciones_' || sufijo);
    execute format('alter table crm.%I enable row level security', 'cotizaciones_' || sufijo);
  end if;
  if to_regclass('crm.cotizacion_lineas_' || sufijo) is null then
    execute format('create table crm.%I partition of crm.cotizacion_lineas for values from (%L) to (%L)', 'cotizacion_lineas_' || sufijo, inicio, fin);
    execute format('create index on crm.%I (producto_id, company_id)', 'cotizacion_lineas_' || sufijo);
    execute format('create index on crm.%I (company_id, fecha)', 'cotizacion_lineas_' || sufijo);
    execute format('alter table crm.%I enable row level security', 'cotizacion_lineas_' || sufijo);
  end if;
end;
$$;

create or replace function crm.fn_asegurar_particion_eventos(p_mes date)
returns void language plpgsql set search_path = crm, pg_temp as $$
declare
  particion text := 'eventos_' || to_char(p_mes, 'YYYY_MM');
  inicio date := date_trunc('month', p_mes);
  fin date := inicio + interval '1 month';
begin
  if to_regclass('crm.' || particion) is null then
    execute format('create table crm.%I partition of crm.eventos for values from (%L) to (%L)', particion, inicio, fin);
    execute format('create index on crm.%I (company_id, creado_en)', particion);
    execute format('create index on crm.%I (oportunidad_id, creado_en)', particion);
    execute format('create index on crm.%I (entidad_id, creado_en)', particion);
    execute format('create index on crm.%I (user_id)', particion);
    execute format('create index on crm.%I using gin (datos)', particion);
    execute format('alter table crm.%I enable row level security', particion);
  end if;
end;
$$;

insert into core.tablas_particionadas (schema_nombre, tabla_nombre, fn_asegurar_particion) values
  ('crm', 'actividades', 'crm.fn_asegurar_particion_actividades'),
  ('crm', 'cotizaciones', 'crm.fn_asegurar_particion_cotizaciones'),
  ('crm', 'eventos', 'crm.fn_asegurar_particion_eventos');

do $$
begin
  perform crm.fn_asegurar_particion_actividades(current_date);
  perform crm.fn_asegurar_particion_cotizaciones(current_date);
  perform crm.fn_asegurar_particion_eventos(current_date);
end;
$$;
select core.fn_asegurar_particiones_futuras(3);

alter table crm.embudo_parametros enable row level security;
alter table crm.etapas enable row level security;
alter table crm.origenes enable row level security;
alter table crm.motivos_perdida enable row level security;
alter table crm.correlativos enable row level security;
alter table crm.leads enable row level security;
alter table crm.oportunidades enable row level security;
alter table crm.actividades enable row level security;
alter table crm.cotizaciones enable row level security;
alter table crm.cotizacion_lineas enable row level security;
alter table crm.eventos enable row level security;
-- crm.clientes conserva su GRANT y sus políticas; las tablas nuevas no tienen ninguno.
revoke all on crm.embudo_parametros, crm.etapas, crm.origenes, crm.motivos_perdida, crm.correlativos,
  crm.leads, crm.oportunidades, crm.actividades, crm.cotizaciones, crm.cotizacion_lineas, crm.eventos
  from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 4. Helpers internos (schema crm, sin EXECUTE para la API)
-- -----------------------------------------------------------------------------
create or replace function crm.fn_hoy()
returns date language sql stable set search_path = '' as $$
  select (now() at time zone 'America/Managua')::date;
$$;

create or replace function crm.fn_exigir_alguno(p_company_id uuid, p_codes text[])
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  c text;
begin
  if v_uid is not null then
    foreach c in array p_codes loop
      if core.has_permission(v_uid, p_company_id, c) then return v_uid; end if;
    end loop;
  end if;
  raise exception using errcode = '42501',
    message = format('No tenés permiso para esta acción (%s).', array_to_string(p_codes, ' o '));
end;
$$;

create or replace function crm.fn_puede(p_uid uuid, p_company_id uuid, p_code text)
returns boolean language sql stable security definer set search_path = '' as $$
  select p_uid is not null and core.has_permission(p_uid, p_company_id, p_code);
$$;

create or replace function crm.fn_equipo(p_uid uuid, p_company_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select crm.fn_puede(p_uid, p_company_id, 'crm.ventas.equipo.ver');
$$;

create or replace function crm.fn_no_encontrado()
returns void language plpgsql set search_path = '' as $$
begin
  raise exception 'No encontramos este registro o no lo tienes asignado.';
end;
$$;

create or replace function crm.fn_conflicto()
returns void language plpgsql set search_path = '' as $$
begin
  raise exception 'Este registro cambió mientras lo editabas. Recarga para ver la versión actual.';
end;
$$;

create or replace function crm.fn_nombre(p_user_id uuid)
returns text language sql stable security definer set search_path = '' as $$
  select coalesce(p.nombre_completo, u.email)
  from auth.users u left join core.perfiles p on p.user_id = u.id
  where u.id = p_user_id;
$$;

-- Texto recortado: null si viene vacío; error si no cumple el largo.
create or replace function crm.fn_txt(p_valor text, p_campo text, p_min integer, p_max integer, p_obligatorio boolean default false)
returns text language plpgsql immutable set search_path = '' as $$
declare v text := nullif(btrim(coalesce(p_valor, '')), '');
begin
  if v is null then
    if p_obligatorio then raise exception '% es obligatorio.', p_campo; end if;
    return null;
  end if;
  if length(v) < p_min or length(v) > p_max then
    raise exception '% debe tener entre % y % caracteres.', p_campo, p_min, p_max;
  end if;
  return v;
end;
$$;

-- 8 dígitos (Nicaragua) → +505XXXXXXXX; el resto se guarda recortado.
create or replace function crm.fn_tel(p_valor text)
returns text language plpgsql immutable set search_path = '' as $$
declare
  v text := nullif(btrim(coalesce(p_valor, '')), '');
  d text;
begin
  if v is null then return null; end if;
  d := regexp_replace(v, '[^0-9]', '', 'g');
  if length(d) = 8 then return '+505' || d; end if;
  if length(d) = 11 and left(d, 3) = '505' then return '+' || d; end if;
  if length(v) > 30 then raise exception 'El teléfono es demasiado largo.'; end if;
  return v;
end;
$$;

create or replace function crm.fn_correo(p_valor text)
returns text language plpgsql immutable set search_path = '' as $$
declare v text := lower(nullif(btrim(coalesce(p_valor, '')), ''));
begin
  if v is null then return null; end if;
  if length(v) > 160 or v !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'El correo no es válido.'; end if;
  return v;
end;
$$;

create or replace function crm.fn_monto(p_valor text, p_campo text, p_min numeric, p_max numeric)
returns numeric language plpgsql immutable set search_path = '' as $$
declare v numeric;
begin
  begin
    v := nullif(btrim(coalesce(p_valor, '')), '')::numeric;
  exception when others then
    raise exception '% no es un número válido.', p_campo;
  end;
  if v is null then raise exception '% es obligatorio.', p_campo; end if;
  if v < p_min or v > p_max then raise exception '% debe estar entre % y %.', p_campo, p_min, p_max; end if;
  return v;
end;
$$;

create or replace function crm.fn_fecha(p_valor text, p_campo text)
returns date language plpgsql immutable set search_path = '' as $$
declare v date;
begin
  begin
    v := nullif(btrim(coalesce(p_valor, '')), '')::date;
  exception when others then
    raise exception '% no es una fecha válida.', p_campo;
  end;
  if v is null then raise exception '% es obligatoria.', p_campo; end if;
  if v < date '2000-01-01' or v > date '2100-12-31' then raise exception '% está fuera de rango.', p_campo; end if;
  return v;
end;
$$;

-- Siembra idempotente de la configuración del embudo (decisión S6, 2026-10-19).
create or replace function crm.fn_sembrar_embudo(p_company_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  insert into crm.embudo_parametros (company_id) values (p_company_id) on conflict do nothing;
  if not exists (select 1 from crm.etapas e where e.company_id = p_company_id) then
    insert into crm.etapas (company_id, nombre, probabilidad, orden, tipo) values
      (p_company_id, 'Nuevo', 10, 1, 'abierta'),
      (p_company_id, 'Calificado', 25, 2, 'abierta'),
      (p_company_id, 'Cotización enviada', 50, 3, 'abierta'),
      (p_company_id, 'Negociación', 75, 4, 'abierta'),
      (p_company_id, 'Ganada', 100, 1000, 'ganada'),
      (p_company_id, 'Perdida', 0, 1001, 'perdida');
  end if;
  if not exists (select 1 from crm.origenes o where o.company_id = p_company_id) then
    insert into crm.origenes (company_id, nombre)
    select p_company_id, x from unnest(array['Sala de ventas', 'Llamada', 'WhatsApp', 'Referido', 'Redes sociales', 'Visita de campo']) x;
  end if;
  if not exists (select 1 from crm.motivos_perdida m where m.company_id = p_company_id) then
    insert into crm.motivos_perdida (company_id, nombre, pide_detalle) values
      (p_company_id, 'Precio', false),
      (p_company_id, 'Sin stock', false),
      (p_company_id, 'Tiempo de entrega', false),
      (p_company_id, 'Compró a la competencia', false),
      (p_company_id, 'Proyecto cancelado', false),
      (p_company_id, 'Otro', true);
  end if;
end;
$$;

-- Evento de la línea de tiempo + auditoría.
create or replace function crm.fn_evento(
  p_uid uuid, p_company_id uuid, p_entidad text, p_entidad_id uuid, p_oportunidad_id uuid, p_tipo text, p_datos jsonb default '{}'::jsonb
) returns void language plpgsql security definer set search_path = '' as $$
begin
  perform crm.fn_asegurar_particion_eventos(current_date);
  insert into crm.eventos (company_id, entidad, entidad_id, oportunidad_id, tipo, user_id, datos)
  values (p_company_id, p_entidad, p_entidad_id, p_oportunidad_id, p_tipo, p_uid, coalesce(p_datos, '{}'::jsonb));
  perform core.fn_auditar(p_uid, p_company_id, 'crm.' || p_entidad || '.' || p_tipo,
    'crm.' || case p_entidad when 'lead' then 'leads' when 'oportunidad' then 'oportunidades'
                             when 'cotizacion' then 'cotizaciones' else 'actividades' end,
    p_entidad_id::text, coalesce(p_datos, '{}'::jsonb));
end;
$$;

-- Usuario activo de la empresa con el permiso de ver el recurso.
create or replace function crm.fn_validar_responsable(p_company_id uuid, p_user_id uuid, p_code_ver text)
returns void language plpgsql stable security definer set search_path = '' as $$
begin
  if p_user_id is null or not exists (
    select 1 from core.company_memberships m where m.user_id = p_user_id and m.company_id = p_company_id and m.activo
  ) then
    raise exception 'El responsable no pertenece a la empresa o está inactivo.';
  end if;
  if not core.has_permission(p_user_id, p_company_id, p_code_ver) then
    raise exception 'El responsable elegido no tiene acceso a este tipo de registro.';
  end if;
end;
$$;

-- Responsable final de un alta/edición: el propio usuario salvo que tenga
-- asignacion.gestionar (y entonces se valida al elegido).
create or replace function crm.fn_resolver_responsable(
  p_uid uuid, p_company_id uuid, p_pedido uuid, p_actual uuid, p_code_ver text
) returns uuid language plpgsql stable security definer set search_path = '' as $$
declare v uuid := coalesce(p_pedido, p_actual, p_uid);
begin
  if v is distinct from coalesce(p_actual, p_uid) then
    if not crm.fn_puede(p_uid, p_company_id, 'crm.ventas.asignacion.gestionar') then
      raise exception 'Tu rol no permite cambiar el responsable.';
    end if;
    perform crm.fn_validar_responsable(p_company_id, v, p_code_ver);
  end if;
  return v;
end;
$$;

create or replace function crm.fn_cliente_de_empresa(p_company_id uuid, p_cliente_id uuid)
returns void language plpgsql stable security definer set search_path = '' as $$
begin
  if p_cliente_id is null or not exists (select 1 from crm.clientes c where c.id = p_cliente_id and c.company_id = p_company_id) then
    raise exception 'El cliente no existe.';
  end if;
end;
$$;

create or replace function crm.fn_siguiente_numero(p_company_id uuid, p_serie text, p_fecha date)
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_anio integer := extract(year from p_fecha);
  v_n bigint;
begin
  insert into crm.correlativos as c (company_id, serie, anio, ultimo) values (p_company_id, p_serie, v_anio, 1)
  on conflict (company_id, serie, anio) do update set ultimo = c.ultimo + 1
  returning c.ultimo into v_n;
  return p_serie || '-' || v_anio || '-' || lpad(v_n::text, 5, '0');
end;
$$;

-- ¿Puede ver el lead / la oportunidad? (registro vivo, de la empresa y en alcance)
create or replace function crm.fn_lead_visible(p_uid uuid, p_company_id uuid, p_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from crm.leads l where l.id = p_id and l.company_id = p_company_id and l.deleted_at is null
                 and (l.responsable_id = p_uid or crm.fn_equipo(p_uid, p_company_id)));
$$;

create or replace function crm.fn_oportunidad_visible(p_uid uuid, p_company_id uuid, p_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from crm.oportunidades o where o.id = p_id and o.company_id = p_company_id and o.deleted_at is null
                 and (o.responsable_id = p_uid or crm.fn_equipo(p_uid, p_company_id)));
$$;

-- Recalcula líneas y totales de una cotización con los parámetros vigentes.
create or replace function crm.fn_recalcular_cotizacion(p_id uuid, p_fecha date)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_bruto numeric; v_desc numeric; v_max numeric; v_neto numeric; v_iva numeric; v_efectivo numeric;
  q crm.cotizaciones;
begin
  select * into q from crm.cotizaciones c where c.id = p_id and c.fecha = p_fecha;
  update crm.cotizacion_lineas l
    set subtotal = round(l.cantidad * l.precio, 2),
        descuento_monto = round(round(l.cantidad * l.precio, 2) * l.descuento_pct / 100, 2),
        total = round(l.cantidad * l.precio, 2) - round(round(l.cantidad * l.precio, 2) * l.descuento_pct / 100, 2)
    where l.cotizacion_id = p_id and l.fecha = p_fecha;
  select coalesce(sum(l.subtotal), 0), coalesce(sum(l.descuento_monto), 0), coalesce(max(l.descuento_pct), 0)
    into v_bruto, v_desc, v_max
    from crm.cotizacion_lineas l where l.cotizacion_id = p_id and l.fecha = p_fecha;
  v_neto := v_bruto - v_desc;
  v_iva := case when q.exento_iva then 0 else round(v_neto * q.iva_porcentaje / 100, 2) end;
  v_efectivo := case when v_bruto > 0 then round(v_desc / v_bruto * 100, 4) else 0 end;
  update crm.cotizaciones c
    set subtotal_bruto = v_bruto, descuento_total = v_desc, subtotal_neto = v_neto, iva = v_iva,
        total = v_neto + v_iva, descuento_efectivo = v_efectivo, descuento_max_linea = v_max,
        requiere_aprobacion = (v_max > c.descuento_maximo or v_efectivo > c.descuento_maximo)
    where c.id = p_id and c.fecha = p_fecha;
end;
$$;

-- Siembra para las empresas que ya tienen el CRM.
do $$
declare r record;
begin
  for r in select ca.company_id from core.company_apps ca join core.apps a on a.id = ca.app_id where a.slug = 'crm' loop
    perform crm.fn_sembrar_embudo(r.company_id);
  end loop;
end;
$$;

-- -----------------------------------------------------------------------------
-- 5. RPC: permisos y configuración
-- -----------------------------------------------------------------------------
create or replace function public.crm_mis_permisos(p_company_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_uid uuid;
begin
  v_uid := core.fn_exigir_permiso(p_company_id, 'crm.ver_modulo');
  return coalesce((select jsonb_agg(pc.code order by pc.code) from core.permissions_catalog pc
                   where pc.module_slug = 'crm' and core.has_permission(v_uid, p_company_id, pc.code)), '[]'::jsonb);
end;
$$;

create or replace function public.crm_embudo_config(p_company_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_uid uuid; p crm.embudo_parametros;
begin
  v_uid := crm.fn_exigir_alguno(p_company_id, array[
    'crm.ventas.lead.ver', 'crm.ventas.oportunidad.ver', 'crm.ventas.actividad.ver', 'crm.ventas.cotizacion.ver',
    'crm.configuracion.embudo.gestionar']);
  perform crm.fn_sembrar_embudo(p_company_id);
  select * into p from crm.embudo_parametros x where x.company_id = p_company_id;
  return jsonb_build_object(
    'etapas', coalesce((select jsonb_agg(jsonb_build_object('id', e.id, 'nombre', e.nombre, 'probabilidad', e.probabilidad,
        'orden', e.orden, 'tipo', e.tipo, 'activa', e.activa,
        'abiertas', (select count(*) from crm.oportunidades o where o.etapa_id = e.id and o.estado = 'abierta' and o.deleted_at is null),
        'total', (select count(*) from crm.oportunidades o where o.etapa_id = e.id and o.deleted_at is null))
      order by e.orden, e.nombre) from crm.etapas e where e.company_id = p_company_id), '[]'::jsonb),
    'origenes', coalesce((select jsonb_agg(jsonb_build_object('id', o.id, 'nombre', o.nombre, 'activo', o.activo,
        'leads', (select count(*) from crm.leads l where l.origen_id = o.id))
      order by o.nombre) from crm.origenes o where o.company_id = p_company_id), '[]'::jsonb),
    'motivos_perdida', coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'nombre', m.nombre, 'pide_detalle', m.pide_detalle,
        'activo', m.activo, 'oportunidades', (select count(*) from crm.oportunidades o where o.motivo_perdida_id = m.id))
      order by m.nombre) from crm.motivos_perdida m where m.company_id = p_company_id), '[]'::jsonb),
    'parametros', jsonb_build_object('descuento_maximo', p.descuento_maximo, 'iva_porcentaje', p.iva_porcentaje,
      'tipo_cambio', p.tipo_cambio, 'validez_dias', p.validez_dias, 'empresa', p.empresa),
    'hoy', crm.fn_hoy());
end;
$$;

-- p_tipo solo se usa al crear (siempre 'abierta'): ganada y perdida las crea el sistema.
create or replace function public.crm_embudo_guardar_etapa(
  p_company_id uuid, p_id uuid, p_nombre text, p_probabilidad numeric, p_activa boolean
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid; e crm.etapas; v_nombre text; v_abiertas integer; v_actualizadas integer := 0;
begin
  v_uid := core.fn_exigir_permiso(p_company_id, 'crm.configuracion.embudo.gestionar');
  perform crm.fn_sembrar_embudo(p_company_id);
  v_nombre := crm.fn_txt(p_nombre, 'El nombre', 2, 60, true);
  if exists (select 1 from crm.etapas x where x.company_id = p_company_id and lower(x.nombre) = lower(v_nombre)
             and x.id is distinct from p_id) then
    raise exception 'Ya existe una etapa con ese nombre.';
  end if;

  if p_id is null then
    if p_probabilidad is null or p_probabilidad < 0 or p_probabilidad > 100 then
      raise exception 'La probabilidad debe estar entre 0 y 100.';
    end if;
    insert into crm.etapas (company_id, nombre, probabilidad, orden, tipo, activa)
    values (p_company_id, v_nombre, round(p_probabilidad, 2),
            coalesce((select max(x.orden) from crm.etapas x where x.company_id = p_company_id and x.tipo = 'abierta'), 0) + 1,
            'abierta', coalesce(p_activa, true))
    returning * into e;
  else
    select * into e from crm.etapas x where x.id = p_id and x.company_id = p_company_id for update;
    if not found then perform crm.fn_no_encontrado(); end if;
    if e.tipo <> 'abierta' then
      if p_activa is false then raise exception 'La etapa % no se puede desactivar.', e.nombre; end if;
      if p_probabilidad is not null and p_probabilidad <> e.probabilidad then
        raise exception 'La probabilidad de la etapa % no se puede cambiar.', e.nombre;
      end if;
    else
      if p_probabilidad is null or p_probabilidad < 0 or p_probabilidad > 100 then
        raise exception 'La probabilidad debe estar entre 0 y 100.';
      end if;
      if p_activa is false and e.activa then
        select count(*) into v_abiertas from crm.oportunidades o
          where o.etapa_id = e.id and o.estado = 'abierta' and o.deleted_at is null;
        if v_abiertas > 0 then
          raise exception 'Mueve sus % oportunidades a otra etapa antes de desactivarla.', v_abiertas;
        end if;
        if not exists (select 1 from crm.etapas x where x.company_id = p_company_id and x.tipo = 'abierta'
                       and x.activa and x.id <> e.id) then
          raise exception 'El embudo necesita al menos una etapa abierta activa.';
        end if;
      end if;
    end if;

    update crm.etapas x set nombre = v_nombre,
      probabilidad = case when x.tipo = 'abierta' then round(p_probabilidad, 2) else x.probabilidad end,
      activa = case when x.tipo = 'abierta' then coalesce(p_activa, x.activa) else true end,
      updated_at = now()
    where x.id = e.id returning * into e;

    -- Las oportunidades abiertas que siguen la probabilidad de la etapa se actualizan.
    update crm.oportunidades o set probabilidad = e.probabilidad, updated_at = now(), version = o.version + 1
      where o.etapa_id = e.id and o.estado = 'abierta' and not o.probabilidad_ajustada and o.probabilidad <> e.probabilidad;
    get diagnostics v_actualizadas = row_count;
  end if;

  perform core.fn_auditar(v_uid, p_company_id, 'crm.embudo.etapa.guardar', 'crm.etapas', e.id::text,
    jsonb_build_object('nombre', e.nombre, 'probabilidad', e.probabilidad, 'activa', e.activa, 'oportunidades_actualizadas', v_actualizadas));
  return jsonb_build_object('id', e.id, 'nombre', e.nombre, 'probabilidad', e.probabilidad, 'orden', e.orden,
    'tipo', e.tipo, 'activa', e.activa, 'oportunidades_actualizadas', v_actualizadas);
end;
$$;

-- p_ids: todas las etapas abiertas de la empresa en el orden nuevo.
create or replace function public.crm_embudo_reordenar_etapas(p_company_id uuid, p_ids uuid[])
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_uid uuid; i integer;
begin
  v_uid := core.fn_exigir_permiso(p_company_id, 'crm.configuracion.embudo.gestionar');
  if p_ids is null or cardinality(p_ids) <> (select count(distinct x) from unnest(p_ids) x)
     or (select array_agg(e.id order by e.id) from crm.etapas e where e.company_id = p_company_id and e.tipo = 'abierta')
        is distinct from (select array_agg(x order by x) from unnest(p_ids) x) then
    raise exception 'El orden debe incluir todas las etapas abiertas, una sola vez.';
  end if;
  for i in 1..cardinality(p_ids) loop
    update crm.etapas e set orden = i, updated_at = now() where e.id = p_ids[i];
  end loop;
  perform core.fn_auditar(v_uid, p_company_id, 'crm.embudo.etapa.reordenar', 'crm.etapas', null, jsonb_build_object('orden', to_jsonb(p_ids)));
  return public.crm_embudo_config(p_company_id);
end;
$$;

create or replace function public.crm_embudo_guardar_origen(p_company_id uuid, p_id uuid, p_nombre text, p_activo boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_uid uuid; v_nombre text; o crm.origenes;
begin
  v_uid := core.fn_exigir_permiso(p_company_id, 'crm.configuracion.embudo.gestionar');
  v_nombre := crm.fn_txt(p_nombre, 'El nombre', 2, 60, true);
  if exists (select 1 from crm.origenes x where x.company_id = p_company_id and lower(x.nombre) = lower(v_nombre) and x.id is distinct from p_id) then
    raise exception 'Ya existe un origen con ese nombre.';
  end if;
  if p_id is null then
    insert into crm.origenes (company_id, nombre, activo) values (p_company_id, v_nombre, coalesce(p_activo, true)) returning * into o;
  else
    update crm.origenes x set nombre = v_nombre, activo = coalesce(p_activo, x.activo), updated_at = now()
      where x.id = p_id and x.company_id = p_company_id returning * into o;
    if not found then perform crm.fn_no_encontrado(); end if;
  end if;
  perform core.fn_auditar(v_uid, p_company_id, 'crm.embudo.origen.guardar', 'crm.origenes', o.id::text,
    jsonb_build_object('nombre', o.nombre, 'activo', o.activo));
  return jsonb_build_object('id', o.id, 'nombre', o.nombre, 'activo', o.activo);
end;
$$;

create or replace function public.crm_embudo_guardar_motivo(p_company_id uuid, p_id uuid, p_nombre text, p_pide_detalle boolean, p_activo boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_uid uuid; v_nombre text; m crm.motivos_perdida;
begin
  v_uid := core.fn_exigir_permiso(p_company_id, 'crm.configuracion.embudo.gestionar');
  v_nombre := crm.fn_txt(p_nombre, 'El nombre', 2, 60, true);
  if exists (select 1 from crm.motivos_perdida x where x.company_id = p_company_id and lower(x.nombre) = lower(v_nombre) and x.id is distinct from p_id) then
    raise exception 'Ya existe un motivo con ese nombre.';
  end if;
  if p_id is null then
    insert into crm.motivos_perdida (company_id, nombre, pide_detalle, activo)
      values (p_company_id, v_nombre, coalesce(p_pide_detalle, false), coalesce(p_activo, true)) returning * into m;
  else
    update crm.motivos_perdida x set nombre = v_nombre, pide_detalle = coalesce(p_pide_detalle, x.pide_detalle),
      activo = coalesce(p_activo, x.activo), updated_at = now()
      where x.id = p_id and x.company_id = p_company_id returning * into m;
    if not found then perform crm.fn_no_encontrado(); end if;
  end if;
  perform core.fn_auditar(v_uid, p_company_id, 'crm.embudo.motivo.guardar', 'crm.motivos_perdida', m.id::text,
    jsonb_build_object('nombre', m.nombre, 'pide_detalle', m.pide_detalle, 'activo', m.activo));
  return jsonb_build_object('id', m.id, 'nombre', m.nombre, 'pide_detalle', m.pide_detalle, 'activo', m.activo);
end;
$$;

-- Borra una etapa abierta, un origen o un motivo que nunca se usó.
create or replace function public.crm_embudo_eliminar(p_company_id uuid, p_tipo text, p_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_uid uuid; v_n integer;
begin
  v_uid := core.fn_exigir_permiso(p_company_id, 'crm.configuracion.embudo.gestionar');
  if p_tipo = 'etapa' then
    if exists (select 1 from crm.etapas e where e.id = p_id and e.company_id = p_company_id and e.tipo <> 'abierta') then
      raise exception 'Las etapas Ganada y Perdida no se pueden borrar.';
    end if;
    if exists (select 1 from crm.oportunidades o where o.etapa_id = p_id) then
      raise exception 'Esta etapa tiene oportunidades: desactívala en vez de borrarla.';
    end if;
    if not exists (select 1 from crm.etapas x where x.company_id = p_company_id and x.tipo = 'abierta' and x.activa and x.id <> p_id) then
      raise exception 'El embudo necesita al menos una etapa abierta activa.';
    end if;
    delete from crm.etapas e where e.id = p_id and e.company_id = p_company_id;
  elsif p_tipo = 'origen' then
    if exists (select 1 from crm.leads l where l.origen_id = p_id) then
      raise exception 'Este origen tiene leads: desactívalo en vez de borrarlo.';
    end if;
    delete from crm.origenes o where o.id = p_id and o.company_id = p_company_id;
  elsif p_tipo = 'motivo' then
    if exists (select 1 from crm.oportunidades o where o.motivo_perdida_id = p_id) then
      raise exception 'Este motivo tiene oportunidades: desactívalo en vez de borrarlo.';
    end if;
    delete from crm.motivos_perdida m where m.id = p_id and m.company_id = p_company_id;
  else
    raise exception 'Tipo de catálogo inválido.';
  end if;
  get diagnostics v_n = row_count;
  if v_n = 0 then perform crm.fn_no_encontrado(); end if;
  perform core.fn_auditar(v_uid, p_company_id, 'crm.embudo.' || p_tipo || '.eliminar', 'crm.' || p_tipo, p_id::text, '{}'::jsonb);
  return jsonb_build_object('ok', true);
end;
$$;

-- p_datos: {descuento_maximo, iva_porcentaje, tipo_cambio, validez_dias, empresa:{razon_social, ruc, direccion, telefono, correo}}
create or replace function public.crm_embudo_guardar_parametros(p_company_id uuid, p_datos jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_uid uuid; v_antes crm.embudo_parametros; v_emp jsonb; v_desp crm.embudo_parametros;
begin
  v_uid := core.fn_exigir_permiso(p_company_id, 'crm.configuracion.embudo.gestionar');
  perform crm.fn_sembrar_embudo(p_company_id);
  if jsonb_typeof(p_datos) is distinct from 'object' then raise exception 'Datos inválidos.'; end if;
  select * into v_antes from crm.embudo_parametros x where x.company_id = p_company_id for update;
  v_emp := jsonb_strip_nulls(jsonb_build_object(
    'razon_social', crm.fn_txt(p_datos->'empresa'->>'razon_social', 'La razón social', 2, 160),
    'ruc', crm.fn_txt(p_datos->'empresa'->>'ruc', 'El RUC', 3, 30),
    'direccion', crm.fn_txt(p_datos->'empresa'->>'direccion', 'La dirección', 3, 300),
    'telefono', crm.fn_txt(p_datos->'empresa'->>'telefono', 'El teléfono', 3, 60),
    'correo', crm.fn_correo(p_datos->'empresa'->>'correo')));
  update crm.embudo_parametros x set
    descuento_maximo = case when p_datos ? 'descuento_maximo' then round(crm.fn_monto(p_datos->>'descuento_maximo', 'El descuento máximo', 0, 100), 2) else x.descuento_maximo end,
    iva_porcentaje = case when p_datos ? 'iva_porcentaje' then round(crm.fn_monto(p_datos->>'iva_porcentaje', 'El IVA', 0, 100), 2) else x.iva_porcentaje end,
    tipo_cambio = case when p_datos ? 'tipo_cambio' then round(crm.fn_monto(p_datos->>'tipo_cambio', 'El tipo de cambio', 0.0001, 9999), 4) else x.tipo_cambio end,
    validez_dias = case when p_datos ? 'validez_dias' then crm.fn_monto(p_datos->>'validez_dias', 'La validez', 1, 365)::integer else x.validez_dias end,
    empresa = case when p_datos ? 'empresa' then v_emp else x.empresa end,
    updated_by = v_uid, updated_at = now()
  where x.company_id = p_company_id returning * into v_desp;
  perform core.fn_auditar(v_uid, p_company_id, 'crm.embudo.parametros.guardar', 'crm.embudo_parametros', p_company_id::text,
    jsonb_build_object('antes', to_jsonb(v_antes) - 'company_id', 'despues', to_jsonb(v_desp) - 'company_id'));
  return public.crm_embudo_config(p_company_id);
end;
$$;

-- -----------------------------------------------------------------------------
-- 6. RPC: responsables, reasignación y búsquedas
-- -----------------------------------------------------------------------------
-- p_recurso: lead | oportunidad | actividad | cotizacion
create or replace function public.crm_responsables(p_company_id uuid, p_recurso text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_code text;
begin
  perform crm.fn_exigir_alguno(p_company_id, array['crm.ventas.equipo.ver', 'crm.ventas.asignacion.gestionar']);
  if p_recurso not in ('lead', 'oportunidad', 'actividad', 'cotizacion') then raise exception 'Recurso inválido.'; end if;
  v_code := 'crm.ventas.' || p_recurso || '.ver';
  return coalesce((select jsonb_agg(jsonb_build_object('user_id', m.user_id, 'nombre', coalesce(pf.nombre_completo, u.email))
      order by coalesce(pf.nombre_completo, u.email))
    from core.company_memberships m
    join auth.users u on u.id = m.user_id
    left join core.perfiles pf on pf.user_id = m.user_id
    where m.company_id = p_company_id and m.activo and core.has_permission(m.user_id, p_company_id, v_code)), '[]'::jsonb);
end;
$$;

create or replace function public.crm_reasignar(
  p_company_id uuid, p_recurso text, p_ids uuid[], p_responsable uuid, p_incluir_relacionados boolean default true
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid; v_equipo boolean; v_id uuid; v_antes uuid; v_n integer := 0; v_rel integer := 0; v_k integer; v_opp uuid;
begin
  v_uid := core.fn_exigir_permiso(p_company_id, 'crm.ventas.asignacion.gestionar');
  if p_recurso not in ('lead', 'oportunidad', 'cotizacion') then raise exception 'Recurso inválido.'; end if;
  if p_ids is null or cardinality(p_ids) = 0 then raise exception 'Selecciona al menos un registro.'; end if;
  if cardinality(p_ids) > 500 then raise exception 'Máximo 500 registros por reasignación.'; end if;
  perform crm.fn_validar_responsable(p_company_id, p_responsable, 'crm.ventas.' || p_recurso || '.ver');
  v_equipo := crm.fn_equipo(v_uid, p_company_id);

  foreach v_id in array p_ids loop
    if p_recurso = 'lead' then
      select l.responsable_id into v_antes from crm.leads l
        where l.id = v_id and l.company_id = p_company_id and l.deleted_at is null and (v_equipo or l.responsable_id = v_uid) for update;
      if not found then perform crm.fn_no_encontrado(); end if;
      continue when v_antes = p_responsable;
      update crm.leads l set responsable_id = p_responsable, updated_at = now(), version = l.version + 1 where l.id = v_id;
      if coalesce(p_incluir_relacionados, true) then
        update crm.actividades a set responsable_id = p_responsable, updated_at = now(), version = a.version + 1
          where a.lead_id = v_id and a.estado = 'agendada' and a.deleted_at is null;
        get diagnostics v_k = row_count; v_rel := v_rel + v_k;
      end if;
      v_opp := null;
    elsif p_recurso = 'oportunidad' then
      select o.responsable_id into v_antes from crm.oportunidades o
        where o.id = v_id and o.company_id = p_company_id and o.deleted_at is null and (v_equipo or o.responsable_id = v_uid) for update;
      if not found then perform crm.fn_no_encontrado(); end if;
      continue when v_antes = p_responsable;
      update crm.oportunidades o set responsable_id = p_responsable, updated_at = now(), version = o.version + 1 where o.id = v_id;
      if coalesce(p_incluir_relacionados, true) then
        update crm.actividades a set responsable_id = p_responsable, updated_at = now(), version = a.version + 1
          where a.oportunidad_id = v_id and a.estado = 'agendada' and a.deleted_at is null;
        get diagnostics v_k = row_count; v_rel := v_rel + v_k;
        update crm.cotizaciones c set responsable_id = p_responsable, updated_at = now(), version = c.version + 1
          where c.oportunidad_id = v_id and c.estado in ('borrador', 'pendiente_aprobacion', 'aprobada', 'enviada');
        get diagnostics v_k = row_count; v_rel := v_rel + v_k;
      end if;
      v_opp := v_id;
    else
      select c.responsable_id, c.oportunidad_id into v_antes, v_opp from crm.cotizaciones c
        where c.id = v_id and c.company_id = p_company_id and (v_equipo or c.responsable_id = v_uid) for update;
      if not found then perform crm.fn_no_encontrado(); end if;
      continue when v_antes = p_responsable;
      update crm.cotizaciones c set responsable_id = p_responsable, updated_at = now(), version = c.version + 1 where c.id = v_id;
    end if;
    v_n := v_n + 1;
    perform crm.fn_evento(v_uid, p_company_id, p_recurso, v_id, v_opp, 'reasignada',
      jsonb_build_object('de', v_antes, 'de_nombre', crm.fn_nombre(v_antes), 'a', p_responsable, 'a_nombre', crm.fn_nombre(p_responsable)));
  end loop;
  return jsonb_build_object('reasignados', v_n, 'relacionados', v_rel, 'responsable_nombre', crm.fn_nombre(p_responsable));
end;
$$;

create or replace function public.crm_clientes_buscar(p_company_id uuid, p_texto text, p_limite integer default 20)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_t text := nullif(btrim(coalesce(p_texto, '')), '');
begin
  perform crm.fn_exigir_alguno(p_company_id, array['crm.clientes.ver', 'crm.ventas.lead.convertir']);
  return coalesce((select jsonb_agg(to_jsonb(x)) from (
    select c.id, c.numero_cliente, c.nombre, c.ruc, c.telefono, c.tipo_cliente
    from crm.clientes c
    where c.company_id = p_company_id
      and (v_t is null or c.nombre ilike '%' || v_t || '%' or c.ruc ilike '%' || v_t || '%'
           or c.telefono ilike '%' || v_t || '%' or c.numero_cliente::text = v_t)
    order by c.nombre
    limit least(greatest(coalesce(p_limite, 20), 1), 50)) x), '[]'::jsonb);
end;
$$;

-- Catálogo para cotizar, sin costos (decisión P4).
create or replace function public.crm_productos_buscar(p_company_id uuid, p_texto text, p_limite integer default 20)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_t text := nullif(btrim(coalesce(p_texto, '')), '');
begin
  perform crm.fn_exigir_alguno(p_company_id, array['crm.ventas.cotizacion.crear', 'crm.ventas.cotizacion.editar']);
  return coalesce((select jsonb_agg(to_jsonb(x)) from (
    select p.id, p.codigo, p.nombre, u.nombre as unidad, u.simbolo as unidad_simbolo, p.es_servicio
    from productos.productos p
    join productos.unidades u on u.id = p.unidad_id
    where p.company_id = p_company_id and not p.descontinuado_ventas
      and (v_t is null or p.codigo ilike '%' || v_t || '%' or p.nombre ilike '%' || v_t || '%' or p.codigo_barras = v_t)
    order by (p.codigo ilike v_t || '%') desc, p.nombre
    limit least(greatest(coalesce(p_limite, 20), 1), 50)) x), '[]'::jsonb);
end;
$$;

-- -----------------------------------------------------------------------------
-- 7. RPC: leads
-- -----------------------------------------------------------------------------
create or replace function crm.fn_lead_json(p_uid uuid, p_company_id uuid, l crm.leads)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', l.id, 'contacto', l.contacto, 'negocio', l.negocio, 'telefono', l.telefono, 'correo', l.correo,
    'ruc', l.ruc, 'direccion', l.direccion, 'origen_id', l.origen_id,
    'origen', (select o.nombre from crm.origenes o where o.id = l.origen_id),
    'tipo_cliente', l.tipo_cliente, 'interes', l.interes, 'estado', l.estado, 'motivo_descarte', l.motivo_descarte,
    'responsable_id', l.responsable_id, 'responsable', crm.fn_nombre(l.responsable_id),
    'cliente_id', l.cliente_id, 'cliente', (select c.nombre from crm.clientes c where c.id = l.cliente_id),
    'oportunidad_id', l.oportunidad_id, 'oportunidad', (select o.nombre from crm.oportunidades o where o.id = l.oportunidad_id),
    'convertido_en', l.convertido_en, 'created_at', l.created_at, 'updated_at', l.updated_at, 'version', l.version,
    'proxima_actividad', (select min(a.fecha) from crm.actividades a
                          where a.lead_id = l.id and a.estado = 'agendada' and a.deleted_at is null),
    'ultima_actividad', (select max(a.fecha) from crm.actividades a
                         where a.lead_id = l.id and a.estado = 'completada' and a.deleted_at is null));
$$;

create or replace function public.crm_leads_listar(
  p_company_id uuid, p_estados text[] default null, p_origen_id uuid default null, p_responsable uuid default null,
  p_buscar text default null, p_sin_seguimiento boolean default false, p_limite integer default 50, p_desplazamiento integer default 0
) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid uuid; v_equipo boolean; v_resp uuid; v_t text := nullif(btrim(coalesce(p_buscar, '')), '');
  v_lim integer := least(greatest(coalesce(p_limite, 50), 1), 200);
  v_off integer := greatest(coalesce(p_desplazamiento, 0), 0);
begin
  v_uid := core.fn_exigir_permiso(p_company_id, 'crm.ventas.lead.ver');
  v_equipo := crm.fn_equipo(v_uid, p_company_id);
  v_resp := case when v_equipo then p_responsable else v_uid end;
  return (
    with base as (
      select l.* from crm.leads l
      where l.company_id = p_company_id and l.deleted_at is null
        and (v_resp is null or l.responsable_id = v_resp)
        and (p_origen_id is null or l.origen_id = p_origen_id)
        and (v_t is null or l.contacto ilike '%' || v_t || '%' or l.negocio ilike '%' || v_t || '%'
             or l.telefono ilike '%' || v_t || '%' or l.correo ilike '%' || v_t || '%' or l.ruc ilike '%' || v_t || '%')
        and (not coalesce(p_sin_seguimiento, false) or (l.estado in ('nuevo', 'contactado') and not exists (
              select 1 from crm.actividades a where a.lead_id = l.id and a.deleted_at is null
                and (a.estado = 'agendada' or (a.estado = 'completada' and a.fecha > now() - interval '7 days')))))
    ), filtrado as (
      select * from base b where p_estados is null or b.estado = any(p_estados)
    )
    select jsonb_build_object(
      'total', (select count(*) from filtrado),
      'conteos', jsonb_build_object(
        'activos', (select count(*) from base where estado in ('nuevo', 'contactado', 'calificado')),
        'nuevo', (select count(*) from base where estado = 'nuevo'),
        'contactado', (select count(*) from base where estado = 'contactado'),
        'calificado', (select count(*) from base where estado = 'calificado'),
        'convertido', (select count(*) from base where estado = 'convertido'),
        'descartado', (select count(*) from base where estado = 'descartado')),
      'equipo', v_equipo,
      'filas', coalesce((select jsonb_agg(crm.fn_lead_json(v_uid, p_company_id, l) order by l.created_at desc)
                         from crm.leads l
                         where l.id in (select id from filtrado order by created_at desc limit v_lim offset v_off)), '[]'::jsonb))
  );
end;
$$;

create or replace function public.crm_lead_obtener(p_company_id uuid, p_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_uid uuid; l crm.leads;
begin
  v_uid := core.fn_exigir_permiso(p_company_id, 'crm.ventas.lead.ver');
  select * into l from crm.leads x where x.id = p_id and x.company_id = p_company_id and x.deleted_at is null
    and (x.responsable_id = v_uid or crm.fn_equipo(v_uid, p_company_id));
  if not found then perform crm.fn_no_encontrado(); end if;
  return crm.fn_lead_json(v_uid, p_company_id, l) || jsonb_build_object(
    'acciones', jsonb_build_object(
      'editar', l.estado <> 'convertido' and crm.fn_puede(v_uid, p_company_id, 'crm.ventas.lead.editar'),
      'convertir', l.estado in ('nuevo', 'contactado', 'calificado') and crm.fn_puede(v_uid, p_company_id, 'crm.ventas.lead.convertir'),
      'eliminar', l.estado <> 'convertido' and crm.fn_puede(v_uid, p_company_id, 'crm.ventas.lead.eliminar'),
      'reasignar', l.estado <> 'convertido' and crm.fn_puede(v_uid, p_company_id, 'crm.ventas.asignacion.gestionar'),
      'registrar_actividad', crm.fn_puede(v_uid, p_company_id, 'crm.ventas.actividad.crear')));
end;
$$;

-- p_datos: {contacto, negocio, telefono, correo, ruc, direccion, origen_id, tipo_cliente, interes, responsable_id}
create or replace function public.crm_lead_guardar(p_company_id uuid, p_id uuid, p_datos jsonb, p_version integer default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid; l crm.leads; v_tel text; v_correo text; v_origen uuid; v_resp uuid; v_tipo text;
begin
  if p_id is null then
    v_uid := core.fn_exigir_permiso(p_company_id, 'crm.ventas.lead.crear');
  else
    v_uid := core.fn_exigir_permiso(p_company_id, 'crm.ventas.lead.editar');
    select * into l from crm.leads x where x.id = p_id and x.company_id = p_company_id and x.deleted_at is null
      and (x.responsable_id = v_uid or crm.fn_equipo(v_uid, p_company_id)) for update;
    if not found then perform crm.fn_no_encontrado(); end if;
    if p_version is distinct from l.version then perform crm.fn_conflicto(); end if;
    if l.estado = 'convertido' then raise exception 'Este lead ya se convirtió: edita los datos en el cliente.'; end if;
  end if;
  if jsonb_typeof(p_datos) is distinct from 'object' then raise exception 'Datos inválidos.'; end if;
  perform crm.fn_sembrar_embudo(p_company_id);

  v_tel := crm.fn_tel(p_datos->>'telefono');
  v_correo := crm.fn_correo(p_datos->>'correo');
  if v_tel is null and v_correo is null then raise exception 'Indica un teléfono o un correo.'; end if;
  v_origen := nullif(p_datos->>'origen_id', '')::uuid;
  if v_origen is null then raise exception 'El origen es obligatorio.'; end if;
  if not exists (select 1 from crm.origenes o where o.id = v_origen and o.company_id = p_company_id
                 and (o.activo or v_origen = l.origen_id)) then
    raise exception 'El origen no existe o está inactivo.';
  end if;
  v_tipo := nullif(btrim(coalesce(p_datos->>'tipo_cliente', '')), '');
  if v_tipo is not null and v_tipo not in ('mayorista', 'detal') then raise exception 'Tipo de cliente inválido.'; end if;
  v_resp := crm.fn_resolver_responsable(v_uid, p_company_id, nullif(p_datos->>'responsable_id', '')::uuid,
                                        l.responsable_id, 'crm.ventas.lead.ver');

  if p_id is null then
    insert into crm.leads (company_id, contacto, negocio, telefono, correo, ruc, direccion, origen_id, tipo_cliente,
                           interes, responsable_id, created_by)
    values (p_company_id, crm.fn_txt(p_datos->>'contacto', 'El nombre del contacto', 2, 120, true),
            crm.fn_txt(p_datos->>'negocio', 'El negocio', 1, 120), v_tel, v_correo,
            crm.fn_txt(p_datos->>'ruc', 'El RUC o cédula', 3, 30), crm.fn_txt(p_datos->>'direccion', 'La dirección', 1, 300),
            v_origen, v_tipo, crm.fn_txt(p_datos->>'interes', 'El interés', 1, 2000), v_resp, v_uid)
    returning * into l;
    perform crm.fn_evento(v_uid, p_company_id, 'lead', l.id, null, 'creado', jsonb_build_object('contacto', l.contacto));
  else
    update crm.leads x set
      contacto = crm.fn_txt(p_datos->>'contacto', 'El nombre del contacto', 2, 120, true),
      negocio = crm.fn_txt(p_datos->>'negocio', 'El negocio', 1, 120), telefono = v_tel, correo = v_correo,
      ruc = crm.fn_txt(p_datos->>'ruc', 'El RUC o cédula', 3, 30), direccion = crm.fn_txt(p_datos->>'direccion', 'La dirección', 1, 300),
      origen_id = v_origen, tipo_cliente = v_tipo, interes = crm.fn_txt(p_datos->>'interes', 'El interés', 1, 2000),
      responsable_id = v_resp, updated_at = now(), version = x.version + 1
    where x.id = p_id returning * into l;
    perform crm.fn_evento(v_uid, p_company_id, 'lead', l.id, null, 'editado', '{}'::jsonb);
  end if;
  return jsonb_build_object('id', l.id, 'version', l.version);
end;
$$;

-- Coincidencias por teléfono, correo o RUC (aviso que no bloquea).
create or replace function public.crm_lead_duplicados(
  p_company_id uuid, p_telefono text, p_correo text, p_ruc text, p_excluir_id uuid default null
) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid uuid; v_tel text := crm.fn_tel(p_telefono); v_correo text; v_ruc text := nullif(btrim(coalesce(p_ruc, '')), '');
  v_equipo boolean;
begin
  v_uid := crm.fn_exigir_alguno(p_company_id, array['crm.ventas.lead.crear', 'crm.ventas.lead.editar']);
  begin v_correo := crm.fn_correo(p_correo); exception when others then v_correo := null; end;
  v_equipo := crm.fn_equipo(v_uid, p_company_id);
  return jsonb_build_object(
    'leads', coalesce((select jsonb_agg(jsonb_build_object('id', l.id, 'contacto', l.contacto, 'negocio', l.negocio,
        'estado', l.estado, 'visible', v_equipo or l.responsable_id = v_uid,
        'coincide', case when l.telefono = v_tel then 'telefono' when lower(l.correo) = v_correo then 'correo' else 'ruc' end))
      from crm.leads l where l.company_id = p_company_id and l.deleted_at is null and l.id is distinct from p_excluir_id
        and ((v_tel is not null and l.telefono = v_tel) or (v_correo is not null and lower(l.correo) = v_correo)
             or (v_ruc is not null and l.ruc = v_ruc))), '[]'::jsonb),
    'clientes', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'numero_cliente', c.numero_cliente, 'nombre', c.nombre,
        'coincide', case when v_ruc is not null and c.ruc = v_ruc then 'ruc' else 'telefono' end))
      from crm.clientes c where c.company_id = p_company_id
        and ((v_ruc is not null and c.ruc = v_ruc)
             or (v_tel is not null and regexp_replace(coalesce(c.telefono, ''), '[^0-9]', '', 'g') <> ''
                 and right(regexp_replace(c.telefono, '[^0-9]', '', 'g'), 8) = right(regexp_replace(v_tel, '[^0-9]', '', 'g'), 8)))
      ), '[]'::jsonb));
end;
$$;

-- nuevo/contactado/calificado entre sí; descartar (con motivo); reactivar descartado → contactado.
create or replace function public.crm_lead_cambiar_estado(p_company_id uuid, p_id uuid, p_estado text, p_motivo text, p_version integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_uid uuid; l crm.leads; v_motivo text;
begin
  v_uid := core.fn_exigir_permiso(p_company_id, 'crm.ventas.lead.editar');
  select * into l from crm.leads x where x.id = p_id and x.company_id = p_company_id and x.deleted_at is null
    and (x.responsable_id = v_uid or crm.fn_equipo(v_uid, p_company_id)) for update;
  if not found then perform crm.fn_no_encontrado(); end if;
  if p_version is distinct from l.version then perform crm.fn_conflicto(); end if;
  if l.estado = 'convertido' then raise exception 'Este lead ya se convirtió.'; end if;
  if p_estado not in ('nuevo', 'contactado', 'calificado', 'descartado') then raise exception 'Estado inválido.'; end if;
  if l.estado = 'descartado' and p_estado <> 'contactado' then
    raise exception 'Un lead descartado solo se puede reactivar como contactado.';
  end if;
  if p_estado = 'descartado' then
    v_motivo := crm.fn_txt(p_motivo, 'El motivo', 3, 300, true);
  end if;
  update crm.leads x set estado = p_estado, motivo_descarte = case when p_estado = 'descartado' then v_motivo end,
    updated_at = now(), version = x.version + 1 where x.id = p_id returning * into l;
  perform crm.fn_evento(v_uid, p_company_id, 'lead', l.id, null, 'estado',
    jsonb_build_object('estado', p_estado, 'motivo', v_motivo));
  return jsonb_build_object('id', l.id, 'estado', l.estado, 'version', l.version);
end;
$$;

create or replace function public.crm_lead_candidatos_cliente(p_company_id uuid, p_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_uid uuid; l crm.leads;
begin
  v_uid := core.fn_exigir_permiso(p_company_id, 'crm.ventas.lead.convertir');
  select * into l from crm.leads x where x.id = p_id and x.company_id = p_company_id and x.deleted_at is null
    and (x.responsable_id = v_uid or crm.fn_equipo(v_uid, p_company_id));
  if not found then perform crm.fn_no_encontrado(); end if;
  return coalesce((select jsonb_agg(to_jsonb(x) order by x.peso desc, x.nombre) from (
    select c.id, c.numero_cliente, c.nombre, c.ruc, c.telefono, c.tipo_cliente,
      case when l.ruc is not null and c.ruc = l.ruc then 3
           when l.telefono is not null and right(regexp_replace(coalesce(c.telefono, ''), '[^0-9]', '', 'g'), 8)
                = right(regexp_replace(l.telefono, '[^0-9]', '', 'g'), 8) then 2 else 1 end as peso,
      (l.ruc is not null and c.ruc = l.ruc) as mismo_ruc
    from crm.clientes c
    where c.company_id = p_company_id and (
      (l.ruc is not null and c.ruc = l.ruc)
      or (l.telefono is not null and regexp_replace(coalesce(c.telefono, ''), '[^0-9]', '', 'g') <> ''
          and right(regexp_replace(c.telefono, '[^0-9]', '', 'g'), 8) = right(regexp_replace(l.telefono, '[^0-9]', '', 'g'), 8))
      or c.nombre ilike '%' || coalesce(l.negocio, l.contacto) || '%')
    limit 10) x), '[]'::jsonb);
end;
$$;

-- Atómica: vincula o crea el cliente y abre la oportunidad.
-- p_cliente (si p_cliente_id es null): {nombre, telefono, ruc, direccion, tipo_cliente}
-- p_oportunidad: {nombre, etapa_id, monto_estimado, fecha_cierre_estimada, responsable_id}
create or replace function public.crm_lead_convertir(
  p_company_id uuid, p_id uuid, p_cliente_id uuid, p_cliente jsonb, p_oportunidad jsonb, p_version integer
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid; l crm.leads; v_cliente uuid := p_cliente_id; v_ruc text; v_tipo text; e crm.etapas;
  v_opp uuid; v_resp uuid; v_cierre date; v_movidas integer;
begin
  v_uid := core.fn_exigir_permiso(p_company_id, 'crm.ventas.lead.convertir');
  select * into l from crm.leads x where x.id = p_id and x.company_id = p_company_id and x.deleted_at is null
    and (x.responsable_id = v_uid or crm.fn_equipo(v_uid, p_company_id)) for update;
  if not found then perform crm.fn_no_encontrado(); end if;
  if p_version is distinct from l.version then perform crm.fn_conflicto(); end if;
  if l.estado not in ('nuevo', 'contactado', 'calificado') then raise exception 'Este lead ya no se puede convertir.'; end if;
  if jsonb_typeof(p_oportunidad) is distinct from 'object' then raise exception 'Faltan los datos de la oportunidad.'; end if;

  if v_cliente is not null then
    perform crm.fn_cliente_de_empresa(p_company_id, v_cliente);
  else
    if jsonb_typeof(p_cliente) is distinct from 'object' then raise exception 'Elige un cliente o indica los datos del nuevo.'; end if;
    v_ruc := crm.fn_txt(p_cliente->>'ruc', 'El RUC', 3, 30);
    if v_ruc is not null and exists (select 1 from crm.clientes c where c.company_id = p_company_id and c.ruc = v_ruc) then
      raise exception 'Ya existe un cliente con este RUC: vincúlalo.';
    end if;
    v_tipo := nullif(btrim(coalesce(p_cliente->>'tipo_cliente', '')), '');
    if v_tipo is not null and v_tipo not in ('mayorista', 'detal') then raise exception 'Tipo de cliente inválido.'; end if;
    insert into crm.clientes (company_id, nombre, telefono, ruc, direccion, tipo_cliente)
    values (p_company_id, crm.fn_txt(p_cliente->>'nombre', 'El nombre del cliente', 2, 160, true),
            crm.fn_tel(p_cliente->>'telefono'), v_ruc, crm.fn_txt(p_cliente->>'direccion', 'La dirección', 1, 300), v_tipo)
    returning id into v_cliente;
    perform core.fn_auditar(v_uid, p_company_id, 'crm.cliente.crear_desde_lead', 'crm.clientes', v_cliente::text,
      jsonb_build_object('lead_id', l.id));
  end if;

  select * into e from crm.etapas x where x.id = nullif(p_oportunidad->>'etapa_id', '')::uuid and x.company_id = p_company_id
    and x.tipo = 'abierta' and x.activa;
  if not found then raise exception 'Elige una etapa abierta.'; end if;
  v_cierre := crm.fn_fecha(p_oportunidad->>'fecha_cierre_estimada', 'La fecha estimada de cierre');
  if v_cierre < crm.fn_hoy() then raise exception 'La fecha estimada de cierre no puede ser anterior a hoy.'; end if;
  v_resp := crm.fn_resolver_responsable(v_uid, p_company_id, nullif(p_oportunidad->>'responsable_id', '')::uuid,
                                        l.responsable_id, 'crm.ventas.oportunidad.ver');

  insert into crm.oportunidades (company_id, nombre, cliente_id, lead_id, etapa_id, monto_estimado, fecha_cierre_estimada,
                                 probabilidad, responsable_id, created_by)
  values (p_company_id, crm.fn_txt(p_oportunidad->>'nombre', 'El nombre', 3, 120, true), v_cliente, l.id, e.id,
          round(crm.fn_monto(p_oportunidad->>'monto_estimado', 'El monto estimado', 0, 99999999.99), 2), v_cierre,
          e.probabilidad, v_resp, v_uid)
  returning id into v_opp;

  -- Las actividades agendadas del lead pasan a la oportunidad (S3).
  update crm.actividades a set lead_id = null, oportunidad_id = v_opp, updated_at = now(), version = a.version + 1
    where a.lead_id = l.id and a.estado = 'agendada' and a.deleted_at is null;
  get diagnostics v_movidas = row_count;

  update crm.leads x set estado = 'convertido', cliente_id = v_cliente, oportunidad_id = v_opp, convertido_en = now(),
    updated_at = now(), version = x.version + 1 where x.id = l.id;

  perform crm.fn_evento(v_uid, p_company_id, 'lead', l.id, v_opp, 'convertido',
    jsonb_build_object('cliente_id', v_cliente, 'oportunidad_id', v_opp, 'cliente_nuevo', p_cliente_id is null));
  perform crm.fn_evento(v_uid, p_company_id, 'oportunidad', v_opp, v_opp, 'creada',
    jsonb_build_object('desde_lead', l.id, 'etapa', e.nombre));
  return jsonb_build_object('cliente_id', v_cliente, 'oportunidad_id', v_opp, 'actividades_movidas', v_movidas);
end;
$$;

create or replace function public.crm_lead_eliminar(p_company_id uuid, p_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_uid uuid; l crm.leads;
begin
  v_uid := core.fn_exigir_permiso(p_company_id, 'crm.ventas.lead.eliminar');
  select * into l from crm.leads x where x.id = p_id and x.company_id = p_company_id and x.deleted_at is null
    and (x.responsable_id = v_uid or crm.fn_equipo(v_uid, p_company_id)) for update;
  if not found then perform crm.fn_no_encontrado(); end if;
  if l.estado = 'convertido' then raise exception 'Un lead convertido no se puede eliminar.'; end if;
  update crm.leads x set deleted_at = now(), updated_at = now(), version = x.version + 1 where x.id = p_id;
  update crm.actividades a set estado = 'cancelada', motivo_cancelacion = 'Lead eliminado', updated_at = now(), version = a.version + 1
    where a.lead_id = p_id and a.estado = 'agendada' and a.deleted_at is null;
  perform crm.fn_evento(v_uid, p_company_id, 'lead', p_id, null, 'eliminado', jsonb_build_object('contacto', l.contacto));
  return jsonb_build_object('ok', true);
end;
$$;

-- -----------------------------------------------------------------------------
-- 8. RPC: oportunidades y tablero
-- -----------------------------------------------------------------------------
create or replace function crm.fn_oportunidad_json(o crm.oportunidades)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', o.id, 'nombre', o.nombre, 'cliente_id', o.cliente_id,
    'cliente', (select c.nombre from crm.clientes c where c.id = o.cliente_id),
    'cliente_telefono', (select c.telefono from crm.clientes c where c.id = o.cliente_id),
    'lead_id', o.lead_id, 'lead', (select l.contacto from crm.leads l where l.id = o.lead_id),
    'etapa_id', o.etapa_id, 'etapa', (select e.nombre from crm.etapas e where e.id = o.etapa_id),
    'monto_estimado', o.monto_estimado, 'fecha_cierre_estimada', o.fecha_cierre_estimada,
    'probabilidad', o.probabilidad, 'probabilidad_ajustada', o.probabilidad_ajustada,
    'ponderado', round(o.monto_estimado * o.probabilidad / 100, 2),
    'estado', o.estado, 'monto_ganado', o.monto_ganado, 'fecha_cierre', o.fecha_cierre,
    'motivo_perdida_id', o.motivo_perdida_id, 'motivo_perdida', (select m.nombre from crm.motivos_perdida m where m.id = o.motivo_perdida_id),
    'detalle_perdida', o.detalle_perdida, 'notas', o.notas,
    'responsable_id', o.responsable_id, 'responsable', crm.fn_nombre(o.responsable_id),
    'vencida', o.estado = 'abierta' and o.fecha_cierre_estimada < crm.fn_hoy(),
    'created_at', o.created_at, 'updated_at', o.updated_at, 'version', o.version);
$$;

-- p_cierre: null | mes | proximo | vencidas
create or replace function public.crm_embudo_tablero(
  p_company_id uuid, p_responsable uuid default null, p_buscar text default null, p_cierre text default null,
  p_limite_etapa integer default 50
) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid uuid; v_equipo boolean; v_resp uuid; v_t text := nullif(btrim(coalesce(p_buscar, '')), '');
  v_hoy date := crm.fn_hoy(); v_mes date := date_trunc('month', crm.fn_hoy())::date;
  v_lim integer := least(greatest(coalesce(p_limite_etapa, 50), 1), 200);
begin
  v_uid := core.fn_exigir_permiso(p_company_id, 'crm.ventas.oportunidad.ver');
  v_equipo := crm.fn_equipo(v_uid, p_company_id);
  v_resp := case when v_equipo then p_responsable else v_uid end;
  return (
    with base as (
      select o.* from crm.oportunidades o
      left join crm.clientes c on c.id = o.cliente_id
      where o.company_id = p_company_id and o.deleted_at is null
        and (v_resp is null or o.responsable_id = v_resp)
        and (v_t is null or o.nombre ilike '%' || v_t || '%' or c.nombre ilike '%' || v_t || '%')
    ), abiertas as (
      select * from base b where b.estado = 'abierta'
        and (p_cierre is null
             or (p_cierre = 'mes' and b.fecha_cierre_estimada >= v_mes and b.fecha_cierre_estimada < (v_mes + interval '1 month')::date)
             or (p_cierre = 'proximo' and b.fecha_cierre_estimada >= (v_mes + interval '1 month')::date
                 and b.fecha_cierre_estimada < (v_mes + interval '2 months')::date)
             or (p_cierre = 'vencidas' and b.fecha_cierre_estimada < v_hoy))
    )
    select jsonb_build_object(
      'equipo', v_equipo,
      'etapas', coalesce((select jsonb_agg(jsonb_build_object(
          'id', e.id, 'nombre', e.nombre, 'probabilidad', e.probabilidad,
          'cantidad', (select count(*) from abiertas a where a.etapa_id = e.id),
          'monto', (select coalesce(sum(a.monto_estimado), 0) from abiertas a where a.etapa_id = e.id),
          'ponderado', (select coalesce(round(sum(a.monto_estimado * a.probabilidad / 100), 2), 0) from abiertas a where a.etapa_id = e.id),
          'filas', coalesce((select jsonb_agg(crm.fn_oportunidad_json(x) order by x.fecha_cierre_estimada, x.nombre)
                             from crm.oportunidades x
                             where x.id in (select a.id from abiertas a where a.etapa_id = e.id
                                            order by a.fecha_cierre_estimada, a.nombre limit v_lim)), '[]'::jsonb))
        order by e.orden) from crm.etapas e where e.company_id = p_company_id and e.tipo = 'abierta' and e.activa), '[]'::jsonb),
      'abiertas', (select count(*) from abiertas),
      'monto', (select coalesce(sum(monto_estimado), 0) from abiertas),
      'ponderado', (select coalesce(round(sum(monto_estimado * probabilidad / 100), 2), 0) from abiertas),
      'ganadas_mes', (select count(*) from base where estado = 'ganada' and fecha_cierre >= v_mes),
      'perdidas_mes', (select count(*) from base where estado = 'perdida' and fecha_cierre >= v_mes))
  );
end;
$$;

-- p_estado: abierta | ganada | perdida | null (todas)
create or replace function public.crm_oportunidades_listar(
  p_company_id uuid, p_estado text default 'abierta', p_etapa_id uuid default null, p_responsable uuid default null,
  p_buscar text default null, p_desde date default null, p_hasta date default null, p_cliente_id uuid default null,
  p_limite integer default 50, p_desplazamiento integer default 0
) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid uuid; v_equipo boolean; v_resp uuid; v_t text := nullif(btrim(coalesce(p_buscar, '')), '');
  v_lim integer := least(greatest(coalesce(p_limite, 50), 1), 200);
  v_off integer := greatest(coalesce(p_desplazamiento, 0), 0);
begin
  v_uid := core.fn_exigir_permiso(p_company_id, 'crm.ventas.oportunidad.ver');
  v_equipo := crm.fn_equipo(v_uid, p_company_id);
  v_resp := case when v_equipo then p_responsable else v_uid end;
  return (
    with f as (
      select o.* from crm.oportunidades o
      left join crm.clientes c on c.id = o.cliente_id
      where o.company_id = p_company_id and o.deleted_at is null
        and (v_resp is null or o.responsable_id = v_resp)
        and (p_estado is null or o.estado = p_estado)
        and (p_etapa_id is null or o.etapa_id = p_etapa_id)
        and (p_cliente_id is null or o.cliente_id = p_cliente_id)
        and (v_t is null or o.nombre ilike '%' || v_t || '%' or c.nombre ilike '%' || v_t || '%')
        and (p_desde is null or coalesce(o.fecha_cierre, o.fecha_cierre_estimada) >= p_desde)
        and (p_hasta is null or coalesce(o.fecha_cierre, o.fecha_cierre_estimada) <= p_hasta)
    )
    select jsonb_build_object('total', (select count(*) from f), 'equipo', v_equipo,
      'monto', (select coalesce(sum(monto_estimado), 0) from f),
      'filas', coalesce((select jsonb_agg(crm.fn_oportunidad_json(x) order by x.fecha_cierre_estimada, x.nombre)
                         from crm.oportunidades x
                         where x.id in (select id from f order by fecha_cierre_estimada, nombre limit v_lim offset v_off)), '[]'::jsonb))
  );
end;
$$;

create or replace function public.crm_oportunidad_obtener(p_company_id uuid, p_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_uid uuid; o crm.oportunidades; v_editar boolean;
begin
  v_uid := core.fn_exigir_permiso(p_company_id, 'crm.ventas.oportunidad.ver');
  select * into o from crm.oportunidades x where x.id = p_id and x.company_id = p_company_id and x.deleted_at is null
    and (x.responsable_id = v_uid or crm.fn_equipo(v_uid, p_company_id));
  if not found then perform crm.fn_no_encontrado(); end if;
  v_editar := crm.fn_puede(v_uid, p_company_id, 'crm.ventas.oportunidad.editar');
  return crm.fn_oportunidad_json(o) || jsonb_build_object(
    'cotizaciones', case when crm.fn_puede(v_uid, p_company_id, 'crm.ventas.cotizacion.ver') then
      coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'numero', c.numero, 'fecha', c.fecha, 'estado', c.estado,
          'vencida', c.estado = 'enviada' and c.valida_hasta < crm.fn_hoy(), 'total', c.total) order by c.fecha desc, c.numero desc)
        from crm.cotizaciones c where c.oportunidad_id = o.id and c.company_id = p_company_id), '[]'::jsonb) end,
    'acciones', jsonb_build_object(
      'editar', v_editar and o.estado = 'abierta',
      'mover', v_editar and o.estado = 'abierta',
      'ganar', v_editar and o.estado = 'abierta',
      'perder', v_editar and o.estado = 'abierta',
      'reabrir', v_editar and o.estado <> 'abierta',
      'editar_notas', v_editar,
      'eliminar', crm.fn_puede(v_uid, p_company_id, 'crm.ventas.oportunidad.eliminar')
                  and not exists (select 1 from crm.cotizaciones c where c.oportunidad_id = o.id and c.estado = 'aceptada'),
      'reasignar', crm.fn_puede(v_uid, p_company_id, 'crm.ventas.asignacion.gestionar'),
      'cotizar', o.estado = 'abierta' and crm.fn_puede(v_uid, p_company_id, 'crm.ventas.cotizacion.crear'),
      'registrar_actividad', crm.fn_puede(v_uid, p_company_id, 'crm.ventas.actividad.crear')));
end;
$$;

-- Actividades (con actividad.ver) + hitos, de lo más reciente a lo más antiguo; las agendadas aparte.
create or replace function public.crm_oportunidad_linea_tiempo(p_company_id uuid, p_id uuid, p_limite integer default 50, p_desplazamiento integer default 0)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid uuid; v_act boolean;
  v_lim integer := least(greatest(coalesce(p_limite, 50), 1), 200);
  v_off integer := greatest(coalesce(p_desplazamiento, 0), 0);
begin
  v_uid := core.fn_exigir_permiso(p_company_id, 'crm.ventas.oportunidad.ver');
  if not crm.fn_oportunidad_visible(v_uid, p_company_id, p_id) then perform crm.fn_no_encontrado(); end if;
  v_act := crm.fn_puede(v_uid, p_company_id, 'crm.ventas.actividad.ver');
  return jsonb_build_object(
    'proximas', case when v_act then coalesce((select jsonb_agg(crm.fn_actividad_json(a) order by a.fecha)
        from crm.actividades a where a.oportunidad_id = p_id and a.estado = 'agendada' and a.deleted_at is null), '[]'::jsonb) end,
    'items', coalesce((select jsonb_agg(x.item order by x.cuando desc) from (
        select * from (
          select a.fecha as cuando, jsonb_build_object('clase', 'actividad') || crm.fn_actividad_json(a) as item
          from crm.actividades a
          where v_act and a.oportunidad_id = p_id and a.estado <> 'agendada' and a.deleted_at is null
          union all
          select ev.creado_en, jsonb_build_object('clase', 'hito', 'id', ev.id, 'entidad', ev.entidad, 'entidad_id', ev.entidad_id,
            'tipo', ev.tipo, 'fecha', ev.creado_en, 'usuario', crm.fn_nombre(ev.user_id), 'datos', ev.datos)
          from crm.eventos ev where ev.oportunidad_id = p_id and ev.company_id = p_company_id
        ) u order by u.cuando desc limit v_lim offset v_off) x), '[]'::jsonb));
end;
$$;

-- p_datos: {nombre, cliente_id, etapa_id, monto_estimado, fecha_cierre_estimada, probabilidad, notas, responsable_id}
-- Una oportunidad cerrada solo admite cambiar las notas.
create or replace function public.crm_oportunidad_guardar(p_company_id uuid, p_id uuid, p_datos jsonb, p_version integer default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid; o crm.oportunidades; e crm.etapas; v_cliente uuid; v_cierre date; v_prob numeric; v_ajustada boolean; v_resp uuid;
begin
  if p_id is null then
    v_uid := core.fn_exigir_permiso(p_company_id, 'crm.ventas.oportunidad.crear');
  else
    v_uid := core.fn_exigir_permiso(p_company_id, 'crm.ventas.oportunidad.editar');
    select * into o from crm.oportunidades x where x.id = p_id and x.company_id = p_company_id and x.deleted_at is null
      and (x.responsable_id = v_uid or crm.fn_equipo(v_uid, p_company_id)) for update;
    if not found then perform crm.fn_no_encontrado(); end if;
    if p_version is distinct from o.version then perform crm.fn_conflicto(); end if;
  end if;
  if jsonb_typeof(p_datos) is distinct from 'object' then raise exception 'Datos inválidos.'; end if;
  perform crm.fn_sembrar_embudo(p_company_id);

  if p_id is not null and o.estado <> 'abierta' then
    update crm.oportunidades x set notas = crm.fn_txt(p_datos->>'notas', 'Las notas', 1, 2000), updated_at = now(), version = x.version + 1
      where x.id = p_id returning * into o;
    return jsonb_build_object('id', o.id, 'version', o.version);
  end if;

  v_cliente := nullif(p_datos->>'cliente_id', '')::uuid;
  perform crm.fn_cliente_de_empresa(p_company_id, v_cliente);
  select * into e from crm.etapas x where x.id = coalesce(nullif(p_datos->>'etapa_id', '')::uuid, o.etapa_id)
    and x.company_id = p_company_id and x.tipo = 'abierta' and (x.activa or x.id = o.etapa_id);
  if not found then raise exception 'Elige una etapa abierta.'; end if;
  v_cierre := crm.fn_fecha(p_datos->>'fecha_cierre_estimada', 'La fecha estimada de cierre');
  if p_id is null and v_cierre < crm.fn_hoy() then raise exception 'La fecha estimada de cierre no puede ser anterior a hoy.'; end if;
  if nullif(p_datos->>'probabilidad', '') is null then
    v_prob := e.probabilidad;
  else
    v_prob := round(crm.fn_monto(p_datos->>'probabilidad', 'La probabilidad', 0, 100), 2);
  end if;
  v_ajustada := v_prob <> e.probabilidad;
  v_resp := crm.fn_resolver_responsable(v_uid, p_company_id, nullif(p_datos->>'responsable_id', '')::uuid,
                                        o.responsable_id, 'crm.ventas.oportunidad.ver');

  if p_id is null then
    insert into crm.oportunidades (company_id, nombre, cliente_id, etapa_id, monto_estimado, fecha_cierre_estimada,
                                   probabilidad, probabilidad_ajustada, notas, responsable_id, created_by)
    values (p_company_id, crm.fn_txt(p_datos->>'nombre', 'El nombre', 3, 120, true), v_cliente, e.id,
            round(crm.fn_monto(p_datos->>'monto_estimado', 'El monto estimado', 0, 99999999.99), 2), v_cierre,
            v_prob, v_ajustada, crm.fn_txt(p_datos->>'notas', 'Las notas', 1, 2000), v_resp, v_uid)
    returning * into o;
    perform crm.fn_evento(v_uid, p_company_id, 'oportunidad', o.id, o.id, 'creada', jsonb_build_object('etapa', e.nombre));
  else
    update crm.oportunidades x set
      nombre = crm.fn_txt(p_datos->>'nombre', 'El nombre', 3, 120, true), cliente_id = v_cliente, etapa_id = e.id,
      monto_estimado = round(crm.fn_monto(p_datos->>'monto_estimado', 'El monto estimado', 0, 99999999.99), 2),
      fecha_cierre_estimada = v_cierre, probabilidad = v_prob, probabilidad_ajustada = v_ajustada,
      notas = crm.fn_txt(p_datos->>'notas', 'Las notas', 1, 2000), responsable_id = v_resp,
      updated_at = now(), version = x.version + 1
    where x.id = p_id returning * into o;
    perform crm.fn_evento(v_uid, p_company_id, 'oportunidad', o.id, o.id, 'editada', '{}'::jsonb);
  end if;
  return jsonb_build_object('id', o.id, 'version', o.version);
end;
$$;

create or replace function public.crm_oportunidad_mover_etapa(p_company_id uuid, p_id uuid, p_etapa_id uuid, p_version integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_uid uuid; o crm.oportunidades; e crm.etapas; v_antes text;
begin
  v_uid := core.fn_exigir_permiso(p_company_id, 'crm.ventas.oportunidad.editar');
  select * into o from crm.oportunidades x where x.id = p_id and x.company_id = p_company_id and x.deleted_at is null
    and (x.responsable_id = v_uid or crm.fn_equipo(v_uid, p_company_id)) for update;
  if not found then perform crm.fn_no_encontrado(); end if;
  if p_version is distinct from o.version then perform crm.fn_conflicto(); end if;
  if o.estado <> 'abierta' then raise exception 'La oportunidad está cerrada: reábrela primero.'; end if;
  select * into e from crm.etapas x where x.id = p_etapa_id and x.company_id = p_company_id and x.tipo = 'abierta' and x.activa;
  if not found then raise exception 'Elige una etapa abierta activa.'; end if;
  select x.nombre into v_antes from crm.etapas x where x.id = o.etapa_id;
  update crm.oportunidades x set etapa_id = e.id, probabilidad = e.probabilidad, probabilidad_ajustada = false,
    updated_at = now(), version = x.version + 1 where x.id = p_id returning * into o;
  perform crm.fn_evento(v_uid, p_company_id, 'oportunidad', o.id, o.id, 'etapa',
    jsonb_build_object('de', v_antes, 'a', e.nombre));
  return jsonb_build_object('id', o.id, 'etapa_id', e.id, 'etapa', e.nombre, 'probabilidad', o.probabilidad, 'version', o.version);
end;
$$;

create or replace function crm.fn_ganar(p_uid uuid, p_company_id uuid, p_id uuid, p_monto numeric, p_fecha date, p_cotizacion_id uuid)
returns crm.oportunidades language plpgsql security definer set search_path = '' as $$
declare o crm.oportunidades; e crm.etapas;
begin
  if p_monto is null or p_monto < 0 or p_monto > 99999999.99 then raise exception 'El monto ganado no es válido.'; end if;
  if p_fecha is null or p_fecha > crm.fn_hoy() then raise exception 'La fecha de cierre no puede ser futura.'; end if;
  select * into e from crm.etapas x where x.company_id = p_company_id and x.tipo = 'ganada';
  update crm.oportunidades x set estado = 'ganada', etapa_id = e.id, probabilidad = 100, probabilidad_ajustada = false,
    monto_ganado = round(p_monto, 2), fecha_cierre = p_fecha, motivo_perdida_id = null, detalle_perdida = null,
    updated_at = now(), version = x.version + 1
  where x.id = p_id returning * into o;
  perform crm.fn_evento(p_uid, p_company_id, 'oportunidad', o.id, o.id, 'ganada',
    jsonb_build_object('monto', o.monto_ganado, 'fecha', o.fecha_cierre, 'cotizacion_id', p_cotizacion_id));
  return o;
end;
$$;

create or replace function public.crm_oportunidad_ganar(p_company_id uuid, p_id uuid, p_monto numeric, p_fecha date, p_version integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_uid uuid; o crm.oportunidades;
begin
  v_uid := core.fn_exigir_permiso(p_company_id, 'crm.ventas.oportunidad.editar');
  select * into o from crm.oportunidades x where x.id = p_id and x.company_id = p_company_id and x.deleted_at is null
    and (x.responsable_id = v_uid or crm.fn_equipo(v_uid, p_company_id)) for update;
  if not found then perform crm.fn_no_encontrado(); end if;
  if p_version is distinct from o.version then perform crm.fn_conflicto(); end if;
  if o.estado <> 'abierta' then raise exception 'La oportunidad ya está cerrada.'; end if;
  o := crm.fn_ganar(v_uid, p_company_id, p_id, coalesce(p_monto, o.monto_estimado), coalesce(p_fecha, crm.fn_hoy()), null);
  return jsonb_build_object('id', o.id, 'estado', o.estado, 'version', o.version);
end;
$$;

-- Perdida: sus cotizaciones enviadas o aprobadas pasan a rechazada; opcionalmente cancela las agendadas.
create or replace function public.crm_oportunidad_perder(
  p_company_id uuid, p_id uuid, p_motivo_id uuid, p_detalle text, p_cancelar_actividades boolean, p_version integer
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_uid uuid; o crm.oportunidades; m crm.motivos_perdida; e crm.etapas; v_detalle text; v_cot integer; v_act integer := 0;
begin
  v_uid := core.fn_exigir_permiso(p_company_id, 'crm.ventas.oportunidad.editar');
  select * into o from crm.oportunidades x where x.id = p_id and x.company_id = p_company_id and x.deleted_at is null
    and (x.responsable_id = v_uid or crm.fn_equipo(v_uid, p_company_id)) for update;
  if not found then perform crm.fn_no_encontrado(); end if;
  if p_version is distinct from o.version then perform crm.fn_conflicto(); end if;
  if o.estado <> 'abierta' then raise exception 'La oportunidad ya está cerrada.'; end if;
  select * into m from crm.motivos_perdida x where x.id = p_motivo_id and x.company_id = p_company_id and x.activo;
  if not found then raise exception 'Elige el motivo de la pérdida.'; end if;
  v_detalle := crm.fn_txt(p_detalle, 'El detalle', 3, 500, m.pide_detalle);
  select * into e from crm.etapas x where x.company_id = p_company_id and x.tipo = 'perdida';

  update crm.oportunidades x set estado = 'perdida', etapa_id = e.id, probabilidad = 0, probabilidad_ajustada = false,
    fecha_cierre = crm.fn_hoy(), motivo_perdida_id = m.id, detalle_perdida = v_detalle, monto_ganado = null,
    updated_at = now(), version = x.version + 1
  where x.id = p_id returning * into o;

  update crm.cotizaciones c set estado = 'rechazada', resultado_en = now(), motivo_resultado = 'Oportunidad perdida: ' || m.nombre,
    updated_at = now(), version = c.version + 1
  where c.oportunidad_id = p_id and c.company_id = p_company_id and c.estado in ('enviada', 'aprobada');
  get diagnostics v_cot = row_count;

  if coalesce(p_cancelar_actividades, true) then
    update crm.actividades a set estado = 'cancelada', motivo_cancelacion = 'Oportunidad perdida', updated_at = now(), version = a.version + 1
      where a.oportunidad_id = p_id and a.estado = 'agendada' and a.deleted_at is null;
    get diagnostics v_act = row_count;
  end if;

  perform crm.fn_evento(v_uid, p_company_id, 'oportunidad', o.id, o.id, 'perdida',
    jsonb_build_object('motivo', m.nombre, 'detalle', v_detalle, 'cotizaciones_rechazadas', v_cot, 'actividades_canceladas', v_act));
  return jsonb_build_object('id', o.id, 'estado', o.estado, 'version', o.version,
    'cotizaciones_rechazadas', v_cot, 'actividades_canceladas', v_act);
end;
$$;

create or replace function public.crm_oportunidad_reabrir(p_company_id uuid, p_id uuid, p_etapa_id uuid, p_version integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_uid uuid; o crm.oportunidades; e crm.etapas; v_antes text;
begin
  v_uid := core.fn_exigir_permiso(p_company_id, 'crm.ventas.oportunidad.editar');
  select * into o from crm.oportunidades x where x.id = p_id and x.company_id = p_company_id and x.deleted_at is null
    and (x.responsable_id = v_uid or crm.fn_equipo(v_uid, p_company_id)) for update;
  if not found then perform crm.fn_no_encontrado(); end if;
  if p_version is distinct from o.version then perform crm.fn_conflicto(); end if;
  if o.estado = 'abierta' then raise exception 'La oportunidad ya está abierta.'; end if;
  select * into e from crm.etapas x where x.id = p_etapa_id and x.company_id = p_company_id and x.tipo = 'abierta' and x.activa;
  if not found then raise exception 'Elige una etapa abierta activa.'; end if;
  v_antes := o.estado;
  update crm.oportunidades x set estado = 'abierta', etapa_id = e.id, probabilidad = e.probabilidad, probabilidad_ajustada = false,
    fecha_cierre = null, monto_ganado = null, motivo_perdida_id = null, detalle_perdida = null,
    updated_at = now(), version = x.version + 1
  where x.id = p_id returning * into o;
  perform crm.fn_evento(v_uid, p_company_id, 'oportunidad', o.id, o.id, 'reabierta', jsonb_build_object('estaba', v_antes, 'etapa', e.nombre));
  return jsonb_build_object('id', o.id, 'estado', o.estado, 'version', o.version);
end;
$$;

create or replace function public.crm_oportunidad_eliminar(p_company_id uuid, p_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_uid uuid; o crm.oportunidades;
begin
  v_uid := core.fn_exigir_permiso(p_company_id, 'crm.ventas.oportunidad.eliminar');
  select * into o from crm.oportunidades x where x.id = p_id and x.company_id = p_company_id and x.deleted_at is null
    and (x.responsable_id = v_uid or crm.fn_equipo(v_uid, p_company_id)) for update;
  if not found then perform crm.fn_no_encontrado(); end if;
  if exists (select 1 from crm.cotizaciones c where c.oportunidad_id = p_id and c.estado = 'aceptada') then
    raise exception 'Esta oportunidad tiene cotizaciones aceptadas: no se puede eliminar.';
  end if;
  update crm.oportunidades x set deleted_at = now(), updated_at = now(), version = x.version + 1 where x.id = p_id;
  update crm.actividades a set estado = 'cancelada', motivo_cancelacion = 'Oportunidad eliminada', updated_at = now(), version = a.version + 1
    where a.oportunidad_id = p_id and a.estado = 'agendada' and a.deleted_at is null;
  update crm.cotizaciones c set estado = 'anulada', anulada_por = v_uid, anulada_en = now(), motivo_anulacion = 'Oportunidad eliminada',
    updated_at = now(), version = c.version + 1
    where c.oportunidad_id = p_id and c.company_id = p_company_id and c.estado in ('borrador', 'pendiente_aprobacion', 'aprobada', 'enviada');
  perform crm.fn_evento(v_uid, p_company_id, 'oportunidad', p_id, p_id, 'eliminada', jsonb_build_object('nombre', o.nombre));
  return jsonb_build_object('ok', true);
end;
$$;

-- -----------------------------------------------------------------------------
-- 9. RPC: actividades y agenda
-- -----------------------------------------------------------------------------
create or replace function crm.fn_actividad_json(a crm.actividades)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', a.id, 'fecha', a.fecha, 'tipo', a.tipo, 'estado', a.estado, 'asunto', a.asunto, 'notas', a.notas,
    'resultado', a.resultado, 'vencida', a.estado = 'agendada' and a.fecha < now(),
    'lead_id', a.lead_id, 'oportunidad_id', a.oportunidad_id, 'cliente_id', a.cliente_id,
    'relacionado', case
      when a.lead_id is not null then (select jsonb_build_object('tipo', 'lead', 'id', l.id, 'nombre', coalesce(l.negocio, l.contacto),
                                        'telefono', l.telefono) from crm.leads l where l.id = a.lead_id)
      when a.oportunidad_id is not null then (select jsonb_build_object('tipo', 'oportunidad', 'id', o.id, 'nombre', o.nombre,
                                        'telefono', c.telefono) from crm.oportunidades o left join crm.clientes c on c.id = o.cliente_id
                                        where o.id = a.oportunidad_id)
      else (select jsonb_build_object('tipo', 'cliente', 'id', c.id, 'nombre', c.nombre, 'telefono', c.telefono)
            from crm.clientes c where c.id = a.cliente_id) end,
    'responsable_id', a.responsable_id, 'responsable', crm.fn_nombre(a.responsable_id),
    'completada_en', a.completada_en, 'motivo_cancelacion', a.motivo_cancelacion,
    'created_at', a.created_at, 'version', a.version);
$$;

-- p_vista: hoy | vencidas | proximas | completadas | todas
create or replace function public.crm_agenda(
  p_company_id uuid, p_vista text default 'hoy', p_desde date default null, p_hasta date default null, p_tipo text default null,
  p_responsable uuid default null, p_lead_id uuid default null, p_oportunidad_id uuid default null, p_cliente_id uuid default null,
  p_limite integer default 50, p_desplazamiento integer default 0
) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid uuid; v_equipo boolean; v_resp uuid; v_hoy date := crm.fn_hoy();
  v_ini timestamptz := (crm.fn_hoy()::timestamp at time zone 'America/Managua');
  v_fin timestamptz := ((crm.fn_hoy() + 1)::timestamp at time zone 'America/Managua');
  v_lim integer := least(greatest(coalesce(p_limite, 50), 1), 200);
  v_off integer := greatest(coalesce(p_desplazamiento, 0), 0);
begin
  v_uid := core.fn_exigir_permiso(p_company_id, 'crm.ventas.actividad.ver');
  v_equipo := crm.fn_equipo(v_uid, p_company_id);
  v_resp := case when v_equipo then p_responsable else v_uid end;
  if p_vista not in ('hoy', 'vencidas', 'proximas', 'completadas', 'todas') then raise exception 'Vista inválida.'; end if;
  return (
    with base as (
      select a.* from crm.actividades a
      where a.company_id = p_company_id and a.deleted_at is null
        and (v_resp is null or a.responsable_id = v_resp)
        and (p_tipo is null or a.tipo = p_tipo)
        and (p_lead_id is null or a.lead_id = p_lead_id)
        and (p_oportunidad_id is null or a.oportunidad_id = p_oportunidad_id)
        and (p_cliente_id is null or a.cliente_id = p_cliente_id)
    ), f as (
      select * from base b where
        (p_vista = 'hoy' and b.estado = 'agendada' and b.fecha >= v_ini and b.fecha < v_fin)
        or (p_vista = 'vencidas' and b.estado = 'agendada' and b.fecha < now())
        or (p_vista = 'proximas' and b.estado = 'agendada'
            and b.fecha >= coalesce((p_desde::timestamp at time zone 'America/Managua'), v_fin)
            and b.fecha < coalesce(((p_hasta + 1)::timestamp at time zone 'America/Managua'), v_fin + interval '14 days'))
        or (p_vista = 'completadas' and b.estado = 'completada'
            and b.fecha >= coalesce((p_desde::timestamp at time zone 'America/Managua'), now() - interval '30 days')
            and (p_hasta is null or b.fecha < ((p_hasta + 1)::timestamp at time zone 'America/Managua')))
        or (p_vista = 'todas')
    )
    select jsonb_build_object(
      'equipo', v_equipo, 'hoy', v_hoy, 'total', (select count(*) from f),
      'conteos', jsonb_build_object(
        'hoy', (select count(*) from base where estado = 'agendada' and fecha >= v_ini and fecha < v_fin),
        'vencidas', (select count(*) from base where estado = 'agendada' and fecha < now()),
        'proximas', (select count(*) from base where estado = 'agendada' and fecha >= v_fin and fecha < v_fin + interval '14 days')),
      'filas', coalesce((select jsonb_agg(crm.fn_actividad_json(x) order by
                           case when p_vista in ('completadas', 'todas') then null else x.fecha end,
                           case when p_vista in ('completadas', 'todas') then x.fecha end desc)
                         from crm.actividades x
                         where (x.id, x.fecha) in (select id, fecha from f order by
                                 case when p_vista in ('completadas', 'todas') then null else fecha end,
                                 case when p_vista in ('completadas', 'todas') then fecha end desc
                               limit v_lim offset v_off)), '[]'::jsonb))
  );
end;
$$;

create or replace function public.crm_actividad_obtener(p_company_id uuid, p_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_uid uuid; a crm.actividades;
begin
  v_uid := core.fn_exigir_permiso(p_company_id, 'crm.ventas.actividad.ver');
  select * into a from crm.actividades x where x.id = p_id and x.company_id = p_company_id and x.deleted_at is null
    and (x.responsable_id = v_uid or crm.fn_equipo(v_uid, p_company_id));
  if not found then perform crm.fn_no_encontrado(); end if;
  return crm.fn_actividad_json(a) || jsonb_build_object('acciones', jsonb_build_object(
    'editar', crm.fn_puede(v_uid, p_company_id, 'crm.ventas.actividad.editar'),
    'eliminar', crm.fn_puede(v_uid, p_company_id, 'crm.ventas.actividad.eliminar')));
end;
$$;

-- Valida el registro relacionado (exactamente uno, vivo y en alcance).
create or replace function crm.fn_validar_relacionado(p_uid uuid, p_company_id uuid, p_lead uuid, p_opp uuid, p_cliente uuid)
returns void language plpgsql stable security definer set search_path = '' as $$
begin
  if num_nonnulls(p_lead, p_opp, p_cliente) <> 1 then
    raise exception 'Relaciona la actividad con un lead, una oportunidad o un cliente (solo uno).';
  end if;
  if p_lead is not null and not crm.fn_lead_visible(p_uid, p_company_id, p_lead) then perform crm.fn_no_encontrado(); end if;
  if p_opp is not null and not crm.fn_oportunidad_visible(p_uid, p_company_id, p_opp) then perform crm.fn_no_encontrado(); end if;
  if p_cliente is not null then perform crm.fn_cliente_de_empresa(p_company_id, p_cliente); end if;
end;
$$;

-- p_datos: {tipo, estado ('completada' = ya ocurrió | 'agendada'), fecha (timestamptz), asunto, notas,
--           lead_id | oportunidad_id | cliente_id, responsable_id}
-- Editar: una completada o cancelada solo cambia asunto y notas; el relacionado no cambia nunca.
create or replace function public.crm_actividad_guardar(p_company_id uuid, p_id uuid, p_datos jsonb, p_version integer default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid; a crm.actividades; v_tipo text; v_estado text; v_fecha timestamptz; v_resp uuid;
  v_lead uuid; v_opp uuid; v_cli uuid;
begin
  if jsonb_typeof(p_datos) is distinct from 'object' then raise exception 'Datos inválidos.'; end if;
  if p_id is null then
    v_uid := core.fn_exigir_permiso(p_company_id, 'crm.ventas.actividad.crear');
  else
    v_uid := core.fn_exigir_permiso(p_company_id, 'crm.ventas.actividad.editar');
    select * into a from crm.actividades x where x.id = p_id and x.company_id = p_company_id and x.deleted_at is null
      and (x.responsable_id = v_uid or crm.fn_equipo(v_uid, p_company_id)) for update;
    if not found then perform crm.fn_no_encontrado(); end if;
    if p_version is distinct from a.version then perform crm.fn_conflicto(); end if;
    if a.estado <> 'agendada' then
      update crm.actividades x set asunto = crm.fn_txt(p_datos->>'asunto', 'El asunto', 3, 120, true),
        notas = crm.fn_txt(p_datos->>'notas', 'Las notas', 1, 2000), updated_at = now(), version = x.version + 1
      where x.id = a.id and x.fecha = a.fecha returning * into a;
      return jsonb_build_object('id', a.id, 'version', a.version);
    end if;
  end if;

  v_tipo := coalesce(nullif(p_datos->>'tipo', ''), a.tipo);
  if v_tipo is null or v_tipo not in ('llamada', 'visita', 'reunion', 'nota', 'correo') then raise exception 'Elige el tipo de actividad.'; end if;
  v_estado := case when p_id is null then coalesce(nullif(p_datos->>'estado', ''), 'completada') else 'agendada' end;
  if v_estado not in ('agendada', 'completada') then raise exception 'Estado inválido.'; end if;
  if v_tipo = 'nota' and v_estado = 'agendada' then raise exception 'Una nota no se puede agendar.'; end if;
  begin
    v_fecha := coalesce(nullif(p_datos->>'fecha', '')::timestamptz,
                        case when p_id is not null then a.fecha when v_estado = 'completada' then now() end);
  exception when others then raise exception 'La fecha y hora no son válidas.';
  end;
  if v_fecha is null then raise exception 'Indica la fecha y la hora.'; end if;
  if v_estado = 'completada' and v_fecha > now() + interval '5 minutes' then raise exception 'Una actividad que ya ocurrió no puede tener fecha futura.'; end if;
  if v_estado = 'agendada' and v_fecha <= now() and (p_id is null or v_fecha <> a.fecha) then
    raise exception 'Una actividad agendada debe ser en el futuro.';
  end if;
  if v_fecha < now() - interval '1 year' or v_fecha > now() + interval '2 years' then raise exception 'La fecha está fuera de rango.'; end if;

  if p_id is null then
    v_lead := nullif(p_datos->>'lead_id', '')::uuid;
    v_opp := nullif(p_datos->>'oportunidad_id', '')::uuid;
    v_cli := nullif(p_datos->>'cliente_id', '')::uuid;
    perform crm.fn_validar_relacionado(v_uid, p_company_id, v_lead, v_opp, v_cli);
  end if;
  v_resp := crm.fn_resolver_responsable(v_uid, p_company_id, nullif(p_datos->>'responsable_id', '')::uuid,
                                        a.responsable_id, 'crm.ventas.actividad.ver');
  perform crm.fn_asegurar_particion_actividades(v_fecha::date);

  if p_id is null then
    insert into crm.actividades (fecha, company_id, tipo, estado, asunto, notas, lead_id, oportunidad_id, cliente_id,
                                 responsable_id, created_by, completada_en)
    values (v_fecha, p_company_id, v_tipo, v_estado, crm.fn_txt(p_datos->>'asunto', 'El asunto', 3, 120, true),
            crm.fn_txt(p_datos->>'notas', 'Las notas', 1, 2000), v_lead, v_opp, v_cli, v_resp, v_uid,
            case when v_estado = 'completada' then now() end)
    returning * into a;
    -- La primera actividad completada pasa el lead de nuevo a contactado (S2).
    if v_estado = 'completada' and v_lead is not null then
      update crm.leads l set estado = 'contactado', updated_at = now(), version = l.version + 1 where l.id = v_lead and l.estado = 'nuevo';
    end if;
  else
    update crm.actividades x set fecha = v_fecha, tipo = v_tipo, asunto = crm.fn_txt(p_datos->>'asunto', 'El asunto', 3, 120, true),
      notas = crm.fn_txt(p_datos->>'notas', 'Las notas', 1, 2000), responsable_id = v_resp, updated_at = now(), version = x.version + 1
    where x.id = a.id and x.fecha = a.fecha returning * into a;
  end if;
  return jsonb_build_object('id', a.id, 'version', a.version, 'estado', a.estado, 'fecha', a.fecha);
end;
$$;

-- p_seguimiento opcional: {tipo, fecha, asunto} → agenda otra actividad ligada al mismo registro.
create or replace function public.crm_actividad_completar(p_company_id uuid, p_id uuid, p_resultado text, p_seguimiento jsonb, p_version integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_uid uuid; a crm.actividades; v_seg jsonb;
begin
  v_uid := core.fn_exigir_permiso(p_company_id, 'crm.ventas.actividad.editar');
  select * into a from crm.actividades x where x.id = p_id and x.company_id = p_company_id and x.deleted_at is null
    and (x.responsable_id = v_uid or crm.fn_equipo(v_uid, p_company_id)) for update;
  if not found then perform crm.fn_no_encontrado(); end if;
  if p_version is distinct from a.version then perform crm.fn_conflicto(); end if;
  if a.estado <> 'agendada' then raise exception 'Esta actividad ya no está agendada.'; end if;
  update crm.actividades x set estado = 'completada', resultado = crm.fn_txt(p_resultado, 'El resultado', 1, 2000),
    completada_en = now(), updated_at = now(), version = x.version + 1
  where x.id = a.id and x.fecha = a.fecha returning * into a;
  if a.lead_id is not null then
    update crm.leads l set estado = 'contactado', updated_at = now(), version = l.version + 1 where l.id = a.lead_id and l.estado = 'nuevo';
  end if;
  if p_seguimiento is not null and jsonb_typeof(p_seguimiento) = 'object' then
    if not crm.fn_puede(v_uid, p_company_id, 'crm.ventas.actividad.crear') then
      raise exception 'Tu rol no permite agendar el seguimiento.';
    end if;
    v_seg := public.crm_actividad_guardar(p_company_id, null, jsonb_build_object(
      'tipo', coalesce(p_seguimiento->>'tipo', a.tipo), 'estado', 'agendada', 'fecha', p_seguimiento->>'fecha',
      'asunto', coalesce(nullif(p_seguimiento->>'asunto', ''), 'Seguimiento: ' || left(a.asunto, 100)),
      'lead_id', a.lead_id, 'oportunidad_id', a.oportunidad_id, 'cliente_id', a.cliente_id,
      'responsable_id', a.responsable_id), null);
  end if;
  return jsonb_build_object('id', a.id, 'version', a.version, 'seguimiento_id', v_seg->'id', 'seguimiento_fecha', v_seg->'fecha');
end;
$$;

create or replace function public.crm_actividad_reprogramar(p_company_id uuid, p_id uuid, p_fecha timestamptz, p_version integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_uid uuid; a crm.actividades;
begin
  v_uid := core.fn_exigir_permiso(p_company_id, 'crm.ventas.actividad.editar');
  select * into a from crm.actividades x where x.id = p_id and x.company_id = p_company_id and x.deleted_at is null
    and (x.responsable_id = v_uid or crm.fn_equipo(v_uid, p_company_id)) for update;
  if not found then perform crm.fn_no_encontrado(); end if;
  if p_version is distinct from a.version then perform crm.fn_conflicto(); end if;
  if a.estado <> 'agendada' then raise exception 'Esta actividad ya no está agendada.'; end if;
  if p_fecha is null or p_fecha <= now() then raise exception 'La nueva fecha debe ser en el futuro.'; end if;
  if p_fecha > now() + interval '2 years' then raise exception 'La fecha está fuera de rango.'; end if;
  perform crm.fn_asegurar_particion_actividades(p_fecha::date);
  update crm.actividades x set fecha = p_fecha, updated_at = now(), version = x.version + 1
    where x.id = a.id and x.fecha = a.fecha returning * into a;
  return jsonb_build_object('id', a.id, 'version', a.version, 'fecha', a.fecha);
end;
$$;

create or replace function public.crm_actividad_cancelar(p_company_id uuid, p_id uuid, p_motivo text, p_version integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_uid uuid; a crm.actividades;
begin
  v_uid := core.fn_exigir_permiso(p_company_id, 'crm.ventas.actividad.editar');
  select * into a from crm.actividades x where x.id = p_id and x.company_id = p_company_id and x.deleted_at is null
    and (x.responsable_id = v_uid or crm.fn_equipo(v_uid, p_company_id)) for update;
  if not found then perform crm.fn_no_encontrado(); end if;
  if p_version is distinct from a.version then perform crm.fn_conflicto(); end if;
  if a.estado <> 'agendada' then raise exception 'Esta actividad ya no está agendada.'; end if;
  update crm.actividades x set estado = 'cancelada', motivo_cancelacion = crm.fn_txt(p_motivo, 'El motivo', 1, 300),
    updated_at = now(), version = x.version + 1 where x.id = a.id and x.fecha = a.fecha returning * into a;
  return jsonb_build_object('id', a.id, 'version', a.version);
end;
$$;

create or replace function public.crm_actividad_eliminar(p_company_id uuid, p_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_uid uuid; a crm.actividades;
begin
  v_uid := core.fn_exigir_permiso(p_company_id, 'crm.ventas.actividad.eliminar');
  select * into a from crm.actividades x where x.id = p_id and x.company_id = p_company_id and x.deleted_at is null
    and (x.responsable_id = v_uid or crm.fn_equipo(v_uid, p_company_id)) for update;
  if not found then perform crm.fn_no_encontrado(); end if;
  update crm.actividades x set deleted_at = now(), updated_at = now(), version = x.version + 1 where x.id = a.id and x.fecha = a.fecha;
  perform core.fn_auditar(v_uid, p_company_id, 'crm.actividad.eliminada', 'crm.actividades', p_id::text,
    jsonb_build_object('asunto', a.asunto, 'fecha', a.fecha));
  return jsonb_build_object('ok', true);
end;
$$;

-- -----------------------------------------------------------------------------
-- 10. RPC: cotizaciones
-- -----------------------------------------------------------------------------
create or replace function crm.fn_cotizacion_json(c crm.cotizaciones)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', c.id, 'numero', c.numero, 'fecha', c.fecha, 'estado', c.estado,
    'vencida', c.estado = 'enviada' and c.valida_hasta < crm.fn_hoy(),
    'cliente_id', c.cliente_id, 'cliente', (select x.nombre from crm.clientes x where x.id = c.cliente_id),
    'cliente_ruc', (select x.ruc from crm.clientes x where x.id = c.cliente_id),
    'cliente_telefono', (select x.telefono from crm.clientes x where x.id = c.cliente_id),
    'cliente_direccion', (select x.direccion from crm.clientes x where x.id = c.cliente_id),
    'oportunidad_id', c.oportunidad_id, 'oportunidad', (select o.nombre from crm.oportunidades o where o.id = c.oportunidad_id),
    'atencion', c.atencion, 'valida_hasta', c.valida_hasta, 'tipo_cambio', c.tipo_cambio, 'condiciones', c.condiciones,
    'exento_iva', c.exento_iva, 'iva_porcentaje', c.iva_porcentaje, 'descuento_maximo', c.descuento_maximo,
    'subtotal_bruto', c.subtotal_bruto, 'descuento_total', c.descuento_total, 'subtotal_neto', c.subtotal_neto,
    'iva', c.iva, 'total', c.total, 'total_cs', round(c.total * c.tipo_cambio, 2),
    'descuento_efectivo', c.descuento_efectivo, 'descuento_max_linea', c.descuento_max_linea,
    'requiere_aprobacion', c.requiere_aprobacion, 'comentario_rechazo', c.comentario_rechazo,
    'aprobado_por', crm.fn_nombre(c.aprobado_por), 'aprobado_en', c.aprobado_en, 'enviada_en', c.enviada_en,
    'resultado_en', c.resultado_en, 'motivo_resultado', c.motivo_resultado,
    'anulada_por', crm.fn_nombre(c.anulada_por), 'anulada_en', c.anulada_en, 'motivo_anulacion', c.motivo_anulacion,
    'duplicada_de', c.duplicada_de, 'responsable_id', c.responsable_id, 'responsable', crm.fn_nombre(c.responsable_id),
    'created_at', c.created_at, 'updated_at', c.updated_at, 'version', c.version);
$$;

-- p_vista: abiertas | por_aprobar | aceptadas | cerradas | todas
create or replace function public.crm_cotizaciones_listar(
  p_company_id uuid, p_vista text default 'abiertas', p_cliente_id uuid default null, p_oportunidad_id uuid default null,
  p_responsable uuid default null, p_desde date default null, p_hasta date default null, p_buscar text default null,
  p_limite integer default 50, p_desplazamiento integer default 0
) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid uuid; v_equipo boolean; v_resp uuid; v_aprobar boolean; v_hoy date := crm.fn_hoy();
  v_t text := nullif(btrim(coalesce(p_buscar, '')), '');
  v_lim integer := least(greatest(coalesce(p_limite, 50), 1), 200);
  v_off integer := greatest(coalesce(p_desplazamiento, 0), 0);
begin
  v_uid := core.fn_exigir_permiso(p_company_id, 'crm.ventas.cotizacion.ver');
  v_equipo := crm.fn_equipo(v_uid, p_company_id);
  v_aprobar := crm.fn_puede(v_uid, p_company_id, 'crm.ventas.cotizacion.aprobar');
  v_resp := case when v_equipo then p_responsable else v_uid end;
  if p_vista not in ('abiertas', 'por_aprobar', 'aceptadas', 'cerradas', 'todas') then raise exception 'Vista inválida.'; end if;
  if p_vista = 'por_aprobar' and not v_aprobar then raise exception 'Tu rol no permite aprobar cotizaciones.'; end if;
  return (
    with base as (
      select c.*, (c.estado = 'enviada' and c.valida_hasta < v_hoy) as es_vencida
      from crm.cotizaciones c
      left join crm.clientes cl on cl.id = c.cliente_id
      where c.company_id = p_company_id
        and (v_resp is null or c.responsable_id = v_resp)
        and (p_cliente_id is null or c.cliente_id = p_cliente_id)
        and (p_oportunidad_id is null or c.oportunidad_id = p_oportunidad_id)
        and (p_desde is null or c.fecha >= p_desde) and (p_hasta is null or c.fecha <= p_hasta)
        and (v_t is null or c.numero ilike '%' || v_t || '%' or cl.nombre ilike '%' || v_t || '%')
    ), f as (
      select * from base b where
        (p_vista = 'abiertas' and b.estado in ('borrador', 'pendiente_aprobacion', 'aprobada', 'enviada') and not b.es_vencida)
        or (p_vista = 'por_aprobar' and b.estado = 'pendiente_aprobacion')
        or (p_vista = 'aceptadas' and b.estado = 'aceptada')
        or (p_vista = 'cerradas' and (b.estado in ('rechazada', 'anulada') or b.es_vencida))
        or p_vista = 'todas'
    )
    select jsonb_build_object(
      'equipo', v_equipo, 'puede_aprobar', v_aprobar, 'total', (select count(*) from f),
      'conteos', jsonb_build_object(
        'abiertas', (select count(*) from base where estado in ('borrador', 'pendiente_aprobacion', 'aprobada', 'enviada') and not es_vencida),
        'por_aprobar', case when v_aprobar then (select count(*) from base where estado = 'pendiente_aprobacion') end,
        'aceptadas', (select count(*) from base where estado = 'aceptada'),
        'cerradas', (select count(*) from base where estado in ('rechazada', 'anulada') or es_vencida)),
      'filas', coalesce((select jsonb_agg(crm.fn_cotizacion_json(x) order by x.fecha desc, x.numero desc)
        from crm.cotizaciones x
        where (x.id, x.fecha) in (select id, fecha from f order by fecha desc, numero desc limit v_lim offset v_off)), '[]'::jsonb))
  );
end;
$$;

create or replace function public.crm_cotizacion_obtener(p_company_id uuid, p_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_uid uuid; c crm.cotizaciones; v_costo boolean; v_editar boolean; v_abierta boolean;
begin
  v_uid := core.fn_exigir_permiso(p_company_id, 'crm.ventas.cotizacion.ver');
  select * into c from crm.cotizaciones x where x.id = p_id and x.company_id = p_company_id
    and (x.responsable_id = v_uid or crm.fn_equipo(v_uid, p_company_id));
  if not found then perform crm.fn_no_encontrado(); end if;
  -- P1: el costo de referencia solo a quien puede ver costos en Productos.
  v_costo := crm.fn_puede(v_uid, p_company_id, 'productos.catalogo.costo.ver');
  v_editar := crm.fn_puede(v_uid, p_company_id, 'crm.ventas.cotizacion.editar');
  v_abierta := c.estado in ('borrador', 'pendiente_aprobacion', 'aprobada', 'enviada');
  return crm.fn_cotizacion_json(c) || jsonb_build_object(
    'lineas', coalesce((select jsonb_agg(jsonb_build_object(
        'linea', l.linea, 'producto_id', l.producto_id, 'codigo', p.codigo, 'descripcion', l.descripcion, 'unidad', l.unidad,
        'cantidad', l.cantidad, 'precio', l.precio, 'descuento_pct', l.descuento_pct, 'subtotal', l.subtotal,
        'descuento_monto', l.descuento_monto, 'total', l.total,
        'supera_descuento', l.descuento_pct > c.descuento_maximo,
        'costo_referencia', case when v_costo then p.costo_referencia end,
        'costo_moneda', case when v_costo then p.costo_moneda end) order by l.linea)
      from crm.cotizacion_lineas l join productos.productos p on p.id = l.producto_id
      where l.cotizacion_id = c.id and l.fecha = c.fecha), '[]'::jsonb),
    'historial', coalesce((select jsonb_agg(jsonb_build_object('tipo', ev.tipo, 'fecha', ev.creado_en,
        'usuario', crm.fn_nombre(ev.user_id), 'datos', ev.datos) order by ev.creado_en)
      from crm.eventos ev where ev.entidad = 'cotizacion' and ev.entidad_id = c.id and ev.company_id = p_company_id), '[]'::jsonb),
    'acciones', jsonb_build_object(
      'editar', v_editar and c.estado in ('borrador', 'aprobada'),
      'enviar', v_editar and c.estado in ('borrador', 'aprobada'),
      'aprobar', c.estado = 'pendiente_aprobacion' and c.responsable_id <> v_uid
                 and crm.fn_puede(v_uid, p_company_id, 'crm.ventas.cotizacion.aprobar'),
      'resultado', v_editar and c.estado = 'enviada',
      'anular', v_abierta and crm.fn_puede(v_uid, p_company_id, 'crm.ventas.cotizacion.anular'),
      'duplicar', crm.fn_puede(v_uid, p_company_id, 'crm.ventas.cotizacion.crear'),
      'reasignar', v_abierta and crm.fn_puede(v_uid, p_company_id, 'crm.ventas.asignacion.gestionar'),
      'ganar_oportunidad', c.oportunidad_id is not null and crm.fn_puede(v_uid, p_company_id, 'crm.ventas.oportunidad.editar')
                           and exists (select 1 from crm.oportunidades o where o.id = c.oportunidad_id and o.estado = 'abierta')));
end;
$$;

-- p_encabezado: {cliente_id, oportunidad_id, atencion, valida_hasta, tipo_cambio, condiciones, exento_iva, responsable_id}
-- p_lineas: [{producto_id, descripcion, cantidad, precio, descuento_pct}]  (1 a 200; el orden del arreglo es el de las líneas)
-- Solo se edita un borrador o una aprobada (que vuelve a borrador y pierde la aprobación).
create or replace function public.crm_cotizacion_guardar(
  p_company_id uuid, p_id uuid, p_encabezado jsonb, p_lineas jsonb, p_version integer default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid; c crm.cotizaciones; par crm.embudo_parametros; v_hoy date := crm.fn_hoy();
  v_cliente uuid; v_opp uuid; v_opp_cliente uuid; v_valida date; v_tc numeric; v_resp uuid; v_estado_antes text;
  r jsonb; i integer := 0; v_prod uuid; p productos.productos; v_unidad text; v_previos uuid[];
begin
  if p_id is null then
    v_uid := core.fn_exigir_permiso(p_company_id, 'crm.ventas.cotizacion.crear');
  else
    v_uid := core.fn_exigir_permiso(p_company_id, 'crm.ventas.cotizacion.editar');
    select * into c from crm.cotizaciones x where x.id = p_id and x.company_id = p_company_id
      and (x.responsable_id = v_uid or crm.fn_equipo(v_uid, p_company_id)) for update;
    if not found then perform crm.fn_no_encontrado(); end if;
    if p_version is distinct from c.version then perform crm.fn_conflicto(); end if;
    if c.estado not in ('borrador', 'aprobada') then
      raise exception 'Solo se edita una cotización en borrador. Para cambiarla, duplícala.';
    end if;
  end if;
  if jsonb_typeof(p_encabezado) is distinct from 'object' then raise exception 'Datos inválidos.'; end if;
  if jsonb_typeof(p_lineas) is distinct from 'array' or jsonb_array_length(p_lineas) = 0 then
    raise exception 'Agrega al menos un producto.';
  end if;
  if jsonb_array_length(p_lineas) > 200 then raise exception 'Máximo 200 líneas por cotización.'; end if;
  perform crm.fn_sembrar_embudo(p_company_id);
  select * into par from crm.embudo_parametros x where x.company_id = p_company_id;

  -- Cliente y oportunidad (S1: la oportunidad es opcional; si viene, fija el cliente).
  v_opp := nullif(p_encabezado->>'oportunidad_id', '')::uuid;
  if v_opp is not null then
    if not crm.fn_oportunidad_visible(v_uid, p_company_id, v_opp) then perform crm.fn_no_encontrado(); end if;
    select o.cliente_id into v_opp_cliente from crm.oportunidades o where o.id = v_opp and o.estado = 'abierta';
    if not found and v_opp is distinct from c.oportunidad_id then raise exception 'La oportunidad ya está cerrada.'; end if;
    if v_opp_cliente is null then select o.cliente_id into v_opp_cliente from crm.oportunidades o where o.id = v_opp; end if;
  end if;
  v_cliente := coalesce(nullif(p_encabezado->>'cliente_id', '')::uuid, v_opp_cliente);
  perform crm.fn_cliente_de_empresa(p_company_id, v_cliente);
  if v_opp is not null and v_cliente <> v_opp_cliente then raise exception 'El cliente debe ser el de la oportunidad.'; end if;

  v_valida := case when nullif(p_encabezado->>'valida_hasta', '') is null
                   then coalesce(c.valida_hasta, v_hoy + par.validez_dias)
                   else crm.fn_fecha(p_encabezado->>'valida_hasta', 'La fecha de validez') end;
  if v_valida < coalesce(c.fecha, v_hoy) then raise exception 'La validez no puede ser anterior a la fecha de emisión.'; end if;
  v_tc := case when nullif(p_encabezado->>'tipo_cambio', '') is null then coalesce(c.tipo_cambio, par.tipo_cambio)
               else round(crm.fn_monto(p_encabezado->>'tipo_cambio', 'El tipo de cambio', 0.0001, 9999), 4) end;
  v_resp := crm.fn_resolver_responsable(v_uid, p_company_id, nullif(p_encabezado->>'responsable_id', '')::uuid,
                                        c.responsable_id, 'crm.ventas.cotizacion.ver');

  if p_id is null then
    perform crm.fn_asegurar_particion_cotizaciones(v_hoy);
    insert into crm.cotizaciones (fecha, company_id, numero, cliente_id, oportunidad_id, atencion, valida_hasta, tipo_cambio,
                                  condiciones, exento_iva, iva_porcentaje, descuento_maximo, responsable_id, created_by)
    values (v_hoy, p_company_id, crm.fn_siguiente_numero(p_company_id, 'COT', v_hoy), v_cliente, v_opp,
            crm.fn_txt(p_encabezado->>'atencion', 'Atención a', 1, 120), v_valida, v_tc,
            crm.fn_txt(p_encabezado->>'condiciones', 'Las condiciones', 1, 2000),
            coalesce(nullif(p_encabezado->>'exento_iva', '')::boolean, false), par.iva_porcentaje, par.descuento_maximo,
            v_resp, v_uid)
    returning * into c;
    v_previos := '{}';
  else
    v_estado_antes := c.estado;
    select array_agg(l.producto_id) into v_previos from crm.cotizacion_lineas l where l.cotizacion_id = c.id and l.fecha = c.fecha;
    update crm.cotizaciones x set cliente_id = v_cliente, oportunidad_id = v_opp,
      atencion = crm.fn_txt(p_encabezado->>'atencion', 'Atención a', 1, 120), valida_hasta = v_valida, tipo_cambio = v_tc,
      condiciones = crm.fn_txt(p_encabezado->>'condiciones', 'Las condiciones', 1, 2000),
      exento_iva = coalesce(nullif(p_encabezado->>'exento_iva', '')::boolean, x.exento_iva),
      iva_porcentaje = par.iva_porcentaje, descuento_maximo = par.descuento_maximo, responsable_id = v_resp,
      estado = 'borrador', aprobado_por = null, aprobado_en = null,
      updated_at = now(), version = x.version + 1
    where x.id = c.id and x.fecha = c.fecha returning * into c;
    delete from crm.cotizacion_lineas l where l.cotizacion_id = c.id and l.fecha = c.fecha;
  end if;

  for r in select x from jsonb_array_elements(p_lineas) x loop
    i := i + 1;
    begin
      v_prod := nullif(r->>'producto_id', '')::uuid;
    exception when others then raise exception 'Línea %: producto inválido.', i;
    end;
    select * into p from productos.productos x where x.id = v_prod and x.company_id = p_company_id;
    if not found then raise exception 'Línea %: el producto no existe.', i; end if;
    if p.descontinuado_ventas and not (v_prod = any(coalesce(v_previos, '{}'))) then
      raise exception 'Línea %: el producto % está descontinuado para ventas.', i, p.codigo;
    end if;
    select coalesce(u.simbolo, u.nombre) into v_unidad from productos.unidades u where u.id = p.unidad_id;
    insert into crm.cotizacion_lineas (cotizacion_id, fecha, company_id, linea, producto_id, descripcion, unidad,
                                       cantidad, precio, descuento_pct, subtotal, descuento_monto, total)
    values (c.id, c.fecha, p_company_id, i, p.id,
            coalesce(crm.fn_txt(r->>'descripcion', 'Línea ' || i || ': la descripción', 1, 300), left(p.nombre, 300)),
            left(v_unidad, 40),
            round(crm.fn_monto(r->>'cantidad', 'Línea ' || i || ': la cantidad', 0.001, 99999999), 3),
            round(crm.fn_monto(r->>'precio', 'Línea ' || i || ': el precio', 0.01, 99999999), 2),
            case when nullif(btrim(coalesce(r->>'descuento_pct', '')), '') is null then 0
                 else round(crm.fn_monto(r->>'descuento_pct', 'Línea ' || i || ': el descuento', 0, 100), 2) end,
            0, 0, 0);
  end loop;
  perform crm.fn_recalcular_cotizacion(c.id, c.fecha);
  select * into c from crm.cotizaciones x where x.id = c.id and x.fecha = c.fecha;

  perform crm.fn_evento(v_uid, p_company_id, 'cotizacion', c.id, c.oportunidad_id,
    case when p_id is null then 'creada' when v_estado_antes = 'aprobada' then 'editada_pierde_aprobacion' else 'editada' end,
    jsonb_build_object('numero', c.numero, 'total', c.total));
  return jsonb_build_object('id', c.id, 'numero', c.numero, 'version', c.version, 'total', c.total,
    'requiere_aprobacion', c.requiere_aprobacion, 'descuento_efectivo', c.descuento_efectivo, 'descuento_maximo', c.descuento_maximo);
end;
$$;

-- Dentro del límite → enviada; fuera → pendiente_aprobacion. Una aprobada → enviada.
create or replace function public.crm_cotizacion_enviar(p_company_id uuid, p_id uuid, p_version integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_uid uuid; c crm.cotizaciones; v_par numeric;
begin
  v_uid := core.fn_exigir_permiso(p_company_id, 'crm.ventas.cotizacion.editar');
  select * into c from crm.cotizaciones x where x.id = p_id and x.company_id = p_company_id
    and (x.responsable_id = v_uid or crm.fn_equipo(v_uid, p_company_id)) for update;
  if not found then perform crm.fn_no_encontrado(); end if;
  if p_version is distinct from c.version then perform crm.fn_conflicto(); end if;
  if c.estado = 'pendiente_aprobacion' then raise exception 'No se puede enviar: requiere aprobación.'; end if;
  if c.estado not in ('borrador', 'aprobada') then raise exception 'Esta cotización ya no se puede enviar.'; end if;
  if not exists (select 1 from crm.cotizacion_lineas l where l.cotizacion_id = c.id and l.fecha = c.fecha) then
    raise exception 'Agrega al menos un producto.';
  end if;

  if c.estado = 'borrador' then
    select x.descuento_maximo into v_par from crm.embudo_parametros x where x.company_id = p_company_id;
    update crm.cotizaciones x set descuento_maximo = v_par where x.id = c.id and x.fecha = c.fecha;
    perform crm.fn_recalcular_cotizacion(c.id, c.fecha);
    select * into c from crm.cotizaciones x where x.id = c.id and x.fecha = c.fecha;
    if c.requiere_aprobacion then
      update crm.cotizaciones x set estado = 'pendiente_aprobacion', comentario_rechazo = null, updated_at = now(), version = x.version + 1
        where x.id = c.id and x.fecha = c.fecha returning * into c;
      perform crm.fn_evento(v_uid, p_company_id, 'cotizacion', c.id, c.oportunidad_id, 'aprobacion_solicitada',
        jsonb_build_object('numero', c.numero, 'descuento_efectivo', c.descuento_efectivo, 'descuento_max_linea', c.descuento_max_linea,
                           'descuento_maximo', c.descuento_maximo));
      return jsonb_build_object('id', c.id, 'estado', c.estado, 'version', c.version);
    end if;
  end if;

  update crm.cotizaciones x set estado = 'enviada', enviada_en = now(), comentario_rechazo = null, updated_at = now(), version = x.version + 1
    where x.id = c.id and x.fecha = c.fecha returning * into c;
  perform crm.fn_evento(v_uid, p_company_id, 'cotizacion', c.id, c.oportunidad_id, 'enviada',
    jsonb_build_object('numero', c.numero, 'total', c.total));
  return jsonb_build_object('id', c.id, 'estado', c.estado, 'version', c.version);
end;
$$;

-- P7: nadie aprueba sus propias cotizaciones (tampoco el Administrador).
create or replace function public.crm_cotizacion_aprobar(p_company_id uuid, p_id uuid, p_comentario text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_uid uuid; c crm.cotizaciones; v_com text;
begin
  v_uid := core.fn_exigir_permiso(p_company_id, 'crm.ventas.cotizacion.aprobar');
  select * into c from crm.cotizaciones x where x.id = p_id and x.company_id = p_company_id
    and (x.responsable_id = v_uid or crm.fn_equipo(v_uid, p_company_id)) for update;
  if not found then perform crm.fn_no_encontrado(); end if;
  if c.estado <> 'pendiente_aprobacion' then raise exception 'Esta cotización no está pendiente de aprobación.'; end if;
  if c.responsable_id = v_uid or c.created_by = v_uid then raise exception 'No puedes aprobar tus propias cotizaciones.'; end if;
  v_com := crm.fn_txt(p_comentario, 'El comentario', 1, 500);
  update crm.cotizaciones x set estado = 'aprobada', aprobado_por = v_uid, aprobado_en = now(), comentario_rechazo = null,
    updated_at = now(), version = x.version + 1 where x.id = c.id and x.fecha = c.fecha returning * into c;
  perform crm.fn_evento(v_uid, p_company_id, 'cotizacion', c.id, c.oportunidad_id, 'aprobada',
    jsonb_build_object('numero', c.numero, 'comentario', v_com, 'descuento_efectivo', c.descuento_efectivo));
  return jsonb_build_object('id', c.id, 'estado', c.estado, 'version', c.version, 'responsable', crm.fn_nombre(c.responsable_id));
end;
$$;

create or replace function public.crm_cotizacion_rechazar_aprobacion(p_company_id uuid, p_id uuid, p_comentario text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_uid uuid; c crm.cotizaciones; v_com text;
begin
  v_uid := core.fn_exigir_permiso(p_company_id, 'crm.ventas.cotizacion.aprobar');
  select * into c from crm.cotizaciones x where x.id = p_id and x.company_id = p_company_id
    and (x.responsable_id = v_uid or crm.fn_equipo(v_uid, p_company_id)) for update;
  if not found then perform crm.fn_no_encontrado(); end if;
  if c.estado <> 'pendiente_aprobacion' then raise exception 'Esta cotización no está pendiente de aprobación.'; end if;
  if c.responsable_id = v_uid or c.created_by = v_uid then raise exception 'No puedes resolver la aprobación de tus propias cotizaciones.'; end if;
  v_com := crm.fn_txt(p_comentario, 'El comentario', 3, 500, true);
  update crm.cotizaciones x set estado = 'borrador', comentario_rechazo = v_com, updated_at = now(), version = x.version + 1
    where x.id = c.id and x.fecha = c.fecha returning * into c;
  perform crm.fn_evento(v_uid, p_company_id, 'cotizacion', c.id, c.oportunidad_id, 'aprobacion_rechazada',
    jsonb_build_object('numero', c.numero, 'comentario', v_com));
  return jsonb_build_object('id', c.id, 'estado', c.estado, 'version', c.version);
end;
$$;

create or replace function crm.fn_anular(p_uid uuid, p_company_id uuid, c crm.cotizaciones, p_motivo text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update crm.cotizaciones x set estado = 'anulada', anulada_por = p_uid, anulada_en = now(), motivo_anulacion = p_motivo,
    updated_at = now(), version = x.version + 1 where x.id = c.id and x.fecha = c.fecha;
  perform crm.fn_evento(p_uid, p_company_id, 'cotizacion', c.id, c.oportunidad_id, 'anulada',
    jsonb_build_object('numero', c.numero, 'motivo', p_motivo));
end;
$$;

-- Resultado del cliente sobre una enviada (también vencida, con aviso en la UI: P6).
create or replace function public.crm_cotizacion_resultado(
  p_company_id uuid, p_id uuid, p_resultado text, p_motivo text, p_ganar_oportunidad boolean, p_anular_hermanas boolean, p_version integer
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid; c crm.cotizaciones; v_motivo text; o crm.oportunidades; h crm.cotizaciones; v_anuladas integer := 0; v_ganada boolean := false;
begin
  v_uid := core.fn_exigir_permiso(p_company_id, 'crm.ventas.cotizacion.editar');
  select * into c from crm.cotizaciones x where x.id = p_id and x.company_id = p_company_id
    and (x.responsable_id = v_uid or crm.fn_equipo(v_uid, p_company_id)) for update;
  if not found then perform crm.fn_no_encontrado(); end if;
  if p_version is distinct from c.version then perform crm.fn_conflicto(); end if;
  if c.estado <> 'enviada' then raise exception 'Solo una cotización enviada puede marcarse aceptada o rechazada.'; end if;
  if p_resultado not in ('aceptada', 'rechazada') then raise exception 'Resultado inválido.'; end if;
  v_motivo := crm.fn_txt(p_motivo, 'El motivo', 1, 300);

  if p_resultado = 'aceptada' and coalesce(p_ganar_oportunidad, false) and c.oportunidad_id is not null then
    if not crm.fn_puede(v_uid, p_company_id, 'crm.ventas.oportunidad.editar') then
      raise exception 'Tu rol no permite marcar la oportunidad como ganada.';
    end if;
    select * into o from crm.oportunidades x where x.id = c.oportunidad_id and x.deleted_at is null for update;
    if found and o.estado = 'abierta' then
      perform crm.fn_ganar(v_uid, p_company_id, o.id, c.total, crm.fn_hoy(), c.id);
      v_ganada := true;
    end if;
  end if;
  if p_resultado = 'aceptada' and coalesce(p_anular_hermanas, false) and c.oportunidad_id is not null then
    if not crm.fn_puede(v_uid, p_company_id, 'crm.ventas.cotizacion.anular') then
      raise exception 'Tu rol no permite anular las otras cotizaciones.';
    end if;
    for h in select * from crm.cotizaciones x where x.oportunidad_id = c.oportunidad_id and x.company_id = p_company_id
               and x.id <> c.id and x.estado in ('borrador', 'pendiente_aprobacion', 'aprobada', 'enviada') for update loop
      perform crm.fn_anular(v_uid, p_company_id, h, 'Se aceptó la cotización ' || c.numero);
      v_anuladas := v_anuladas + 1;
    end loop;
  end if;

  update crm.cotizaciones x set estado = p_resultado, resultado_en = now(), motivo_resultado = v_motivo,
    updated_at = now(), version = x.version + 1 where x.id = c.id and x.fecha = c.fecha returning * into c;
  perform crm.fn_evento(v_uid, p_company_id, 'cotizacion', c.id, c.oportunidad_id, p_resultado,
    jsonb_build_object('numero', c.numero, 'total', c.total, 'motivo', v_motivo,
                       'vencida', c.valida_hasta < crm.fn_hoy(), 'oportunidad_ganada', v_ganada, 'anuladas', v_anuladas));
  return jsonb_build_object('id', c.id, 'estado', c.estado, 'version', c.version, 'oportunidad_ganada', v_ganada, 'anuladas', v_anuladas);
end;
$$;

create or replace function public.crm_cotizacion_anular(p_company_id uuid, p_id uuid, p_motivo text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_uid uuid; c crm.cotizaciones; v_motivo text;
begin
  v_uid := core.fn_exigir_permiso(p_company_id, 'crm.ventas.cotizacion.anular');
  select * into c from crm.cotizaciones x where x.id = p_id and x.company_id = p_company_id
    and (x.responsable_id = v_uid or crm.fn_equipo(v_uid, p_company_id)) for update;
  if not found then perform crm.fn_no_encontrado(); end if;
  if c.estado not in ('borrador', 'pendiente_aprobacion', 'aprobada', 'enviada') then
    raise exception 'Esta cotización ya está cerrada.';
  end if;
  v_motivo := crm.fn_txt(p_motivo, 'El motivo', 3, 300, true);
  perform crm.fn_anular(v_uid, p_company_id, c, v_motivo);
  return jsonb_build_object('id', c.id, 'estado', 'anulada');
end;
$$;

create or replace function public.crm_cotizacion_duplicar(p_company_id uuid, p_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_uid uuid; c crm.cotizaciones; n crm.cotizaciones; par crm.embudo_parametros; v_hoy date := crm.fn_hoy(); v_opp uuid;
begin
  v_uid := core.fn_exigir_permiso(p_company_id, 'crm.ventas.cotizacion.crear');
  select * into c from crm.cotizaciones x where x.id = p_id and x.company_id = p_company_id
    and (x.responsable_id = v_uid or crm.fn_equipo(v_uid, p_company_id));
  if not found then perform crm.fn_no_encontrado(); end if;
  perform crm.fn_sembrar_embudo(p_company_id);
  select * into par from crm.embudo_parametros x where x.company_id = p_company_id;
  select o.id into v_opp from crm.oportunidades o where o.id = c.oportunidad_id and o.estado = 'abierta' and o.deleted_at is null;
  perform crm.fn_asegurar_particion_cotizaciones(v_hoy);
  insert into crm.cotizaciones (fecha, company_id, numero, cliente_id, oportunidad_id, atencion, valida_hasta, tipo_cambio,
                                condiciones, exento_iva, iva_porcentaje, descuento_maximo, duplicada_de, responsable_id, created_by)
  values (v_hoy, p_company_id, crm.fn_siguiente_numero(p_company_id, 'COT', v_hoy), c.cliente_id, v_opp, c.atencion,
          v_hoy + par.validez_dias, par.tipo_cambio, c.condiciones, c.exento_iva, par.iva_porcentaje, par.descuento_maximo,
          c.id, case when c.responsable_id = v_uid or not crm.fn_puede(v_uid, p_company_id, 'crm.ventas.asignacion.gestionar')
                     then v_uid else c.responsable_id end, v_uid)
  returning * into n;
  insert into crm.cotizacion_lineas (cotizacion_id, fecha, company_id, linea, producto_id, descripcion, unidad, cantidad, precio,
                                     descuento_pct, subtotal, descuento_monto, total)
  select n.id, n.fecha, p_company_id, l.linea, l.producto_id, l.descripcion, l.unidad, l.cantidad, l.precio, l.descuento_pct, 0, 0, 0
  from crm.cotizacion_lineas l where l.cotizacion_id = c.id and l.fecha = c.fecha;
  perform crm.fn_recalcular_cotizacion(n.id, n.fecha);
  perform crm.fn_evento(v_uid, p_company_id, 'cotizacion', n.id, n.oportunidad_id, 'creada',
    jsonb_build_object('numero', n.numero, 'duplicada_de', c.numero));
  return jsonb_build_object('id', n.id, 'numero', n.numero);
end;
$$;

-- Datos para la vista de impresión (P3: impresión del navegador).
create or replace function public.crm_cotizacion_impresion(p_company_id uuid, p_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_uid uuid; c crm.cotizaciones; v jsonb;
begin
  v_uid := core.fn_exigir_permiso(p_company_id, 'crm.ventas.cotizacion.ver');
  select * into c from crm.cotizaciones x where x.id = p_id and x.company_id = p_company_id
    and (x.responsable_id = v_uid or crm.fn_equipo(v_uid, p_company_id));
  if not found then perform crm.fn_no_encontrado(); end if;
  v := crm.fn_cotizacion_json(c);
  return v || jsonb_build_object(
    'lineas', coalesce((select jsonb_agg(jsonb_build_object('linea', l.linea, 'codigo', p.codigo, 'descripcion', l.descripcion,
        'unidad', l.unidad, 'cantidad', l.cantidad, 'precio', l.precio, 'descuento_pct', l.descuento_pct, 'total', l.total) order by l.linea)
      from crm.cotizacion_lineas l join productos.productos p on p.id = l.producto_id
      where l.cotizacion_id = c.id and l.fecha = c.fecha), '[]'::jsonb),
    'empresa', coalesce((select x.empresa from crm.embudo_parametros x where x.company_id = p_company_id), '{}'::jsonb)
               || jsonb_build_object('nombre', (select co.name from core.companies co where co.id = p_company_id),
                                     'logo_url', (select s.logo_url from core.platform_settings s order by s.id limit 1)),
    'marca_agua', case
      when c.estado = 'borrador' then 'BORRADOR · NO VÁLIDA'
      when c.estado = 'pendiente_aprobacion' then 'PENDIENTE DE APROBACIÓN'
      when c.estado = 'anulada' then 'ANULADA'
      when c.estado = 'rechazada' then 'RECHAZADA'
      when c.estado = 'enviada' and c.valida_hasta < crm.fn_hoy() then 'VENCIDA'
      end);
end;
$$;

-- -----------------------------------------------------------------------------
-- 11. RPC: indicadores del Dashboard (cada bloque solo con su permiso)
-- -----------------------------------------------------------------------------
create or replace function public.crm_embudo_resumen(p_company_id uuid, p_solo_mio boolean default false)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid uuid; v_equipo boolean; v_resp uuid; v_mes date := date_trunc('month', crm.fn_hoy())::date; v_hoy date := crm.fn_hoy();
  v_ini timestamptz := (crm.fn_hoy()::timestamp at time zone 'America/Managua');
  v_fin timestamptz := ((crm.fn_hoy() + 1)::timestamp at time zone 'America/Managua');
  v jsonb := '{}'::jsonb; v_g integer; v_p integer;
begin
  v_uid := crm.fn_exigir_alguno(p_company_id, array[
    'crm.ventas.lead.ver', 'crm.ventas.oportunidad.ver', 'crm.ventas.actividad.ver', 'crm.ventas.cotizacion.ver']);
  v_equipo := crm.fn_equipo(v_uid, p_company_id);
  v_resp := case when v_equipo and not coalesce(p_solo_mio, false) then null else v_uid end;
  v := jsonb_build_object('alcance', case when v_resp is null then 'equipo' else 'mio' end, 'equipo', v_equipo);

  if crm.fn_puede(v_uid, p_company_id, 'crm.ventas.oportunidad.ver') then
    select count(*) filter (where o.estado = 'ganada' and o.fecha_cierre >= v_mes),
           count(*) filter (where o.estado = 'perdida' and o.fecha_cierre >= v_mes)
      into v_g, v_p
      from crm.oportunidades o where o.company_id = p_company_id and o.deleted_at is null and (v_resp is null or o.responsable_id = v_resp);
    v := v || jsonb_build_object('oportunidades', (
      select jsonb_build_object(
        'abiertas', count(*) filter (where o.estado = 'abierta'),
        'monto_abierto', coalesce(sum(o.monto_estimado) filter (where o.estado = 'abierta'), 0),
        'ponderado', coalesce(round(sum(o.monto_estimado * o.probabilidad / 100) filter (where o.estado = 'abierta'), 2), 0),
        'ganadas_mes', v_g,
        'ganado_mes', coalesce(sum(o.monto_ganado) filter (where o.estado = 'ganada' and o.fecha_cierre >= v_mes), 0),
        'perdidas_mes', v_p,
        'tasa_cierre_mes', case when v_g + v_p > 0 then round(v_g::numeric / (v_g + v_p) * 100, 1) end,
        'cierre_vencido', count(*) filter (where o.estado = 'abierta' and o.fecha_cierre_estimada < v_hoy),
        'por_etapa', coalesce((select jsonb_agg(jsonb_build_object('id', e.id, 'nombre', e.nombre, 'probabilidad', e.probabilidad,
              'cantidad', (select count(*) from crm.oportunidades x where x.etapa_id = e.id and x.estado = 'abierta' and x.deleted_at is null
                           and (v_resp is null or x.responsable_id = v_resp)),
              'monto', (select coalesce(sum(x.monto_estimado), 0) from crm.oportunidades x where x.etapa_id = e.id and x.estado = 'abierta'
                        and x.deleted_at is null and (v_resp is null or x.responsable_id = v_resp))) order by e.orden)
            from crm.etapas e where e.company_id = p_company_id and e.tipo = 'abierta' and e.activa), '[]'::jsonb))
      from crm.oportunidades o where o.company_id = p_company_id and o.deleted_at is null and (v_resp is null or o.responsable_id = v_resp)));
  end if;

  if crm.fn_puede(v_uid, p_company_id, 'crm.ventas.actividad.ver') then
    v := v || jsonb_build_object('actividades', (
      select jsonb_build_object(
        'hoy', count(*) filter (where a.fecha >= v_ini and a.fecha < v_fin),
        'vencidas', count(*) filter (where a.fecha < now()))
      from crm.actividades a where a.company_id = p_company_id and a.deleted_at is null and a.estado = 'agendada'
        and (v_resp is null or a.responsable_id = v_resp)));
  end if;

  if crm.fn_puede(v_uid, p_company_id, 'crm.ventas.lead.ver') then
    v := v || jsonb_build_object('leads', (
      select jsonb_build_object(
        'nuevos_mes', count(*) filter (where l.created_at >= (v_mes::timestamp at time zone 'America/Managua')),
        'activos', count(*) filter (where l.estado in ('nuevo', 'contactado', 'calificado')),
        'sin_seguimiento', count(*) filter (where l.estado in ('nuevo', 'contactado') and not exists (
          select 1 from crm.actividades a where a.lead_id = l.id and a.deleted_at is null
            and (a.estado = 'agendada' or (a.estado = 'completada' and a.fecha > now() - interval '7 days')))))
      from crm.leads l where l.company_id = p_company_id and l.deleted_at is null and (v_resp is null or l.responsable_id = v_resp)));
  end if;

  if crm.fn_puede(v_uid, p_company_id, 'crm.ventas.cotizacion.ver') then
    v := v || jsonb_build_object('cotizaciones', (
      select jsonb_build_object(
        'enviadas_abiertas', count(*) filter (where c.estado = 'enviada' and c.valida_hasta >= v_hoy),
        'monto_enviadas', coalesce(sum(c.total) filter (where c.estado = 'enviada' and c.valida_hasta >= v_hoy), 0),
        'por_aprobar', case when crm.fn_puede(v_uid, p_company_id, 'crm.ventas.cotizacion.aprobar')
                            then count(*) filter (where c.estado = 'pendiente_aprobacion' and c.responsable_id <> v_uid) end)
      from crm.cotizaciones c where c.company_id = p_company_id
        and (v_resp is null or c.responsable_id = v_resp
             or (c.estado = 'pendiente_aprobacion' and v_equipo and crm.fn_puede(v_uid, p_company_id, 'crm.ventas.cotizacion.aprobar')))));
  end if;
  return v;
end;
$$;

-- -----------------------------------------------------------------------------
-- 12. Permisos de ejecución
-- -----------------------------------------------------------------------------
-- Helpers crm.fn_* sin EXECUTE para la API (crm.default_company_id, de crm.clientes, no se toca).
do $$
declare f record;
begin
  for f in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'crm' and p.proname like 'fn\_%' loop
    execute format('revoke all on function %s from public, anon, authenticated', f.sig);
  end loop;
  for f in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname like 'crm\_%' loop
    execute format('revoke all on function %s from public, anon', f.sig);
    execute format('grant execute on function %s to authenticated', f.sig);
  end loop;
end;
$$;

-- -----------------------------------------------------------------------------
-- 13. Postcheck
-- -----------------------------------------------------------------------------
do $$
declare v_n integer;
begin
  select count(*) into v_n from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname like 'crm\_%';
  if v_n <> 48 then raise exception 'postcheck: se esperaban 48 RPC public.crm_*, hay %', v_n; end if;
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
             where n.nspname = 'public' and p.proname like 'crm\_%' and has_function_privilege('anon', p.oid, 'execute')) then
    raise exception 'postcheck: anon puede ejecutar una RPC crm';
  end if;
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
             where n.nspname = 'crm' and p.proname like 'fn\_%' and has_function_privilege('authenticated', p.oid, 'execute')) then
    raise exception 'postcheck: authenticated puede ejecutar un helper crm.fn_*';
  end if;
  if has_table_privilege('authenticated', 'crm.leads', 'select') or has_table_privilege('authenticated', 'crm.cotizaciones', 'select') then
    raise exception 'postcheck: las tablas del embudo quedaron expuestas';
  end if;
  if not has_table_privilege('authenticated', 'crm.clientes', 'select') then
    raise exception 'postcheck: crm.clientes perdió su GRANT';
  end if;
end;
$$;
