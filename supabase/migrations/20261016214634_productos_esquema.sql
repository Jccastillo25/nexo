-- =============================================================================
-- Módulo Productos (catálogo maestro) — esquema + RPC
--
-- Diseño y decisiones del usuario (2026-10-16): docs/plan/14-productos.md §4.
-- Requiere el Paso Cero 20261016203638_productos_paso_cero.
--
-- Resumen:
--   1. Schema productos (sin exponer a la API: todo por RPC):
--        clasificaciones (Clase › Tipo › Categoría, árbol estricto, número de
--        2 dígitos dentro del padre), marcas (+ clases permitidas), unidades,
--        proveedores, características, cuentas contables, centros de costo;
--        productos (+ características por producto); contadores de ID y de
--        código por categoría.
--   2. ID del producto (numero_id) único e inmutable; los importados conservan
--      el ID del ERP, los nuevos siguen desde el más alto + 1.
--   3. Código editable (único); si no se escribe, se genera
--      clase+tipo+categoría + "-" + consecutivo de 3 dígitos (ej. 030202-001).
--   4. RPC public.productos_* (security definer + core.fn_exigir_permiso);
--      el costo nunca sale sin productos.catalogo.costo.ver.
--   5. Los productos no se borran (trigger); se descontinúan.
-- Todas son tablas de catálogo: no se particionan.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0. Prechecks
-- -----------------------------------------------------------------------------
do $$
begin
  if to_regnamespace('productos') is not null then
    raise exception 'precheck: el schema productos ya existe';
  end if;
  if not exists (select 1 from core.permissions_catalog where code = 'productos.catalogo.producto.crear') then
    raise exception 'precheck: falta el Paso Cero de Productos';
  end if;
end;
$$;

create schema productos;
revoke all on schema productos from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 1. Catálogos
-- -----------------------------------------------------------------------------
create table productos.clasificaciones (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references core.companies(id) on delete cascade,
  nivel text not null check (nivel in ('clase', 'tipo', 'categoria')),
  padre_id uuid,
  numero text not null check (numero ~ '^[0-9]{2}$' and numero <> '00'),
  nombre text not null check (length(btrim(nombre)) between 1 and 80),
  codigo_erp text check (codigo_erp is null or length(codigo_erp) <= 20),
  activa boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, company_id),
  foreign key (padre_id, company_id) references productos.clasificaciones (id, company_id),
  check ((nivel = 'clase') = (padre_id is null))
);
create unique index clasificaciones_clase_numero_uq on productos.clasificaciones (company_id, numero) where padre_id is null;
create unique index clasificaciones_clase_nombre_uq on productos.clasificaciones (company_id, lower(btrim(nombre))) where padre_id is null;
create unique index clasificaciones_hijo_numero_uq on productos.clasificaciones (padre_id, numero) where padre_id is not null;
create unique index clasificaciones_hijo_nombre_uq on productos.clasificaciones (padre_id, lower(btrim(nombre))) where padre_id is not null;
create index clasificaciones_padre_idx on productos.clasificaciones (padre_id);

comment on table productos.clasificaciones is
  'Clase › Tipo › Categoría (árbol estricto). numero: 2 dígitos dentro del padre, forma el código de los productos nuevos; queda fijo cuando algún producto usa el nivel. codigo_erp: número que traía el ERP, solo referencia.';

create table productos.marcas (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references core.companies(id) on delete cascade,
  nombre text not null check (length(btrim(nombre)) between 1 and 80),
  activa boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, company_id)
);
create unique index marcas_nombre_uq on productos.marcas (company_id, lower(btrim(nombre)));

create table productos.marca_clases (
  company_id uuid not null,
  marca_id uuid not null,
  clase_id uuid not null,
  primary key (marca_id, clase_id),
  foreign key (marca_id, company_id) references productos.marcas (id, company_id) on delete cascade,
  foreign key (clase_id, company_id) references productos.clasificaciones (id, company_id) on delete cascade
);
create index marca_clases_clase_idx on productos.marca_clases (clase_id);
comment on table productos.marca_clases is 'Clases donde se permite cada marca. Sin filas = la marca vale para cualquier clase.';

create table productos.unidades (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references core.companies(id) on delete cascade,
  nombre text not null check (length(btrim(nombre)) between 1 and 30),
  simbolo text check (simbolo is null or length(simbolo) <= 10),
  activa boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, company_id)
);
create unique index unidades_nombre_uq on productos.unidades (company_id, lower(btrim(nombre)));

create table productos.proveedores (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references core.companies(id) on delete cascade,
  nombre text not null check (length(btrim(nombre)) between 1 and 150),
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, company_id)
);
create unique index proveedores_nombre_uq on productos.proveedores (company_id, lower(btrim(nombre)));
comment on table productos.proveedores is 'Proveedores de productos. Pasa a un módulo de Compras cuando exista.';

create table productos.caracteristicas (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references core.companies(id) on delete cascade,
  nombre text not null check (length(btrim(nombre)) between 1 and 60),
  tipo text not null default 'texto' check (tipo in ('texto', 'numero', 'si_no')),
  activa boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, company_id)
);
create unique index caracteristicas_nombre_uq on productos.caracteristicas (company_id, lower(btrim(nombre)));

create table productos.cuentas_contables (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references core.companies(id) on delete cascade,
  codigo text not null check (length(btrim(codigo)) between 1 and 30),
  nombre text not null check (length(btrim(nombre)) between 1 and 120),
  tipo text not null check (tipo in ('ingreso', 'inventario', 'costo')),
  exenta boolean not null default false,
  activa boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, company_id)
);
create unique index cuentas_contables_codigo_uq on productos.cuentas_contables (company_id, lower(btrim(codigo)));

create table productos.centros_costo (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references core.companies(id) on delete cascade,
  codigo text not null check (length(btrim(codigo)) between 1 and 30),
  nombre text not null check (length(btrim(nombre)) between 1 and 120),
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, company_id)
);
create unique index centros_costo_codigo_uq on productos.centros_costo (company_id, lower(btrim(codigo)));

-- -----------------------------------------------------------------------------
-- 2. Productos
-- -----------------------------------------------------------------------------
create table productos.productos (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references core.companies(id) on delete cascade,
  numero_id bigint not null check (numero_id > 0),
  codigo text not null check (length(codigo) between 1 and 40 and codigo = btrim(codigo)),
  nombre text not null check (length(btrim(nombre)) between 1 and 200),
  descripcion text check (descripcion is null or length(descripcion) <= 2000),
  notas text check (notas is null or length(notas) <= 2000),
  codigo_barras text check (codigo_barras is null or length(btrim(codigo_barras)) between 1 and 60),
  peso numeric(12,3) check (peso is null or peso >= 0),
  erp_producto_id bigint check (erp_producto_id is null or erp_producto_id > 0),
  fecha_ingreso date not null default current_date,
  es_servicio boolean not null default false,
  inventariable boolean not null default true,
  clase_id uuid,
  tipo_id uuid,
  categoria_id uuid,
  marca_id uuid,
  proveedor_id uuid,
  unidad_id uuid not null,
  exento_ventas boolean not null default false,
  exento_compras boolean not null default false,
  cuenta_ingreso_id uuid,
  cuenta_inventario_id uuid,
  cuenta_costo_id uuid,
  codigo_sac text check (codigo_sac is null or length(codigo_sac) <= 40),
  centro_costo_id uuid,
  centro_costo_unico boolean not null default false,
  costo_moneda text not null default 'NIO' check (costo_moneda in ('NIO', 'USD')),
  costo_referencia numeric(14,4) check (costo_referencia is null or costo_referencia >= 0),
  existencia_minima numeric(14,3) not null default 0 check (existencia_minima >= 0),
  existencia_maxima numeric(14,3) not null default 0 check (existencia_maxima >= 0),
  lote_por_vencimiento boolean not null default false,
  plazo_vencimiento_dias integer check (plazo_vencimiento_dias is null or plazo_vencimiento_dias >= 0),
  margen_dias_vencer integer check (margen_dias_vencer is null or margen_dias_vencer >= 0),
  descontinuado_ventas boolean not null default false,
  descontinuado_compras boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, company_id),
  unique (company_id, numero_id),
  foreign key (clase_id, company_id) references productos.clasificaciones (id, company_id),
  foreign key (tipo_id, company_id) references productos.clasificaciones (id, company_id),
  foreign key (categoria_id, company_id) references productos.clasificaciones (id, company_id),
  foreign key (marca_id, company_id) references productos.marcas (id, company_id),
  foreign key (proveedor_id, company_id) references productos.proveedores (id, company_id),
  foreign key (unidad_id, company_id) references productos.unidades (id, company_id),
  foreign key (cuenta_ingreso_id, company_id) references productos.cuentas_contables (id, company_id),
  foreign key (cuenta_inventario_id, company_id) references productos.cuentas_contables (id, company_id),
  foreign key (cuenta_costo_id, company_id) references productos.cuentas_contables (id, company_id),
  foreign key (centro_costo_id, company_id) references productos.centros_costo (id, company_id)
);
create unique index productos_codigo_uq on productos.productos (company_id, upper(codigo));
create unique index productos_barras_uq on productos.productos (company_id, btrim(codigo_barras)) where codigo_barras is not null;
create unique index productos_erp_uq on productos.productos (company_id, erp_producto_id) where erp_producto_id is not null;
create index productos_nombre_idx on productos.productos (company_id, lower(nombre));
create index productos_clase_idx on productos.productos (clase_id);
create index productos_tipo_idx on productos.productos (tipo_id);
create index productos_categoria_idx on productos.productos (categoria_id);
create index productos_marca_idx on productos.productos (marca_id);
create index productos_proveedor_idx on productos.productos (proveedor_id);
create index productos_unidad_idx on productos.productos (unidad_id);
create index productos_cuenta_ingreso_idx on productos.productos (cuenta_ingreso_id);
create index productos_cuenta_inventario_idx on productos.productos (cuenta_inventario_id);
create index productos_cuenta_costo_idx on productos.productos (cuenta_costo_id);
create index productos_centro_costo_idx on productos.productos (centro_costo_id);

comment on table productos.productos is
  'Catálogo maestro (Nexo es el maestro, 2026-10-16). numero_id = ID del producto, inmutable; los demás módulos referencian id/numero_id, nunca el código. Sin precios (van en Listas de precios) ni existencias reales (Inventario).';
comment on column productos.productos.numero_id is 'ID visible del producto. Importados: el ID del ERP. Nuevos: más alto + 1. Inmutable (trigger).';
comment on column productos.productos.codigo is 'Código editable y único. Generado como CCTTKK-NNN si no se escribe.';
comment on column productos.productos.erp_producto_id is 'ID del producto en el ERP, para exportarle. Solo se puede fijar una vez.';

create table productos.producto_caracteristicas (
  company_id uuid not null,
  producto_id uuid not null,
  caracteristica_id uuid not null,
  valor text not null check (length(valor) <= 200),
  primary key (producto_id, caracteristica_id),
  foreign key (producto_id, company_id) references productos.productos (id, company_id) on delete cascade,
  foreign key (caracteristica_id, company_id) references productos.caracteristicas (id, company_id)
);
create index producto_caracteristicas_carac_idx on productos.producto_caracteristicas (caracteristica_id);

-- Último ID asignado por empresa y último consecutivo de código por categoría.
create table productos.id_contadores (
  company_id uuid primary key references core.companies(id) on delete cascade,
  ultimo bigint not null default 0
);
create table productos.codigo_contadores (
  categoria_id uuid primary key references productos.clasificaciones(id) on delete cascade,
  company_id uuid not null,
  ultimo integer not null default 0 check (ultimo between 0 and 999)
);
create index codigo_contadores_company_idx on productos.codigo_contadores (company_id);

alter table productos.clasificaciones enable row level security;
alter table productos.marcas enable row level security;
alter table productos.marca_clases enable row level security;
alter table productos.unidades enable row level security;
alter table productos.proveedores enable row level security;
alter table productos.caracteristicas enable row level security;
alter table productos.cuentas_contables enable row level security;
alter table productos.centros_costo enable row level security;
alter table productos.productos enable row level security;
alter table productos.producto_caracteristicas enable row level security;
alter table productos.id_contadores enable row level security;
alter table productos.codigo_contadores enable row level security;
revoke all on all tables in schema productos from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 3. Triggers de integridad
-- -----------------------------------------------------------------------------
create or replace function productos.fn_trg_clasificacion()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_padre_nivel text;
begin
  if tg_op = 'UPDATE' then
    if new.nivel <> old.nivel or new.padre_id is distinct from old.padre_id or new.company_id <> old.company_id then
      raise exception 'No se puede mover una clasificación a otro nivel ni a otro padre.';
    end if;
    if new.numero <> old.numero and exists (
      select 1 from productos.productos p
      where p.clase_id = old.id or p.tipo_id = old.id or p.categoria_id = old.id) then
      raise exception 'El número % ya lo usan productos; no se puede cambiar.', old.numero;
    end if;
    new.updated_at := now();
  end if;
  if new.padre_id is not null then
    select c.nivel into v_padre_nivel from productos.clasificaciones c where c.id = new.padre_id;
    if (new.nivel = 'tipo' and v_padre_nivel is distinct from 'clase')
       or (new.nivel = 'categoria' and v_padre_nivel is distinct from 'tipo') then
      raise exception 'Un tipo cuelga de una clase y una categoría de un tipo.';
    end if;
  end if;
  new.nombre := regexp_replace(btrim(new.nombre), '\s+', ' ', 'g');
  return new;
end;
$$;
create trigger trg_clasificacion before insert or update on productos.clasificaciones
  for each row execute function productos.fn_trg_clasificacion();

create or replace function productos.fn_trg_producto()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_padre uuid;
  v_nivel text;
begin
  if tg_op = 'UPDATE' then
    if new.id <> old.id or new.numero_id <> old.numero_id or new.company_id <> old.company_id then
      raise exception 'El ID del producto no se puede modificar.';
    end if;
    if old.erp_producto_id is not null and new.erp_producto_id is distinct from old.erp_producto_id then
      raise exception 'El ID del ERP ya está fijado y no se puede cambiar.';
    end if;
  end if;

  new.codigo := btrim(new.codigo);
  new.nombre := regexp_replace(btrim(new.nombre), '\s+', ' ', 'g');
  new.codigo_barras := nullif(btrim(coalesce(new.codigo_barras, '')), '');

  -- Clasificación: la categoría define el tipo y el tipo define la clase.
  if new.categoria_id is not null then
    select c.padre_id, c.nivel into v_padre, v_nivel from productos.clasificaciones c where c.id = new.categoria_id;
    if v_nivel is distinct from 'categoria' then raise exception 'La categoría elegida no es una categoría.'; end if;
    if new.tipo_id is not null and new.tipo_id <> v_padre then raise exception 'La categoría no pertenece al tipo elegido.'; end if;
    new.tipo_id := v_padre;
  end if;
  if new.tipo_id is not null then
    select c.padre_id, c.nivel into v_padre, v_nivel from productos.clasificaciones c where c.id = new.tipo_id;
    if v_nivel is distinct from 'tipo' then raise exception 'El tipo elegido no es un tipo.'; end if;
    if new.clase_id is not null and new.clase_id <> v_padre then raise exception 'El tipo no pertenece a la clase elegida.'; end if;
    new.clase_id := v_padre;
  end if;
  if new.clase_id is not null and not exists (
    select 1 from productos.clasificaciones c where c.id = new.clase_id and c.nivel = 'clase') then
    raise exception 'La clase elegida no es una clase.';
  end if;

  if new.marca_id is not null and new.clase_id is not null
     and exists (select 1 from productos.marca_clases mc where mc.marca_id = new.marca_id)
     and not exists (select 1 from productos.marca_clases mc where mc.marca_id = new.marca_id and mc.clase_id = new.clase_id) then
    raise exception 'La marca elegida no está permitida en esa clase.';
  end if;

  if new.cuenta_ingreso_id is not null and not exists (select 1 from productos.cuentas_contables c where c.id = new.cuenta_ingreso_id and c.tipo = 'ingreso') then
    raise exception 'La cuenta de ingresos no es una cuenta de ingresos.';
  end if;
  if new.cuenta_inventario_id is not null and not exists (select 1 from productos.cuentas_contables c where c.id = new.cuenta_inventario_id and c.tipo = 'inventario') then
    raise exception 'La cuenta de inventario no es una cuenta de inventario.';
  end if;
  if new.cuenta_costo_id is not null and not exists (select 1 from productos.cuentas_contables c where c.id = new.cuenta_costo_id and c.tipo = 'costo') then
    raise exception 'La cuenta de costos no es una cuenta de costos.';
  end if;

  -- Regla del ERP: un servicio no lleva clasificación, marca, proveedor,
  -- cuenta de costos ni existencias.
  if new.es_servicio then
    if new.clase_id is not null or new.marca_id is not null or new.proveedor_id is not null
       or new.cuenta_costo_id is not null or new.existencia_minima > 0 or new.existencia_maxima > 0 then
      raise exception 'Un servicio no lleva clasificación, marca, proveedor, cuenta de costos ni existencias.';
    end if;
    new.inventariable := false;
  end if;

  if new.existencia_maxima > 0 and new.existencia_minima > new.existencia_maxima then
    raise exception 'La existencia mínima no puede ser mayor que la máxima.';
  end if;

  new.updated_at := now();
  return new;
end;
$$;
create trigger trg_producto before insert or update on productos.productos
  for each row execute function productos.fn_trg_producto();

create or replace function productos.fn_trg_no_borrar()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  raise exception 'Los productos no se borran; se descontinúan.';
end;
$$;
create trigger trg_producto_no_borrar before delete on productos.productos
  for each row execute function productos.fn_trg_no_borrar();

-- -----------------------------------------------------------------------------
-- 4. Helpers internos
-- -----------------------------------------------------------------------------
create or replace function productos.fn_puede(p_company_id uuid, p_code text)
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and core.has_permission(auth.uid(), p_company_id, p_code);
$$;

-- Siguiente ID: más alto entre el contador y los existentes, + 1 (con bloqueo).
create or replace function productos.fn_siguiente_id(p_company_id uuid)
returns bigint language plpgsql security definer set search_path = '' as $$
declare
  v bigint;
begin
  insert into productos.id_contadores (company_id) values (p_company_id) on conflict do nothing;
  update productos.id_contadores ic
    set ultimo = greatest(ic.ultimo,
                          (select coalesce(max(p.numero_id), 0) from productos.productos p where p.company_id = p_company_id)) + 1
    where ic.company_id = p_company_id
    returning ic.ultimo into v;
  return v;
end;
$$;

-- Prefijo de código de una categoría: número de clase + tipo + categoría.
create or replace function productos.fn_prefijo(p_categoria_id uuid)
returns text language sql stable security definer set search_path = '' as $$
  select cl.numero || ti.numero || ca.numero
  from productos.clasificaciones ca
  join productos.clasificaciones ti on ti.id = ca.padre_id
  join productos.clasificaciones cl on cl.id = ti.padre_id
  where ca.id = p_categoria_id and ca.nivel = 'categoria';
$$;

-- Primer consecutivo libre después de p_desde (sin reservar).
create or replace function productos.fn_codigo_libre(p_company_id uuid, p_prefijo text, p_desde integer)
returns text language plpgsql stable security definer set search_path = '' as $$
declare
  n integer := p_desde + 1;
  v text;
begin
  loop
    if n > 999 then raise exception 'La categoría ya usó los 999 códigos (%-999).', p_prefijo; end if;
    v := p_prefijo || '-' || lpad(n::text, 3, '0');
    exit when not exists (select 1 from productos.productos p where p.company_id = p_company_id and upper(p.codigo) = upper(v));
    n := n + 1;
  end loop;
  return v;
end;
$$;

-- Genera y reserva el siguiente código de la categoría (con bloqueo).
create or replace function productos.fn_generar_codigo(p_company_id uuid, p_categoria_id uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_pre text := productos.fn_prefijo(p_categoria_id);
  v_ultimo integer;
  v text;
begin
  if v_pre is null then raise exception 'Elige clase, tipo y categoría para generar el código.'; end if;
  insert into productos.codigo_contadores (categoria_id, company_id) values (p_categoria_id, p_company_id) on conflict do nothing;
  select cc.ultimo into v_ultimo from productos.codigo_contadores cc where cc.categoria_id = p_categoria_id for update;
  v := productos.fn_codigo_libre(p_company_id, v_pre, v_ultimo);
  update productos.codigo_contadores cc set ultimo = split_part(v, '-', 2)::integer where cc.categoria_id = p_categoria_id;
  return v;
end;
$$;

-- Si un código escrito a mano sigue el patrón de su categoría, el contador avanza.
create or replace function productos.fn_ajustar_contador(p_company_id uuid, p_categoria_id uuid, p_codigo text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_pre text;
begin
  if p_categoria_id is null then return; end if;
  v_pre := productos.fn_prefijo(p_categoria_id);
  if v_pre is null or p_codigo !~ ('^' || v_pre || '-[0-9]{3}$') then return; end if;
  insert into productos.codigo_contadores (categoria_id, company_id, ultimo)
  values (p_categoria_id, p_company_id, split_part(p_codigo, '-', 2)::integer)
  on conflict (categoria_id) do update set ultimo = greatest(productos.codigo_contadores.ultimo, excluded.ultimo);
end;
$$;

-- Siguiente número libre de 2 dígitos dentro del padre (o entre las clases).
create or replace function productos.fn_numero_libre(p_company_id uuid, p_padre_id uuid)
returns text language plpgsql stable security definer set search_path = '' as $$
declare
  n integer := 1;
begin
  loop
    if n > 99 then raise exception 'Ya se usaron los 99 números de este nivel.'; end if;
    exit when not exists (
      select 1 from productos.clasificaciones c
      where c.company_id = p_company_id and c.padre_id is not distinct from p_padre_id and c.numero = lpad(n::text, 2, '0'));
    n := n + 1;
  end loop;
  return lpad(n::text, 2, '0');
end;
$$;

-- Fila de producto con nombres legibles; el costo solo si p_con_costo.
create or replace function productos.fn_producto_json(p_id uuid, p_con_costo boolean)
returns jsonb language sql stable security definer set search_path = '' as $$
  select to_jsonb(p) - case when p_con_costo then '{}'::text[] else array['costo_referencia', 'costo_moneda'] end
    || jsonb_build_object(
      'clase', cl.nombre, 'clase_numero', cl.numero,
      'tipo', ti.nombre, 'tipo_numero', ti.numero,
      'categoria', ca.nombre, 'categoria_numero', ca.numero,
      'marca', m.nombre, 'proveedor', pr.nombre, 'unidad', u.nombre,
      'cuenta_ingreso', ci.codigo || ' / ' || ci.nombre,
      'cuenta_inventario', cv.codigo || ' / ' || cv.nombre,
      'cuenta_costo', cc.codigo || ' / ' || cc.nombre,
      'centro_costo', ce.nombre,
      'caracteristicas', coalesce((
        select jsonb_agg(jsonb_build_object('caracteristica_id', pc.caracteristica_id, 'nombre', c.nombre, 'valor', pc.valor) order by c.nombre)
        from productos.producto_caracteristicas pc join productos.caracteristicas c on c.id = pc.caracteristica_id
        where pc.producto_id = p.id), '[]'::jsonb))
  from productos.productos p
  left join productos.clasificaciones cl on cl.id = p.clase_id
  left join productos.clasificaciones ti on ti.id = p.tipo_id
  left join productos.clasificaciones ca on ca.id = p.categoria_id
  left join productos.marcas m on m.id = p.marca_id
  left join productos.proveedores pr on pr.id = p.proveedor_id
  left join productos.unidades u on u.id = p.unidad_id
  left join productos.cuentas_contables ci on ci.id = p.cuenta_ingreso_id
  left join productos.cuentas_contables cv on cv.id = p.cuenta_inventario_id
  left join productos.cuentas_contables cc on cc.id = p.cuenta_costo_id
  left join productos.centros_costo ce on ce.id = p.centro_costo_id
  where p.id = p_id;
$$;

-- -----------------------------------------------------------------------------
-- 5. RPC — lectura
-- -----------------------------------------------------------------------------
create or replace function public.productos_resumen(p_company_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v jsonb;
begin
  perform core.fn_exigir_permiso(p_company_id, 'productos.dashboard.resumen.ver');
  select jsonb_build_object(
    'total', count(*),
    'activos', count(*) filter (where not p.descontinuado_ventas),
    'servicios', count(*) filter (where p.es_servicio),
    'descontinuados', count(*) filter (where p.descontinuado_ventas),
    'sin_clasificacion', count(*) filter (where not p.es_servicio and p.categoria_id is null),
    'con_codigo_barras', count(*) filter (where p.codigo_barras is not null),
    'sin_costo', case when productos.fn_puede(p_company_id, 'productos.catalogo.costo.ver')
                      then count(*) filter (where coalesce(p.costo_referencia, 0) <= 1) end,
    'siguiente_id', greatest(coalesce(max(p.numero_id), 0),
                             coalesce((select ic.ultimo from productos.id_contadores ic where ic.company_id = p_company_id), 0)) + 1,
    'clases', (select count(*) from productos.clasificaciones c where c.company_id = p_company_id and c.nivel = 'clase'),
    'ultimos', coalesce((
      select jsonb_agg(jsonb_build_object('id', x.id, 'numero_id', x.numero_id, 'codigo', x.codigo, 'nombre', x.nombre, 'created_at', x.created_at)
                       order by x.created_at desc, x.numero_id desc)
      from (select * from productos.productos q where q.company_id = p_company_id order by q.created_at desc, q.numero_id desc limit 5) x), '[]'::jsonb))
  into v
  from productos.productos p where p.company_id = p_company_id;
  return v;
end;
$$;

create or replace function public.productos_listar(
  p_company_id uuid, p_buscar text default null, p_clase_id uuid default null,
  p_estado text default null, p_limite integer default 50, p_desde integer default 0
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_costo boolean;
  v_q text := nullif(btrim(coalesce(p_buscar, '')), '');
  v jsonb;
begin
  perform core.fn_exigir_permiso(p_company_id, 'productos.catalogo.producto.ver');
  v_costo := productos.fn_puede(p_company_id, 'productos.catalogo.costo.ver');
  with base as (
    select p.* from productos.productos p
    where p.company_id = p_company_id
      and (p_clase_id is null or p.clase_id = p_clase_id)
      and (p_estado is null
           or (p_estado = 'activos' and not p.descontinuado_ventas)
           or (p_estado = 'descontinuados' and p.descontinuado_ventas)
           or (p_estado = 'sin_clasificar' and not p.es_servicio and p.categoria_id is null))
      and (v_q is null
           or p.nombre ilike '%' || v_q || '%'
           or p.codigo ilike '%' || v_q || '%'
           or p.codigo_barras ilike '%' || v_q || '%'
           or p.numero_id::text = v_q)
  )
  select jsonb_build_object(
    'total', (select count(*) from base),
    'costo_visible', v_costo,
    'filas', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', b.id, 'numero_id', b.numero_id, 'codigo', b.codigo, 'nombre', b.nombre,
        'codigo_barras', b.codigo_barras, 'es_servicio', b.es_servicio,
        'clasificacion', concat_ws(' › ', cl.nombre, ti.nombre, ca.nombre),
        'marca', m.nombre, 'unidad', u.nombre,
        'costo', case when v_costo then b.costo_referencia end,
        'costo_moneda', case when v_costo then b.costo_moneda end,
        'descontinuado_ventas', b.descontinuado_ventas,
        'sin_clasificacion', not b.es_servicio and b.categoria_id is null) order by b.nombre)
      from (select * from base order by lower(base.nombre), base.numero_id
            limit least(greatest(coalesce(p_limite, 50), 1), 200) offset greatest(coalesce(p_desde, 0), 0)) b
      left join productos.clasificaciones cl on cl.id = b.clase_id
      left join productos.clasificaciones ti on ti.id = b.tipo_id
      left join productos.clasificaciones ca on ca.id = b.categoria_id
      left join productos.marcas m on m.id = b.marca_id
      left join productos.unidades u on u.id = b.unidad_id), '[]'::jsonb))
  into v;
  return v;
end;
$$;

create or replace function public.productos_obtener(p_company_id uuid, p_producto_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v jsonb;
begin
  perform core.fn_exigir_permiso(p_company_id, 'productos.catalogo.producto.ver');
  if not exists (select 1 from productos.productos p where p.id = p_producto_id and p.company_id = p_company_id) then
    raise exception 'Producto no encontrado.';
  end if;
  v := productos.fn_producto_json(p_producto_id, productos.fn_puede(p_company_id, 'productos.catalogo.costo.ver'));
  return v;
end;
$$;

-- Catálogos para formularios y pantallas de configuración.
create or replace function public.productos_catalogos(p_company_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  perform core.fn_exigir_permiso(p_company_id, 'productos.catalogo.producto.ver');
  return jsonb_build_object(
    'clasificaciones', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', c.id, 'nivel', c.nivel, 'padre_id', c.padre_id, 'numero', c.numero, 'nombre', c.nombre,
        'codigo_erp', c.codigo_erp, 'activa', c.activa,
        'productos', (select count(*) from productos.productos p
                      where p.clase_id = c.id or p.tipo_id = c.id or p.categoria_id = c.id),
        'prefijo', case when c.nivel = 'categoria' then productos.fn_prefijo(c.id) end)
        order by c.nivel, c.numero)
      from productos.clasificaciones c where c.company_id = p_company_id), '[]'::jsonb),
    'marcas', coalesce((
      select jsonb_agg(jsonb_build_object('id', m.id, 'nombre', m.nombre, 'activa', m.activa,
        'clases', coalesce((select jsonb_agg(mc.clase_id) from productos.marca_clases mc where mc.marca_id = m.id), '[]'::jsonb))
        order by lower(m.nombre))
      from productos.marcas m where m.company_id = p_company_id), '[]'::jsonb),
    'unidades', coalesce((select jsonb_agg(jsonb_build_object('id', u.id, 'nombre', u.nombre, 'simbolo', u.simbolo, 'activa', u.activa) order by lower(u.nombre))
      from productos.unidades u where u.company_id = p_company_id), '[]'::jsonb),
    'proveedores', coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'nombre', x.nombre, 'activo', x.activo) order by lower(x.nombre))
      from productos.proveedores x where x.company_id = p_company_id), '[]'::jsonb),
    'caracteristicas', coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'nombre', x.nombre, 'tipo', x.tipo, 'activa', x.activa) order by lower(x.nombre))
      from productos.caracteristicas x where x.company_id = p_company_id), '[]'::jsonb),
    'cuentas', coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'codigo', x.codigo, 'nombre', x.nombre, 'tipo', x.tipo, 'exenta', x.exenta, 'activa', x.activa) order by x.tipo, x.codigo)
      from productos.cuentas_contables x where x.company_id = p_company_id), '[]'::jsonb),
    'centros_costo', coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'codigo', x.codigo, 'nombre', x.nombre, 'activo', x.activo) order by x.codigo)
      from productos.centros_costo x where x.company_id = p_company_id), '[]'::jsonb));
end;
$$;

-- Vista previa del código que recibiría un producto nuevo (no lo reserva).
create or replace function public.productos_sugerir_codigo(p_company_id uuid, p_categoria_id uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_pre text;
begin
  perform core.fn_exigir_permiso(p_company_id, 'productos.catalogo.producto.ver');
  v_pre := productos.fn_prefijo(p_categoria_id);
  if v_pre is null or not exists (select 1 from productos.clasificaciones c where c.id = p_categoria_id and c.company_id = p_company_id) then
    return null;
  end if;
  return productos.fn_codigo_libre(p_company_id, v_pre,
    coalesce((select cc.ultimo from productos.codigo_contadores cc where cc.categoria_id = p_categoria_id), 0));
end;
$$;

-- -----------------------------------------------------------------------------
-- 6. RPC — escritura de productos
-- -----------------------------------------------------------------------------
-- p_datos: solo las claves presentes se aplican. Grupos y permisos:
--   general -> crear (nuevo) / editar; costo -> costo.editar; fiscal -> fiscal.editar.
create or replace function public.productos_guardar(p_company_id uuid, p_producto_id uuid, p_datos jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_base productos.productos;
  v productos.productos;
  v_nuevo boolean := p_producto_id is null;
  d jsonb := coalesce(p_datos, '{}'::jsonb);
  v_cambios jsonb;
  v_codigo_generado boolean := false;
begin
  if v_nuevo then
    v_uid := core.fn_exigir_permiso(p_company_id, 'productos.catalogo.producto.crear');
    v_base.company_id := p_company_id;
    v_base.codigo := '';
    v_base.nombre := '';
    v_base.fecha_ingreso := current_date;
    v_base.es_servicio := false; v_base.inventariable := true;
    v_base.exento_ventas := false; v_base.exento_compras := false; v_base.centro_costo_unico := false;
    v_base.costo_moneda := 'NIO';
    v_base.existencia_minima := 0; v_base.existencia_maxima := 0;
    v_base.lote_por_vencimiento := false;
    v_base.descontinuado_ventas := false; v_base.descontinuado_compras := false;
  else
    if v_uid is null then raise exception using errcode = '42501', message = 'Sesión requerida.'; end if;
    perform core.fn_exigir_permiso(p_company_id, 'productos.catalogo.producto.ver');
    select * into v_base from productos.productos p where p.id = p_producto_id and p.company_id = p_company_id for update;
    if not found then raise exception 'Producto no encontrado.'; end if;
  end if;
  v := v_base;

  -- general
  if d ? 'codigo' then v.codigo := btrim(coalesce(d->>'codigo', '')); end if;
  if d ? 'nombre' then v.nombre := coalesce(d->>'nombre', ''); end if;
  if d ? 'descripcion' then v.descripcion := nullif(btrim(coalesce(d->>'descripcion', '')), ''); end if;
  if d ? 'notas' then v.notas := nullif(btrim(coalesce(d->>'notas', '')), ''); end if;
  if d ? 'codigo_barras' then v.codigo_barras := d->>'codigo_barras'; end if;
  if d ? 'peso' then v.peso := nullif(d->>'peso', '')::numeric; end if;
  if d ? 'fecha_ingreso' then v.fecha_ingreso := coalesce(nullif(d->>'fecha_ingreso', '')::date, v.fecha_ingreso); end if;
  if d ? 'es_servicio' then v.es_servicio := coalesce((d->>'es_servicio')::boolean, false); end if;
  if d ? 'inventariable' then v.inventariable := coalesce((d->>'inventariable')::boolean, true); end if;
  if d ? 'clase_id' then v.clase_id := nullif(d->>'clase_id', '')::uuid; end if;
  if d ? 'tipo_id' then v.tipo_id := nullif(d->>'tipo_id', '')::uuid; end if;
  if d ? 'categoria_id' then v.categoria_id := nullif(d->>'categoria_id', '')::uuid; end if;
  if d ? 'marca_id' then v.marca_id := nullif(d->>'marca_id', '')::uuid; end if;
  if d ? 'proveedor_id' then v.proveedor_id := nullif(d->>'proveedor_id', '')::uuid; end if;
  if d ? 'unidad_id' then v.unidad_id := nullif(d->>'unidad_id', '')::uuid; end if;
  if d ? 'existencia_minima' then v.existencia_minima := coalesce(nullif(d->>'existencia_minima', '')::numeric, 0); end if;
  if d ? 'existencia_maxima' then v.existencia_maxima := coalesce(nullif(d->>'existencia_maxima', '')::numeric, 0); end if;
  if d ? 'lote_por_vencimiento' then v.lote_por_vencimiento := coalesce((d->>'lote_por_vencimiento')::boolean, false); end if;
  if d ? 'plazo_vencimiento_dias' then v.plazo_vencimiento_dias := nullif(d->>'plazo_vencimiento_dias', '')::integer; end if;
  if d ? 'margen_dias_vencer' then v.margen_dias_vencer := nullif(d->>'margen_dias_vencer', '')::integer; end if;
  -- costo
  if d ? 'costo_moneda' then v.costo_moneda := coalesce(nullif(d->>'costo_moneda', ''), 'NIO'); end if;
  if d ? 'costo_referencia' then v.costo_referencia := nullif(d->>'costo_referencia', '')::numeric; end if;
  -- fiscal
  if d ? 'exento_ventas' then v.exento_ventas := coalesce((d->>'exento_ventas')::boolean, false); end if;
  if d ? 'exento_compras' then v.exento_compras := coalesce((d->>'exento_compras')::boolean, false); end if;
  if d ? 'cuenta_ingreso_id' then v.cuenta_ingreso_id := nullif(d->>'cuenta_ingreso_id', '')::uuid; end if;
  if d ? 'cuenta_inventario_id' then v.cuenta_inventario_id := nullif(d->>'cuenta_inventario_id', '')::uuid; end if;
  if d ? 'cuenta_costo_id' then v.cuenta_costo_id := nullif(d->>'cuenta_costo_id', '')::uuid; end if;
  if d ? 'codigo_sac' then v.codigo_sac := nullif(btrim(coalesce(d->>'codigo_sac', '')), ''); end if;
  if d ? 'centro_costo_id' then v.centro_costo_id := nullif(d->>'centro_costo_id', '')::uuid; end if;
  if d ? 'centro_costo_unico' then v.centro_costo_unico := coalesce((d->>'centro_costo_unico')::boolean, false); end if;

  -- Permisos por grupo de campos que realmente cambian.
  if not v_nuevo and (
       v.codigo, v.nombre, v.descripcion, v.notas, v.codigo_barras, v.peso, v.fecha_ingreso, v.es_servicio, v.inventariable,
       v.clase_id, v.tipo_id, v.categoria_id, v.marca_id, v.proveedor_id, v.unidad_id,
       v.existencia_minima, v.existencia_maxima, v.lote_por_vencimiento, v.plazo_vencimiento_dias, v.margen_dias_vencer
     ) is distinct from (
       v_base.codigo, v_base.nombre, v_base.descripcion, v_base.notas, v_base.codigo_barras, v_base.peso, v_base.fecha_ingreso, v_base.es_servicio, v_base.inventariable,
       v_base.clase_id, v_base.tipo_id, v_base.categoria_id, v_base.marca_id, v_base.proveedor_id, v_base.unidad_id,
       v_base.existencia_minima, v_base.existencia_maxima, v_base.lote_por_vencimiento, v_base.plazo_vencimiento_dias, v_base.margen_dias_vencer
     ) or (not v_nuevo and d ? 'caracteristicas') then
    perform core.fn_exigir_permiso(p_company_id, 'productos.catalogo.producto.editar');
  end if;
  if (v.costo_moneda, v.costo_referencia) is distinct from (v_base.costo_moneda, v_base.costo_referencia) then
    perform core.fn_exigir_permiso(p_company_id, 'productos.catalogo.costo.editar');
  end if;
  if (v.exento_ventas, v.exento_compras, v.cuenta_ingreso_id, v.cuenta_inventario_id, v.cuenta_costo_id,
      v.codigo_sac, v.centro_costo_id, v.centro_costo_unico)
     is distinct from
     (v_base.exento_ventas, v_base.exento_compras, v_base.cuenta_ingreso_id, v_base.cuenta_inventario_id, v_base.cuenta_costo_id,
      v_base.codigo_sac, v_base.centro_costo_id, v_base.centro_costo_unico) then
    perform core.fn_exigir_permiso(p_company_id, 'productos.catalogo.fiscal.editar');
  end if;

  if length(btrim(v.nombre)) = 0 then raise exception 'Escribe el nombre del producto.'; end if;
  if v.unidad_id is null then raise exception 'Elige la unidad de medida.'; end if;

  if v_nuevo then
    if v.codigo = '' then
      if v.categoria_id is null then raise exception 'Escribe un código o elige clase, tipo y categoría para generarlo.'; end if;
      if not exists (select 1 from productos.clasificaciones c where c.id = v.categoria_id and c.company_id = p_company_id) then
        raise exception 'Categoría no encontrada.';
      end if;
      v.codigo := productos.fn_generar_codigo(p_company_id, v.categoria_id);
      v_codigo_generado := true;
    end if;
    v.id := gen_random_uuid();
    v.numero_id := productos.fn_siguiente_id(p_company_id);
    v.created_by := v_uid; v.updated_by := v_uid;
    v.created_at := now(); v.updated_at := now();
    insert into productos.productos select (v).*;
  else
    if v.codigo = '' then raise exception 'El código no puede quedar vacío.'; end if;
    v.updated_by := v_uid;
    update productos.productos p set
      codigo = v.codigo, nombre = v.nombre, descripcion = v.descripcion, notas = v.notas, codigo_barras = v.codigo_barras,
      peso = v.peso, fecha_ingreso = v.fecha_ingreso, es_servicio = v.es_servicio, inventariable = v.inventariable,
      clase_id = v.clase_id, tipo_id = v.tipo_id, categoria_id = v.categoria_id, marca_id = v.marca_id,
      proveedor_id = v.proveedor_id, unidad_id = v.unidad_id,
      exento_ventas = v.exento_ventas, exento_compras = v.exento_compras,
      cuenta_ingreso_id = v.cuenta_ingreso_id, cuenta_inventario_id = v.cuenta_inventario_id, cuenta_costo_id = v.cuenta_costo_id,
      codigo_sac = v.codigo_sac, centro_costo_id = v.centro_costo_id, centro_costo_unico = v.centro_costo_unico,
      costo_moneda = v.costo_moneda, costo_referencia = v.costo_referencia,
      existencia_minima = v.existencia_minima, existencia_maxima = v.existencia_maxima,
      lote_por_vencimiento = v.lote_por_vencimiento, plazo_vencimiento_dias = v.plazo_vencimiento_dias,
      margen_dias_vencer = v.margen_dias_vencer, updated_by = v.updated_by
    where p.id = v.id;
  end if;
  if not v_codigo_generado then
    perform productos.fn_ajustar_contador(p_company_id, (select p.categoria_id from productos.productos p where p.id = v.id), v.codigo);
  end if;

  if d ? 'caracteristicas' then
    delete from productos.producto_caracteristicas pc where pc.producto_id = v.id;
    insert into productos.producto_caracteristicas (company_id, producto_id, caracteristica_id, valor)
    select p_company_id, v.id, (x->>'caracteristica_id')::uuid, btrim(x->>'valor')
    from jsonb_array_elements(coalesce(d->'caracteristicas', '[]'::jsonb)) x
    where nullif(btrim(coalesce(x->>'valor', '')), '') is not null;
  end if;

  select coalesce(jsonb_object_agg(n.key, jsonb_build_object('de', b.value, 'a', n.value)), '{}'::jsonb) into v_cambios
  from jsonb_each(to_jsonb(v)) n
  join jsonb_each(to_jsonb(v_base)) b on b.key = n.key
  where n.value is distinct from b.value
    and n.key not in ('id', 'created_at', 'updated_at', 'created_by', 'updated_by', 'company_id');
  perform core.fn_auditar(v_uid, p_company_id,
    case when v_nuevo then 'productos.producto.crear' else 'productos.producto.editar' end,
    'productos.productos', v.id::text,
    jsonb_build_object('numero_id', v.numero_id, 'codigo', v.codigo, 'cambios', v_cambios));

  return jsonb_build_object('id', v.id, 'numero_id', v.numero_id, 'codigo', v.codigo);
exception
  when unique_violation then
    if sqlerrm like '%productos_codigo_uq%' then raise exception 'Ese código ya lo usa otro producto.';
    elsif sqlerrm like '%productos_barras_uq%' then raise exception 'Ese código de barras ya lo usa otro producto.';
    else raise;
    end if;
end;
$$;

create or replace function public.productos_descontinuar(
  p_company_id uuid, p_producto_id uuid, p_ventas boolean, p_compras boolean
) returns void language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid;
  v_id uuid;
begin
  v_uid := core.fn_exigir_permiso(p_company_id, 'productos.catalogo.producto.descontinuar');
  update productos.productos p
    set descontinuado_ventas = coalesce(p_ventas, p.descontinuado_ventas),
        descontinuado_compras = coalesce(p_compras, p.descontinuado_compras),
        updated_by = v_uid
    where p.id = p_producto_id and p.company_id = p_company_id
    returning p.id into v_id;
  if v_id is null then raise exception 'Producto no encontrado.'; end if;
  perform core.fn_auditar(v_uid, p_company_id, 'productos.producto.descontinuar', 'productos.productos', v_id::text,
    jsonb_build_object('ventas', p_ventas, 'compras', p_compras));
end;
$$;

-- -----------------------------------------------------------------------------
-- 7. RPC — configuración
-- -----------------------------------------------------------------------------
create or replace function public.productos_siguiente_numero(p_company_id uuid, p_padre_id uuid)
returns text language plpgsql security definer set search_path = '' as $$
begin
  perform core.fn_exigir_permiso(p_company_id, 'productos.catalogo.producto.ver');
  return productos.fn_numero_libre(p_company_id, p_padre_id);
end;
$$;

-- p_numero null o vacío = el siguiente libre.
create or replace function public.productos_guardar_clasificacion(
  p_company_id uuid, p_id uuid, p_nivel text, p_padre_id uuid, p_numero text, p_nombre text, p_activa boolean
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid;
  v_id uuid;
  v_num text := nullif(btrim(coalesce(p_numero, '')), '');
begin
  v_uid := core.fn_exigir_permiso(p_company_id, 'productos.configuracion.clasificacion.gestionar');
  if v_num is not null and v_num ~ '^[0-9]$' then v_num := '0' || v_num; end if;
  if v_num is not null and (v_num !~ '^[0-9]{2}$' or v_num = '00') then
    raise exception 'El número debe tener 2 dígitos, de 01 a 99.';
  end if;
  if p_padre_id is not null and not exists (select 1 from productos.clasificaciones c where c.id = p_padre_id and c.company_id = p_company_id) then
    raise exception 'Clasificación padre no encontrada.';
  end if;

  if p_id is null then
    insert into productos.clasificaciones (company_id, nivel, padre_id, numero, nombre, activa)
    values (p_company_id, p_nivel, p_padre_id, coalesce(v_num, productos.fn_numero_libre(p_company_id, p_padre_id)),
            coalesce(p_nombre, ''), coalesce(p_activa, true))
    returning id into v_id;
  else
    update productos.clasificaciones c
      set numero = coalesce(v_num, c.numero), nombre = coalesce(p_nombre, c.nombre), activa = coalesce(p_activa, c.activa)
      where c.id = p_id and c.company_id = p_company_id
      returning c.id into v_id;
    if v_id is null then raise exception 'Clasificación no encontrada.'; end if;
  end if;

  perform core.fn_auditar(v_uid, p_company_id,
    case when p_id is null then 'productos.clasificacion.crear' else 'productos.clasificacion.editar' end,
    'productos.clasificaciones', v_id::text,
    jsonb_build_object('nivel', p_nivel, 'numero', v_num, 'nombre', p_nombre, 'activa', p_activa));
  return v_id;
exception
  when unique_violation then raise exception 'Ya existe una clasificación con ese número o nombre en el mismo nivel.';
  when check_violation then raise exception 'Revisa el nombre y el número de la clasificación.';
end;
$$;

-- Catálogos simples. p_catalogo: marca | unidad | proveedor | caracteristica | cuenta | centro_costo.
create or replace function public.productos_guardar_catalogo(
  p_company_id uuid, p_catalogo text, p_id uuid, p_datos jsonb
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid;
  v_id uuid;
  d jsonb := coalesce(p_datos, '{}'::jsonb);
  v_activo boolean := coalesce((d->>'activo')::boolean, true);
  v_permiso text := case p_catalogo
    when 'marca' then 'productos.configuracion.marca.gestionar'
    when 'unidad' then 'productos.configuracion.unidad.gestionar'
    when 'proveedor' then 'productos.configuracion.proveedor.gestionar'
    when 'caracteristica' then 'productos.configuracion.caracteristica.gestionar'
    when 'cuenta' then 'productos.configuracion.contable.gestionar'
    when 'centro_costo' then 'productos.configuracion.contable.gestionar' end;
begin
  if v_permiso is null then raise exception 'Catálogo desconocido: %', p_catalogo; end if;
  v_uid := core.fn_exigir_permiso(p_company_id, v_permiso);

  if p_catalogo = 'marca' then
    if p_id is null then
      insert into productos.marcas (company_id, nombre, activa) values (p_company_id, btrim(d->>'nombre'), v_activo) returning id into v_id;
    else
      update productos.marcas x set nombre = coalesce(btrim(d->>'nombre'), x.nombre), activa = v_activo, updated_at = now()
        where x.id = p_id and x.company_id = p_company_id returning x.id into v_id;
    end if;
    if v_id is not null and d ? 'clases' then
      delete from productos.marca_clases mc where mc.marca_id = v_id;
      insert into productos.marca_clases (company_id, marca_id, clase_id)
      select p_company_id, v_id, c.id from productos.clasificaciones c
      where c.company_id = p_company_id and c.nivel = 'clase'
        and c.id in (select (jsonb_array_elements_text(d->'clases'))::uuid);
    end if;
  elsif p_catalogo = 'unidad' then
    if p_id is null then
      insert into productos.unidades (company_id, nombre, simbolo, activa)
      values (p_company_id, upper(btrim(d->>'nombre')), nullif(btrim(coalesce(d->>'simbolo', '')), ''), v_activo) returning id into v_id;
    else
      update productos.unidades x set nombre = coalesce(upper(btrim(d->>'nombre')), x.nombre),
        simbolo = nullif(btrim(coalesce(d->>'simbolo', '')), ''), activa = v_activo, updated_at = now()
        where x.id = p_id and x.company_id = p_company_id returning x.id into v_id;
    end if;
  elsif p_catalogo = 'proveedor' then
    if p_id is null then
      insert into productos.proveedores (company_id, nombre, activo) values (p_company_id, btrim(d->>'nombre'), v_activo) returning id into v_id;
    else
      update productos.proveedores x set nombre = coalesce(btrim(d->>'nombre'), x.nombre), activo = v_activo, updated_at = now()
        where x.id = p_id and x.company_id = p_company_id returning x.id into v_id;
    end if;
  elsif p_catalogo = 'caracteristica' then
    if p_id is null then
      insert into productos.caracteristicas (company_id, nombre, tipo, activa)
      values (p_company_id, btrim(d->>'nombre'), coalesce(nullif(d->>'tipo', ''), 'texto'), v_activo) returning id into v_id;
    else
      update productos.caracteristicas x set nombre = coalesce(btrim(d->>'nombre'), x.nombre),
        tipo = coalesce(nullif(d->>'tipo', ''), x.tipo), activa = v_activo, updated_at = now()
        where x.id = p_id and x.company_id = p_company_id returning x.id into v_id;
    end if;
  elsif p_catalogo = 'cuenta' then
    if p_id is null then
      insert into productos.cuentas_contables (company_id, codigo, nombre, tipo, exenta, activa)
      values (p_company_id, btrim(d->>'codigo'), btrim(d->>'nombre'), d->>'tipo', coalesce((d->>'exenta')::boolean, false), v_activo)
      returning id into v_id;
    else
      update productos.cuentas_contables x set codigo = coalesce(btrim(d->>'codigo'), x.codigo), nombre = coalesce(btrim(d->>'nombre'), x.nombre),
        exenta = coalesce((d->>'exenta')::boolean, x.exenta), activa = v_activo, updated_at = now()
        where x.id = p_id and x.company_id = p_company_id returning x.id into v_id;
    end if;
  else
    if p_id is null then
      insert into productos.centros_costo (company_id, codigo, nombre, activo)
      values (p_company_id, btrim(d->>'codigo'), btrim(d->>'nombre'), v_activo) returning id into v_id;
    else
      update productos.centros_costo x set codigo = coalesce(btrim(d->>'codigo'), x.codigo), nombre = coalesce(btrim(d->>'nombre'), x.nombre),
        activo = v_activo, updated_at = now()
        where x.id = p_id and x.company_id = p_company_id returning x.id into v_id;
    end if;
  end if;
  if v_id is null then raise exception 'Registro no encontrado.'; end if;

  perform core.fn_auditar(v_uid, p_company_id,
    'productos.' || p_catalogo || case when p_id is null then '.crear' else '.editar' end,
    'productos.' || p_catalogo, v_id::text, d);
  return v_id;
exception
  when unique_violation then raise exception 'Ya existe un registro con ese nombre o código.';
  when check_violation or not_null_violation then raise exception 'Revisa los datos: falta el nombre o el código, o son demasiado largos.';
end;
$$;

-- -----------------------------------------------------------------------------
-- 8. RPC — importación desde la plantilla del ERP
-- -----------------------------------------------------------------------------
-- p_filas: arreglo JSON ya leído y limpiado por la app (Excel → JSON). Claves:
--   fila, erp_id, codigo, nombre, codigo_barras, es_servicio, inventariable,
--   exento_ventas, exento_compras, descontinuado_ventas, descontinuado_compras,
--   cuenta_ingreso, cuenta_inventario, cuenta_costo ("411-01 / Nombre"),
--   unidad, fecha_ingreso (aaaa-mm-dd), existencia_minima, existencia_maxima,
--   proveedor, marca, clase {nombre, erp}, tipo {nombre, erp}, categoria {nombre, erp},
--   descripcion, codigo_sac, centro_costo, centro_costo_unico, lote_por_vencimiento,
--   plazo_vencimiento_dias, margen_dias_vencer, costo_moneda, costo_referencia, notas, peso.
-- Crea los catálogos que falten. Producto existente (mismo código) = se actualiza.
-- Todo o nada: con p_confirmar = false, o con algún error, nada queda guardado
-- y se devuelve el mismo resumen (vista previa).
create or replace function public.productos_importar(p_company_id uuid, p_filas jsonb, p_confirmar boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid;
  r jsonb;
  v_fila integer;
  v_codigo text;
  v_prod productos.productos;
  v_existe boolean;
  v_unidad uuid; v_marca uuid; v_prov uuid; v_centro uuid;
  v_cta_ing uuid; v_cta_inv uuid; v_cta_cos uuid;
  v_clase uuid; v_tipo uuid; v_cat uuid;
  v_erp bigint;
  v_creados integer := 0; v_actualizados integer := 0;
  v_errores jsonb := '[]'::jsonb;
  v_sin_clasif integer := 0; v_sin_costo integer := 0;
  v_cat_cuenta jsonb := jsonb_build_object('clases', 0, 'tipos', 0, 'categorias', 0, 'marcas', 0, 'unidades', 0, 'proveedores', 0, 'cuentas', 0, 'centros_costo', 0);
  v_max_erp bigint;
  v_res jsonb;
  v_primer_id bigint;
  v_n integer;
begin
  v_uid := core.fn_exigir_permiso(p_company_id, 'productos.catalogo.producto.importar');
  -- La importación escribe costo y datos fiscales: exige también esos permisos.
  perform core.fn_exigir_permiso(p_company_id, 'productos.catalogo.costo.editar');
  perform core.fn_exigir_permiso(p_company_id, 'productos.catalogo.fiscal.editar');
  if jsonb_typeof(p_filas) is distinct from 'array' then raise exception 'Formato de importación inválido.'; end if;
  if jsonb_array_length(p_filas) > 5000 then raise exception 'Máximo 5000 filas por importación.'; end if;

  begin
    -- Reserva los IDs del ERP: los productos sin ID quedan por encima de todos.
    select max(nullif(x->>'erp_id', '')::bigint) into v_max_erp from jsonb_array_elements(p_filas) x;
    insert into productos.id_contadores (company_id) values (p_company_id) on conflict do nothing;
    update productos.id_contadores ic set ultimo = greatest(ic.ultimo, coalesce(v_max_erp, 0),
      (select coalesce(max(p.numero_id), 0) from productos.productos p where p.company_id = p_company_id))
      where ic.company_id = p_company_id;

    for r in select x from jsonb_array_elements(p_filas) x loop
      v_fila := coalesce((r->>'fila')::integer, 0);
      v_codigo := btrim(coalesce(r->>'codigo', ''));
      begin
        if v_codigo = '' then raise exception 'Falta el código.'; end if;
        if btrim(coalesce(r->>'nombre', '')) = '' then raise exception 'Falta el nombre.'; end if;

        -- Unidad (obligatoria)
        v_unidad := null;
        if nullif(btrim(coalesce(r->>'unidad', '')), '') is null then raise exception 'Falta la unidad de medida.'; end if;
        select u.id into v_unidad from productos.unidades u where u.company_id = p_company_id and lower(u.nombre) = lower(btrim(r->>'unidad'));
        if v_unidad is null then
          insert into productos.unidades (company_id, nombre) values (p_company_id, upper(btrim(r->>'unidad'))) returning id into v_unidad;
          v_cat_cuenta := jsonb_set(v_cat_cuenta, '{unidades}', to_jsonb((v_cat_cuenta->>'unidades')::int + 1));
        end if;

        -- Marca / proveedor
        v_marca := null;
        if nullif(btrim(coalesce(r->>'marca', '')), '') is not null then
          select m.id into v_marca from productos.marcas m where m.company_id = p_company_id and lower(btrim(m.nombre)) = lower(btrim(r->>'marca'));
          if v_marca is null then
            insert into productos.marcas (company_id, nombre) values (p_company_id, btrim(r->>'marca')) returning id into v_marca;
            v_cat_cuenta := jsonb_set(v_cat_cuenta, '{marcas}', to_jsonb((v_cat_cuenta->>'marcas')::int + 1));
          end if;
        end if;
        v_prov := null;
        if nullif(btrim(coalesce(r->>'proveedor', '')), '') is not null then
          select x.id into v_prov from productos.proveedores x where x.company_id = p_company_id and lower(btrim(x.nombre)) = lower(btrim(r->>'proveedor'));
          if v_prov is null then
            insert into productos.proveedores (company_id, nombre) values (p_company_id, btrim(r->>'proveedor')) returning id into v_prov;
            v_cat_cuenta := jsonb_set(v_cat_cuenta, '{proveedores}', to_jsonb((v_cat_cuenta->>'proveedores')::int + 1));
          end if;
        end if;

        -- Cuentas contables "codigo / nombre"
        v_cta_ing := null; v_cta_inv := null; v_cta_cos := null;
        declare
          k text; t text; txt text; cod text; nom text; vid uuid;
        begin
          foreach k in array array['cuenta_ingreso', 'cuenta_inventario', 'cuenta_costo'] loop
            txt := nullif(btrim(coalesce(r->>k, '')), '');
            continue when txt is null;
            t := case k when 'cuenta_ingreso' then 'ingreso' when 'cuenta_inventario' then 'inventario' else 'costo' end;
            cod := btrim(split_part(txt, '/', 1));
            nom := nullif(btrim(substr(txt, length(split_part(txt, '/', 1)) + 2)), '');
            select c.id into vid from productos.cuentas_contables c where c.company_id = p_company_id and lower(c.codigo) = lower(cod);
            if vid is null then
              insert into productos.cuentas_contables (company_id, codigo, nombre, tipo) values (p_company_id, cod, coalesce(nom, cod), t) returning id into vid;
              v_cat_cuenta := jsonb_set(v_cat_cuenta, '{cuentas}', to_jsonb((v_cat_cuenta->>'cuentas')::int + 1));
            end if;
            if k = 'cuenta_ingreso' then v_cta_ing := vid; elsif k = 'cuenta_inventario' then v_cta_inv := vid; else v_cta_cos := vid; end if;
            vid := null;
          end loop;
        end;

        -- Centro de costo (por código)
        v_centro := null;
        if nullif(btrim(coalesce(r->>'centro_costo', '')), '') is not null then
          select x.id into v_centro from productos.centros_costo x where x.company_id = p_company_id and lower(x.codigo) = lower(btrim(r->>'centro_costo'));
          if v_centro is null then
            insert into productos.centros_costo (company_id, codigo, nombre) values (p_company_id, btrim(r->>'centro_costo'), btrim(r->>'centro_costo')) returning id into v_centro;
            v_cat_cuenta := jsonb_set(v_cat_cuenta, '{centros_costo}', to_jsonb((v_cat_cuenta->>'centros_costo')::int + 1));
          end if;
        end if;

        -- Clasificación por nombre dentro del padre; número nuevo al crear.
        v_clase := null; v_tipo := null; v_cat := null;
        if nullif(btrim(coalesce(r->'clase'->>'nombre', '')), '') is not null then
          select c.id into v_clase from productos.clasificaciones c
          where c.company_id = p_company_id and c.nivel = 'clase' and lower(c.nombre) = lower(regexp_replace(btrim(r->'clase'->>'nombre'), '\s+', ' ', 'g'));
          if v_clase is null then
            insert into productos.clasificaciones (company_id, nivel, numero, nombre, codigo_erp)
            values (p_company_id, 'clase', productos.fn_numero_libre(p_company_id, null), btrim(r->'clase'->>'nombre'), nullif(r->'clase'->>'erp', ''))
            returning id into v_clase;
            v_cat_cuenta := jsonb_set(v_cat_cuenta, '{clases}', to_jsonb((v_cat_cuenta->>'clases')::int + 1));
          end if;
          if nullif(btrim(coalesce(r->'tipo'->>'nombre', '')), '') is not null then
            select c.id into v_tipo from productos.clasificaciones c
            where c.padre_id = v_clase and lower(c.nombre) = lower(regexp_replace(btrim(r->'tipo'->>'nombre'), '\s+', ' ', 'g'));
            if v_tipo is null then
              insert into productos.clasificaciones (company_id, nivel, padre_id, numero, nombre, codigo_erp)
              values (p_company_id, 'tipo', v_clase, productos.fn_numero_libre(p_company_id, v_clase), btrim(r->'tipo'->>'nombre'), nullif(r->'tipo'->>'erp', ''))
              returning id into v_tipo;
              v_cat_cuenta := jsonb_set(v_cat_cuenta, '{tipos}', to_jsonb((v_cat_cuenta->>'tipos')::int + 1));
            end if;
            if nullif(btrim(coalesce(r->'categoria'->>'nombre', '')), '') is not null then
              select c.id into v_cat from productos.clasificaciones c
              where c.padre_id = v_tipo and lower(c.nombre) = lower(regexp_replace(btrim(r->'categoria'->>'nombre'), '\s+', ' ', 'g'));
              if v_cat is null then
                insert into productos.clasificaciones (company_id, nivel, padre_id, numero, nombre, codigo_erp)
                values (p_company_id, 'categoria', v_tipo, productos.fn_numero_libre(p_company_id, v_tipo), btrim(r->'categoria'->>'nombre'), nullif(r->'categoria'->>'erp', ''))
                returning id into v_cat;
                v_cat_cuenta := jsonb_set(v_cat_cuenta, '{categorias}', to_jsonb((v_cat_cuenta->>'categorias')::int + 1));
              end if;
            end if;
          end if;
        end if;

        -- Producto
        select * into v_prod from productos.productos p where p.company_id = p_company_id and upper(p.codigo) = upper(v_codigo) for update;
        v_existe := found;
        v_erp := nullif(r->>'erp_id', '')::bigint;
        if not v_existe then
          v_prod := null;
          v_prod.id := gen_random_uuid();
          v_prod.company_id := p_company_id;
          if v_erp is not null then
            if exists (select 1 from productos.productos p where p.company_id = p_company_id and p.numero_id = v_erp) then
              raise exception 'El ID % ya lo usa otro producto.', v_erp;
            end if;
            v_prod.numero_id := v_erp;
          else
            v_prod.numero_id := productos.fn_siguiente_id(p_company_id);
          end if;
          v_prod.created_by := v_uid;
          v_prod.created_at := now();
          v_prod.fecha_ingreso := current_date;
        end if;
        v_prod.codigo := v_codigo;
        v_prod.nombre := r->>'nombre';
        v_prod.codigo_barras := nullif(btrim(coalesce(r->>'codigo_barras', '')), '');
        v_prod.es_servicio := coalesce((r->>'es_servicio')::boolean, false);
        v_prod.inventariable := coalesce((r->>'inventariable')::boolean, true);
        v_prod.exento_ventas := coalesce((r->>'exento_ventas')::boolean, false);
        v_prod.exento_compras := coalesce((r->>'exento_compras')::boolean, false);
        v_prod.descontinuado_ventas := coalesce((r->>'descontinuado_ventas')::boolean, false);
        v_prod.descontinuado_compras := coalesce((r->>'descontinuado_compras')::boolean, false);
        v_prod.cuenta_ingreso_id := v_cta_ing; v_prod.cuenta_inventario_id := v_cta_inv; v_prod.cuenta_costo_id := v_cta_cos;
        v_prod.unidad_id := v_unidad;
        v_prod.fecha_ingreso := coalesce(nullif(r->>'fecha_ingreso', '')::date, v_prod.fecha_ingreso, current_date);
        v_prod.existencia_minima := coalesce(nullif(r->>'existencia_minima', '')::numeric, 0);
        v_prod.existencia_maxima := coalesce(nullif(r->>'existencia_maxima', '')::numeric, 0);
        v_prod.proveedor_id := v_prov; v_prod.marca_id := v_marca;
        v_prod.clase_id := v_clase; v_prod.tipo_id := v_tipo; v_prod.categoria_id := v_cat;
        v_prod.descripcion := nullif(btrim(coalesce(r->>'descripcion', '')), '');
        v_prod.codigo_sac := nullif(btrim(coalesce(r->>'codigo_sac', '')), '');
        v_prod.centro_costo_id := v_centro;
        v_prod.centro_costo_unico := coalesce((r->>'centro_costo_unico')::boolean, false);
        v_prod.lote_por_vencimiento := coalesce((r->>'lote_por_vencimiento')::boolean, false);
        v_prod.plazo_vencimiento_dias := nullif(r->>'plazo_vencimiento_dias', '')::integer;
        v_prod.margen_dias_vencer := nullif(r->>'margen_dias_vencer', '')::integer;
        v_prod.costo_moneda := coalesce(nullif(r->>'costo_moneda', ''), 'NIO');
        v_prod.costo_referencia := nullif(r->>'costo_referencia', '')::numeric;
        v_prod.notas := nullif(btrim(coalesce(r->>'notas', '')), '');
        v_prod.peso := nullif(r->>'peso', '')::numeric;
        if v_prod.erp_producto_id is null then v_prod.erp_producto_id := v_erp; end if;
        v_prod.updated_by := v_uid;

        if v_existe then
          update productos.productos p set
            nombre = v_prod.nombre, codigo_barras = v_prod.codigo_barras, es_servicio = v_prod.es_servicio, inventariable = v_prod.inventariable,
            exento_ventas = v_prod.exento_ventas, exento_compras = v_prod.exento_compras,
            descontinuado_ventas = v_prod.descontinuado_ventas, descontinuado_compras = v_prod.descontinuado_compras,
            cuenta_ingreso_id = v_prod.cuenta_ingreso_id, cuenta_inventario_id = v_prod.cuenta_inventario_id, cuenta_costo_id = v_prod.cuenta_costo_id,
            unidad_id = v_prod.unidad_id, fecha_ingreso = v_prod.fecha_ingreso,
            existencia_minima = v_prod.existencia_minima, existencia_maxima = v_prod.existencia_maxima,
            proveedor_id = v_prod.proveedor_id, marca_id = v_prod.marca_id,
            clase_id = v_prod.clase_id, tipo_id = v_prod.tipo_id, categoria_id = v_prod.categoria_id,
            descripcion = v_prod.descripcion, codigo_sac = v_prod.codigo_sac, centro_costo_id = v_prod.centro_costo_id,
            centro_costo_unico = v_prod.centro_costo_unico, lote_por_vencimiento = v_prod.lote_por_vencimiento,
            plazo_vencimiento_dias = v_prod.plazo_vencimiento_dias, margen_dias_vencer = v_prod.margen_dias_vencer,
            costo_moneda = v_prod.costo_moneda, costo_referencia = v_prod.costo_referencia,
            notas = v_prod.notas, peso = v_prod.peso, erp_producto_id = v_prod.erp_producto_id, updated_by = v_uid
          where p.id = v_prod.id;
          v_actualizados := v_actualizados + 1;
        else
          v_prod.updated_at := now();
          insert into productos.productos select (v_prod).*;
          v_creados := v_creados + 1;
        end if;
        perform productos.fn_ajustar_contador(p_company_id, v_cat, v_codigo);

        if not v_prod.es_servicio and v_cat is null then v_sin_clasif := v_sin_clasif + 1; end if;
        if coalesce(v_prod.costo_referencia, 0) <= 1 then v_sin_costo := v_sin_costo + 1; end if;
      exception
        when others then
          v_errores := v_errores || jsonb_build_object('fila', v_fila, 'codigo', v_codigo,
            'mensaje', case when sqlstate = '23505' then 'Código, código de barras o ID repetido.' else sqlerrm end);
      end;
    end loop;

    select coalesce(max(p.numero_id), 0) + 1 into v_primer_id from productos.productos p where p.company_id = p_company_id;
    v_n := jsonb_array_length(v_errores);
    v_res := jsonb_build_object(
      'confirmado', p_confirmar and v_n = 0,
      'total', jsonb_array_length(p_filas),
      'creados', v_creados, 'actualizados', v_actualizados,
      'errores', v_errores,
      'sin_clasificacion', v_sin_clasif, 'sin_costo', v_sin_costo,
      'catalogos_nuevos', v_cat_cuenta,
      'siguiente_id', v_primer_id);

    if not p_confirmar or v_n > 0 then
      raise exception using errcode = 'P0099', message = 'vista_previa';
    end if;
  exception
    when sqlstate 'P0099' then null;  -- revierte todo lo del bloque; v_res queda
  end;

  if (v_res->>'confirmado')::boolean then
    perform core.fn_auditar(v_uid, p_company_id, 'productos.producto.importar', 'productos.productos', null,
      v_res - 'errores');
  end if;
  return v_res;
end;
$$;

-- Filas en el orden de columnas de la plantilla del ERP. El costo solo con permiso.
create or replace function public.productos_exportar(p_company_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_costo boolean;
begin
  perform core.fn_exigir_permiso(p_company_id, 'productos.catalogo.producto.exportar');
  v_costo := productos.fn_puede(p_company_id, 'productos.catalogo.costo.ver');
  return coalesce((
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
end;
$$;

-- -----------------------------------------------------------------------------
-- 9. Permisos de ejecución
-- -----------------------------------------------------------------------------
revoke all on all functions in schema productos from public, anon, authenticated;

revoke all on function
  public.productos_resumen(uuid),
  public.productos_listar(uuid, text, uuid, text, integer, integer),
  public.productos_obtener(uuid, uuid),
  public.productos_catalogos(uuid),
  public.productos_sugerir_codigo(uuid, uuid),
  public.productos_guardar(uuid, uuid, jsonb),
  public.productos_descontinuar(uuid, uuid, boolean, boolean),
  public.productos_siguiente_numero(uuid, uuid),
  public.productos_guardar_clasificacion(uuid, uuid, text, uuid, text, text, boolean),
  public.productos_guardar_catalogo(uuid, text, uuid, jsonb),
  public.productos_importar(uuid, jsonb, boolean),
  public.productos_exportar(uuid)
from public, anon;

grant execute on function
  public.productos_resumen(uuid),
  public.productos_listar(uuid, text, uuid, text, integer, integer),
  public.productos_obtener(uuid, uuid),
  public.productos_catalogos(uuid),
  public.productos_sugerir_codigo(uuid, uuid),
  public.productos_guardar(uuid, uuid, jsonb),
  public.productos_descontinuar(uuid, uuid, boolean, boolean),
  public.productos_siguiente_numero(uuid, uuid),
  public.productos_guardar_clasificacion(uuid, uuid, text, uuid, text, text, boolean),
  public.productos_guardar_catalogo(uuid, text, uuid, jsonb),
  public.productos_importar(uuid, jsonb, boolean),
  public.productos_exportar(uuid)
to authenticated;
