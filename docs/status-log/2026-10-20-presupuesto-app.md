# 2026-10-20 — App Presupuesto: Paso Cero, esquema y app en local

- **Pedido del usuario:** "Quiero aplicar presupuesto como una app aparte pero que viva en el despliegue de CRM para no crear una nueva". Aprobó la matriz con "Si aplícalo".
- **Diseño:** [plan 19](../plan/19-presupuesto.md).
- **Estado anterior:** Metas de ventas y Presupuesto anual estaban dentro del CRM y se borraron con él (`20261020143821`).
- **Estado nuevo:** la fase 1 es una app propia, `presupuesto`, con su esquema aplicado en `nexo-core` y su código en `apps/presupuesto`, solo en local.
- **Commit:** pendiente (todo en local).

## Base de datos (aplicada en `nexo-core`)

| Migración | Contenido | Verificación |
|---|---|---|
| [`20261020183127_presupuesto_paso_cero.sql`](../../supabase/migrations/20261020183127_presupuesto_paso_cero.sql) | Registra la app `presupuesto` en `core.apps`, inactiva y en la categoría Ventas. Agrega 9 permisos: `presupuesto.ver_modulo`, que crea el trigger, y 8 de 4 segmentos. Plantillas Vendedor 3, Gerente de ventas 7 y Administrador de ventas 9. | Se ensayó en una transacción revertida antes de aplicar. Poscheque en remoto: 9 permisos, plantillas 9/7/3 y app inactiva. |
| [`20261020184030_presupuesto_esquema.sql`](../../supabase/migrations/20261020184030_presupuesto_esquema.sql) | Schema `presupuesto` cerrado a la API. Es el esquema de Metas del plan 15 (`20261018135152`) con otro nombre. Tiene 6 tablas: `vendedores`, `presupuestos`, `presupuesto_meses` y `metas_vendedor`, más `facturas` e `importaciones`, que van **particionadas por mes** y quedan registradas en `core.tablas_particionadas`. Suma 14 RPC `public.presupuesto_*` con `security definer` y `search_path = ''`, incluida `presupuesto_mis_permisos`, que es nueva. Los mensajes van en "tú". | Ver abajo. Poscheque en remoto: 14 RPC, 49 particiones de facturas desde 2023-01, 4 de importaciones y 0 facturas. |

| [`20261020191334_presupuesto_ajustes_revision.sql`](../../supabase/migrations/20261020191334_presupuesto_ajustes_revision.sql) | Ajustes de la revisión independiente:<br>• `presupuesto_vendedores` solo devuelve el usuario vinculado y su correo con `presupuesto.configuracion.vendedor.gestionar`; los demás reciben `vinculado` (sí o no).<br>• En la importación, un número de fila que no es entero ya no aborta el lote.<br>• Los helpers de partición pasan a `search_path = ''`. | Se ensayó en una transacción revertida:<br>• una fila `"1.5"` da 2 nuevas y 1 error, sin abortar;<br>• una partición nueva se crea con `search_path` vacío;<br>• el owner ve `user_id`;<br>• un rol de gerente con equipo y facturas ve `vinculado` sin `user_id` ni correo.<br>Poscheque: los permisos de ejecución siguen iguales y el remoto no tiene datos. |

**Ensayo completo antes de aplicar**, en una transacción que termina con un error a propósito, con datos PRUEBA:

| Caso | Resultado |
|---|---|
| Permisos del owner | 9 |
| Vista previa de importación (2 válidas y 1 sin fecha) | 2 nuevas y 1 error. No escribe vendedores ni importaciones. |
| Importar | 2 nuevas y 1 error ("Falta la fecha.") |
| Reimportar el mismo archivo | 0 nuevas y 2 actualizadas: no duplica |
| Presupuesto anual 1000 × 1.32 | 1320.00 en 12 meses |
| Porcentajes que no suman 100 % | Rechazado |
| Meta sugerida de octubre | 66.00, que es el 5 % del presupuesto, con el peso del único vendedor activo |
| Ajustar a 150 y regenerar | Se conserva 150.00 como `ajustada` |
| Equipo de septiembre | 1 vendedor, 100 vendidos, tipo de cambio 36.6243 (las anuladas no suman) |
| Facturas con búsqueda y base sugerida del año siguiente | 2 y 100.00 |
| Vincular el vendedor a un usuario y la auditoría | Vinculado; 7 filas `presupuesto.*` en `core.audit_log` |
| Usuario con un rol de empresa que trae solo la plantilla Vendedor | 3 permisos. Su avance: vinculado, 100 vendidos y 1 anulada. Sus facturas: 2. |
| El mismo vendedor contra equipo, todas las facturas, importar, presupuesto anual, vendedores y ajustar meta | Todo **denegado** (42501) |
| Sin sesión | **Denegado** |

Después de cada ensayo se comprobó que el remoto quedó igual. Los datos PRUEBA se revirtieron, así que no hay limpieza pendiente.

## Código (`apps/presupuesto`, sin commit)

- **De dónde sale el código.** Se copió de la rama de respaldo `respaldo/crm-2026-10-20`, solo la parte de Metas, Presupuesto, Facturas, Importar y Vendedores, sin clientes ni embudo. Después se adaptó:
  - las RPC `metas_*` pasan a `presupuesto_*`;
  - los permisos `crm.*` pasan a `presupuesto.*`;
  - el texto "del ERP" pasa a "de AG Negocio";
  - el cliente de Supabase ya no lleva el tipo `Database`;
  - el cierre de sesión pasa a `src/lib/sesion.ts`.
- **Zona:** `basePath` `/presupuesto` y puerto 3001, que era el del CRM. Se agregaron las cabeceras de seguridad, como en RRHH, y se quitaron los *source maps* del navegador.
- **Rutas:** `/dashboard`, `/metas/por-vendedor`, `/anual`, `/facturas`, `/importar`, `/configuracion/vendedores` y `/sin-acceso`.
  - `/dashboard` muestra el avance propio o del equipo con la venta contra la meta y contra el presupuesto. Quien no tiene indicadores ve un aviso, para que la redirección no entre en ciclo.
  - `/anual` es el presupuesto anual; antes vivía en `/presupuesto`.
- **Menú** (`src/lib/nav.ts`): Dashboard; Metas (Metas por vendedor y Presupuesto anual); Ventas (Facturas o Mis facturas, e Importar de AG Negocio); Análisis (Histórico y Presupuesto contra lo real, los dos "Pronto"); y Configuración (Vendedores y usuarios). Cada ítem aparece solo con su permiso.
- **Panel:**
  - rewrite condicional `/presupuesto` hacia `PRESUPUESTO_APP_URL` y `presupuesto` en el matcher del proxy;
  - la variable va en `turbo.json`, en `.env.local.example` y en el `.env.local` local, que pasa de `CRM_APP_URL` a `PRESUPUESTO_APP_URL=http://localhost:3001`;
  - el mosaico "Próximamente" va en la sección Ventas, con el icono `target` nuevo en `packages/ui/app-icons.tsx`.
- **CI:**
  - `nexo-presupuesto` entra al gate de lint (`scripts/lint-apps.mjs`);
  - `test:presupuesto` se suma a `pnpm verify`, y hay un job `test-presupuesto-importacion` que todavía no es obligatorio en la protección de `main`;
  - se agregó el servidor `presupuesto` en `.claude/launch.json`.
- **Dependencias:** las mismas de Productos, sin `sonner`. `pnpm-lock.yaml` se actualizó con `pnpm install`.

## Pruebas

| Prueba | Resultado |
|---|---|
| `pnpm --filter nexo-presupuesto typecheck` | ✅ |
| `pnpm --filter nexo-presupuesto lint` | ✅ |
| `pnpm --filter nexo-presupuesto test` (lector del Excel) | ✅ 9/9 |
| `pnpm --filter nexo-presupuesto build` | ✅ 9 rutas |
| `pnpm --filter nexo-panel typecheck` y `build` | ✅ |
| `pnpm lint:plan` | ✅ gate 7 (incluye `nexo-presupuesto`), deuda 1 (`transporte-app`) |

## Revisión independiente (subagente `reviewer`)

No encontró hallazgos críticos ni altos. Repitió typecheck (8/8), lint:gate (7/7), build (8/8) y las 9 pruebas. Además comparó el SQL contra el de Metas: la lógica es idéntica.

**Corregido:**
- **M1:** el `.gitignore` de la app ahora permite versionar `.env.local.example`.
- **B1, B2 y B3:** los resolvió la migración `20261020191334`.
- **B4:** se actualizó el conteo de planes en `docs/README.md`.
- **N4:** se corrigió la ruta en el comentario de la prueba.
- **N5:** "Metas por vendedor" ahora usa el icono `target`.
- **N6:** los grises `neutral-400` pasan a `neutral-500` para dar más contraste.

**Queda pendiente, a propósito:**
- **M2:** el árbol de trabajo mezcla cambios ajenos a Presupuesto:
  - las redirecciones del kiosco, que ya están en `main` por el PR #49;
  - `ConfirmDialog` y los iconos `funnel`, `phone` y `mail` sin uso;
  - agentes y skills;
  - el Paso Cero R1+R2 del ERP, sin aplicar.

  Hay que separarlos en commits distintos al subir.
- **N3:** el `next` del login pierde el *query string*, igual que en Productos.
- **N7:** `generar-sugeridas` vive en la carpeta de rutas de Metas.
- **N8:** `apps/nexo/README.md` todavía menciona el CRM.
- La lista de apps con Speed Insights en `CLAUDE.md` todavía no incluye Presupuesto.

## No verificado

- El recorrido con sesión real en local: necesita que el usuario inicie sesión. La app ya está activa (ver abajo).
- La importación del Excel real y la vista en el celular.
- El despliegue. El proyecto de Vercel `nexo-crm` sigue construyendo el CRM viejo desde `main`.

## Activación (aplicada)

`20261020192310_presupuesto_activar`. El usuario la pidió con "Sí, activa Presupuesto para la empresa para probarla en local".

**Qué cambió:** la app quedó activa y habilitada para la empresa.

**Poscheque:** el owner tiene `presupuesto.ver_modulo` y un miembro sin rol no. Ningún rol de empresa tiene permisos `presupuesto.*`.

**En local:** sin sesión, `localhost:3001/presupuesto/dashboard` lleva a `localhost:3000/login?next=/presupuesto/dashboard`. Esto se verificó en el navegador.

**En producción:** el mosaico ya aparece en el Launcher, pero no abre hasta el despliegue.

## Datos reales cargados (2026-10-20)

El usuario lo pidió así: "Podrías cargar la información que estaba en el Excel". Se cargó desde la app en local, en el Chrome del usuario y con su sesión de owner, a partir de `PPTO 2026 JCastillo.xlsx`. Se usó una copia idéntica (hash igual) en la carpeta temporal de la sesión, porque el navegador solo sube archivos desde ahí.

**Recorrido con sesión:** Dashboard, Presupuesto anual, Metas por vendedor, Facturas e Importar abren sin errores. Cada pantalla muestra su estado vacío y su primer paso.

**Validación previa sin escribir:**
- El validador y la vista previa de la app leyeron lo mismo: 47 301 facturas en 4 hojas, 0 filas descartadas y 11 vendedores.
- La "Comprobación contra la base" encontró 1 error: la factura `52372-A` (hoja 2023, fila 6864) tiene el vencimiento con el año **20233**, un error de captura en el Excel.
- Se corrigió el lector (`src/lib/metas/importacion.ts`):
  - las fechas fuera de 1900–2100 se descartan;
  - un vencimiento imposible queda vacío, con el aviso nuevo `vencimiento_invalido`, y la venta se importa;
  - la prueba nueva lleva el total a 10/10.

**Importación:** 47 301 nuevas, 0 actualizadas, 0 con error y 11 vendedores nuevos, en 48 lotes y 1 min 42 s. Quedaron 48 filas en `core.audit_log`.

Totales en la base, que cuadran al centavo con el Excel (sin anuladas):

| Año | Facturas | Anuladas | US$ | C$ |
|---|---|---|---|---|
| 2023 | 7 642 | 168 | 2,198,295.35 | 77,716,266 |
| 2024 | 13 223 | 271 | 3,442,190.30 | 125,276,465 |
| 2025 | 12 173 | 155 | 3,095,682.19 | 113,283,102 |
| 2026 | 13 604 | 65 | 3,975,525.13 | 145,543,854 |

La `52372-A` quedó con fecha 2023-07-27, US$ 412.27 y sin vencimiento.

**Presupuesto 2026**, tomado de la hoja "PPTO +32%":
- Venta base de US$ 3,093,113.11 × 1.32, que da **US$ 4,082,909.31**.
- Reparto mensual: 9.05, 8.16, 7.72, 8.06, 9.00, 8.48, 8.69, 8.54, 8.96, 7.68, 8.59 y 7.07 %, que suman 100 %.
- Los montos por mes en la base son iguales a los del Excel.
- La venta base es la del Excel, no la que suma la base para 2025 (US$ 3,095,682.19); la diferencia es de US$ 2,569.

**Dashboard con datos reales:**
- Septiembre de 2026: meta US$ 365,828.67, vendido US$ 358,335.56 y cumplimiento 97.9 %.
- Acumulado de enero a septiembre: 127 % del presupuesto a la fecha y 97.3 % del anual, como en el Excel.

**No se hizo:**
- generar las metas sugeridas por vendedor;
- vincular vendedores con usuarios;
- asignar plantillas a roles.

Son decisiones del usuario.

## Metas, cuadro de meta configurable y clientes (2026-10-20)

El usuario lo pidió así: "Generalas. Me gustaría poder elegir a los vendedores a mostrar en el cuadro de meta. Recuerda que tiene que dependiendo el rol y que el usuario tenga el vendedor asignado puede ver su avance personal, sus clientes cuando fue la última vez que facturó, que le facturó a este cliente".

**Metas sugeridas:**
- Se generaron octubre, noviembre y diciembre de 2026 desde la app; cada mes sumaba la meta de la empresa.
- Septiembre lo generó el propio usuario a las 19:40.
- **Cambio posterior del usuario**, a las 19:47: volvió a guardar el presupuesto 2026 con "Usar reparto de 2025" (9.91, 7.71, 9.03… %) en lugar del reparto del Excel, y a las 19:48 regeneró octubre. Por eso las metas de septiembre, noviembre y diciembre ya no suman la nueva meta de la empresa (septiembre: metas US$ 365,828.68 contra meta US$ 290,527.58). Ver la auditoría (`presupuesto.anual.guardar`).
- **Resuelto (20:43):** el usuario eligió volver al reparto del Excel. Se guardó de nuevo desde la app y se regeneraron las metas de septiembre a diciembre. Cada mes cuadra con la meta de la empresa:

  | Mes | Meta de la empresa (US$) | Suma de metas (US$) |
  |---|---|---|
  | Septiembre | 365,828.67 | 365,828.68 |
  | Octubre | 313,567.44 | 313,567.44 |
  | Noviembre | 350,721.91 | 350,721.90 |
  | Diciembre | 288,661.69 | 288,661.68 |

  La diferencia de un centavo es redondeo.

**Migración `20261020194816_presupuesto_tablero_clientes`** (aplicada). No crea permisos nuevos.
- `presupuesto.vendedores.en_tablero` y la RPC `presupuesto_guardar_tablero`, que exige `presupuesto.metas.meta_vendedor.gestionar`. La elección es de la empresa y no cambia metas ni totales. `presupuesto_equipo` devuelve `en_tablero`.
- `presupuesto_clientes` lista los clientes por nombre con la última factura (fecha, número, monto, días y vendedor), las facturas, el total y el total del año. Ordena por la factura más reciente, por monto o por nombre.
- `presupuesto_facturas_cliente` muestra lo facturado a un cliente.
- Las dos usan el helper `presupuesto.fn_alcance_facturas`:
  - con `factura.ver` se ven todos los vendedores, o uno;
  - solo con `factura_propia.ver` se ve únicamente el vendedor vinculado, y `p_vendedor_id` se ignora;
  - sin vínculo no hay datos.

**Ensayo previo** en una transacción revertida, con los datos reales:

| Caso | Resultado |
|---|---|
| Owner | 96 clientes, igual que el conteo directo, en 232 ms |
| Filtro por Edith | 74 clientes |
| Detalle de un cliente | Cuadra con las facturas |
| Selector del cuadro | 6 visibles y 5 ocultos; el equipo marca los 5 |
| Vendedor vinculado | Ve 74 clientes, igual aunque pida los de otro vendedor; un cliente ajeno da 0; no recibe el vendedor de cada fila; se le niegan el selector y el equipo |
| Sin vínculo | No ve nada |
| Sin sesión | Denegado |

**Pantallas:**
- Selector "Elegir vendedores" en el cuadro de meta del Dashboard, con Marcar todos y Solo activos. La tabla muestra solo los elegidos y una fila "N vendedores ocultos" con lo que vendieron. Los indicadores siguen siendo de toda la empresa.
- **Clientes** o **Mis clientes** (`/clientes`, menú Ventas, icono `building`). Muestra la última factura de la empresa o del vendedor, y una tabla con cliente, última factura y "hace N días", último monto, facturas, este año, total y "Última por" (solo gerencia). Tiene búsqueda, orden, filtro por vendedor (solo gerencia) y paginación.
- **Detalle** (`/clientes/detalle?cliente=`). Tarjetas de última factura, total facturado, facturas y ticket promedio, y la lista de facturas.
- En Mi avance, el enlace "Ver mis clientes".

**Pruebas:** typecheck, lint, las 10 pruebas y build (11 rutas) en verde. En el Chrome del usuario se probaron el selector (abierto y cancelado, sin guardar), Clientes (96) y el detalle de "Materiales Jequi .", sin errores en la consola.

**No verificado:**
- La vista de un vendedor real con su usuario: hace falta vincular un vendedor y asignarle la plantilla Vendedor a un rol de empresa. Por ahora solo se probó con el ensayo SQL.
- La vista en el celular.

## KPIs del Dashboard (2026-10-20)

**Pedido del usuario:** "si tiene asignado su vendedor y acceso a la app presupuesto, el dashboard debe mostrar su meta personal, sus clientes, su última factura. Analiza en internet los KPIs más importantes para el dashboard de avance personal y el global."

**KPIs elegidos.** Salen de la investigación y se ajustaron a los datos que existen: facturas, metas y presupuesto, sin pipeline de oportunidades.
- **Ritmo del mes (pacing):**
  - proyección al cierre = vendido ÷ días hábiles transcurridos × días hábiles del mes;
  - venta necesaria por día hábil restante;
  - promedio diario.
  - Los días hábiles van de lunes a sábado, porque los datos casi no tienen ventas en domingo (131 facturas de 25 777 en 2025–26). No se descuentan feriados.
- **Mismo período del año anterior** (variación con signo) y **acumulado del año**. En el equipo, el acumulado se compara también contra el presupuesto a la fecha. En la vista personal se compara contra el año anterior, porque las metas por vendedor no cubren todos los meses.
- **Clientes:**
  - clientes atendidos en el mes y clientes nuevos (primera compra);
  - **clientes por recuperar**: 3 facturas o más en 12 meses y 45 días o más sin comprar, con lo que compraron;
  - **venta de contado**: la parte de la venta que va a "Vario";
  - en el equipo, la **concentración top 10**;
  - en la vista personal, **Mi última factura** y "Clientes que te compraron hace poco".
- **Tabla del equipo:** columna Proyección por vendedor, con el % de su meta, solo con el mes en curso.
- **"Vario"**, el cliente genérico de contado, hace el 85–90 % de la venta. No se cuenta como cliente: si se contara, los KPIs de clientes no dirían nada.
- **El corte es la última factura importada, no la fecha de hoy.** Si la importación va atrasada, no todos los clientes aparecen como dormidos.

**Migración `20261020204854_presupuesto_indicadores`** (aplicada). Solo lectura, sin tablas ni permisos nuevos.
- `public.presupuesto_indicadores(empresa, año, mes, vista)`:
  - `'propio'` exige `metas.avance_propio.ver` y un vendedor vinculado; sin vínculo devuelve `vinculado: false`;
  - `'equipo'` exige `metas.avance_equipo.ver`.
- Los nombres de clientes y los números de factura solo vuelven con permiso de facturas: `factura_propia.ver` o `factura.ver` en la vista propia, y `factura.ver` en la del equipo. Sin ese permiso, las listas vienen en null y los conteos se ven igual.
- Helpers `fn_dias_habiles` y `fn_cliente_generico`, que `authenticated` no puede ejecutar. En total son 18 RPC, con anon 0.

**Ensayo con datos reales:**

| Caso | Resultado |
|---|---|
| Equipo, septiembre | Vendido US$ 358,335.56, igual que `presupuesto_equipo`. 26 días hábiles cerrados. +62.7 % contra sep-2025. 24 clientes por recuperar. Contado 85.7 % |
| Propio, con Junieth vinculada temporalmente en una transacción revertida | Ve solo lo suyo: 29 clientes en 12 meses, su última factura 96636-A. En octubre, sin facturas importadas, sale "sin datos" |
| Sin vínculo | `vinculado: false` |

**Pantallas.** Componentes en `components/metas/indicadores.tsx`; el cálculo, en `lib/metas/ritmo.ts`.
- **Mi avance:** Ritmo del mes, Mis clientes (Mi última factura, Clientes atendidos, Por recuperar, Contado), la gráfica, y dos tablas: clientes recientes y por recuperar, con enlace al detalle del cliente.
- **Equipo:** Ritmo del mes, Clientes, la columna Proyección y la tabla "Clientes por recuperar" con el vendedor de la última factura.
- Si los indicadores fallan, el dashboard se ve igual, con un aviso.

**Pruebas:** typecheck y lint en verde, y 17 pruebas: 10 del lector y 7 nuevas de ritmo. En el Chrome del usuario se probó el equipo de septiembre 2026: las cifras son las del ensayo y no hay errores en la consola.

**No verificado:** Mi avance en pantalla con un usuario vinculado. Ningún vendedor tiene usuario todavía, así que solo se probó con el ensayo SQL.

**Fuentes:**
- [salesscreen: KPIs con fórmulas](https://salesscreen.com/blog/10-sales-kpi-dashboard-metrics-with-formulas-and-benchmarks)
- [Sybill: dashboards de ventas](https://www.sybill.ai/blogs/best-sales-dashboards)
- [calculator.academy: ritmo de ventas](https://calculator.academy/sales-pacing-calculator/)
- [Visdum: run rate en días hábiles](https://visdum.com/term/daily-run-rate)
- [10X ERP: métricas de distribuidores](https://pulse.10xerp.com/blog/5-sales-metrics-every-distributor-should-track)
- [Oro: retención y abandono B2B](https://oroinc.com/blog/kpis-track-b2b-success-part-customer-retention-churn)
- [Phocas: segmentación RFM en mayoristas](https://www.phocassoftware.com/resources/blog/customer-segmentation-for-wholesalers)

## Importación al 20/10/2026

**Pedido del usuario:** "te adjunto las ventas actualizadas hasta este momento, para que las subamos". El archivo es `Factura_de_ventas_20-10-2026.xlsx`, hoja "Consolidado Facturas", del 01/09 al 20/10/2026.

**Bug del lector, encontrado antes de guardar.** AG Negocio llena con **0** la columna de la otra moneda: una factura en C$ trae "Total USD" = 0, y al revés. El lector tomaba ese 0 como monto, así que la vista previa daba US$ 345.68 por C$ 22 millones. Si se hubiera importado, septiembre habría quedado en cero.
- Corrección en `lib/metas/importacion.ts`: si una columna es 0 y la otra es mayor que 0, la que está en 0 se calcula con el tipo de cambio.
- Prueba nueva con el formato real: son 11 pruebas del lector, 18 en total.

**Comprobación antes de confirmar:**
- Septiembre del archivo contra la base, día por día: todos los días cuadran al centavo menos el 30/09. Ese día el archivo trae 4 facturas más (96877-A a 96880-A, US$ 2,199.22), emitidas después de la importación anterior.
- El tipo de cambio es 36.6243, el mismo de los datos cargados.

**Resultado:**
- 717 facturas nuevas: 713 de octubre y 4 del 30/09.
- 1,104 actualizadas y 0 con error.
- En la base hay 48,018 facturas, y ninguna vigente queda con US$ 0.

| Mes | Facturas vigentes | US$ |
|---|---|---|
| Septiembre | 1,101 | 360,534.78 |
| Octubre, al día 20 | 712 | 240,878.76 |

**Dashboard de octubre:**
- 76.8 % de la meta.
- Proyección de US$ 382,572.15, el 122 % de la meta, con 17 de 27 días hábiles.
- +45 % contra el mismo período de 2025.

**Nota:** las metas de octubre se generaron antes de que entraran esas 4 facturas de septiembre. La sugerida de hoy cambia menos de US$ 200 por vendedor, y las metas guardadas no se tocaron.

## Rediseño del Dashboard del equipo (2026-10-20)

**Pedido del usuario:** "No me gusta el dashboard de ventas globales… adaptarlo a un dashboard con KPIs importantes y visualmente atractivo, fácil de leer e interpretar".

**Investigación.** Guías de dashboards ejecutivos de ventas:
- de 5 a 9 KPIs a la vista;
- lo más importante arriba a la izquierda (lectura en F);
- pirámide: número principal, indicadores, tendencia y desglose;
- cada número con su comparación contra el plan y el período anterior;
- barras tipo *bullet* para la meta;
- ritmo medido contra el tiempo transcurrido.

También se aplicaron la skill `dataviz` (una sola escala, leyenda, tooltip, tabla "Ver datos" y sin colores de estado para identificar series) y `nexo-ui`.

**Estructura nueva** (`dashboard/equipo.tsx`, `components/metas/tablero.tsx`, `components/metas/grafico-acumulado.tsx`):
1. **Tarjeta principal del mes:**
   - venta del mes en grande, con el % de la meta;
   - una etiqueta de ritmo: "22 % arriba del ritmo";
   - barra *bullet* con lo vendido, la proyección en tono claro, la marca de "hoy tocaba llevar" y la marca de la meta;
   - abajo, la proyección al cierre, lo que se necesita por día hábil y los días hábiles.
2. **Cuatro indicadores:** contra el mismo mes del año anterior, el acumulado del año contra el presupuesto, cuántos vendedores van a cumplir según su proyección, y los clientes por recuperar.
3. **Venta acumulada del mes**, una gráfica interactiva:
   - muestra lo vendido, el ritmo para la meta (repartido por días hábiles), el mismo mes del año anterior y la proyección;
   - tiene tooltip con el puntero o con las flechas del teclado, y la tabla "Ver datos".
   - A su lado va el **panel de clientes**: atendidos, de contado, top 10 y "Por recuperar".
4. **Vendedores contra su meta:** un ranking con barras (vendido, proyección y marca de meta), el % y el estado según la proyección: Va a cumplir, En riesgo o No llega.
5. El año contra el presupuesto, y "Cómo se calculó la meta sugerida", ahora plegado.

**Migración `20261020210947_presupuesto_venta_diaria`** (aplicada, solo lectura): `presupuesto_venta_diaria(empresa, año, mes, vista)`, con el mismo alcance que `presupuesto_indicadores`. Devuelve los montos por día del mes y del mismo mes del año anterior. Ahora son 19 RPC, con anon 0.
- Ensayo: octubre del equipo suma US$ 240,878.76, igual que el total del mes, con 31 días. La vista propia devuelve solo lo del vendedor vinculado.

**Pruebas:**
- typecheck y lint en verde, y 20 pruebas (2 nuevas de la serie acumulada).
- En el Chrome del usuario, a 1024 px: la tarjeta principal, los indicadores, la gráfica con su tooltip (día 15: US$ 170,723.17 contra el ritmo de US$ 150,976.92), el panel de clientes, el ranking y la gráfica anual. Sin desplazamiento horizontal.
- Se corrigieron un desborde del acumulado, las etiquetas cortadas y la marca de "hoy" poco visible.

**No verificado:**
- La vista en celular: la ventana de Chrome no se pudo achicar.
- "Mi avance" conserva el diseño anterior.

## Revisión independiente y correcciones (2026-10-20)

El usuario señaló que el coordinador no estaba usando los subagentes. Desde aquí se sigue el flujo de CLAUDE.md: `reviewer`, luego `ui-frontend`, y la verificación del coordinador.

**`reviewer`:** sin hallazgos críticos ni altos; 4 medios, 9 bajos y 7 notas.
- Sin problemas de permisos ni de fuga de datos en las RPC.
- typecheck y lint en verde, y 20 de 20 pruebas.

**Corregido por `ui-frontend`:**
- **M1:** si fallan los indicadores, se ve "Ritmo no disponible". Antes decía "Sin facturas del mes".
- **M2:** la insignia de Mi avance usa el ritmo en el mes en curso.
- **M3:** la gráfica acumulada mide su ancho, así que el texto queda en 11 px reales en el celular, con menos marcas y las etiquetas en la leyenda.
- **M4:** se oculta el % del presupuesto acumulado cuando el mes elegido es posterior al corte.
- **B1:** un solo umbral de riesgo, `UMBRAL_RIESGO = 0.9`, en todas las pantallas. Antes `estadoCumplimiento` usaba 0.8.
- **B5:** contraste `blue-300` en la línea del año anterior y en la proyección.
- **B6:** el toque en el celular abre el tooltip.
- **B7:** la gráfica indica que se recorre con flechas, con una región `aria-live` que solo se actualiza desde el teclado.
- **B8:** los errores de `presupuesto_metas_mes` y `presupuesto_venta_diaria` quedan registrados, y la venta diaria muestra su propio mensaje.
- **B9:** se evita una consulta en cascada.
- **N4:** "Clientes por recuperar" ya no se repite; en su lugar va "Ticket promedio".

**Corregido por el coordinador:**
- **B2:** el importador también trata el 0 de la otra moneda cuando el monto es negativo (devoluciones), con una prueba. En los datos no hay negativos.
- Las tarjetas de Mi avance pasan a 3 o 4 columnas solo desde `xl`, para que los montos no se partan a 1024 px.

**Verificación del coordinador:**
- typecheck y lint en verde, y 22 de 22 pruebas.
- En el Chrome del usuario, sin errores en consola: Equipo de octubre, Mi avance del 003, que ahora está vinculado al usuario (meta, ritmo "86.6 % arriba del ritmo", clientes y última factura 97574-A), y diciembre, que oculta el % del presupuesto.

**No corregido (anotado):**
- **B3:** con este formato de AG, el tipo de cambio ya no se detecta solo y se usa el que escribe el usuario.
- **B4:** los clientes se agrupan por nombre de texto, y "nuevo" en Mi avance significa nuevo para ese vendedor.
- **N5:** la RPC de indicadores lee todo el historial.
- **N6:** las comprobaciones finales cuentan las RPC con un número fijo.
- 120 facturas en US$ de importaciones anteriores tienen C$ en 0; solo afecta la referencia en córdobas.

**Sin verificar:** el celular real y el lector de pantalla.

**Decisión del usuario (N1, 2026-10-20):** quien tiene avance propio y su vendedor vinculado entra directo a **Mi avance**, también si es gerente. Las pestañas van en el orden "Mi avance" y "Equipo", y `?vista=equipo` abre Equipo.
- El botón "Ver avance del equipo" del importador apunta a `?vista=equipo`.
- Sin vínculo, la persona cae en Equipo.
- Se verificó en el Chrome del usuario: `/dashboard` abre Mi avance del 003 y la pestaña Equipo abre el tablero del equipo.

## Pendiente

1. ~~El usuario recorre `/presupuesto` en local con su sesión~~: hecho en su Chrome, con datos reales. El panel de `localhost:3000` necesita un reinicio para tomar el rewrite `/presupuesto`; sin él, después del login hay que abrir `localhost:3001/presupuesto` directo, porque las cookies de `localhost` sirven en los dos puertos.
2. Asignar las plantillas a los roles de empresa (Vendedor, Gerente, Administrador) cuando el usuario lo decida.
3. **Despliegue**, que deciden el usuario y el PR:
   - cambiar el *Root Directory* de `nexo-crm` a `apps/presupuesto` justo antes de fusionar;
   - poner `PRESUPUESTO_APP_URL` en `nexocore`.
4. ~~Importar el Excel real y cargar el presupuesto 2026~~ ✅. Faltan generar las metas sugeridas de cada mes y vincular los 11 vendedores con sus usuarios.
5. Fase 2: el presupuesto por centro de costo de AG, con su propio Paso Cero, después de la etapa R2 del ERP.
