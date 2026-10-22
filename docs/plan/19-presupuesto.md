# 19 — Presupuesto: app aparte, en el despliegue del CRM

**Estado (2026-10-20):** EN CURSO.
- El usuario aprobó el Paso Cero ("Si aplícalo").
- Paso Cero (`20261020183127`), esquema (`20261020184030`) y ajustes de la revisión (`20261020191334`) aplicados en `nexo-core`.
- `apps/presupuesto` está en local y en verde.
- App activada para la empresa (`20261020192310`). Faltan el recorrido con sesión y el despliegue.
- [Detalle](../status-log/2026-10-20-presupuesto-app.md).

**Pedido del usuario (2026-10-20):** "Quiero aplicar presupuesto como una app aparte pero que viva en el despliegue de CRM para no crear una nueva".

## 1. Qué es

Presupuesto es la app de la suite donde se define cuánto se espera vender y gastar, y donde se compara contra lo real. Tiene dos fases.

**Fase 1: presupuesto de ventas y metas.** Recupera lo que hacía el [plan 15](15-metas-ventas.md) dentro del CRM, que se borró con él el 2026-10-20:
- el presupuesto anual de la empresa: la venta del año anterior más el % de crecimiento, repartida por mes (el Excel `PPTO 2026 JCastillo.xlsx`, +32%);
- la meta mensual de cada vendedor, con un reparto sugerido y el ajuste del gerente;
- el avance: cada vendedor ve el suyo y gerencia ve al equipo;
- las facturas importadas del Excel de AG Negocio, sin duplicar.

El código ya existe en la rama local `respaldo/crm-2026-10-20`. Ahí están las pantallas de metas, presupuesto, facturas, importación y vendedores, el lector del Excel en bruto con sus 9 pruebas y el validador. Con el Excel actual leyó 47 301 facturas que cuadran con su Dashboard.

**Fase 2: presupuesto por centro de costo, como en AG Negocio** (`presupuestos` e `informe_comparativo_de_presupuestos`, [plan 18 §3.6](18-replica-ag-negocio.md#36-activos-fijos-y-presupuesto)):
- el presupuesto anual por centro de costo, importado por Excel;
- el comparativo del presupuesto contra lo real.

La fase 2 depende del catálogo de cuentas, los centros de costo y los comprobantes del ERP (etapa R2 del plan 18). Tendrá su propio Paso Cero, en el dominio `contable`, cuando R2 exista.

## 2. Dónde vive

| Pieza | Valor |
|---|---|
| Carpeta | `apps/presupuesto`, nueva. El código de la fase 1 se toma de la rama de respaldo, sin lo del embudo ni los clientes. |
| `basePath` | `/presupuesto` |
| Proyecto de Vercel | Se reutiliza **`nexo-crm`** (`prj_ZkuHO3l8cZxe6tDF0RUeBfnJYib6`), así que no se crea uno nuevo. Su *Root Directory* pasa de `apps/crm` a `apps/presupuesto`. Cambiarle el nombre a `nexo-presupuesto` es opcional y se decide al desplegar. |
| Variables del proyecto | Ya tiene `NEXO_COMPANY_ID`, `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` para producción y preview (verificado el 2026-10-20). Sirven tal como están. |
| Panel (`nexocore`) | Se agregan el rewrite `/presupuesto` hacia `PRESUPUESTO_APP_URL` en `apps/nexo/next.config.ts` (condicional, como Atención y Productos), la variable en `turbo.json` y en el proyecto `nexocore`, y `presupuesto` en el matcher de `apps/nexo/src/proxy.ts`. |
| Launcher | `core.apps` con slug `presupuesto`, en la categoría **Ventas**, que quedó vacía al retirar el CRM. El icono es `target`: hay que agregarlo a `packages/ui/app-icons.tsx`, y mientras tanto cae al icono de la categoría. |
| Base de datos | Schema `presupuesto`, cerrado a la API (RLS sin políticas y `revoke all`). Todo pasa por RPC `public.presupuesto_*` con `security definer` y `core.fn_exigir_permiso`, para que Web y Mobile usen lo mismo. |

**Orden del despliegue.** `main` todavía tiene `apps/crm`, porque el retiro del CRM está sin commit, y el proyecto `nexo-crm` sigue construyendo el CRM viejo, que ya no tiene base de datos. El *Root Directory* se cambia justo antes de fusionar el PR que trae `apps/presupuesto` junto con el retiro del CRM. Si se cambia después, el primer deploy de `main` sin `apps/crm` falla. No se pierde nada, porque el CRM viejo no tiene datos.

## 3. Qué cambia frente al plan 15

| Tema | Plan 15 (dentro del CRM) | Ahora |
|---|---|---|
| Lugar | Menú Metas del CRM, `/crm/metas` | App propia del Launcher, `/presupuesto` |
| Permisos | `crm.metas.*`, `crm.ventas.*`, `crm.configuracion.*` | `presupuesto.*`, con los mismos significados. El presupuesto anual pasa a `presupuesto.ventas.presupuesto_anual.gestionar`, para dejar el dominio `contable` libre para la fase 2. |
| Schema y RPC | `metas`, `public.metas_*` | `presupuesto`, `public.presupuesto_*` |
| Clientes | Incluidos | Fuera: los clientes son del ERP (Cuentas por cobrar, R4). |
| Fuente de ventas | Excel del ERP | El Excel de facturas de AG Negocio, con el mismo importador. Cuando el ERP facture (R4), la app leerá sus facturas directo y el importador quedará para la historia. |
| Vendedores | Catálogo propio (código de AG + usuario de Nexo) | Igual. Se enlazará al expediente único de empleados y vendedores cuando exista ([plan 18 §5](18-replica-ag-negocio.md#5-mapeo-a-nexo)). |

## 4. Paso Cero — aprobado y aplicado (2026-10-20)

**SQL:** [`supabase/migrations/20261020183127_presupuesto_paso_cero.sql`](../../supabase/migrations/20261020183127_presupuesto_paso_cero.sql). Se escribió como `20261020170000` y se renombró a la versión remota. Poscheque en remoto: 9 permisos, plantillas 9/7/3 y app inactiva.

**Verificación remota previa (2026-10-20):**
- `core.apps` no tiene `presupuesto`.
- No hay permisos `presupuesto.*`, ni plantillas, ni un schema `presupuesto` o `metas`.
- La última migración remota es `20261020143821`.

**Ensayo:** se corrió completo en `nexo-core` dentro de una transacción que termina con error a propósito. Dio 9 permisos y las plantillas administrador 9, gerente 7 y vendedor 3, con la app oculta del Launcher. Después se comprobó que el remoto quedó igual: 0 apps, 0 permisos y 0 plantillas `presupuesto`.

| Código | Qué permite | Vendedor | Gerente de ventas | Administrador de ventas |
|---|---|:-:|:-:|:-:|
| `presupuesto.ver_modulo` | Entrar a la app (lo crea el trigger) | ✅ | ✅ | ✅ |
| `presupuesto.metas.avance_propio.ver` | Ver su meta del mes, su avance y su historial | ✅ | ✅ | ✅ |
| `presupuesto.ventas.factura_propia.ver` | Ver sus facturas | ✅ | ✅ | ✅ |
| `presupuesto.metas.avance_equipo.ver` | Ver a todos los vendedores, el ranking y el total contra el presupuesto | | ✅ | ✅ |
| `presupuesto.ventas.factura.ver` | Ver las facturas de todos | | ✅ | ✅ |
| `presupuesto.ventas.factura.importar` | Subir el Excel de facturas de AG Negocio sin duplicar | | ✅ | ✅ |
| `presupuesto.metas.meta_vendedor.gestionar` | Generar la meta sugerida por vendedor y mes y ajustarla | | ✅ | ✅ |
| `presupuesto.ventas.presupuesto_anual.gestionar` | Definir la venta base, el crecimiento y el reparto mensual del año | | | ✅ |
| `presupuesto.configuracion.vendedor.gestionar` | Vincular los códigos de vendedor de AG con usuarios de Nexo | | | ✅ |

**Separación de funciones:**
- El vendedor nunca ve al equipo ni las facturas de otros. La RPC filtra por el vendedor vinculado al usuario que llama.
- Solo el Administrador define el presupuesto anual y vincula vendedores. El poscheque de la migración lo comprueba.

**Lo que no hace este Paso Cero:**
- No crea tablas.
- Deja la app inactiva y fuera del Launcher.
- No asigna plantillas a usuarios ni a roles de empresa.

## 5. Modelo de datos (aplicado, `20261020184030`)

Es el mismo del plan 15 §4, con el schema renombrado. Las RPC son `public.presupuesto_*`:
- `presupuesto_mis_permisos`, `presupuesto_mi_avance`, `presupuesto_mis_facturas`;
- `presupuesto_equipo`, `presupuesto_facturas`, `presupuesto_vendedores`, `presupuesto_usuarios_vinculables`;
- `presupuesto_anual`, `presupuesto_metas_mes`;
- `presupuesto_importar_facturas`, `presupuesto_guardar_vendedor`, `presupuesto_guardar_anual`, `presupuesto_generar_sugeridas`, `presupuesto_ajustar_meta`.

Tablas:

| Tabla | Tipo | Contenido |
|---|---|---|
| `vendedores` | catálogo | Código de AG (`001`), nombre, `user_id` opcional (un usuario es un vendedor por empresa) y activo. Se crean solos al importar. |
| `facturas` | hechos, **particionada por mes** (`fecha`) | Número, cliente, anulada, total C$, total US$, vendedor e importación. La identidad es `(empresa, número)`. |
| `importaciones` | log, **particionada por mes** | Archivo, usuario, filas, nuevas, actualizadas, errores y rango de fechas. |
| `presupuestos` + `presupuesto_meses` | catálogo | Venta base, % de crecimiento y total. El % y el monto de cada mes; los % suman 100. |
| `metas_vendedor` | catálogo | Vendedor × año × mes, monto en US$ y origen `sugerida` o `ajustada`. |

Las reglas son las del plan 15:
- Las anuladas no suman.
- El C$ de referencia sale del tipo de cambio implícito del mes.
- La meta sugerida se calcula con el peso de cada vendedor activo en los 3 meses anteriores.
- La importación va por lotes, con vista previa.
- Cada escritura deja su fila en `core.audit_log`.

## 6. Pantallas (implementadas en local)

Menú según la regla de la suite (grupos desplegables con icono; cada ítem aparece solo con su permiso). El avance propio o del equipo es el Dashboard y no se repite en Metas:

```text
Dashboard (Mi avance | Avance del equipo)   /dashboard
Metas
  ├─ Metas por vendedor                     /metas/por-vendedor
  └─ Presupuesto anual                      /anual
Ventas
  ├─ Facturas | Mis facturas                /facturas
  ├─ Clientes | Mis clientes                /clientes  (+ /clientes/detalle?cliente=)
  └─ Importar de AG Negocio                 /importar
Análisis
  ├─ Histórico                              (Pronto)
  └─ Presupuesto contra lo real             (Pronto, fase 2)
Configuración
  └─ Vendedores y usuarios                  /configuracion/vendedores
```

Agregado el 2026-10-20 a pedido del usuario (`20261020194816`, sin permisos nuevos):
- **Elegir vendedores** del cuadro de meta. Es una elección de la empresa y la hace quien gestiona metas. Los ocultos se resumen en una fila y siguen contando en los totales.
- **Clientes / Mis clientes**: última factura y hace cuántos días, último monto, facturas, total del año y total histórico. El detalle muestra lo facturado a cada cliente. El vendedor ve solo lo suyo si su usuario está vinculado; gerencia ve todos.

El Dashboard tiene KPIs reales: venta del mes contra la meta, el cumplimiento acumulado y anual, y el ranking para gerencia o el avance propio para el vendedor.

Agregado el 2026-10-20 a pedido del usuario (`20261020204854`, solo lectura). El vendedor vinculado entra y ve su meta, sus clientes y su última factura, con los KPIs elegidos tras investigar:
- **Ritmo del mes:** proyección al cierre, venta necesaria por día hábil (lun–sáb) y promedio diario.
- **Comparación:** contra el mismo período del año anterior, y el acumulado del año.
- **Clientes:** atendidos y nuevos, por recuperar (3+ facturas en 12 meses y 45+ días sin comprar), venta de contado y, en el equipo, concentración top 10.
- **Equipo:** la tabla de vendedores tiene una columna Proyección.
- "Vario" (contado) no cuenta como cliente.
- El corte es la última factura importada.

Vista por defecto (decisión del usuario, 2026-10-20): quien tiene avance propio y su vendedor vinculado entra a **Mi avance**, aunque también vea el equipo. "Equipo" es la segunda pestaña.

Rediseño del Dashboard del equipo (2026-10-20, a pedido del usuario), en pirámide:
1. el número del mes con su ritmo y una barra de meta;
2. 4 indicadores;
3. la venta acumulada día a día (`presupuesto_venta_diaria`) junto al panel de clientes;
4. el ranking de vendedores contra su meta y su proyección;
5. el año y el detalle de las metas, plegado. Lleva Speed Insights y Analytics, y el login es único (sin login propio).

## 7. Etapas

| Paso | Contenido |
|---|---|
| P0 | ✅ Paso Cero aplicado (`20261020183127`). |
| P1 | ✅ Esquema y RPC aplicados (`20261020184030`), ensayados completos en transacción revertida. |
| P2 | ✅ `apps/presupuesto` en local: menú, Dashboard, `typecheck`, `lint`, `build` y las 9 pruebas del lector. Registrada en `scripts/lint-apps.mjs` y en el CI (`test-presupuesto-importacion`). |
| P3 | Revisión independiente y recorrido en el navegador local (la sesión la inicia el usuario). |
| P4 | Despliegue: *Root Directory* de `nexo-crm`, `PRESUPUESTO_APP_URL` en `nexocore`, activar la app y asignar las plantillas a roles de empresa. Push y merge los decide el usuario. |
| P5 | ✅ (2026-10-20) Excel real importado: 47 301 facturas que cuadran por año, y presupuesto 2026 de US$ 4,082,909.31 cargado. Faltan las metas por vendedor y vincular vendedores con usuarios. |
| Fase 2 | Presupuesto por centro de costo y comparativo, con su Paso Cero, después de la etapa R2 del ERP. |

## 8. Decisiones

**Tomadas (2026-10-20):**
1. Presupuesto es una **app aparte** en el Launcher.
2. **Vive en el proyecto de Vercel `nexo-crm`**: no se crea un proyecto nuevo.

3. **La matriz de §4** y que el **presupuesto por centro de costo de AG** (fase 2) también viva aquí, no en el ERP (R8). Quedó aprobado con el Paso Cero: "Si aplícalo".

4. **Activar la app** para probarla en local. El usuario lo pidió con "Sí, activa Presupuesto para la empresa para probarla en local", y se aplicó en `20261020192310`.

**Pendientes del usuario:**
1. Cambiarle el nombre al proyecto de Vercel `nexo-presupuesto`. Es opcional y solo cambia cómo se ve.
