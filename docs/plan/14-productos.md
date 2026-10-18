# Módulo Productos (catálogo maestro) — Paso Cero y diseño

Fecha: 2026-10-16 · Estado: **Paso Cero (sección 3) aprobado y aplicado a
`nexo-core` el 2026-10-16** (migración `20261016203638_productos_paso_cero`):
app `productos` registrada **inactiva**, sin empresa habilitada. Modelo de
datos (sección 4): **aprobado y aplicado el 2026-10-16**
(`20261016214634_productos_esquema`, el SQL real es el de la migración).
`apps/productos` implementada y compilada en local; sin commit, sin datos,
sin proyecto Vercel ([status-log](../status-log/2026-10-16-productos-esquema-app.md)).

Origen: pedido del usuario 2026-10-16: "Necesitamos primero el módulo de
productos para luego pasar a elaborar el módulo de listas de precios", más
las dos plantillas de importación del ERP actual que entregó el usuario el
mismo día (`Importacion_de_productos_datos_16-10-2026.xlsx` y
`Plantilla_de_productos_con_multiprecio_con_datos_16-10-2026.xlsx`). Ver la
sección 1.

> **Cambio de orden respecto al Plan Maestro.** En el plan vigente, productos
> es parte de la FASE 5 (Inventario mínimo, [plan 08](08-fase5-inventario.md))
> y la fase activa es RRHH. El pedido del usuario adelanta el **catálogo de
> productos** como app propia, base de Listas de precios, CRM (cotizaciones),
> Inventario y Fabricación. Inventario (almacenes, existencias, movimientos,
> reservas) sigue siendo la FASE 5 y **leerá** este catálogo; no lo duplica.

## 0. Verificación remota (2026-10-16, `nexo-core`)

- `core.apps`: rrhh, flotilla, crm, agencia (inactiva), atencion (+ nexo). **No existe** `productos`.
- `core.permissions_catalog`: ningún código `productos.*`, `inventario.*`, `precios.*` ni que contenga "producto"/"precio".
- `core.app_roles`: ninguna plantilla de productos/inventario/precios.
- Tablas: ninguna tabla de productos, categorías, marcas, unidades ni precios en ningún schema. No existe schema `productos`.

## 1. Lo que exige el ERP actual (plantillas del 2026-10-16)

### 1.1 Hoja "Productos" (~700 productos), columnas

| Grupo | Columnas del ERP | Dónde va en Nexo |
|---|---|---|
| Identidad | Nombre\*, Código\* (texto; trae espacios al inicio, ej. `" 001001021"`), Código de barra, Descripción, Notas, Peso, **Producto ID** (id interno del ERP) | **Productos** |
| Tipo | Es servicio, No inventariable | **Productos** |
| Estado | Descontinuado (ventas), Descontinuado para compras | **Productos** |
| Clasificación | **Clase → Tipo → Categoría** (3 niveles, cada uno "Nombre (código)", ej. `Construccion (004)` → `Perlin (10)` → `Galvanizado (02)`), Marca, Proveedor | **Productos** |
| Unidad | Unidad de medida\* (GALON, KILOS, LIBRAS, LITROS, METROS, PIE, UNIDAD, 1/4, 1/6, 1/16, CUBETA, CAJA, PAR, QQ, SET, VARILLA…) | **Productos** |
| Fiscal / contable | Exento de ventas, Exento de compras, Cuenta de ingresos\*, Cuenta de inventario\*, Cuenta de costos\*, Código SAC (arancel), Centro de costo, Centro de costo único | **Productos** (permiso aparte) |
| Costo | Moneda del costo (C$/US$), Costo de referencia | **Productos** (permiso aparte) |
| Inventario | Existencia mínima, Existencia máxima, Lote por fecha de vencimiento, Plazo de vencimiento, Margen de días a vencerse | **Productos** (parámetros del producto; Inventario FASE 5 los usa) |
| Características | Tipo de característica (TEXTO…), Característica (ej. Peso), Detalle | **Productos** |
| Comercial | Moneda\* (C$/US$), Fecha de ingreso\*, Margen de ganancia, **Precio de venta\***, **Precio mínimo**, Descuento máximo, Descuento automático, % de comisión | **Listas de precios** (módulo siguiente) |

### 1.2 Reglas de catálogo que se ven en los datos

- La **clasificación es un árbol de 3 niveles con códigos**; el código del
  producto se arma con esos códigos (ej. `00202-002-04` = Accesorios (002) /
  Cerradura (02) / Pomo…). Un Tipo puede colgar de varias Clases (ej.
  `Lisas (003) (4 Pies)` está bajo varias clases de láminas).
- **Marca ↔ Clase**: cada marca indica en qué clases se permite (ej. Yale →
  Accesorios (002); Dewalt → Discos, Construcción, Accesorios).
- Los datos tienen ruido que la importación debe limpiar: `.` usado como
  "vacío", espacios dobles, duplicados ("Lisas  (003) (4 Pies)" dos veces),
  margen negativo (`-98.77`), costo de referencia `1.0` como relleno.
- Cuentas contables actuales: ingresos 411-01, 412-01/02/03; inventario
  114-01, 114-02; costos 511.

### 1.3 Plantilla de multiprecios → módulo **Listas de precios** (no entra aquí)

- **Precio de venta** (base) + **Precio mínimo** por producto.
- **Multiprecios**: varios precios alternos por producto, cada uno con su id,
  activables/desactivables.
- **Precios por clasificación**: niveles `Precio 2`, `Precio 3`, `Precio 4`;
  cada nivel tiene **subclasificaciones de cliente** (ej. Ferretero → Precio 2;
  Exclusivo → Precio 3; Jimmy → Precio 4) y cada producto tiene un precio por
  nivel. Esto se diseña en el Paso Cero de Listas de precios; Productos solo
  aporta el id del producto.

### 1.4 Reporte "Consolidado de productos" (`Productos_16-10-2026.xlsx`)

Tercer archivo del ERP entregado el mismo día. Mismos ~700 productos (mismos
códigos), sin servicios. Columnas: Código, Producto, Código de barra, Es
servicio, Clase, Marca, Tipo, Categoría, Proveedor, **Existencias**,
Existencia mín/máx, **Precio de venta**, **Margen bruto de utilidad**,
**Costo**, y por cada **clasificación de cliente** (Jimmy, iii, Exclusivo,
ggg, hhh, Ferretero) un par **Margen / Precio** (`N/A` si no tiene), más Peso.

Lo que aporta:

- **Costo real** (ej. `1,020.94`): en la plantilla de importación el "costo
  de referencia" casi siempre es `1.0` de relleno. Para la primera carga de
  Productos, el costo se toma **de este reporte** (costo del ERP al
  16-10-2026), y la importación cruza los dos archivos por código.
- **Existencias** (ej. 116): no se cargan en Productos; son de Inventario
  (FASE 5). Este archivo sirve de saldo inicial cuando exista Inventario.
- **Es la "comparativa" que pidió el usuario para Listas de precios**: precio
  de venta vs costo vs precio por clasificación de cliente, con su margen.
  En los datos, el *margen bruto* se calcula sobre el precio
  (`(1120 − 1020.94) / 1120 = 8.84 %`) y el margen de cada clasificación sobre
  el costo (`(1100 − 1020.94) / 1020.94 = 7.74 %`); el Paso Cero de Listas de
  precios debe fijar una sola regla y mostrar las dos con su nombre.
- Avisos de datos: precio menor que el costo (ej. cerradura a C$ 3 con costo
  C$ 244.16 → margen `(8,038.67) %`), precio 0 con costo, `.` como marca.
- El encabezado de clasificaciones de cliente sale corrido 2 columnas en el
  Excel (Jimmy está sobre "Margen bruto"); la importación lo lee por pares, no
  por la posición de la etiqueta.

## 2. Alcance del módulo Productos

| Incluye | No incluye (otro módulo) |
|---|---|
| Ficha de producto con todos los campos de 1.1 salvo los "Comercial" | Precio de venta, precio mínimo, multiprecios, niveles por clasificación de cliente, margen, descuentos, comisión → **Listas de precios** |
| Catálogos: clasificación (Clase/Tipo/Categoría), marcas (con sus clases permitidas), unidades, proveedores, características, cuentas contables y centros de costo | Existencias por almacén, movimientos, lotes reales → **Inventario (FASE 5)** |
| Importar desde la plantilla del ERP (mismas columnas) y exportar en ese mismo formato | BOM/recetas → **Fabricación (FASE 6)** |
| Dashboard de KPIs (activos, descontinuados, sin clasificar, sin código de barras, sin costo) | |

Los productos **no se borran**: se descontinúan (otros módulos los referencian).
El **Producto ID del ERP** se guarda como referencia externa para poder
sincronizar en los dos sentidos.

## 3. Matriz de permisos (Paso Cero)

App `productos` (el trigger crea `productos.ver_modulo` al registrarla).

| Código | Etiqueta |
|---|---|
| `productos.dashboard.resumen.ver` | Ver el dashboard del catálogo |
| `productos.catalogo.producto.ver` | Ver productos |
| `productos.catalogo.producto.crear` | Crear productos |
| `productos.catalogo.producto.editar` | Editar productos (datos generales, clasificación, unidad, características, parámetros de inventario) |
| `productos.catalogo.producto.descontinuar` | Descontinuar y reactivar productos (ventas y compras) |
| `productos.catalogo.producto.importar` | Importar productos desde la plantilla del ERP |
| `productos.catalogo.producto.exportar` | Exportar productos en el formato del ERP |
| `productos.catalogo.costo.ver` | Ver el costo de referencia |
| `productos.catalogo.costo.editar` | Editar el costo de referencia y su moneda |
| `productos.catalogo.fiscal.editar` | Editar exenciones, cuentas contables, código SAC y centro de costo |
| `productos.configuracion.clasificacion.gestionar` | Gestionar clases, tipos y categorías |
| `productos.configuracion.marca.gestionar` | Gestionar marcas y sus clases permitidas |
| `productos.configuracion.unidad.gestionar` | Gestionar unidades de medida |
| `productos.configuracion.proveedor.gestionar` | Gestionar proveedores |
| `productos.configuracion.caracteristica.gestionar` | Gestionar características de producto |
| `productos.configuracion.contable.gestionar` | Gestionar cuentas contables y centros de costo |

Por qué hay permisos aparte: un vendedor ve el catálogo **sin costo**; un
editor de catálogo no toca **cuentas contables ni exenciones** (afectan
la contabilidad y los impuestos).

Plantillas (`core.app_roles`, solo para "Cargar plantilla" en Configuración → Roles):

| Permiso | Consulta | Editor de catálogo | Contabilidad | Administrador de catálogo |
|---|:-:|:-:|:-:|:-:|
| `productos.ver_modulo` | ✓ | ✓ | ✓ | ✓ |
| `dashboard.resumen.ver` | ✓ | ✓ | ✓ | ✓ |
| `catalogo.producto.ver` | ✓ | ✓ | ✓ | ✓ |
| `catalogo.producto.crear` | | ✓ | | ✓ |
| `catalogo.producto.editar` | | ✓ | | ✓ |
| `catalogo.producto.descontinuar` | | | | ✓ |
| `catalogo.producto.importar` | | | | ✓ |
| `catalogo.producto.exportar` | | ✓ | ✓ | ✓ |
| `catalogo.costo.ver` | | ✓ | ✓ | ✓ |
| `catalogo.costo.editar` | | | ✓ | ✓ |
| `catalogo.fiscal.editar` | | | ✓ | ✓ |
| `configuracion.clasificacion/marca/unidad/proveedor/caracteristica` (5) | | | | ✓ |
| `configuracion.contable.gestionar` | | | ✓ | ✓ |

La app se registra **inactiva** y sin habilitar para ninguna empresa: nadie la
ve (tampoco el owner) hasta su activación al terminar el módulo.

```sql
-- Paso Cero Productos. Solo catálogo + plantillas; sin tablas.
do $$
begin
  if exists (select 1 from core.apps where slug = 'productos')
     or exists (select 1 from core.permissions_catalog where module_slug = 'productos')
     or exists (select 1 from core.app_roles where module_slug = 'productos') then
    raise exception 'precheck: Productos ya registrado';
  end if;
end;
$$;

insert into core.apps (slug, name, category, icon, color, route, depends, active)
values ('productos', 'Productos', 'Cadena de suministro', 'package', 'purple', '/productos', '{}', false);

do $$
begin
  if not exists (select 1 from core.permissions_catalog where code = 'productos.ver_modulo') then
    raise exception 'el trigger no creó productos.ver_modulo';
  end if;
end;
$$;

insert into core.permissions_catalog (code, module_slug, domain, label, description) values
  ('productos.dashboard.resumen.ver',                  'productos', 'dashboard',     'Ver dashboard',              'Ver los indicadores del catálogo de productos.'),
  ('productos.catalogo.producto.ver',                  'productos', 'catalogo',      'Ver productos',              'Ver el listado y la ficha de los productos.'),
  ('productos.catalogo.producto.crear',                'productos', 'catalogo',      'Crear productos',            'Dar de alta productos y servicios nuevos.'),
  ('productos.catalogo.producto.editar',               'productos', 'catalogo',      'Editar productos',           'Modificar datos generales, clasificación, unidad, características y parámetros de inventario.'),
  ('productos.catalogo.producto.descontinuar',         'productos', 'catalogo',      'Descontinuar productos',     'Descontinuar y reactivar productos para ventas o compras (no se borran).'),
  ('productos.catalogo.producto.importar',             'productos', 'catalogo',      'Importar productos',         'Crear o actualizar productos desde la plantilla del ERP.'),
  ('productos.catalogo.producto.exportar',             'productos', 'catalogo',      'Exportar productos',         'Descargar el catálogo en el formato del ERP.'),
  ('productos.catalogo.costo.ver',                     'productos', 'catalogo',      'Ver costo',                  'Ver el costo de referencia de los productos.'),
  ('productos.catalogo.costo.editar',                  'productos', 'catalogo',      'Editar costo',               'Modificar el costo de referencia y su moneda.'),
  ('productos.catalogo.fiscal.editar',                 'productos', 'catalogo',      'Editar datos fiscales',      'Modificar exenciones, cuentas contables, código SAC y centro de costo.'),
  ('productos.configuracion.clasificacion.gestionar',  'productos', 'configuracion', 'Gestionar clasificación',    'Crear, editar y desactivar clases, tipos y categorías.'),
  ('productos.configuracion.marca.gestionar',          'productos', 'configuracion', 'Gestionar marcas',           'Crear, editar y desactivar marcas y sus clases permitidas.'),
  ('productos.configuracion.unidad.gestionar',         'productos', 'configuracion', 'Gestionar unidades',         'Crear, editar y desactivar unidades de medida.'),
  ('productos.configuracion.proveedor.gestionar',      'productos', 'configuracion', 'Gestionar proveedores',      'Crear, editar y desactivar proveedores.'),
  ('productos.configuracion.caracteristica.gestionar', 'productos', 'configuracion', 'Gestionar características',  'Crear, editar y desactivar características de producto.'),
  ('productos.configuracion.contable.gestionar',       'productos', 'configuracion', 'Gestionar cuentas contables','Crear, editar y desactivar cuentas contables y centros de costo.');

insert into core.app_roles (module_slug, role_key, label, description) values
  ('productos', 'consulta',      'Consulta',                  'Ve el catálogo sin costos.'),
  ('productos', 'editor',        'Editor de catálogo',        'Crea y edita productos; ve costos.'),
  ('productos', 'contabilidad',  'Contabilidad',              'Costos, datos fiscales y cuentas contables.'),
  ('productos', 'administrador', 'Administrador de catálogo', 'Todo el módulo.');

insert into core.app_role_permissions (app_role_id, permission_code)
select r.id, p.code
from core.app_roles r
join core.permissions_catalog p on p.module_slug = 'productos'
where r.module_slug = 'productos'
  and (
    r.role_key = 'administrador'
    or (r.role_key = 'consulta' and p.code in (
      'productos.ver_modulo', 'productos.dashboard.resumen.ver', 'productos.catalogo.producto.ver'))
    or (r.role_key = 'editor' and p.code in (
      'productos.ver_modulo', 'productos.dashboard.resumen.ver', 'productos.catalogo.producto.ver',
      'productos.catalogo.producto.crear', 'productos.catalogo.producto.editar',
      'productos.catalogo.producto.exportar', 'productos.catalogo.costo.ver'))
    or (r.role_key = 'contabilidad' and p.code in (
      'productos.ver_modulo', 'productos.dashboard.resumen.ver', 'productos.catalogo.producto.ver',
      'productos.catalogo.producto.exportar', 'productos.catalogo.costo.ver', 'productos.catalogo.costo.editar',
      'productos.catalogo.fiscal.editar', 'productos.configuracion.contable.gestionar'))
  );
```

## 4. Modelo de datos (borrador detallado, requiere aprobación aparte)

Mismo patrón que Atención: schema `productos` **cerrado** (`revoke all … from
public, anon, authenticated`), RLS activado en todas las tablas sin políticas
para `authenticated`, y **todo acceso por RPC** `public.productos_*`
(`security definer`, `search_path = ''`, primera línea `core.has_permission`).
Así la misma API sirve a la web y a Nexo Mobile, y el costo nunca sale sin
`productos.catalogo.costo.ver`. Todas son **catálogos** (no se particionan).
Cada tabla lleva `company_id`, `created_at`, `updated_at`, `unique (id,
company_id)` y FK compuestas `(x_id, company_id)` para impedir mezclar
empresas, como en RRHH/Atención. Cada escritura deja su fila en
`core.audit_log` (`productos.*`).

### 4.1 Catálogos

| Tabla | Columnas | Reglas |
|---|---|---|
| `productos.clasificaciones` | `nivel` (`clase` / `tipo` / `categoria`), `padre_id` (nulo en clase; la clase en un tipo; el tipo en una categoría), `numero` (2 dígitos, `01`–`99`), `nombre`, `codigo_erp` (el texto entre paréntesis del ERP, solo referencia), `activa` | **Árbol estricto**: cada tipo pertenece a una sola clase y cada categoría a un solo tipo (si "Lisas" va en dos clases, se crea en cada una). Únicos por empresa: `(padre_id, numero)` y `(padre_id, lower(nombre))`. El `numero` lo propone el sistema (siguiente libre dentro del padre) y se puede cambiar al crear; **queda fijo** en cuanto algún producto usa ese nivel. Trigger: el padre es exactamente del nivel anterior. |
| `productos.codigo_contadores` | `categoria_id`, `ultimo` | Último consecutivo usado por categoría, para generar códigos sin choques entre dos usuarios a la vez. |
| `productos.marcas` | `nombre`, `activa` | Único `lower(nombre)` por empresa. |
| `productos.marca_clases` | `marca_id`, `clase_id` | Sin filas = la marca vale para cualquier clase. |
| `productos.unidades` | `nombre` (GALON, QQ…), `simbolo`, `activa` | Único `lower(nombre)`. |
| `productos.proveedores` | `nombre`, `activo` | Único `lower(btrim(nombre))`. Pasa a Compras cuando exista ese módulo. |
| `productos.caracteristicas` | `nombre` (Peso…), `tipo` (`texto` / `numero` / `si_no`), `activa` | |
| `productos.cuentas_contables` | `codigo` (411-01), `nombre`, `tipo` (`ingreso` / `inventario` / `costo`), `exenta`, `activa` | Único `(codigo)` por empresa. |
| `productos.centros_costo` | `codigo`, `nombre`, `activo` | |

### 4.2 `productos.productos`

| Grupo | Columnas |
|---|---|
| Identidad | **`numero_id`** (ID del producto: entero único por empresa; en los importados es el ID del ERP, en los nuevos lo asigna la base desde el más alto + 1; **inmutable**, nunca se reutiliza), `codigo` (texto, `btrim`, único por empresa, **editable**), `nombre`, `descripcion`, `notas`, `codigo_barras` (único por empresa si no es nulo), `peso`, `erp_producto_id` (entero, único por empresa si no es nulo), `fecha_ingreso` |
| Tipo | `es_servicio`, `inventariable` |
| Clasificación | `clase_id`, `tipo_id`, `categoria_id` (todas opcionales; trigger valida que el tipo cuelgue de la clase y la categoría del tipo), `marca_id` (si la marca tiene clases permitidas, la clase debe estar entre ellas), `proveedor_id`, `unidad_id` (obligatoria) |
| Fiscal | `exento_ventas`, `exento_compras`, `cuenta_ingreso_id`, `cuenta_inventario_id`, `cuenta_costo_id` (cada una debe ser del `tipo` correcto), `codigo_sac`, `centro_costo_id`, `centro_costo_unico` |
| Costo | `costo_moneda` (`NIO` / `USD`), `costo_referencia` (≥ 0) |
| Inventario | `existencia_minima`, `existencia_maxima` (≥ 0; máx 0 = sin tope), `lote_por_vencimiento`, `plazo_vencimiento_dias`, `margen_dias_vencer` |
| Estado | `descontinuado_ventas`, `descontinuado_compras` (no hay borrado) |

**Código automático (decisión del usuario 2026-10-16).** Al crear un
producto con clase, tipo y categoría, el código se genera así:

```text
Construcción (01) / Perlín (01) / Galvanizado (01)  →  010101-001, 010101-002, …
número de clase + número de tipo + número de categoría + "-" + consecutivo de 3 dígitos por categoría
```

- El consecutivo sale de `productos.codigo_contadores` con bloqueo de fila: dos
  personas creando a la vez nunca reciben el mismo código. Si un código
  generado ya existe (ej. uno importado), salta al siguiente libre.
- Sin clasificación completa (o en servicios) el código se escribe a mano.
- El código generado **se puede editar** (al crear o después, con
  `productos.catalogo.producto.editar`), siempre que no lo use otro producto.
  Cada cambio de código queda en `core.audit_log` con el valor anterior. Mover
  el producto de categoría no cambia su código por sí solo.

**ID del producto (decisión del usuario 2026-10-16): único e intocable.**
Además del código, cada producto tiene un **ID** (`numero_id`) que asigna la
base al crearlo (consecutivo por empresa, sin huecos reutilizados) y que
**nadie puede modificar**: un trigger rechaza cualquier `update` de `id`,
`numero_id` o `company_id`, y los productos no se borran (solo se
descontinúan). Todas las referencias de otros módulos (Listas de precios,
Inventario, CRM) apuntan al ID interno, nunca al código, para que editar un
código no rompa nada. **Los importados conservan el ID del ERP como su ID de Nexo** (decisión del
usuario 2026-10-16): el Perlín negro con "Producto ID" 1465 en la plantilla
del ERP es el `numero_id` 1465 en Nexo. Los productos nuevos siguen desde el
más alto + 1 (la secuencia se ajusta después de la carga). El ID sale de la
columna AO de la plantilla de importación (el Consolidado no lo trae; se
cruza por código). `erp_producto_id` queda como dato aparte para la
exportación: en los importados es igual al ID; en los creados en Nexo queda
vacío hasta que el ERP les asigne el suyo, que puede no coincidir.
- Los productos **importados del ERP conservan su código** (`001001021`,
  `00202-002-04`…); solo los nuevos reciben el código generado.

Regla del ERP que se respeta: si `es_servicio`, no llevan cuenta de costos,
existencias, proveedor, marca ni clasificación.

`productos.producto_caracteristicas`: `producto_id`, `caracteristica_id`,
`valor` (texto), único `(producto_id, caracteristica_id)`.

### 4.3 RPC (`public.productos_*`)

| RPC | Permiso |
|---|---|
| `productos_resumen` (KPIs del dashboard) | `dashboard.resumen.ver` |
| `productos_listar` (búsqueda, filtros por clasificación/marca/estado, paginado) · `productos_obtener` | `catalogo.producto.ver` (+ `costo.ver` para incluir el costo) |
| `productos_guardar` (crear o editar; los campos de costo/fiscales solo cambian con su permiso) | `producto.crear` / `producto.editar` (+ `costo.editar`, `fiscal.editar`) |
| `productos_descontinuar` | `producto.descontinuar` |
| `productos_importar` (lote JSON ya leído de la plantilla; crea catálogos que falten y hace *upsert* por `codigo`; devuelve filas creadas/actualizadas/con error, todo o nada) | `producto.importar` |
| `productos_exportar` (filas en el orden de columnas del ERP) | `producto.exportar` |
| `productos_catalogos` (listas para formularios) · `productos_guardar_<catálogo>` | `producto.ver` · `configuracion.<catálogo>.gestionar` |

El Excel se lee en el navegador/servidor de la app y se manda a
`productos_importar` como JSON: la base nunca abre archivos.

### 4.4 Limpieza en la importación

`btrim` de códigos y nombres, espacios dobles a uno, `.` y vacío = nulo,
fecha numérica de Excel → fecha, "Nombre (código)" → `nombre` +
`codigo_erp`, catálogos repetidos se unifican. La primera carga usa **dos
archivos cruzados por código**: la plantilla de importación (datos del
producto) y el consolidado (costo real, sección 1.4); un código que esté en
uno solo se reporta. Como los números del ERP no
siguen un formato (`(004)`, `(10)`, `(07-)`, sin número), al importar **se
asigna a cada clase/tipo/categoría su número nuevo de 2 dígitos** en orden,
dentro de su padre; el texto del ERP queda en `codigo_erp`. Los tipos que en
el ERP cuelgan de varias clases se crean una vez por clase. Datos que no se corrigen solos (margen
negativo, costo `1.0` de relleno) se importan y se listan como **avisos**
para revisión, no se descartan.

## 5. Plan de prueba local antes de producción (pedido del usuario 2026-10-16)

Las apps locales apuntan a la base de producción `nexo-core` (no hay base
local). Por eso "probar en local" significa: **código solo en tu PC**, pero
**la base es la real**. (Ver sección 6 para las decisiones.)

1. Aprobar el modelo (sección 4) → aplicar la migración de tablas + RPC a `nexo-core` (no afecta a nadie: la app sigue inactiva).
2. Crear `apps/productos` (NexoShell, dashboard, listado, ficha, catálogos, importar/exportar) y correrla en local (`pnpm dev`) junto al panel.
3. Probar primero con **pocos productos de prueba** con prefijo `PRUEBA`, luego importar el Excel real.
4. Para que la app abra hay que **activarla para la empresa** en `nexo-core`: desde ese momento el dueño también vería la tarjeta "Productos" en el Launcher de producción, que no abre hasta el deploy (pasó igual con Atención). Alternativa: activarla, probar y volver a desactivarla.
5. Con todo validado: rama + PR (los 5 checks), proyecto Vercel `nexo-productos`, `PRODUCTOS_APP_URL` y rewrite en `apps/nexo/next.config.ts`, merge, prueba en producción.
6. Limpiar los datos `PRUEBA`, con la lista exacta y tu confirmación.

## 6. Decisiones y pendientes

| Fecha | Decisión del usuario |
|---|---|
| 2026-10-16 | Matriz y 4 plantillas (sección 3) **aprobadas** y aplicadas. |
| 2026-10-16 | **Nexo es el maestro de productos**: se crean y editan en Nexo; la importación de la plantilla del ERP sirve para la primera carga y la exportación en ese formato alimenta al ERP mientras siga en uso. |
| 2026-10-16 | **Código de producto automático** `CCTTKK-NNN` (clase, tipo y categoría de 2 dígitos + consecutivo de 3 por categoría, ej. `010101-001`); numeración de cada nivel **por padre**, propuesta por el sistema y editable al crear; los códigos del ERP se **conservan** en los importados. Ver 4.2. |
| 2026-10-16 | El **código es editable** (único, con auditoría); cada producto tiene además un **ID único e inmutable** asignado por la base, al que apuntan los demás módulos. Ver 4.2. |
| 2026-10-16 | Los productos importados **conservan su ID del ERP** como ID de Nexo; los nuevos continúan desde el más alto + 1. |
| 2026-10-16 | **Probar todo en local antes de subir a producción** (código local contra `nexo-core`; ver sección 6). |
| 2026-10-16 | Listas de precios **debe comunicarse con Productos**: llamar los productos, hacer la comparativa de precios y generar listas de precios oficiales. Si es app aparte o sección de Productos **queda sin decidir**. |

| 2026-10-17 | **Decidido por el usuario: Listas de precios es una app aparte**, fuera de Productos ("precios podemos hacerlo como una app aparte, sería sacarlo de producto"). Se quitó el grupo "Precios" del menú de Productos y la app figura como "Próximamente" en el Launcher (slug previsto `precios`). Su Paso Cero (matriz de permisos y roles) se hace antes de cualquier tabla o pantalla. |

Recomendación para Listas de precios (**aprobada 2026-10-17**): **app aparte**
(`precios`, su propio Paso Cero y sus roles — quien publica precios oficiales
no tiene por qué editar el catálogo). Están en la misma base `nexo-core`, así
que la comunicación es directa: las tablas de precios referencian
`productos.productos.id` por FK y leen el catálogo con una RPC de lectura de
Productos; no se copia el catálogo.

| 2026-10-16 | Modelo de datos **aprobado** después de ver el prototipo ("Me gusta"); aplicado el mismo día. |

Pendiente:

1. ~~Activar la app para la empresa~~ — activada 2026-10-16 (`20261016220935`). Falta el recorrido en local con sesión real.
2. ~~Decidir si Listas de precios es app aparte o sección de Productos~~: es app aparte (2026-10-17). Siguiente paso: su Paso Cero.
