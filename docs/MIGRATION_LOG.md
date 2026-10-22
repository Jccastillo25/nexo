# Bitácora de migración

## 2026-10-14 — Agencia digital, matriz mínima (APLICADA)

`20261014181353_agencia_dashboard_access`, aplicada en `nexo-core` con aprobación explícita del usuario. Añade el módulo `agencia` inactivo, permiso de módulo del trigger, `agencia.dashboard.resumen.ver` y rol `consulta` con ambos permisos. Sin tablas, políticas o funciones nuevas; sin roles asignados a usuarios ni empresas habilitadas. Postchecks: 2 permisos, 1 rol, 2 grants al rol, 0 usuarios y 0 empresas habilitadas. Advisors antes/después conservan las 4 categorías y los 38 hallazgos previos, sin cambio salvo observed_at. Activación pendiente del deploy y aprobación humana. [Detalle](status-log/2026-10-14-agencia-independiente.md).


Orden de bitácora: más reciente arriba.

## 2026-10-22 — Planilla PL2b (prestaciones) y PL2c (reportes y configuración) (APLICADAS)

**Migraciones (9), aplicadas en este orden con `apply_migration` y guardadas con la versión remota:**

| Versión | Archivo | Contenido |
|---|---|---|
| `20261021235639` | `rrhh_planilla_pl2b_paso_cero` | 2 permisos nuevos solo para la plantilla admin: `rrhh.planillas.liquidaciones.{pagar,anular}` (27 códigos `rrhh.planillas.*`) |
| `20261022000001` | `rrhh_planilla_pl2b_1_tablas` | conceptos AGUINALDO, VACACIONES_PAGADAS, EMBARGO_ALIMENTOS, EMBARGO_JUDICIAL y PRESTAMO; tipo de planilla Aguinaldo; tablas `liquidaciones`, `liquidacion_lineas`, `prestamos`, `embargos`, `vacaciones_movimientos` y `provisiones` (estas dos particionadas por mes); columnas nuevas en `novedades`; RLS, policies y funciones de apoyo |
| `20261022000431` | `rrhh_planilla_pl2b_2_motor` | motor ordinario con embargos, cuotas de préstamo y salario pagado en liquidación; motor del aguinaldo; huella con embargos, liquidaciones y reglas de conceptos |
| `20261022000640` | `rrhh_planilla_pl2b_3_liquidacion` | liquidación pura y preparación (saldo de vacaciones, aguinaldo ya pagado, préstamos sin tocar el aguinaldo); triggers de inmutabilidad |
| `20261022000939` | `rrhh_planilla_pl2b_4_rpc_vacaciones` | RPC de PL2a que cambian y las 6 RPC de vacaciones |
| `20261022001314` | `rrhh_planilla_pl2b_5_prestamos_liquidaciones` | préstamos, embargos, liquidación como documento, pasivo y provisiones; privilegios y poscheques de PL2b |
| `20261022001530` | `rrhh_planilla_pl2c_1_lectura` | parámetro `horas_extra_fraccion_minutos` (30, verificar) y 6 RPC de lectura |
| `20261022001727` | `rrhh_planilla_pl2c_2_configuracion` | conceptos, tipos de planilla y tabla de IR |
| `20261022001922` | `rrhh_planilla_pl2c_3_declaraciones_asistencia` | declaraciones INSS, INATEC e IR; propuesta e importación desde Asistencia; privilegios y poscheques de PL2c |

**Aprobación:** el usuario eligió "Aplicar al pasar pruebas y revisión": cada migración se aplica cuando pasa PGlite, la revisión independiente y un ensayo revertido en remoto. PL2b y PL2c se escribieron como dos migraciones y se dividieron en partes en límites de sección (cada parte cabe en una llamada); cada parte revoca el EXECUTE de las funciones nuevas que crea, para que no queden expuestas entre partes. La huella de las funciones de la cadena dividida es idéntica a la de los archivos sin dividir.

**Antes de aplicar:**
- PL2b: dos rondas de `reviewer`; PL2c: dos rondas. Todo lo alto y medio corregido; la 2.ª ronda de PL2c dejó un medio (vacaciones aprobadas después de importar una ausencia) y tres bajos, corregidos antes de aplicar.
- `npm run test:rrhh:planilla` (PGlite) con código 0: pruebas de PL2a, PL2b y PL2c.
- Un ensayo revertido por parte, con pruebas sobre datos reales como el owner de la empresa: quincena del 1 al 15 de octubre calculada con 4 personas; aguinaldo 2026 con 4 personas; liquidación por renuncia al 31/10 preparada para los 4 contratos con salario; préstamo de 4 cuotas, embargo, liquidación como documento con la deducción del préstamo y aprobación rechazada a quien la creó; provisiones de septiembre (3 filas); lectura con RLS como `authenticated` y escritura directa denegada; propuesta de Asistencia con las marcas reales (52 ausencias y 0 horas extra del 1 al 15 de octubre: casi nadie marca en el kiosco).

**Poscheque remoto:**
- poscheques de PL2b y PL2c dentro de sus migraciones: OK (conceptos, tipo Aguinaldo, particiones registradas, RLS en tablas y particiones, sin escritura directa, EXECUTE correcto, núcleos sin EXECUTE para la API);
- `md5(prosrc)` de las 81 funciones de planilla comparado con PGlite: 79 idénticas; `rrhh.fn_crear_contrato` y `rrhh.fn_editar_contrato` (de PL2a) difieren solo en comentarios y espacios (iguales al normalizarlos);
- 0 planillas, 0 liquidaciones y 0 préstamos reales: los ensayos se revirtieron.

**Advisors de seguridad después:** sin hallazgos nuevos fuera del patrón. Ninguna función de planilla es ejecutable por `anon` (siguen 5, las mismas); las RPC `planilla_*` aparecen en `authenticated_security_definer_function_executable`, como corresponde al patrón (cada una valida su permiso); las particiones nuevas no aparecen en `rls_enabled_no_policy`.

**Rollback (antes de uso):** en el encabezado de `20261022000001_rrhh_planilla_pl2b_1_tablas.sql` (PL2b) y de `20261022001530_rrhh_planilla_pl2c_1_lectura.sql` (PL2c), en orden inverso: primero PL2c, después PL2b y al final el Paso Cero.

## 2026-10-21 — Planilla PL2a: esquema y motor (APLICADA)

**Migración:** `20261021191441_rrhh_planilla_pl2a_motor`, aplicada con `apply_migration` y guardada con la versión remota (se escribió con el prefijo local `20261021220000`). La aprobó el usuario ("Si", a la pregunta de aplicar PL2a). Diseño en el [plan 20 §3.1 y §7](plan/20-planilla.md).

**Qué cambia:**
- **Tablas nuevas en `rrhh`:** `contrato_regimen`, `ir_tramos`, `planilla_tipos`, `conceptos` y `planilla_empleados`, más `planilla_lineas` y `novedades` (particionadas por mes desde 2026-01).
- **`planillas`:** estados nuevos y columnas de tipo, huellas, pago y anulación. Pierde la escritura directa.
- **`planilla_detalles`:** queda en desuso.
- **`parametros_ley`:**
  - el 22.5% patronal se cierra y el 21.5% rige desde 2026-09-03;
  - se agregan `certeza`, `fuente` y 16 parámetros;
  - se retira la escritura directa.
- **`feriados`:** columna `tipo` y los 14 de 2026.
- **Contratos:**
  - `contratos.fecha_antiguedad`, protegida por trigger;
  - las 4 compensaciones activas pasan de `mensual` a `quincenal` (auditado) y el default queda en quincenal;
  - `crear_contrato` y `editar_contrato` se recrean con `p_frecuencia_pago` opcional.
- **12 RPC `public.planilla_*`.**
- **Régimen inicial:** servicios profesionales exento en los 5 contratos activos.

**Antes de aplicar:**
- dos rondas de `reviewer`, con todos sus hallazgos corregidos;
- `test:db` en verde;
- tres ensayos en transacción revertida. El primero fue incompleto. El último incluyó la migración final completa y una corrida real de la 1.ª quincena de octubre con 4 personas.

**Poscheque remoto:**
- versión `20261021191441`;
- 7 tablas nuevas y 26 particiones;
- 12 RPC;
- INSS patronal vigente de 0.2150;
- 20 parámetros abiertos y 14 feriados;
- régimen de servicios profesionales exento en 5 contratos;
- 4 compensaciones en quincenal y 1 contrato activo sin salario;
- `crear_contrato` con la firma nueva;
- 4 auditorías de frecuencia;
- 0 planillas.

**Advisors de seguridad después:** sin hallazgos nuevos fuera del patrón esperado.
- `rls_enabled_no_policy` (INFO): incluye las 26 particiones nuevas, que tienen RLS sin policies a propósito para bloquear el acceso directo.
- `authenticated_security_definer_function_executable` (WARN): incluye las 12 RPC nuevas y las 2 de contrato recreadas; cada una valida su permiso.
- `anon_security_definer_function_executable`: sigue en 5, ninguna de planilla.
- `auth_leaked_password_protection`: ya existía.

**Rollback (antes de uso):** está en el encabezado del archivo. Hay que borrar primero los triggers, después las tablas nuevas, y restaurar las policies y grants retirados, las RPC de contrato de `20260918043955`, la frecuencia según la auditoría y los parámetros.

## 2026-10-21 — Planilla: Paso Cero (APLICADA)

**Migración:** `20261021160943_rrhh_planilla_paso_cero`, aplicada con `apply_migration` y guardada con la versión remota. La aprobó el usuario: "Apruebo el Paso Cero de Planilla, incluyendo quitarle aprobar y anular al especialista de planillas. Aplícalo." Diseño en el [plan 20 §8](plan/20-planilla.md).

Solo cambia el catálogo y las plantillas de rol: no crea tablas, no toca roles de empresa (`core.rol_permisos`) y no activa nada.
- 15 códigos `rrhh.planillas.*` nuevos: `regimen.{ver,cambiar}`, `conceptos.{ver,gestionar}`, `planilla.pagar`, `vacaciones.{ver,registrar,aprobar}`, `prestamos.{ver,gestionar}`, `liquidaciones.{ver,calcular,aprobar}`, `declaraciones.generar` y `colillas.enviar`.
- 34 asignaciones a plantillas.
- **Separación de funciones:** `especialista_planillas` pierde `planilla.aprobar` y `planilla.anular`.

**Ensayo:** antes de aplicar se probó dentro de una transacción revertida. Dio 34 asignaciones, todos los códigos con 4 segmentos, y no quedó nada.

**Poscheque remoto:**
- 25 permisos de planillas y 85 de RRHH.
- Por plantilla: admin 25, especialista 18 (solo `planilla.ver` y `planilla.generar` del recurso planilla), consulta 7, supervisor 2 y gestor 1.
- Régimen, pago, aprobación y anulación quedan solo en admin.

**Rollback (antes de uso):** está en el encabezado del archivo. Borra los 15 códigos y sus asignaciones, y le devuelve aprobar y anular al especialista.

## 2026-10-21 — Revisión integral: 4 migraciones (APLICADAS)

Salen de la revisión integral del 2026-10-20 ([status-log](status-log/2026-10-20-revision-integral.md) y [implementación](status-log/2026-10-21-mejoras-revision-integral.md)).

**Aplicación:**
- Las aprobó el usuario el 2026-10-21. Se aplicaron una por una con `apply_migration` entre las 10:46 y las 10:50 (hora de Managua).
- No se usó `db push`, que habría arrastrado `20261021090000_erp_r1_r2_paso_cero`, que sigue sin aplicar.
- Antes de cada una se comprobó que no hubiera sesiones abiertas en Atención, consultas activas, transacciones largas ni locks en los esquemas, y que ninguna función dependiera de las que se renombran o revocan (`pg_depend`).
- Los archivos se escribieron como `20261021030100…030400` y se renombraron a la versión remota.

| Versión remota | Qué hace | Verificación | Rollback |
|---|---|---|---|
| `20261021164649_core_mis_permisos_rls_initplan` | RPC `public.mis_permisos(empresa, códigos[]) → text[]` (`security definer`, `search_path=''`, máximo 300 códigos, sin `anon`), que usa `getPermisos` del kernel. Además, `(select auth.uid())` en las políticas `company_memberships: ver la propia` y `user_app_roles: ver el propio`. `notify pgrst` | Como owner devuelve solo los códigos válidos y sin sesión devuelve `{}`. El advisor `auth_rls_initplan` pasa de 2 a 0 | `drop function public.mis_permisos(uuid,text[]);` y volver las dos políticas a `auth.uid()` sin `select` |
| `20261021164748_presupuesto_indicadores_acotado` | `presupuesto_indicadores` acotada a la ventana que usa, más el índice `ix_facturas_company_cliente_norm_fecha` | Antes se ensayó en transacción revertida (44 casos con JSON idéntico). Después de aplicarla, los 10 meses de 2026 (equipo) tienen **la misma huella md5 que antes**, con **181 ms** de media (antes eran 660) | Recrear la función de `20261020204854` y `drop index presupuesto.ix_facturas_company_cliente_norm_fecha;` |
| `20261021164902_seguridad_kiosco_reportes_exportar` | Revoca `registrar_marca_kiosko` a `anon` y `authenticated` (N7/H5). Las RPC de reportes `diario`, `tardanzas`, `incidencias` y `resumen` se envuelven: las originales pasan a `rrhh.*_base`, sin EXECUTE. Más de 200 filas exige `reportes.exportar`, salvo el diario de un contrato, y el resumen se recorta a 200 filas (N6). La firma del PDF sale de `core.perfiles` (N11). `productos_exportar` queda auditada (N5). `notify pgrst` | Los 4 reportes como owner dan **la misma huella que antes**. Un usuario sin permiso que pide 300 filas recibe `42501`. `registrar_marca_kiosko` ya no la puede ejecutar `anon`; `registrar_marca_terminal`, `canjear_codigo_terminal` y `estado_terminal` sí | Mover las `_base` de vuelta a `public` con su nombre original, `grant execute … to authenticated` en `registrar_marca_kiosko`, y recrear `asistencia_registrar_exportacion` y `productos_exportar` desde sus migraciones originales |
| `20261021165004_indices_llaves_foraneas` | 101 índices B-Tree para 106 FK sin cobertura, con `lock_timeout` de 5 s | Poscheque con 0 FK sin índice. El advisor `unindexed_foreign_keys` pasa de 188 a 0. Tamaños: la tabla mayor es `presupuesto.facturas`, con 34 MB | `drop index` de cada uno (la lista está en el archivo) |

**Advisors después:**
- **Seguridad:** las funciones `security definer` ejecutables por `anon` bajan de 6 a 5 (salió `registrar_marca_kiosko`; las otras 5 son intencionales). `auth_leaked_password_protection` sigue pendiente: es configuración de Auth, a cargo del usuario.
- **Rendimiento:** `unindexed_foreign_keys` y `auth_rls_initplan` en 0. `unused_index` pasa de 124 a 329; es informativo, porque los índices nuevos todavía no tienen uso.

## 2026-10-20 — Presupuesto: venta diaria (APLICADA)

**Migración:** `20261020210947_presupuesto_venta_diaria`, escrita como `20261020230000_…` y renombrada a la versión remota. Solo lectura.

**Qué crea:** la RPC `public.presupuesto_venta_diaria(uuid, integer, integer, text)`, con el mismo alcance que `presupuesto_indicadores`. Devuelve la venta vigente por día del mes y del mismo mes del año anterior, sin clientes ni números de factura.

**Ensayo:** octubre del equipo suma US$ 240,878.76, igual que el total del mes. La vista propia solo devuelve lo del vendedor vinculado.

**Poscheque:** 19 RPC con anon 0.

**Rollback:** `drop function public.presupuesto_venta_diaria(uuid,integer,integer,text);`

## 2026-10-20 — Presupuesto: indicadores del Dashboard (APLICADA)

**Migración:** `20261020204854_presupuesto_indicadores`, escrita como `20261020213000_…` y renombrada a la versión remota. Solo lectura, sin tablas ni permisos nuevos.

**Qué crea:**
- La RPC `public.presupuesto_indicadores(uuid, integer, integer, text)`. La vista `propio` exige `metas.avance_propio.ver` y la vista `equipo`, `metas.avance_equipo.ver`. Las listas de clientes y facturas solo vuelven con permiso de facturas.
- Los helpers `presupuesto.fn_dias_habiles` y `presupuesto.fn_cliente_generico`.

**Ensayo:** con datos reales, para el equipo (owner), el vendedor vinculado (transacción revertida) y sin vínculo.

**Poscheque:** 18 RPC con anon 0. Los helpers no son ejecutables por `authenticated`.

**Rollback:** `drop function public.presupuesto_indicadores(uuid,integer,integer,text); drop function presupuesto.fn_dias_habiles(date,date); drop function presupuesto.fn_cliente_generico(text);`

## 2026-10-20 — Presupuesto: cuadro de meta y clientes (APLICADA)

**Migración:** `20261020194816_presupuesto_tablero_clientes`, escrita como `20261020220000_…`. La pidió el usuario: elegir los vendedores del cuadro de meta, y que el vendedor vea sus clientes y qué les facturó.

**Qué crea:**
- La columna `presupuesto.vendedores.en_tablero` (true por defecto).
- La RPC `presupuesto_guardar_tablero`, que exige `metas.meta_vendedor.gestionar`.
- `presupuesto_equipo` vuelve a crearse, ahora con `en_tablero`.
- Las RPC `presupuesto_clientes` y `presupuesto_facturas_cliente`, con el helper `presupuesto.fn_alcance_facturas`: todos con `factura.ver`, o solo lo propio con `factura_propia.ver`.
- No hay permisos nuevos y quedan 17 RPC.

**Ensayo previo:** en una transacción revertida, con los datos reales: owner, filtro por vendedor, selector, vendedor vinculado y sin vínculo, y sin sesión.

**Poscheque:** 17 RPC con anon 0. El helper no es ejecutable por `authenticated`.

**Rollback:**
- `drop` de las 3 RPC nuevas y del helper;
- volver a crear `presupuesto_equipo` de `20261020184030`;
- `alter table presupuesto.vendedores drop column en_tablero`.

## 2026-10-20 — Activación de la app Presupuesto (APLICADA)

**Migración:** `20261020192310_presupuesto_activar`, escrita como `20261020210000_…`. Decisión del usuario: "Sí, activa Presupuesto para la empresa para probarla en local".

**Qué hace:** activa la app en `core.apps` y la habilita en `core.company_apps` para `materiales-jcastillo`. No asigna roles ni usuarios.

**Poscheque:**
- el owner tiene `presupuesto.ver_modulo`;
- un miembro sin rol, no;
- ningún rol de empresa tiene permisos `presupuesto.*`.

**Efecto en producción:** el mosaico aparece en el Launcher de producción, pero no abre hasta que se despliegue `apps/presupuesto`, igual que pasó con Productos.

**Rollback:** `update core.apps set active = false where slug = 'presupuesto'` y borrar su fila de `core.company_apps`.

## 2026-10-20 — App Presupuesto: ajustes de la revisión (APLICADA)

**Migración:** `20261020191334_presupuesto_ajustes_revision`, escrita como `20261020200000_…`.

**Qué cambia:**
- `presupuesto_vendedores` entrega `user_id` y el correo solo con `presupuesto.configuracion.vendedor.gestionar`; a los demás les da `vinculado`.
- En `presupuesto_importar_facturas`, un número de fila que no es entero cuenta como fila 0 y no aborta el lote.
- Los helpers de partición quedan con `search_path = ''`.

**Ensayo previo:** en una transacción revertida, con los casos del owner, de un rol de gerente, de la fila "1.5" y de una partición nueva.

**Poscheque:** los permisos de ejecución no cambiaron, los helpers quedaron con `search_path=""` y no hay datos.

**Rollback:** volver a crear las dos funciones con su versión de `20261020184030`.

## 2026-10-20 — App Presupuesto: esquema + RPC (APLICADA)

**Migración:** `20261020184030_presupuesto_esquema`, escrita como `20261020190000_…` y renombrada a la versión remota. Es el esquema de Metas (`20261018135152`) renombrado: schema `metas` → `presupuesto`, `public.metas_*` → `public.presupuesto_*`, códigos `presupuesto.*` y mensajes en "tú". Agrega `presupuesto_mis_permisos`.

**Qué crea:**
- 6 tablas, todas con RLS y sin políticas: `vendedores`, `presupuestos`, `presupuesto_meses` y `metas_vendedor`, más `facturas` e `importaciones`, particionadas por mes y registradas en `core.tablas_particionadas`.
- 14 RPC, ejecutables solo por `authenticated`. El schema queda sin USAGE para la API.

**Ensayo previo:** se corrió completo en una transacción que termina con error a propósito, con datos PRUEBA:
- importación con vista previa, sin duplicar;
- presupuesto anual y rechazo de porcentajes que no suman 100 %;
- metas sugeridas, y ajustadas que se conservan al regenerar;
- equipo y facturas;
- un usuario con solo la plantilla Vendedor ve solo lo suyo y se le deniegan 6 RPC;
- sin sesión, todo denegado.

Se verificó después que el remoto quedó igual.

**Poscheque en remoto:** 14 RPC, 49 particiones de facturas (2023-01 a 2027-01), 4 de importaciones y 0 datos. Los helpers no son ejecutables por `authenticated`.

**Rollback:** `drop schema presupuesto cascade`, borrar las 14 RPC `public.presupuesto_*` y las 2 filas de `core.tablas_particionadas`. No hay datos.

[Detalle](status-log/2026-10-20-presupuesto-app.md).

## 2026-10-20 — App Presupuesto: Paso Cero (APLICADA)

**Migración:** `20261020183127_presupuesto_paso_cero`, escrita como `20261020170000_…`. La aprobó el usuario: "Si aplícalo".

**Qué hace:**
- Registra la app `presupuesto` en `core.apps`, inactiva y en la categoría Ventas.
- Agrega 9 permisos: el trigger crea `presupuesto.ver_modulo` y la migración inserta los otros 8, de 4 segmentos.
- Agrega las plantillas Vendedor 3, Gerente de ventas 7 y Administrador de ventas 9.

**Verificación:**
- Antes: no había nada de `presupuesto`.
- Después: 9 permisos, plantillas 9/7/3, app inactiva y sin `company_apps`.
- Ensayada antes en una transacción revertida.

**Rollback:** borrar las plantillas, los 9 permisos y la app `presupuesto`.

## 2026-10-20 — Retiro del CRM y de Metas (APLICADA)

Migración `20261020143821_retirar_crm_y_metas`, escrita como `20261020200000_…`. La pidió el usuario: "Borra todo el CRM: el código de apps/crm con respaldo en una rama local, la app del Launcher y los esquemas crm y metas con sus permisos en nexo-core".

**Qué hace:**
- **Prechequeo.** Aborta si alguna tabla de datos de `crm` o `metas` tiene filas, si hay permisos `crm.*` en otro módulo o si algún usuario o rol de empresa tiene un permiso `crm.*`.
- Borra las 48 RPC `public.crm_*` y las 13 `public.metas_*`.
- Quita las 5 filas de `crm` y `metas` de `core.tablas_particionadas`.
- `drop schema metas cascade`.
- `drop schema crm cascade` y luego `create schema crm` vacío, con `revoke all` a `public`, `anon` y `authenticated`. Se conserva porque `crm` sigue en "Exposed schemas".
- Borra 78 permisos de plantilla, 3 plantillas, 34 permisos y la app `crm`; la fila de `company_apps` cae en cascada.
- **Poscheque.** Comprueba cada punto, incluido que `anon` y `authenticated` no tengan USAGE sobre `crm`.

**Verificación:**
- Antes de aplicar se confirmó que nada fuera de `crm` y `metas` depende de sus objetos (`pg_depend`, llaves foráneas, funciones, vistas y `cron.job`).
- Se ensayó completa en una transacción revertida, y después se confirmó que el remoto seguía intacto.
- Después de aplicar quedaron 9 apps, 184 permisos y 25 plantillas; `metas` no existe y `crm` tiene 0 objetos.
- La Data API sigue sirviendo: una RPC pública devolvió 200.

**Rollback:** volver a aplicar, en orden, las migraciones del CRM y de Metas que están en `supabase/migrations/`. No había datos.

Detalle en [status-log/2026-10-20-retiro-crm-replica-ag-negocio.md](status-log/2026-10-20-retiro-crm-replica-ag-negocio.md).

## 2026-10-20 — Paso Cero de Listas de precios + ERP (APLICADA)

Migración `20261020064732_erp_precios_paso_cero`, escrita como `20261020120000_…`. La aprobó el usuario.

**Qué hace:**
- Registra las apps `precios` y `erp` como **inactivas**.
- Agrega los permisos: `precios.*` (10, más el `ver_modulo` del trigger) y `erp.*` (51, más el `ver_modulo` del trigger).
- Crea 12 plantillas:
  - Precios: Consulta 3, Analista 7 y Administrador 11.
  - ERP: Bodeguero 10, Jefe de bodega 15, Comprador 11, Cajero 10, Supervisor 18, Auxiliar contable 15, Contador 25, Gerente financiero 21 y Administrador 52.
- No crea tablas.

**Verificación:**
- Antes de aplicar se ensayó en una transacción revertida.
- La migración incluye un postcheck de los conteos exactos.
- En remoto quedó la versión `20261020064732`, con 11 permisos de precios y 52 del ERP, y las dos apps inactivas.

**Rollback:** borrar de `core.app_role_permissions`, `core.app_roles`, `core.permissions_catalog` y `core.apps` las filas `precios` y `erp`. No existen datos que dependan de ellas.

Diseño en [plan/17-erp.md](plan/17-erp.md).

## 2026-10-20 — CRM: esquema del embudo comercial (APLICADA)

Migración `20261020060058_crm_embudo_esquema`, escrita como `20261019200000_…`. Aplica las decisiones del usuario P1–P7 y S6.

**Qué crea en `crm`:**
- 9 tablas: `embudo_parametros`, `etapas`, `origenes`, `motivos_perdida`, `correlativos`, `leads` y `oportunidades`, más `actividades`, `cotizaciones` + `cotizacion_lineas` y `eventos`, estas últimas particionadas por mes.
- 3 funciones para crear particiones, registradas en `core.tablas_particionadas`.
- Helpers `crm.fn_*`, sin `EXECUTE` para la API.
- 48 RPC `public.crm_*`, con `EXECUTE` solo para `authenticated`.
- La siembra S6 de la empresa.

`crm.clientes` no cambia, pero ahora recibe FK desde el embudo.

**Pruebas:**
- Antes de aplicar: 19 grupos en verde en una transacción revertida.
- Después, en remoto: 48 RPC, 16 particiones, siembra 6/6/6/1 y 0 datos.
- Los avisos de seguridad solo muestran lo esperado.

**Rollback** (no hay datos que dependan de esto):
1. Borrar las 48 RPC y los `crm.fn_*`.
2. Borrar las 11 tablas, de las hijas a las padres.
3. Borrar las 3 filas de `core.tablas_particionadas`.

[Detalle](status-log/2026-10-20-crm-embudo-esquema.md).

## 2026-10-19 — CRM: Paso Cero del embudo comercial (APLICADA)

`20261019152215_crm_embudo_paso_cero` (escrita como `20261019000000_…`), con la aprobación del usuario.

- Agrega 21 permisos `crm.ventas.{lead,oportunidad,actividad,cotizacion}.*`, más `crm.ventas.equipo.ver`, `crm.ventas.asignacion.gestionar` y `crm.configuracion.embudo.gestionar`.
- Amplía las plantillas: Vendedor 4 → 17, Gerente de ventas 10 → 27, Administrador de ventas 13 → 34.
- No crea tablas ni funciones.

Se ensayó en una transacción revertida y la migración trae precheck y postcheck. En remoto quedaron 34 permisos `crm` y ningún rol de empresa con los permisos nuevos.

**Rollback:** borrar de `core.app_role_permissions` y de `core.permissions_catalog` esos 21 códigos. No existe ningún dato que dependa de ellos. [Detalle](status-log/2026-10-19-crm-embudo-paso-cero.md).

## 2026-10-18 — Metas y Presupuesto dentro del CRM (APLICADA)

`20261018184849_metas_dentro_de_crm` (escrita como `20261018190000_…`), con la aprobación del usuario. 8 permisos `crm.*` de 4 segmentos reemplazan a los `metas.*`; primeras plantillas del CRM (Vendedor 4, Gerente de ventas 10, Administrador de ventas 13); las 13 funciones del schema `metas` se reescriben desde su definición actual cambiando solo los literales de código (grants intactos); se borran plantillas, permisos y la app `metas` (y su `company_apps`). Probada antes en transacción revertida (permisos por rol, Launcher, denegaciones). Postcheck en remoto: 13 permisos `crm`, 0 filas de `metas` en el catálogo, 13 RPC. Rollback: volver a aplicar los permisos `metas.*` y reemplazar los literales al revés (sin datos al aplicar). [Detalle](status-log/2026-10-18-metas-dentro-de-crm.md).

## 2026-10-18 — Metas de ventas: activación (APLICADA, luego reemplazada)

> Reemplazada el mismo día por `20261018184849_metas_dentro_de_crm`: la app `metas` ya no existe.

`20261018174647_metas_activar`, con la aprobación del usuario ("actívala"). Hace `core.apps.active = true` y `core.company_apps.enabled = true` para `materiales-jcastillo`, igual que `productos_activar`; no asigna roles ni usuarios. Postcheck: activa, habilitada y el owner tiene `metas.ver_modulo`. El mosaico ya aparece en el Launcher de producción, pero no abre hasta que exista el deploy y `METAS_APP_URL` en `nexocore`. Rollback: `update core.apps set active = false where slug = 'metas'`.

## 2026-10-18 — Metas de ventas: Paso Cero + esquema (APLICADAS)

El usuario aprobó la matriz ("Autorizado") tras ver la maqueta. Ambas aplicadas en `nexo-core` con sus prechecks. Verificación previa: no existía nada de `metas`. Detalle: [status-log](status-log/2026-10-18-metas-paso-cero-esquema.md).

- **`20261018133816_metas_paso_cero`:** app `metas` inactiva (Ventas, `/metas`), 8 permisos + `metas.ver_modulo` del trigger, plantillas Vendedor (3), Gerente de ventas (7) y Administrador (9). No asigna nada a roles de empresa.
- **`20261018135152_metas_esquema`** (escrita como `20261018140000_…`, renombrada a la versión remota sin tocar el SQL): schema `metas` con 6 tablas (facturas e importaciones particionadas por mes; 49 particiones de facturas desde 2023-01), 13 RPC `public.metas_*`, registro en `core.tablas_particionadas`. Antes de aplicarla, 18 pruebas en una transacción revertida, todas con el resultado esperado.
- **Advisors:** solo `rls_enabled_no_policy` en `metas.*` (cerrado a propósito) y las 13 RPC `security definer` para `authenticated`. Nada nuevo para `anon`.
- **Rollback:** `drop schema metas cascade; delete from core.tablas_particionadas where schema_nombre = 'metas';` y luego borrar plantillas, permisos y la app `metas` (sin datos todavía).

## 2026-10-18 — Reportes de Asistencia (APLICADAS)

El usuario aprobó la especificación, la matriz y las decisiones recomendadas ("Ok") y luego la aplicación ("Aplícalo"). Se aplicaron en `nexo-core` con sus prechecks y postchecks y se renombraron a la versión remota (escritas como `20261018100000_…` y `20261018100100_…`). Advisors de seguridad: 62 / 6 / 81 / 1 (antes 62 / 6 / 75 / 1); los 6 nuevos de `authenticated_security_definer` son las 6 RPC públicas de reportes, el mismo patrón que el resto de RPC del módulo; `anon` no cambió. Comprobación posterior como owner (transacción revertida): diario 1–17 oct con 15 filas, resumen e incidencias responden. Detalle: [status-log](status-log/2026-10-18-asistencia-reportes.md).

- **`20261018014012_asistencia_reportes_paso_cero`:**
  - permisos `rrhh.asistencia.reportes.ver` y `.exportar`;
  - plantillas: Admin RRHH, Supervisor de Asistencia y Especialista de Planillas, ver y exportar; Consulta General, solo ver;
  - no asigna nada a los roles de empresa. Verificado en remoto: Heyner, Mercedes y Prueba no tienen permisos de RRHH.
- **`20261018014127_asistencia_reportes`:**
  - núcleo `rrhh.fn_asistencia_dias`: una fila por contrato y día de Managua, con jornada, feriado, marcas truncadas al minuto, horas netas con el descanso real o el programado, tardanza y salida temprana desde la hora programada si superan la tolerancia, tiempo sobre jornada informativo, estado y observaciones;
  - `rrhh.fn_reporte_validar`;
  - funciones públicas `asistencia_reporte_{diario,resumen,tardanzas,incidencias,opciones}` y `asistencia_registrar_exportacion`, esta última auditada en `core.audit_log`.

**Ensayo 1**, en `nexo-core` con datos sintéticos y todo revertido:

| Día | Caso | Resultado |
|---|---|---|
| 05 | Completo | netas 510, sobre jornada 30 |
| 06 | Tarde y sin descanso | netas 468, tardanza 12, sin descanso marcado |
| 07 | Salida temprana | netas 470, salida temprana 10 |
| 08 | Solo entrada | falta salida |
| 09 | Sin marcas | sin marcas |
| 10 | Feriado trabajado | no laborable 240 |
| 11 | Domingo | día de descanso |
| 12 | Descanso abierto | descanso sin cerrar |
| 13 | Dentro de la tolerancia | netas 471, tardanza 0 |

En el mismo ensayo:
- **Resumen:** 7 días laborables, 1 ausencia, 2 incompletos, 3360 min programados, 1919 min netos y puntualidad 0,8333.
- **Validaciones:** un rango de más de 62 días da 22023 y un usuario sin permiso da 42501.

**Ensayo 2:** el archivo exacto contra datos reales (7 días), revertido; las 6 funciones responden. Después se comprobó que no quedó ni el núcleo, ni los permisos, ni auditorías.

## 2026-10-17 — P4d: freno de PIN sin salto (APLICADA)

`20261018002033_rrhh_p4d_freno_pin`. Se escribió como `20261017240000_…`, el usuario la aprobó, se aplicó con sus prechecks y postchecks y se renombró a la versión remota; advisors de seguridad sin cambios (62 / 6 / 75 / 1). Corrige el hallazgo Alto #2 de la revisión de P4c: un PIN válido reiniciaba `intentos_en_ventana`, así que quien conociera su propio PIN podía intercalarlo con PINes ajenos sin bloquearse nunca. Las confirmaciones rechazadas tampoco contaban en ningún límite. Solo reemplaza `rrhh.fn_registrar_marca_kiosko`, con la misma firma:

- un PIN válido ya no reinicia los inválidos;
- `previas_en_ventana` cuenta todo envío con PIN válido que no registra una marca (vista previa o confirmación con motivo); 30 por minuto bloquean 5 minutos;
- `search_path = ''`, con `extensions.crypt` (hallazgo #7).

Ensayo en `nexo-core` dentro de un bloque revertido:

| Caso | Resultado |
|---|---|
| 7 inválidos + PIN propio | acciones, y el contador sigue en 7 |
| 1 inválido más | bloqueo; el PIN propio recibe rechazo genérico |
| 3 confirmaciones de salida en S0 | `accion_no_disponible`, contador en 3 |
| Flujo normal | vista previa `["entrada"]` y entrada registrada |

Después se comprobó que la base no cambió. En Vercel, `nexo-rrhh` (Production) no tiene `NEXO_KIOSKO_ID`, así que el camino heredado no está activo en producción.

## 2026-10-17 — P4c: descanso en las marcas del kiosco (APLICADA)

`20261017233458_rrhh_p4c_marcas_descanso`. Se escribió como `20261017220000_…`, el usuario la revisó y la aprobó, se aplicó con sus prechecks y postchecks y se renombró a la versión remota. Advisors de seguridad sin cambios en los conteos (62 / 6 / 75 / 1); solo cambiaron las firmas de las dos RPC del kiosco. Hasta que salga el cliente nuevo, el kiosco anterior falla cerrado. Contenido:

- **Check de `tipo`:** acepta `entrada`, `inicio_descanso`, `fin_descanso` y `salida`. Está en la tabla padre y las particiones lo heredan.
- **Columna nueva:** `kiosko_rate_limits.previas_en_ventana`, para D7.
- **Funciones de marcado:** se reemplaza `p_confirmar_salida boolean` por `p_accion text` en `rrhh.fn_registrar_marca_kiosko`, `rrhh.fn_registrar_marca_terminal`, `public.registrar_marca_kiosko` y `public.registrar_marca_terminal`. Las firmas viejas se eliminan, así que el cliente anterior falla cerrado.
- **`fn_consultar_marcas`:** suma los estados `en_descanso_hoy`, `descanso_sin_cerrar` y `sin_descanso_marcado`.

**Ensayo 1:** la migración completa, con prechecks y postchecks, corrió en `nexo-core` dentro de un bloque revertido. Se detuvo en la prueba posterior por un error de la propia prueba: contaba una tabla interna con el rol `anon`.

**Ensayo 2:** misma lógica, con la prueba corregida y también revertido:

| Caso | Resultado |
|---|---|
| Vista previa en S0 | `["entrada"]`, sin dejar rastro en `kiosko_solicitudes` |
| Salida en S0 | `accion_no_disponible` |
| Entrada | registrada |
| Reintento con el mismo id | misma respuesta |
| Vista previa en S1 | `["inicio_descanso","salida"]` |
| Vista previa en S2 | `["fin_descanso"]` |
| Salida durante el descanso | `accion_no_disponible` |
| Vista previa en S3 | `["salida"]` |
| Vista previa en S4 | `sin_acciones` |
| Acción inválida | rechazada genérica |
| PIN incorrecto | rechazada genérica |

Otros resultados del ensayo 2:
- Secuencia guardada: `entrada>inicio_descanso>fin_descanso>salida`.
- Vistas previas contadas: 6.
- `consultar_marcas`: los 4 tipos aparecen como `registrada`, y un día sin descanso queda como `salida=sin_descanso_marcado`.

Después se comprobó que el remoto sigue igual: firma vieja presente, firma nueva y columna ausentes, y 1 marca.

## 2026-10-17 — M3: límite de canjes de terminal más alto y bloqueos auditados (APLICADA)

`20261017183023_asistencia_canje_limite_m3`. Se escribió como `20261017210000_…`, el usuario la revisó y la aprobó, se aplicó con sus prechecks y postchecks y se renombró a la versión remota. Advisors de seguridad después de aplicar: sin cambios (62 / 6 / 75 / 1). Reemplaza solo `rrhh.fn_canjear_codigo_terminal`:

- el umbral sube de 20 a 300 fallos en 10 min (el bloqueo sigue siendo de 15 min);
- al activarse un bloqueo se registra una sola vez `asistencia.terminal.canje_bloqueado` en `core.audit_log`, sin código ni IP;
- el encabezado trae el SQL de desbloqueo y el rollback.

Ensayo en `nexo-core` dentro de un bloque revertido. Después se comprobó que la función sigue como antes, con 0 bloqueos auditados y 0 fallos.

| Caso | Resultado |
|---|---|
| Canje válido | asignada |
| 299 fallos | 299 rechazados, ningún bloqueo auditado |
| Fallo 300 | rechazado, con 1 bloqueo auditado (metadata: fallos, inicio de la ventana, fin del bloqueo) |
| Intento 301 | limitado |

## 2026-10-17 — Enrolamiento de terminales de kiosco (APLICADA)

**Aplicadas con aprobación explícita del usuario.** Los archivos se escribieron como `20261017200000_…` y `20261017200100_…` y se renombraron a las versiones remotas `20261017180753` y `20261017180853`, sin tocar su SQL. Los prechecks y postchecks van dentro de las migraciones y pasaron. Advisors de seguridad después de aplicar:

| Aviso | Antes | Después | Diferencia |
|---|---|---|---|
| `rls_enabled_no_policy` | 60 | 62 | las 2 tablas nuevas, sin acceso por la API a propósito |
| `anon_security_definer_function_executable` | 3 | 6 | canjear, estado y marcar de la terminal |
| `authenticated_security_definer_function_executable` | 69 | 75 | las 6 RPC nuevas, que validan su permiso adentro |
| `auth_leaked_password_protection` | 1 | 1 | sin cambio (H6) |

Todos los cambios son esperados. Rollback en el encabezado de cada archivo.

Contenido de las dos migraciones:

- `20261017180753_asistencia_enrolamiento_paso_cero`: permisos `rrhh.asistencia.kioskos.asignar` y `.revocar`, en la plantilla de Administrador de RRHH.
- `20261017180853_asistencia_enrolamiento_terminales`: tablas `rrhh.kiosko_credenciales` y `rrhh.kiosko_canje_limites`, con RLS y sin grants; 6 funciones internas `rrhh.fn_*` con `search_path=''`, y sus wrappers en `public`.

**Ensayo en `nexo-core`:** se ejecutaron las dos migraciones y una batería de 12 comprobaciones, todo dentro de un único bloque que terminó en excepción a propósito, así que se revirtió. Después se comprobó que no quedó ninguna tabla, permiso ni RPC. Resultados:

| Comprobación | Resultado |
|---|---|
| Generar código | 10 dígitos |
| Canjear con espacio | asignada, con el nombre del dispositivo y un token de 47 caracteres |
| Reusar el código | rechazado |
| Código inexistente | rechazado |
| Estado de la terminal | asignada |
| PIN inválido | rechazada |
| `anon` lee la tabla | denegado |
| `anon` genera un código | denegado |
| Estado de los equipos | asignada |
| Revocar | revocada |
| Estado con el token revocado | sin_asignar |
| Marcar con el token revocado | terminal_no_autorizada |
| Usuario sin permiso | denegado |

La migración de cierre (revocar `public.registrar_marca_kiosko` a `anon`, H5) se escribirá cuando se retire `NEXO_KIOSKO_ID`.

## 2026-10-17 — Registro de la app Asistencia (APLICADA)

`20261017173701_asistencia_registrar_app`, aplicada con aprobación explícita del usuario ("aplicar la migración ... en nexo-core"). Se escribió como `20261017190000_…` y se renombró a la versión remota sin tocar su SQL. Prechecks (dentro de la migración): no existía el slug `asistencia`, no había permisos `asistencia.%` y `rrhh` estaba activo. Cambios: `core.apps` `asistencia` (Asistencia, categoría RRHH, icono `clock`, ruta `/rrhh/asistencia`, `depends {rrhh}`, activa) y `company_apps.enabled` para Materiales J Castillo. El trigger creó `asistencia.ver_modulo`. Postchecks: ese permiso existe y es el único del módulo. Sin roles ni usuarios: hoy solo el owner la ve (tampoco hay roles de empresa con `rrhh.ver_modulo`). Efecto: el mosaico aparece en el Launcher de producción y `/rrhh/asistencia` da 404 hasta el deploy de `nexo-rrhh` con el push único; no necesita rewrite nuevo. Nota: el comentario del archivo enumera los permisos de contenido sin `feriados`; es solo texto. Rollback en el encabezado. [Detalle](status-log/2026-10-17-asistencia-app.md).

## 2026-10-17 — Activación del módulo Agencia digital (APLICADA)

`20261017171359_agencia_activar`, aplicada con aprobación explícita del usuario ("activa agencia digital"). El archivo se escribió como `20261017180000_…` y se renombró a la versión remota sin tocar su SQL. Precheck: `core.apps.agencia` con `active = false`, sin filas en `company_apps` y con los 2 permisos del Paso Cero. Cambios: `active = true` y `company_apps.enabled = true` para Materiales J Castillo; sin roles ni usuarios. Postcheck: `active = true`, `enabled = true`. Efecto: la tarjeta aparece en el Launcher de producción. El mismo día se creó en `nexocore` `AGENCIA_APP_URL` de Production (`https://nexo-agencia.vercel.app`, que responde 307 al login), así que `/agencia` abre en producción a partir del próximo deploy de `nexocore`. En local responde por el rewrite del panel (puerto 3003). Rollback en el encabezado del archivo.

## 2026-10-17 — Seguridad: `update_platform_settings` sin `anon` (APLICADA)

`20261017164447_seguridad_update_platform_settings_sin_anon` (antes `20261017170000_…`, renombrada a la versión remota sin tocar el SQL; hallazgo H4 de la [revisión de seguridad](status-log/2026-10-17-revision-seguridad.md)). Regresión de `20260830000012`, que revocó `anon` sobre la firma de 7 argumentos: al recrearse la función con `p_favicon_url` (8 argumentos, `20260907223910`) se revocó `PUBLIC` pero no `anon`, que recuperó EXECUTE por los default privileges (`proacl` remoto verificado: sin `PUBLIC`, con `anon`). La migración hace `revoke … from public, anon` (para `public` no hace nada), conserva `authenticated` y deja `get_platform_settings` intacta, con precheck de firma y postchecks de privilegios. **Probada en `nexo-core` dentro de una transacción revertida**: `anon` sin EXECUTE, `authenticated` con EXECUTE, `get_platform_settings` sigue abierta a `anon`; tras el rollback el remoto quedó igual. **Aplicada el 2026-10-17 con aprobación explícita del usuario** (versión remota `20261017164447`). Precheck: `proacl` = `postgres, anon, authenticated, service_role`. Los postchecks de la migración pasaron. Después de aplicarla, `proacl` = `postgres, authenticated, service_role`, y `get_platform_settings` sigue ejecutable por `anon`. Advisors de seguridad: `anon_security_definer_function_executable` bajó de 4 a 3 (quedan `atencion_pantalla_estado`, `get_platform_settings` y `registrar_marca_kiosko`, que son intencionales). El resto de los avisos sigue igual: `rls_enabled_no_policy` 60, `authenticated_…` 69 y `auth_leaked_password_protection` 1. Rollback: `grant execute … to anon`.

## 2026-10-17 — RRHH P1–P6 del piloto de kiosco (APLICADAS)

Aprobación explícita del usuario. Aplicadas en `nexo-core` en el orden del [paquete del Operador](RRHH_PAQUETE_OPERADOR.md): `20261017131004_p1_pin_ambiguo_fallo_cerrado`, `20261017131040_rrhh_p2_pin_unico_empresa`, `20261017131113_rrhh_p3_marca_contrato`, `20261017131132_rrhh_p4a_kiosko_solicitudes`, `20261017131202_rrhh_p4b_marca_atomica_idempotente`, `20261017131221_rrhh_p6_consultar_marcas` (archivos renombrados a la versión remota sin tocar su SQL; P1 se llamaba `20261015181000_…`). Precondiciones: 0 marcas, 0 credenciales vigentes. Postchecks del paquete en verde, P7 sección A en verde en remoto, advisors solo con los hallazgos esperados. Efecto: el kiosco desplegado desde `main` falla cerrado hasta fusionar el PR #47. Rollback: el de cada paso en el paquete (corregir hacia adelante; no restaurar la firma de 2 parámetros). [Detalle](status-log/2026-10-17-rrhh-p1-p6-aplicadas.md).

## 2026-10-16 — Activación del módulo Productos (APLICADA)

`20261016220935_productos_activar`, por pedido del usuario ("levántalo en local"): `core.apps.active = true` para `productos` y `core.company_apps.enabled = true` para Materiales J Castillo. Necesaria para entrar desde local, porque las apps locales usan `nexo-core`. Efecto conocido y aceptado: el owner ve la tarjeta "Productos" en el Launcher de producción, que no abre hasta el deploy (sin `PRODUCTOS_APP_URL` en `nexocore`). Verificado: `active = true`, `enabled = true`. Rollback: `update core.apps set active = false where slug = 'productos'`.

## 2026-10-16 — Productos: esquema + RPC (APLICADA)

`20261016214634_productos_esquema` (archivo escrito como `20261016230000_…` y renombrado a la versión remota sin tocar su SQL), aplicada en `nexo-core` con aprobación del usuario del modelo de datos (plan 14 §4). Crea el schema `productos` cerrado a la API (12 tablas de catálogo, RLS sin políticas, `revoke all`), triggers de integridad (ID inmutable, sin `delete`, coherencia de clasificación, marca por clase, tipo de cuenta, regla de servicios) y 12 RPC `public.productos_*` con `EXECUTE` solo para `authenticated`. Precheck: aborta si el schema existe o falta el Paso Cero. **Antes de aplicar**, la misma migración se ejecutó en una transacción revertida con 17 pruebas (código `010102-001/-002`, código editable sin duplicados, número de clasificación fijo, vista previa sin efectos, IDs del ERP 1465/800 y nuevos desde 1466, costo oculto y alta denegada para un rol de consulta, ID inmutable, sin borrado); **después**, 11 pruebas más en otra transacción revertida (marca por clase, servicios, tipo de cuenta, descontinuar, contador con código manual `-005` → sugiere `-006`, importación de proveedor/centro de costo, exportación, catálogos). Advisors: solo los avisos esperados del patrón RPC (`rls_enabled_no_policy` INFO ×12, `authenticated_security_definer_function_executable` WARN ×12), sin exposición a `anon`. Sin datos. Rollback: `drop schema productos cascade` + `drop function public.productos_*`. [Detalle](status-log/2026-10-16-productos-esquema-app.md).

## 2026-10-16 — Paso Cero del módulo Productos (APLICADA)

`20261016203638_productos_paso_cero`, aplicada en `nexo-core` con aprobación explícita del usuario. Registra `core.apps` `productos` **inactiva** (el trigger crea `productos.ver_modulo`), 16 permisos (`dashboard`, `catalogo`, `configuracion`) y 4 plantillas en `core.app_roles` (consulta 3, editor 7, contabilidad 8, administrador 17 permisos). Precheck que aborta si algo de `productos` ya existía. Sin tablas, schema, políticas ni funciones; ninguna empresa habilitada en `core.company_apps`. Rollback: borrar las filas `module_slug = 'productos'` de `core.app_role_permissions`/`core.app_roles`/`core.permissions_catalog` y la app. [Detalle](status-log/2026-10-16-productos-paso-cero.md).

## 2026-10-15 — RRHH P1: PIN ambiguo, fallo cerrado (APLICADA el 2026-10-17, ver arriba)

- `20261017131004_p1_pin_ambiguo_fallo_cerrado` (fusionada en `main`
  `fc2b309`, vía PR #42) — **todavía no aplicada a `nexo-core`, por pedido
  explícito del usuario**: no se tocó el remoto. Reemplaza
  `rrhh.fn_registrar_marca_kiosko` para CONTAR las
  credenciales vigentes de la empresa del kiosco que aceptan el PIN; con más
  de una coincidencia no inserta marca, no identifica a nadie y emite una
  señal técnica sin PIN (señal en el log del servidor). Misma firma, mismo
  tipo de retorno, mismo rate-limit y mismos `GRANT`/`REVOKE`; ninguna
  migración histórica modificada.
- Verificado antes de escribirla (solo lectura sobre `nexo-core`): la función
  desplegada seguía resolviendo con `limit 1` y con el mismo tipo de retorno;
  `anon` sin `EXECUTE` sobre la función interna y con `EXECUTE` sobre
  `public.registrar_marca_kiosko`.
- Probada en PostgreSQL embebido (PGlite 0.5.10 + `contrib/pgcrypto` real) en
  memoria: 13 casos / 28 aserciones en verde, migración reaplicable sin error,
  y control negativo contra la definición F1.3 (la prueba falla en C4 con la
  versión vieja). [Detalle](status-log/2026-10-15-rrhh-p1-pin-ambiguo.md).
- Rollback: reaplicar la definición de
  `20260907154715_f1_3_pin_exclusivamente_contractual`.

## 2026-10-15 — Atención: métricas (APLICADA)

- `20261015173729_atencion_metricas`: nuevas `public.atencion_metricas` y
  `public.atencion_sucursales_reportes` (solo `authenticated`). Probada antes en
  transacción revertida. Archivo renombrado de `20261015240000_…`. Rollback:
  borrar las 2 funciones. [Detalle](status-log/2026-10-15-atencion-metricas-dashboards.md).

## 2026-10-15 — Atención: reactivar y factura única (APLICADAS)

- `20261015165620_atencion_paso_cero_metricas_reactivar`: 2 permisos +
  4 asignaciones a plantillas. Rollback: borrar esas filas de
  `core.app_role_permissions` y `core.permissions_catalog`.
- `20261015172012_atencion_reactivar_factura_unica`: columnas `en_fila_desde`,
  `reactivaciones`, `reemplazado_en`, `reemplazado_por`; `fn_factura_normal` +
  `turnos_factura_idx`; `atencion_crear_turno`, `atencion_llamar`,
  `atencion_pantalla_estado` reemplazadas; nuevas `atencion_reactivar_turno` y
  `atencion_cola_v3`. Probada antes en bloque revertido (8 casos). Rollback:
  volver a las definiciones de `20261015163957`/`20261015161222`/
  `20261014224341`, borrar las 2 funciones nuevas, el índice y las 4 columnas.
- `20261015172709_atencion_factura_usa_indice`: `atencion_crear_turno` con
  `t.factura is not null` para usar el índice parcial (revisión de Codex).
  Rollback: la definición de `20261015172012`.
- Conector MCP: también retiene `UPDATE` sin `WHERE` (ver status-log).
  [Detalle](status-log/2026-10-15-atencion-reactivar-factura-unica.md).

## 2026-10-15 — Atención: inicio de atención y cola con tiempos (APLICADA)

- `20261015163957_atencion_inicio_atencion`: columna
  `atencion.turnos.inicio_atencion_en` (rellenada desde `turno_eventos`),
  `atencion_llamar` la fija, nueva `public.atencion_cola_v2` (+
  `inicio_atencion_en`, `finalizado_en`). Probada antes en bloque revertido.
  Un primer intento con `drop function atencion_cola` se colgó en el conector
  MCP sin aplicar nada (verificado); se rehízo sin DROP. Archivo renombrado de
  `20261015200000_…`. Rollback: volver a la `atencion_llamar` de
  `20261014224341`, `drop function public.atencion_cola_v2(uuid, uuid)`,
  `alter table atencion.turnos drop column inicio_atencion_en`.
  Pendiente: retirar `public.atencion_cola` (sin uso).
  [Detalle](status-log/2026-10-15-atencion-cronometros.md).

## 2026-10-15 — Atención: fila en tiempo real (APLICADA)

- `20261015162540_atencion_cola_tiempo_real`: tabla
  `public.atencion_cola_senales` (una fila por sucursal, sin datos del
  cliente) en `supabase_realtime`, con RLS de solo lectura vía
  `public.atencion_puede_escuchar(uuid)`; trigger `trg_atencion_turnos_avisar`
  en `atencion.turnos`. Probada antes en un bloque revertido. Postcheck:
  versión registrada, publicación, grants y trigger en las particiones.
  Archivo renombrado de `20261015190000_…`. Rollback: `drop trigger
  trg_atencion_turnos_avisar on atencion.turnos`, `alter publication
  supabase_realtime drop table public.atencion_cola_senales`, `drop table
  public.atencion_cola_senales`, `drop function
  atencion.fn_avisar_cambio_turno(), public.atencion_puede_escuchar(uuid)`.
  [Detalle](status-log/2026-10-15-atencion-fila-tiempo-real.md).

## 2026-10-15 — Atención: factura en la pantalla (APLICADA)

- `20261015161222_atencion_pantalla_factura`: `create or replace` de
  `public.atencion_pantalla_estado`, que agrega `factura` a `llamados[]` solo si
  `config.mostrar.factura` o `config.anunciar.factura` es `true` (sin clave =
  no). Probada antes en un bloque revertido. Dos intentos previos con un `DROP
  FUNCTION` se cortaron a los 60 s en el conector sin aplicar nada; se rediseñó
  sin `DROP`. Postcheck: versión registrada, `anon` con `EXECUTE`, la pantalla
  real devuelve `factura: null`. Archivo renombrado de `20261015180000_…`.
  Rollback: volver a ejecutar la definición de `20261015155035`.

## 2026-10-15 — Atención: datos configurables de la pantalla (APLICADA)

- `20261015155035_atencion_pantalla_campos_configurables`: nueva
  `atencion.fn_pantalla_campo` (sin `EXECUTE` para la API) y `create or
  replace` de `public.atencion_pantalla_estado`, que devuelve `null` en
  `cliente`/`agente`/`puesto` cuando `config.mostrar` y `config.anunciar` los
  apagan (sin clave = sí, así que las pantallas existentes no cambian).
  Probada antes en un bloque revertido (3 casos). Postcheck: versión
  registrada, grants correctos, la pantalla real devuelve lo mismo. Archivo
  local renombrado de `20261015170000_…` a la versión remota sin tocar el SQL.
  Rollback: volver a ejecutar la definición de `20261015151609` y
  `drop function atencion.fn_pantalla_campo(jsonb, text)`.
  [Detalle](status-log/2026-10-15-atencion-pantalla-configurable.md).

## 2026-10-15 — Atención: nombres en la pantalla pública (APLICADA)

- `20261015151609_atencion_pantalla_nombres`: `create or replace` de
  `public.atencion_pantalla_estado`. `llamados[]` agrega `cliente`
  (`turnos.cliente_nombre`) y `agente` (`core.perfiles.nombre_completo` de
  `turnos.atendido_por`, `left join`). Grants iguales (`anon`,
  `authenticated`). Decisión explícita del usuario; revierte "solo números y
  puestos". Precheck: la función remota coincidía con `20261014224341`.
  Postcheck: versión registrada, `anon` con `EXECUTE`, prueba con turno
  ficticio en bloque revertido. Archivo local renombrado de
  `20261015120000_…` a la versión remota sin tocar el SQL.
  Rollback: volver a ejecutar la definición de la sección 9 de
  `20261014224341_atencion_esquema.sql`.
  [Detalle](status-log/2026-10-15-atencion-pantalla-nombres.md).

## 2026-10-14 — Activación del módulo Atención (APLICADA)

- `20261014230022_atencion_activar` — `core.apps.active = true` para
  `atencion` y `core.company_apps` habilitado para `materiales-jcastillo`.
  Decisión explícita del usuario: activar **antes del merge** para probar en
  el preview, aceptando que la tarjeta aparezca en el inicio de producción,
  donde `/atencion` no funciona hasta configurar `ATENCION_APP_URL` de
  Production y fusionar. Postcheck: activa, 1 empresa, owner con
  `atencion.ver_modulo` y `atencion.puesto.sesion.iniciar`; 0 sucursales y 0
  roles con permisos de Atención (se crean desde las pantallas).
  Rollback: `update core.apps set active = false where slug = 'atencion'`.

## 2026-10-14 — Módulo Atención: esquema + RPC + pg_cron (APLICADA)

Detalle, pruebas y postcheck en
[`status-log/2026-10-14-atencion-esquema.md`](status-log/2026-10-14-atencion-esquema.md).
Aprobada explícitamente por el usuario; probada antes de punta a punta en una
transacción revertida (verificado que no quedó nada). Aplicada con
`apply_migration`; archivo `20261015000000_…` renombrado a la versión remota
`20261014224341` sin tocar el SQL.

- `20261014224341_atencion_esquema` — `core.sucursales`,
  `core.usuario_sucursales`; schema `atencion` (sin `USAGE` para la API, solo
  RPC) con `puestos`, `pantallas`, `contadores`, `sesiones_activas` y las
  particionadas `sesiones`, `turnos`, `turno_eventos`; 19 RPC; **instala
  `pg_cron`** con los jobs `atencion-cierre-vencidas` y
  `nexo-particiones-futuras`. App `atencion` sigue inactiva.
  Rollback: `cron.unschedule` de ambos jobs, `drop schema atencion cascade`,
  `drop` de las 4 RPC `admin_*sucursal*`, borrar las 3 filas de
  `core.tablas_particionadas`, `drop table core.usuario_sucursales,
  core.sucursales` (y opcionalmente `drop extension pg_cron`).

## 2026-10-14 — Paso Cero del módulo Atención + permisos de sucursales (APLICADA)

Diseño: [`plan/13-atencion-turnos.md`](plan/13-atencion-turnos.md); detalle en
[`status-log/2026-10-14-atencion-paso-cero.md`](status-log/2026-10-14-atencion-paso-cero.md).
Aprobada explícitamente por el usuario; validada antes en una transacción
revertida (y verificado que no quedó nada). Aplicada con `apply_migration`;
versión remota `20261014222454` (archivo nombrado con esa versión).

- `20261014222454_atencion_paso_cero` — `core.apps` + `atencion` (inactiva,
  sin `company_apps`); el trigger creó `atencion.ver_modulo`; 14 permisos
  `atencion.*` + 2 `nexo.administracion.sucursales.*`; 3 plantillas en
  `core.app_roles` (`recepcion` 6, `agente` 8, `supervisor` 15). Sin tablas.
  Postcheck: owner sin acceso a Atención (app inactiva, esperado), owner con
  `sucursales.gestionar`; 0 asignaciones en `user_permissions`/`rol_permisos`.
  Rollback: borrar `app_role_permissions`/`app_roles` de `atencion`, los 16
  códigos del catálogo, `atencion.ver_modulo` y la fila de `core.apps`.

## 2026-10-14 — Esquema de usuarios y roles + nueva `has_permission` (APLICADA)

Detalle y pruebas en
[`status-log/2026-10-14-usuarios-roles-esquema.md`](status-log/2026-10-14-usuarios-roles-esquema.md).
**1 migración, revisada y aprobada explícitamente por el usuario, aplicada
a `nexo-core` el 2026-10-14** con `apply_migration`. Antes de aplicarla se
ejecutó completa en una transacción revertida con 15 pruebas (owner, rol
limitado, anti-escalada, usuario desactivado, sin sesión) — todas
correctas, y se verificó que no quedó nada persistido. La migración trae
sus propios prechecks (abortan si `user_app_roles` tiene filas, si hay
membresías `admin`, si falta el Paso Cero o si las tablas ya existen).
Postcheck: 3 tablas nuevas, 3 columnas nuevas en `company_memberships`,
14 RPC, `anon` sin `EXECUTE` en ninguna, helpers `core.fn_*` cerrados a
`authenticated`, owner conserva acceso a `rrhh`/`nexo` y queda sin acceso a
`agencia` (módulo no habilitado), 1 membresía activa, partición
`audit_log_2027_01` creada, 0 roles y 0 filas de auditoría. Archivo local
creado como `20261014230000_...` y renombrado a la versión remota real
`20261014203144` sin tocar su SQL. `get_advisors(security)`: solo los
avisos esperados (`rls_enabled_no_policy` INFO en las 3 tablas nuevas —
deliberado, acceso solo por RPC; `authenticated_security_definer_function_executable`
en las RPC nuevas — mismo patrón que el resto de RPC de la suite, cada una
valida permiso adentro).

- `20261014203144_nexo_usuarios_roles_esquema` —
  1. `core.roles`, `core.rol_permisos`, `core.perfiles`;
     `core.company_memberships` + `rol_id` (FK compuesta misma empresa),
     `activo`, `updated_at`.
  2. `core.has_permission` reescrita (misma firma): módulo habilitado +
     membresía activa + rol de empresa; deja de evaluar `user_app_roles` y
     el bypass `admin`.
  3. Helpers internos `core.fn_es_owner`, `fn_permisos_rol`,
     `fn_cubre_permisos`, `fn_exigir_permiso`, `fn_auditar`,
     `fn_membresia_administrable`, `fn_validar_rol_asignable`,
     `fn_vincular_empleado`.
  4. 14 RPC `public.*` (ver [DATABASE.md](DATABASE.md)).
  5. `core.fn_asegurar_particiones_futuras(3)` — `audit_log` hasta 2027-01.

  Rollback (mientras no haya roles/usuarios creados por la UI): restaurar
  `core.has_permission` desde `20260902000001_app_scoped_roles.sql`, `drop`
  de las 14 RPC y 8 helpers, `alter table core.company_memberships drop
  column rol_id, drop column activo, drop column updated_at`, `drop table
  core.rol_permisos, core.roles, core.perfiles`.

## 2026-10-14 — Paso Cero de administración de usuarios y roles (APLICADA)

Detalle en
[`status-log/2026-10-14-paso-cero-administracion-usuarios-roles.md`](status-log/2026-10-14-paso-cero-administracion-usuarios-roles.md);
diseño en [`plan/12-administracion-usuarios-roles.md`](plan/12-administracion-usuarios-roles.md).
**1 migración, aprobada explícitamente por el usuario y aplicada a `nexo-core` el 2026-10-14** con `apply_migration`. Precheck de solo lectura:
0 códigos `nexo.administracion.%`, `core.apps` con `nexo` registrada.
Postcheck: 9 códigos nuevos (`nexo` pasa de 2 a 11 en el catálogo),
`core.user_permissions` y `core.user_app_roles` siguen en 0 filas (nadie
recibió permisos), migración registrada con versión remota `20261014201119`
— el archivo local se nombró directamente con esa versión.

- `20261014201119_nexo_administracion_permisos_paso_cero` — solo `insert`
  en `core.permissions_catalog` de los 9 códigos
  `nexo.administracion.{usuarios.ver|crear|editar|desactivar, roles.ver|crear|editar|eliminar, auditoria.ver}`.
  Sin tablas, sin cambios de RLS ni de `core.has_permission`. Hoy solo el
  owner los obtiene (bypass de membresía). Rollback: `delete from
  core.permissions_catalog where code like 'nexo.administracion.%'`
  (seguro mientras ninguna fila de `user_permissions`/`app_role_permissions`
  los referencie).

Divergencia detectada en el precheck, sin relación con esta migración:
`20261014181353_agencia_dashboard_access` está aplicada en `nexo-core` pero
no existe en `main` (probablemente viene de la rama
`feat/issue-18-agencia-independiente`). **Reconciliada el mismo día**: esa
rama se trajo por merge a `feat/usuarios-roles-nexo`, con el archivo de la
migración incluido.

## 2026-09-18 — Reglas de contratación y endurecimiento de seguridad/integridad (APLICADA)

Contexto completo, causa raíz del bug de UI auditado y deuda en
[`status-log/2026-09-17-contratos-reglas-y-endurecimiento.md`](status-log/2026-09-17-contratos-reglas-y-endurecimiento.md).
**1 migración, escrita y revisada manualmente el 2026-09-17, aplicada a `nexo-core` (remoto) el 2026-09-18** con `apply_migration` — prechecks de
solo lectura antes de aplicar (migración no registrada, `rrhh.contratos`
en 0 filas, sin puestos sin departamento, sin puestos activos sin
plantilla activa, firmas remotas de los 4 RPC todavía con la firma
antigua) y postchecks después (migración registrada con versión remota
`20260918043955`, columnas `NOT NULL` confirmadas, firmas nuevas de los 4
RPC confirmadas, `anon`/`PUBLIC` sin `EXECUTE`, límites del bucket
confirmados, `get_advisors(security)` sin hallazgos nuevos). El archivo
local se creó con el prefijo `20260917100000` (fecha de escritura) y se
renombró a `20260918043955` (la versión remota real que quedó registrada
al aplicarlo) sin modificar su contenido SQL — mismo desfase ya visto
antes en este proyecto entre el prefijo de un archivo y la versión que
`apply_migration` termina registrando (ej. `20260916150000_...` quedó
como `20260916152106`).

- `20260918043955_rrhh_contratos_reglas_y_endurecimiento` —
  1. Integridad multiempresa: `UNIQUE (id, company_id)` en
     `rrhh.empleados`/`departamentos`/`puestos`/`plantillas_contrato`, y
     FK compuesta `(recurso_id, company_id)` en `rrhh.contratos` y las 4
     tablas de expediente ampliado + `empleado_documentos` +
     `puesto_plantillas` (antes cada una guardaba `company_id` sin
     verificar que coincidiera con el del recurso referenciado).
     `rrhh.puestos.departamento_id` pasa a `NOT NULL` (verificado 0 filas
     nulas en remoto) con FK compuesta a `rrhh.departamentos`.
  2. `core.geografia_ni_municipios` gana `UNIQUE (id, departamento_id)`;
     `rrhh.empleado_direccion` gana FK compuesta + `CHECK` que exige que
     un municipio elegido pertenezca al departamento elegido.
  3. `rrhh.fn_validar_porcentaje_beneficiarios()`: agrega `perform ...
     for update` sobre el empleado antes de sumar — cierra una condición
     de carrera real (dos escrituras concurrentes podían superar 100% en
     conjunto).
  4. `storage.buckets` (`rrhh-documentos-privados`): `file_size_limit`
     10MB + `allowed_mime_types` reales (antes sin límite de
     infraestructura).
  5. `rrhh.contratos` gana `plantilla_contrato_id` (`NOT NULL`,
     persistida); `puesto_id`/`departamento_id` pasan a `NOT NULL`
     (verificado 0 filas nulas en remoto).
  6. `rrhh.fn_crear_contrato`/`public.crear_contrato` — `DROP` + `CREATE`
     (cambio de firma): `p_puesto_id`/`p_departamento_id`/
     `p_plantilla_contrato_id` pasan a obligatorios, **sin**
     `p_fecha_fin_prevista` (eliminado, no solo omitido); valida server-side
     mismo tenant + puesto pertenece al departamento + plantilla asignada
     y activa para el puesto + rechaza un segundo contrato abierto por
     empleado (antes solo lo impedía un unique index para `estado='activo'`).
  7. `rrhh.fn_editar_contrato`/`public.editar_contrato` — `DROP` +
     `CREATE`: agrega `p_plantilla_contrato_id`, revalida la relación
     completa contra el estado resultante en cada edición;
     `fecha_fin_prevista` se sigue pudiendo completar acá.

## 2026-09-16 — Bloque "pre-F1.5": cédula, catálogos, Storage privado, expediente ampliado

Contexto completo, pruebas y deuda en
[`status-log/2026-09-16-rrhh-pre-f1-5.md`](status-log/2026-09-16-rrhh-pre-f1-5.md).
**6 migraciones nuevas, todas aplicadas a `nexo-core` con
`apply_migration` y verificadas** (`get_advisors(security)` sin
hallazgos nuevos después de cada tanda):

- `20260916100000_rrhh_cedula_obligatoria` — `rrhh.empleados.documento_identidad`
  a `NOT NULL` (guarda explícita que aborta si aparece una fila nula en
  vez de asumir 0 filas; verificado 0 antes de aplicar).
  `rrhh.fn_crear_empleado`/`fn_editar_empleado` reescritas para exigir
  documento no vacío y traducir `unique_violation` a mensaje entendible.
- `20260916140000_rrhh_catalogos_contratacion_permisos` — Paso Cero: 9
  códigos nuevos `rrhh.expedientes.{puestos,departamentos,plantillas}.{ver,crear,editar}`.
- `20260916150000_rrhh_catalogos_contratacion_tablas` —
  `rrhh.departamentos`/`rrhh.puestos`/`rrhh.plantillas_contrato`/
  `rrhh.puesto_plantillas` nuevas; `rrhh.contratos` gana `puesto_id`/
  `departamento_id` con backfill genérico desde el texto libre (no-op:
  0 contratos en producción); `rrhh.fn_crear_contrato`/`fn_editar_contrato`
  (y sus wrappers `public.*`) recreadas con `DROP` explícito primero
  (cambia el tipo de dos parámetros `text`→`uuid`, `CREATE OR REPLACE`
  no alcanza) preservando la lógica original (validación de empleado,
  permiso `compensacion.editar`, `coalesce` en edición parcial). Primer
  intento de esta migración falló (`unique (company_id, lower(nombre))`
  no es sintaxis válida como table constraint — una expresión solo puede
  ir en un índice, no en un `UNIQUE` de tabla); corregido a
  `CREATE UNIQUE INDEX ... (company_id, lower(nombre))` antes de
  reaplicar, sin dejar nada a medias (falla transaccional, verificado con
  `information_schema.tables` antes de reintentar).
- `20260916160000_rrhh_expediente_ampliado_permisos` — Paso Cero: 9
  códigos nuevos (`direccion.*`, `info_complementaria.*` — visibles
  también para `consulta`; `cuentas_bancarias.*`/`beneficiarios.*` — solo
  `admin`; `documentos.descargar`).
- `20260916170000_geografia_ni_y_expediente_ampliado` —
  `core.geografia_ni_departamentos` (sembrada, 17 filas) y
  `core.geografia_ni_municipios` (esquema listo, **vacía a propósito** —
  ver deuda en el status-log); `rrhh.empleado_direccion`/
  `empleado_info_complementaria`/`empleado_cuentas_bancarias`/
  `empleado_beneficiarios` nuevas, con trigger
  `rrhh.fn_validar_porcentaje_beneficiarios` (suma de porcentaje activo
  por empleado ≤ 100, regla entre filas).
- `20260916180000_rrhh_storage_privado_documentos` — bucket
  `rrhh-documentos-privados` (`public=false`, cero políticas de
  `storage.objects`) + `rrhh.empleado_documentos` (soft delete). Subida
  por `createSignedUploadUrl` (URL firmada de subida directa
  navegador→Storage) — evita a propósito el techo de 4.5MB de Vercel
  Functions que causó el bug P0 del 2026-09-14 con imágenes de marca.

## 2026-09-07 — Nexo Enterprise UI: rediseño visual transversal

Contexto completo en [`IMPLEMENTATION_STATUS.md`](IMPLEMENTATION_STATUS.md)
sección 0.15. Alcance predominantemente de UI/navegación
(`packages/ui`/`apps/nexo`/`apps/rrhh`/`apps/crm`) — solo 3 migraciones,
ninguna toca contratos/PIN/jornadas/asistencia/planillas.

**3 migraciones nuevas, aplicadas a `nexo-core` y verificadas con RPC
real** (mismo patrón: `apply_migration` primero, archivo de Git después
con el `version` que Supabase asignó):

- `20260907223910_nexo_enterprise_ui_favicon` — aditiva:
  `core.platform_settings.favicon_url`. `get_platform_settings`/
  `update_platform_settings` recreadas (`DROP FUNCTION` + `CREATE` —
  `RETURNS TABLE` cambia el tipo fila compuesto al agregar una columna,
  `create or replace` lo rechaza con error real, confirmado al
  intentarlo sin el drop). Probado end-to-end: `update_platform_settings`
  con favicon → `get_platform_settings` lo devuelve; limpiado después
  (favicon vuelto a `null`, cero residuo).
- `20260907224007_nexo_enterprise_ui_eliminar_empleado` —
  `rrhh.fn_eliminar_empleado`/`public.eliminar_empleado`: completa el
  hueco de UI de "eliminar empleado" (permiso `rrhh.expedientes.
  empleados.eliminar` y política RLS `DELETE` ya existían desde F1.1,
  sin consumidor hasta ahora). Ajuste obligatorio del usuario: valida
  **explícitamente** contra `rrhh.contratos` (cualquier estado) antes de
  eliminar, con mensaje de dominio claro — no depende de la violación de
  la FK. Verificado con 3 casos reales (sin contrato → elimina; con
  contrato borrador → rechazado por dominio; sin permiso → rechazado),
  cero residuo de datos de prueba.
- `20260907224240_fix_eliminar_empleado_anon_grant` — corrección el mismo
  turno: `get_advisors(security)` detectó que `public.eliminar_empleado`
  quedaba ejecutable por `anon` (default privileges de Postgres al crear
  una función nueva en `public`, mismo patrón ya visto en
  `20260902000009_fix_crear_empleado_anon_grant`) — revocado
  explícitamente, reverificado con `has_function_privilege`.

**Kit de UI compartido**: `AppShell`/`ShellBar`/`Sidebar`/`StatCard`
retirados de `packages/ui` (verificado por grep de `"@nexo/ui"` en todo
el monorepo antes de borrar — cero consumidores fuera de las 3 apps
migradas en este mismo commit); reemplazados por `NexoShell`/
`NexoSidebar`/`NexoTopbar`/`MetricCard` + el resto del kit nuevo
(`Breadcrumb`, `PageHeader`, `DashboardHero`, `ActivityFeed`,
`QuickActions`, `DataTable`, `FilterBar`, `StatusBadge`, `FormTabs`,
`FormSection`, `EmptyState`, `ConfirmDialog`, `Toast`/`useToast`).
`Toast` envuelve `sonner` (ya era dependencia real en uso en
`apps/crm`/`apps/rrhh`) en vez de duplicar un sistema de notificaciones —
`sonner` se agregó como dependencia real de `packages/ui` y `apps/nexo`.
`pnpm-lock.yaml` actualizado con `pnpm install --no-frozen-lockfile
--lockfile-only` (el `pnpm install` normal fallaba con `EPERM` de entorno
sobre binarios nativos de `turbo` al materializar `node_modules` — mismo
tipo de bloqueo de Windows/OneDrive ya documentado para `tsc`; el modo
`--lockfile-only` no escribe `node_modules`, evita el problema por
completo).

## 2026-09-07 — F1.4: Jornadas mínimas

Contexto completo en [`IMPLEMENTATION_STATUS.md`](IMPLEMENTATION_STATUS.md)
sección 0.14. Rama `feat/rrhh-f1-4-jornadas-minimas` → `main`.

Revisión previa obligatoria del stash `feat/rrhh-jornadas-y-horas`
(trabajo de una sesión anterior a `PLAN_MAESTRO_IMPLEMENTACION_NEXO.md`):
contenía solo 5 archivos de **documentación** (`CLAUDE.md`,
`docs/PERMISSIONS.md`, `docs/README.md`, `docs/RRHH_IMPLEMENTATION_PLAN.md`,
`docs/planning/RRHH_JORNADAS_DISENO.md`) — **ninguna migración SQL ni
código de app**. Clasificado como incompatible/descartable para reutilizar
literalmente: sus FK cuelgan de `empleado_id` (no `contrato_id`, el modelo
vigente), y su alcance (evidencia fotográfica en kiosco, redondeo,
incidencias, consolidación) excede F1.4. El propio documento dice "nada de
esto se aplicó". Stash intacto, sin `pop` — nada se integró.

**3 migraciones nuevas, aplicadas a `nexo-core` y verificadas** (aplicadas
primero vía `apply_migration`, archivo de Git escrito después con el mismo
`version` que Supabase asignó — mismo patrón que las migraciones
anteriores de esta fecha):

- `20260907162904_f1_4_jornadas_permission_matrix` — Paso Cero. Inserta 4
  códigos nuevos (`rrhh.asistencia.feriados.{ver,crear,editar,eliminar}`),
  único permiso nuevo necesario. Reutiliza sin cambios
  `rrhh.asistencia.turnos.{ver,crear,editar,eliminar}` (existentes desde
  la matriz original de RRHH, nunca consumidos hasta ahora) para
  `rrhh.jornadas`/`rrhh.jornada_dias`, y `rrhh.expedientes.contratos.editar`
  (existente) para asignar jornada a un contrato — sin duplicar ningún
  código. Aprobado explícitamente por el usuario antes de aplicar.
- `20260907162929_fix_f1_4_feriados_admin_role_missing` — corrección el
  mismo día: la migración anterior asumía que el rol `admin` de RRHH
  recibe automáticamente los permisos nuevos de un dominio existente.
  Falso — verificado con una consulta real después de aplicar. Sin este
  fix, `admin` quedaba denegado (fail-closed) para feriados.
- `20260907163244_f1_4_rrhh_jornadas_minimas` — modelo mínimo de 4 tablas:
  - `rrhh.jornadas` / `rrhh.jornada_dias`: plantilla reutilizable + reglas
    por día (1=lunes..7=domingo), un único bloque entrada/salida por día
    (sin turnos nocturnos ni cruce de medianoche). Escritura directa
    protegida por RLS (mismo patrón que `rrhh.parametros_ley`).
  - `rrhh.contrato_jornadas`: histórico de asignación por rango de
    vigencia (`vigente_desde`/`vigente_hasta`), `EXCLUDE USING gist`
    (requiere `btree_gist`) contra solapamientos por `contrato_id`.
    Escritura SOLO vía `rrhh.fn_asignar_jornada_contrato` (cierra la
    vigencia abierta anterior y abre una nueva, atómicamente).
  - `rrhh.feriados`: catálogo por empresa, sin tipo/alcance ni pago
    (decisión de negocio pendiente).
  - RPC nuevas: `fn_asignar_jornada_contrato`, `fn_jornada_vigente_contrato`
    (interfaz de solo lectura para F1.5, sin motor de cálculo).
  - `rrhh.fn_activar_contrato` (`create or replace`, mismo tipo de
    retorno): ahora exige al menos una fila en `contrato_jornadas` para
    activar — decisión explícita del usuario (jornada obligatoria).
  - Estrategia de versionado: `jornada_dias` editable en vivo; la garantía
    de no alterar retroactivamente un período cerrado la da
    `contrato_jornadas` + que F1.5 deberá snapshotear las reglas del día
    en el momento del cálculo (mismo criterio que `planilla_detalles`).

Verificado con llamadas RPC reales (no solo `INSERT` crudo), simulando
`auth.uid()` vía `request.jwt.claims` (empleado/contrato/jornadas de
prueba, 0 filas antes y después): crear jornada → definir días → asignar a
contrato borrador → activar sin jornada rechazado → activar con jornada
aceptado (PIN generado) → jornada vigente por fecha resuelta correctamente
→ reasignación con vigencia histórica (cierra la anterior, abre la nueva,
sin sobreescribir) → solapamiento inválido rechazado (`EXCLUDE`) →
cross-company rechazado → usuario sin permiso rechazado (RPC y lectura) →
RLS directa (lectura e insert) rechazada sin permiso → jornada con
histórico protegida contra `DELETE` por FK → finalizar contrato conserva
el histórico de jornadas intacto → feriados CRUD + duplicado rechazado.
`get_advisors(security)`: sin exposición nueva a `anon`, solo los WARN ya
aceptados de `authenticated` (mismo patrón que el resto de RRHH).
`get_advisors(performance)`: solo INFO de FK sin índice de cobertura /
índice sin uso, misma deuda pre-existente ya documentada (sección 0.8 de
`IMPLEMENTATION_STATUS.md`), nada nuevo que bloquee.

**Gap de permisos detectado durante la UI, no cerrado en esta sesión**:
`gestor_expedientes` tiene `rrhh.expedientes.contratos.editar` (puede
asignar jornada vía RPC) pero NO `rrhh.asistencia.turnos.ver` (no puede
ver el listado de jornadas para elegir una en el selector de la UI) — la
matriz aprobada reutilizó `turnos.*` tal cual, sin extenderla a este rol.
Es una decisión de rol nueva, no cubierta por la aprobación de este Paso
Cero — queda señalada para aprobación aparte, no aplicada.

**No verificado en navegador/UI** — mismo `EPERM` de entorno ya
documentado (2026-09-05), reconfirmado en esta sesión. Verificación
equivalente ejecutada después del push a `main` (commit `a68c5e9`): build
real de Vercel para los 3 proyectos afectados (`nexo-rrhh`, `nexocore`,
`nexo-crm` — reconstruyen por el cambio en `packages/ui/Sidebar.tsx`),
los 3 en `readyState: READY`, sin `get_runtime_errors` nuevos en
`nexo-rrhh`. Frontend nuevo: `/rrhh/jornadas` (catálogo de jornadas +
días + feriados) y sección "Jornada" en `/rrhh/expedientes/[id]`
(asignar/reasignar por contrato). Verificado por revisión estática
cuidadosa del código + la verificación exhaustiva de esquema/RPC/RLS de
arriba + el build real de Vercel — no por interacción real en un
navegador.

## 2026-09-07 — F1.0 a F1.3 completas (auditoría, cierre D-06, Paso Cero, contratos, PIN contractual)

Contexto completo en [`IMPLEMENTATION_STATUS.md`](IMPLEMENTATION_STATUS.md)
sección 0 y en la sección "F1.0.1" agregada en esta misma fecha.

- **F1.0 no generó migraciones** — fue una auditoría de solo lectura contra
  `main`, `nexo-core` remoto y Vercel. El único hallazgo con acción
  inmediata fue de seguridad (D-06, ver abajo).
- **1 migración nueva, aplicada a `nexo-core` y verificada**
  (`20260907151106_revoke_validar_acceso_operativo_public_execute`, rama
  `docs/f1-0-auditoria-rrhh` → `main`):
  - Revoca `EXECUTE` de `anon` y `authenticated` sobre
    `public.validar_acceso_operativo(p_nombre_usuario text, p_pin text)` —
    el wrapper público del diseño de "PIN de doble propósito" (login
    operativo con el mismo PIN del kiosko), rechazado como arquitectura
    final por `PLAN_MAESTRO_IMPLEMENTACION_NEXO.md`/`DRIVER_ACCESS_AND_KIOSK.md`.
    Confirmado por búsqueda estática en todo el monorepo que no tiene
    ningún consumidor real en el código.
  - No reescribe la migración histórica `20260902000008` que la creó.
  - No elimina `rrhh.fn_validar_acceso_operativo` ni el wrapper público:
    ambas quedan marcadas explícitamente como deprecadas vía
    `comment on function`, pendientes de una migración de limpieza
    posterior y separada (junto con `rrhh.seguridad_accesos` y las
    columnas `nombre_usuario`/`user_id`/`pin_bloqueado`/`intentos_fallidos`
    de `rrhh.empleados`, que F1.1–F1.3 van a reemplazar).
  - Verificado post-aplicación con `has_function_privilege`: `anon` y
    `authenticated` → `false`; `service_role`/`postgres` → `true` (sin
    cambio, esperado). El advisor de seguridad
    "Public Can Execute SECURITY DEFINER Function" para esta función ya
    no aparece en `get_advisors(security)`.
  - Migración aplicada primero vía `apply_migration` (MCP de Supabase) y
    el archivo en `supabase/migrations/` escrito después usando el mismo
    `version` que Supabase asignó (`20260907151106`) — evita a propósito
    la divergencia de historial que ocurrió el 2026-09-05 (ver entrada de
    abajo), sin necesitar ninguna reparación posterior.
- **1 migración más, Paso Cero de permisos, aplicada y verificada**
  (`20260907151643_rrhh_contratos_permission_matrix`, rama
  `docs/paso-cero-matriz-contratos` → `main`), aprobada explícitamente
  por el usuario antes de cualquier tabla/UI de F1.1–F1.3:
  - Inserta 7 códigos nuevos en `core.permissions_catalog`, reutilizando
    el dominio `expedientes` ya existente:
    `rrhh.expedientes.contratos.{ver,crear,editar,activar,finalizar}`,
    `rrhh.expedientes.credenciales.{ver,regenerar}`.
  - Asigna en `core.app_role_permissions`: `admin` los 7;
    `gestor_expedientes` ver/crear/editar de contratos + ver de
    credenciales; `supervisor_asistencia` solo ver de credenciales;
    `especialista_planillas`/`consulta` ninguno de los 7.
  - No inserta `core.identidad.cuenta.*` (capacidad transversal de Core,
    diseño objetivo sin implementar) ni `flotilla.conductores.acceso.*`
    (eliminado de la propuesta — la provisión/bloqueo de identidad es
    exclusiva de `core.identidad`) — decisión explícita del usuario.
  - Verificado post-aplicación con una consulta directa a
    `core.app_role_permissions` filtrada por los 7 códigos: coincide
    exactamente con la tabla de asignación aprobada.
  - Mismo patrón de versión que la migración anterior: aplicada primero,
    archivo de Git escrito después con el `version` real (`20260907151643`).
- **2 migraciones más, F1.1 (Separar Expediente General/Laboral), aplicadas
  y verificadas** (rama `docs/f1-1-expediente-general-laboral` → `main`):
  1. `20260907152301_f1_1_separar_expediente_general_laboral`: columnas
     laborales/credenciales de `rrhh.empleados` (`puesto`, `departamento`,
     `fecha_ingreso`, `fecha_baja`, `estado`, `pin_hash`, `nombre_usuario`,
     `pin_bloqueado`, `intentos_fallidos`, `user_id`) quedan nullable donde
     aplicaba y marcadas `DEPRECADAS` vía `comment on column` — no se
     eliminan todavía. `estado` recibe nuevo default `'sin_contrato'`.
     `rrhh.fn_crear_empleado`/`public.crear_empleado` reemplazadas por una
     versión de firma reducida (solo Expediente General) — la firma
     anterior (13 parámetros) se elimina con `drop function`, no se edita
     in place (Postgres distingue funciones por firma).
  2. `20260907152500_f1_1_fix_empleados_estado_check`: corrección
     necesaria — el `CHECK` de `estado` no incluía `'sin_contrato'`.
     Detectada por una prueba de inserción/borrado antes de dar F1.1 por
     terminado, sin dejar ninguna fila real inválida.
  - Verificado: inserción de prueba (borrada en la misma sesión) confirma
    que un alta con solo datos generales queda con las columnas
    deprecadas en `null`/default; `rrhh.fn_registrar_marca_kiosko`
    (kiosko en producción) verificado intacto — sigue exigiendo
    `estado = 'activo' and pin_hash is not null` hasta que F1.3 lo
    reemplace por la validación contractual.
  - Frontend actualizado en el mismo cambio: formulario y listado de
    `/rrhh/expedientes` (ya no piden/muestran puesto, departamento,
    compensación, PIN, usuario), dashboard (`Empleados activos` →
    `Expedientes`). Tipos (`database.types.ts` de `apps/rrhh` y su
    espejo en `apps/crm`) actualizados a mano.
- **1 migración más, F1.2 (`rrhh.contratos` + compensación contractual),
  aplicada y verificada** (`20260907153604_f1_2_rrhh_contratos`, rama
  `docs/f1-2-rrhh-contratos` → `main`):
  - Tabla `rrhh.contratos` (Expediente Laboral): `borrador → activo →
    finalizado`, un solo contrato activo por empleado (unique index
    parcial), trigger `trg_validar_transicion_contrato` (defensa en
    profundidad: transiciones válidas + inmutabilidad de datos base
    fuera de `borrador`). RLS `ver`/`crear`/`editar` (editar solo en
    `borrador`), sin `DELETE`.
  - Tabla `rrhh.contrato_compensacion` (1:1 con el contrato, no el
    empleado — D-03), reutiliza `rrhh.expedientes.compensacion.ver/editar`
    (permisos existentes, sin crear uno nuevo).
  - RPC `rrhh.fn_crear_contrato`/`fn_editar_contrato`/`fn_activar_contrato`/
    `fn_finalizar_contrato` + wrappers `public.*` (`authenticated`-only).
    `fn_activar_contrato`/`fn_finalizar_contrato` son solo transición de
    estado por ahora — F1.3 las reemplaza para generar/revocar el PIN.
  - Verificado con inserción/transición/borrado de prueba (0 filas antes
    y después): transición inválida rechazada, edición fuera de
    `borrador` rechazada, segundo contrato activo rechazado, reapertura
    de contrato finalizado rechazada. `pg_policies`/`has_function_privilege`
    confirmados; `get_advisors(security)` sin exposición nueva a `anon`.
  - Frontend nuevo: `/rrhh/expedientes/[id]` (ficha del empleado +
    Expediente Laboral), listado enlaza a cada ficha y muestra contrato
    activo real. **No verificado en navegador** — mismo `EPERM` de
    entorno ya documentado (2026-09-05), reconfirmado con 
ext dev` y
    `tsc --noEmit` hoy; sustituido por revisión estática cuidadosa.
- **3 migraciones más, F1.3 (PIN exclusivamente contractual) + 2
  correcciones, aplicadas y verificadas END-TO-END** (no solo esquema —
  ver abajo), rama `docs/f1-3-pin-contractual` → `main`:
  1. `20260907154715_f1_3_pin_exclusivamente_contractual`: tabla nueva
     `rrhh.contrato_credenciales` (1:1 con el contrato, RLS sin
     policies, sin GRANT de SELECT a nadie); `rrhh.fn_activar_contrato`
     reemplazada (cambia el tipo de retorno — requirió DROP) para
     generar el PIN; `rrhh.fn_finalizar_contrato` extendida para
     revocarlo; `rrhh.fn_regenerar_pin_contrato` y
     `rrhh.fn_estado_credencial_contrato` nuevas; `rrhh.fn_registrar_marca_kiosko`
     (kiosko en producción) reescrita para validar contra la nueva
     credencial en vez de `rrhh.empleados.pin_hash/estado/pin_bloqueado`
     — misma firma, mismo rate-limit, misma lógica anti-enumeración.
  2. `20260907154858_fix_crear_empleado_returning_ambiguous` y
     `20260907154942_fix_crear_contrato_returning_ambiguous`: **2 bugs
     reales encontrados durante la verificación end-to-end** — ni
     `fn_crear_empleado` (F1.1) ni `fn_crear_contrato` (F1.2) pudieron
     ejecutarse NUNCA desde que se crearon (`RETURNING` sin alias de
     tabla, ambiguo contra las variables `OUT` de `RETURNS TABLE`). Las
     pruebas de esquema de F1.1/F1.2 no lo detectaron porque hacían
     `INSERT` crudo, sin pasar por la función real.
  - **Verificación end-to-end real** (simulando `auth.uid()` vía
    `request.jwt.claims` contra un usuario `owner` real y datos de
    prueba borrados al final, 0 filas antes/después): crear empleado →
    crear contrato con salario → activar (PIN devuelto una vez) →
    marcar entrada → marcar salida → ver estado de credencial (sin
    PIN) → regenerar PIN → PIN anterior rechazado → PIN nuevo acepta
    marca → finalizar contrato → PIN rechazado después de finalizar.
    Negativos: usuario sin permiso rechazado; empresa cruzada rechazada.
  - `get_advisors(security)` sin exposición nueva a `anon` (solo los WARN
    esperados de `authenticated`, mismo patrón ya aceptado).
  - Frontend: reveal-once de PIN en "Activar"/"Regenerar PIN", badge de
    estado de credencial, en `contratos-panel.tsx` + `actions.ts`.
  - D-02 y D-06 quedan completamente cerrados (no solo el componente de
    seguridad inmediato de F1.0.1).

## 2026-09-05 — Auditoría de seguridad de RRHH cerrada en producción + fix de ruteo del kiosco

Continuación directa de la fase anterior: cierre de los riesgos de
seguridad documentados el 2026-09-04 (funciones internas de RRHH
ejecutables por `anon`), más un bug de ruteo real encontrado al
verificar el kiosco en producción. Detalle completo, matrices de
prueba y evidencia paso a paso en
[SECURITY_VALIDATION_HANDOFF.md](SECURITY_VALIDATION_HANDOFF.md).

- **5 migraciones nuevas, aplicadas a `nexo-core` y verificadas**
  (`20260905000001` a `20260905000005`, rama
  `security/rrhh-audit-hardening`, mergeada a `main` en el commit
  `ac9a487`):
  1. `revoke_rrhh_internal_anon_execute` — revoca `EXECUTE` de `anon` en
     `rrhh.fn_crear_empleado`, `rrhh.fn_set_pin_empleado` y
     `public.get_visible_apps`.
  2. `kiosko_minimize_exposure_and_bloqueo_check` — `fn_registrar_marca_kiosko`
     deja de devolver `empleado_nombre` (dato personal) y respeta
     `pin_bloqueado`.
  3. `rrhh_rls_wrap_auth_uid_initplan` — corrige el patrón de
     rendimiento `auth_rls_initplan` en las 25 policies de `rrhh`
     (`(select auth.uid())`), sin cambiar autorización.
  4. `revoke_rrhh_internal_public_execute` — corrige un fallo confirmado
     por validación local previa: revoca `EXECUTE` de `PUBLIC` (no solo
     `anon`) en `fn_crear_empleado`/`fn_set_pin_empleado`, ya que ambas
     conservaban el grant al pseudo-rol `PUBLIC` desde su creación.
  5. `rrhh_public_auth_hardening` — nueva tabla `rrhh.kiosko_rate_limits`
     (rate-limit persistente del kiosko: 8 fallos/1min → bloqueo 5min,
     sin datos personales, RLS sin policies); corrige un bug real de
     `RAISE EXCEPTION` post-escritura en `fn_validar_acceso_operativo`
     (y por diseño en `fn_registrar_marca_kiosko`) que impedía que el
     bloqueo a 3 fallos consecutivos persistiera; cierra `EXECUTE`
     directo de ambas funciones internas para todos los roles.
- **Validación local con Docker no se pudo ejecutar** (el entorno de la
  sesión no tenía WSL2/Docker operativo pese a instalarlo y reiniciar —
  se confirmó que la sesión corre en un entorno distinto a la máquina
  física del usuario). El usuario autorizó explícitamente aplicar
  directo a `nexo-core`, dado que `20260905000004` ya corregía un
  fallo real ya confirmado por una validación local anterior. Se
  verificó en su lugar, contra producción: privilegios (`has_function_privilege`
  antes/después para las 4 funciones internas + 2 wrappers públicos),
  RLS y ausencia de acceso directo en `rrhh.kiosko_rate_limits`, y
  `get_advisors` (security y performance) sin los WARN que esta
  auditoría vino a cerrar.
- **Divergencia de historial de migraciones, diagnosticada y reparada**:
  las 5 migraciones se aplicaron con `apply_migration` (MCP de
  Supabase), que registra su propio timestamp de versión en vez del que
  lleva cada archivo — el historial remoto quedó con 5 versiones
  auto-generadas (`20260905072348` etc.) sin correspondencia con
  `main`. Reparado con una transacción de `UPDATE` sobre
  `supabase_migrations.schema_migrations` (verificación interna con
  `ROLLBACK` automático ante discrepancia, sin tocar el esquema ni
  volver a ejecutar SQL de las migraciones) — historial remoto alineado
  1:1 con los 5 archivos de `main`.
- **Bug de ruteo real encontrado al verificar el kiosco en producción**:
  `/rrhh/kiosco` redirigía a `/login` del panel pese a que
  `apps/rrhh/src/proxy.ts` ya excluía `/kiosco` de su propio guard de
  sesión correctamente. Causa: `apps/nexo/src/proxy.ts` (zona raíz de
  Multi-Zones) interceptaba `/rrhh/*` antes de que el rewrite lo
  entregara a la zona `rrhh` — su `matcher` excluía `crm` de su guard
  pero nunca `rrhh`, pese a que esa zona tiene el mismo patrón de
  middleware propio. Corregido agregando `rrhh` a la misma exclusión
  (rama `fix/rrhh-kiosco-public-route`, mergeada a `main` en el commit
  `a3bcc5d`). Verificado en producción: `/rrhh/kiosco` carga sin
  sesión, `/rrhh/expedientes` sigue redirigiendo a login, `/crm` y `/`
  sin regresión.
- **Qué sigue sin cambiar**: el motor de consolidación de horas y el
  generador de planillas (pasos 3 y 4 del flujo del MVP) siguen sin
  construir — ninguno de estos dos cierres declara el MVP de RRHH
  completo. Ver [RRHH_MVP.md](RRHH_MVP.md).

## 2026-09-02 a 2026-09-04 — Adaptación de RRHH: schema, permisos, kiosco, despliegue en producción

Fase 6a del roadmap. A diferencia de CRM (migración de datos de un
proyecto Supabase existente), RRHH se **diseñó de cero** para Nexo —
Gestor360/`marcacion-grupo-ct` (importado el 2026-08-29) quedó como
referencia de producto, no como fuente de esquema a migrar 1:1.

- **Paso Cero cumplido**: matriz de permisos de RRHH (37 códigos bajo
  `rrhh.*`, dominios `expedientes`/`asistencia`/`planillas`) diseñada y
  aprobada antes de crear ninguna tabla —
  [`20260902000005_rrhh_permissions_and_roles.sql`](../supabase/migrations/20260902000005_rrhh_permissions_and_roles.sql).
  Roles con alcance por app (`app_scoped_roles`, extensión de `core`
  aplicada el mismo día): `admin`, `supervisor_asistencia`,
  `gestor_expedientes`, `especialista_planillas`.
- **Schema `rrhh` aplicado**
  ([`20260902000006`](../supabase/migrations/20260902000006_rrhh_schema_and_tables.sql)):
  8 tablas base (`empleados`, `empleado_compensacion`,
  `kiosko_dispositivos`, `asistencia_marcas`, `parametros_ley`,
  `seguridad_accesos`, `planillas`, `planilla_detalles`), 2 tablas de
  hechos particionadas por mes desde el día uno (`asistencia_marcas`,
  `seguridad_accesos`), RLS en las 8 con policies contra
  `core.has_permission()`. Extendido el mismo día
  ([`20260902000008`](../supabase/migrations/20260902000008_rrhh_nicaragua_and_contracts.sql))
  con parámetros de ley nicaragüense (INSS/INATEC, versionados), modalidad
  de contrato, y credenciales operativas (`nombre_usuario` + PIN
  compartido con el kiosko) para un futuro módulo móvil de choferes.
  Detalle completo de tablas y funciones en [DATABASE.md](DATABASE.md).
- **Kiosco de marcación** (`/rrhh/kiosco`): numpad de PIN, sin sesión de
  Supabase Auth a propósito (`rrhh.fn_registrar_marca_kiosko`,
  `SECURITY DEFINER`, callable por `anon`). Rate-limiting básico a nivel
  de Server Action (ventana de 60s, máx. 8 intentos, debounce de 600ms)
  además del bloqueo a 3 fallos consecutivos dentro de la función SQL.
- **UI de expedientes** (`/rrhh/expedientes`, `/rrhh/expedientes/nuevo`):
  listado y alta de empleados vía `rrhh.fn_crear_empleado`, que
  autogenera `nombre_usuario` y PIN si no se proveen y los devuelve en
  texto plano una única vez (gateado además por
  `rrhh.expedientes.compensacion.ver` para mostrar el PIN).
- **Habilitado en el panel**: `core.company_apps` con `rrhh` en
  `enabled = true`
  ([`20260903000001_enable_rrhh_company_app.sql`](../supabase/migrations/20260903000001_enable_rrhh_company_app.sql)).
- **Tres bugs de despliegue distintos, diagnosticados con datos (no
  supuestos) y corregidos en orden**, ya incorporados como checklist
  permanente en [`CLAUDE.md`](../CLAUDE.md) punto 5 de la regla crítica:
  1. `DNS_HOSTNAME_RESOLVED_PRIVATE` en `/rrhh` — `RRHH_APP_URL` faltaba
     en el allowlist `tasks.build.env` de `turbo.json`, Turborepo la
     descartaba en build y el rewrite caía a `localhost`. Corregido
     agregándola al allowlist (`769bb87`).
  2. 500 genérico en `/rrhh/dashboard` ("Falta NEXO_COMPANY_ID") — la
     variable existía en el proyecto Vercel `nexocore` pero **no en
     `nexo-rrhh`** (cada proyecto Vercel tiene sus propias Environment
     Variables, no se comparten). Se perdió tiempo real porque el
     usuario editó la variable en el proyecto equivocado dos veces antes
     de confirmarlo mirando directamente el dashboard de `nexo-rrhh`.
  3. 500 en `/rrhh/dashboard` con mensaje vacío tras resolver (2) —
     `42501 permission denied for schema rrhh`. RLS estaba correcto pero
     la migración que creó el schema nunca hizo el `GRANT USAGE`/`SELECT`
     base de Postgres para `authenticated` (mismo bug ya resuelto una vez
     para `crm` en `20260830000010`, nunca replicado al crear `rrhh`).
     Verificado con `has_schema_privilege()` y un `curl` directo con
     `Accept-Profile: rrhh` (`42501`, no un 404 — descarta que faltara
     exponer el schema) antes de escribir el fix. Corregido en
     [`20260904000001_fix_rrhh_schema_grants.sql`](../supabase/migrations/20260904000001_fix_rrhh_schema_grants.sql),
     aplicado al remoto y confirmado con `get_runtime_errors` limpio.
- **Provisión operativa post-fix (2026-09-04)**: creado el primer
  `rrhh.kiosko_dispositivos` real (`901098a8-dac4-4185-aa1c-530ab69b768b`,
  "Kiosko principal", sucursal Materiales JCastillo) para poder configurar
  `NEXO_KIOSKO_ID` en el proyecto `nexo-rrhh` y habilitar la marcación
  física. Pendiente de confirmar en producción tras esa configuración.
- **Auditoría de seguridad (`get_advisors`, 2026-09-04)**: confirmó que
  `rrhh.fn_crear_empleado` y `rrhh.fn_set_pin_empleado` (las funciones
  internas, no sus wrappers en `public`) son ejecutables directamente por
  `anon` — inconsistente con el `REVOKE` explícito que sí tienen sus
  wrappers. Riesgo mitigado en la práctica por el chequeo interno de
  `core.has_permission()`, pero **no corregido todavía** — ver
  "Riesgos de seguridad" en [DATABASE.md](DATABASE.md) y
  [RRHH_MVP.md](RRHH_MVP.md).
- **Qué falta validar** (por eso RRHH figura como infraestructura lista
  pero MVP sin validar en [ROADMAP.md](ROADMAP.md)): motor de
  consolidación de marcas → horas trabajadas, generador de planilla de
  prueba (`/rrhh/planillas` sigue siendo un placeholder explícito en el
  código), cero empleados/marcas/planillas reales cargados a esta fecha,
  y el recorrido completo con los 3 roles (admin/operador/sin permiso)
  sin ejecutar. Detalle en [RRHH_MVP.md](RRHH_MVP.md).

## 2026-08-30 — Diseño UX/UI (investigación SAP Fiori + Odoo) aplicado al panel

- Investigación pedida por el usuario, documentada completa en
  [planning/DISENO_UX_UI.md](planning/DISENO_UX_UI.md): shell bar +
  agrupación por categoría (Fiori Launchpad/Spaces), estética plana y
  colores por categoría (Odoo).
- `packages/ui` dejó de estar vacío: `ShellBar` (barra superior persistente)
  y `category-colors.ts` (tokens de color por categoría, no por módulo).
- `apps/nexo`: shell bar agregado, grilla agrupada por categoría (antes era
  plana), tipografía Inter para el chrome del panel.
- Nueva función `public.get_visible_apps` corregida: excluía mal a `nexo`
  de su propia lista (se listaba a sí mismo, un tile circular apuntando a
  "/") — detectado al escribir el código del home, corregido con una
  migración nueva antes de verificarlo en vivo.
- **Verificación real, no solo "debería compilar"**:
  - `pnpm install` de nuevo (dependencia nueva `@nexo/ui` en `apps/nexo`).
  - 
ext build` de `apps/nexo` y de `apps/crm` — ambos compilan y tipan
    limpio.
  - En el camino, 
ext build` de `apps/crm` encontró un bug real de tipos
    en `packages/permissions` (heredado de la Fase 3, no detectado hasta
    ahora porque nunca se había corrido un build real de esa app): el tipo
    `RpcClient.rpc()` pedía un `Promise` estricto pero `supabase.rpc()`
    devuelve un `PostgrestFilterBuilder` (`PromiseLike`, no `Promise`
    completo) — corregido.
  - `turbo run build` de **todo el monorepo** detectó una colisión real:
    `apps/rrhh` y `apps/web-corporativo` tenían el mismo `name` de paquete
    (`"web"`, heredado sin tocar de sus `create-next-app` originales) —
    renombrados a `rrhh` y `web-corporativo`.
  - Resultado final de `turbo run build`: **4 de 5 apps compilan limpio**
    (`web-corporativo`, `crm`, `nexo`, `transporte-app`/flotilla). `rrhh`
    falla por falta de variables de entorno de su propio Supabase original
    (`ofeuzkwjhmfsazqfyutu`) — **esperado**, esa app no se ha tocado desde
    el import crudo, le toca configurarse en su propia fase (6), no antes.
- **No verificado visualmente todavía**: la grilla de módulos con datos
  reales (tiles agrupados por categoría) — requiere un usuario autenticado
  con membresía en `core.company_memberships`, que no existe todavía (ver
  nota de la Fase 4 más abajo). Sí se verificó que compila y tipa sin
  errores.

## 2026-08-30 — Fase 4: panel `apps/nexo`, verificado en vivo

- Se construyó `apps/nexo`: login (Supabase Auth), middleware de sesión,
  home (`/`) que llama a `public.get_visible_apps(companyId)` para armar la
  grilla de módulos — nunca hardcodea qué mostrar.
- Nueva función `public.get_visible_apps`: cruza `core.company_apps`
  (contratado) y `core.has_permission` (autorizado). Mismo patrón que
  `has_permission` — wrapper en `public` para no depender de exponer el
  schema `core`.
- `next.config.ts` de `apps/nexo` implementa el rewrite de Multi-Zones
  hacia `/crm` (el único módulo adaptado hasta ahora).
- **Se corrió de verdad, no solo se escribió**: `pnpm install` en todo el
  monorepo (vía 
px pnpm@9`, porque no había pnpm global instalable sin
  permisos de administrador), y ambas apps (`crm` en :3001, `nexo` en :3000)
  levantadas con el Browser pane. Verificado en vivo:
  - `http://localhost:3000/` → redirige a `/login` sin sesión (middleware
    funcionando).
  - Login de Nexo con credenciales falsas → `"Correo o contraseña
    incorrectos."`, confirmando conexión real end-to-end con Supabase Auth
    de `nexo-core` (no un error de red).
  - `http://localhost:3000/crm` → la URL se queda en el puerto 3000 (un
    solo dominio) pero el contenido servido es el login real de la app CRM
    (`/crm/login`, con su branding y su propio middleware de auth) — **el
    rewrite de Multi-Zones funciona de punta a punta**.
  - Consola del navegador sin errores en ninguna de las dos pantallas.
- Se creó/corrigió `.claude/launch.json` en el directorio de trabajo
  principal (`jcastillo`, no `Nexo` — el Browser pane lee el launch.json
  del working directory principal de la sesión) con configuraciones `crm` y
  `nexo` que corren `pnpm --filter <app> dev` con `pnpm -C` apuntando al
  monorepo real.
- **No verificado todavía**: la grilla de módulos con un usuario real
  autenticado (`core.company_memberships` está vacío — hace falta crear un
  usuario y una membresía manualmente, ver `apps/nexo/README.md`).

## 2026-08-30 — Fase 3: adaptar `web-corporativo` + `crm`

- **`web-corporativo`**: no requirió ningún cambio. Es contenido estático,
  vive en el dominio raíz `materialesjcastillo.com` (no en Multi-Zones), no
  usa Supabase. Se documentó ese hecho en su README para que quede
  explícito que "no adaptado" no es lo mismo que "pendiente".
- **`crm`**: adaptado de punta a punta.
  - `next.config.ts`: `basePath: "/crm"` + `transpilePackages: ["@nexo/permissions"]`.
  - Cliente/servidor de Supabase re-apuntados a `nexo-core`
    (`yrbjlmiqhkyxtlcerowh`), en vez del proyecto original
    `materiales-jcastillo-crm` (`arzadwxsifnaolvfcvqk`).
  - Las 3 acciones de escritura (`createCliente`, `updateCliente`,
    `deleteCliente`) llaman a `requirePermission()` de `@nexo/permissions`
    antes de tocar la base de datos.
  - Se agregó `core.company_memberships` + la función única
    `core.has_permission()` (gap detectado al implementar: el diseño
    original de la Fase 2 no tenía de dónde sacar el rol owner/admin).
    **El usuario pidió resetear el schema `core` recién creado (sin datos
    reales) para incorporar esto desde cero en vez de parchearlo** — se hizo
    con `drop schema core cascade` + recrear, confirmado de bajo riesgo
    porque `core` no tenía ningún dato real todavía.
  - `crm.clientes` quedó con RLS real: las 4 policies (ver/crear/editar/eliminar)
    llaman a `core.has_permission()` directo — la protección de datos no
    depende solo de que el código de la app se acuerde de chequear.
  - `get_advisors` detectó y se corrigieron 2 warnings: `search_path`
    mutable en una función nueva, y el RPC `public.has_permission`
    ejecutable por el rol `anon` sin sesión (se revocó de `PUBLIC`, se dejó
    solo para `authenticated`).
- **Resuelto**: el clasificador de permisos de Claude Code denegó
  `restore_project` sobre el proyecto pausado `arzadwxsifnaolvfcvqk`
  (materiales-jcastillo-crm), así que no se pudo inspeccionar en vivo. El
  usuario confirmó que todo lo que había ahí era de prueba — **no hace
  falta copiar ningún dato**. La estructura de `crm.clientes` recreada a
  partir de `database.types.ts` (2026-08-29) es la definitiva, no un
  placeholder a completar después.
- **Pendiente manual, fuera del alcance de las herramientas MCP**: exponer
  el schema `crm` en Settings → API → Data API → Exposed schemas del
  proyecto `nexo-core`. Sin esto, `apps/crm` no puede conectarse de verdad
  todavía.
- **Sin verificar**: no se corrió un dev server real (no existe `apps/nexo`
  todavía para probar Multi-Zones de punta a punta) — el comportamiento de
  `proxy.ts`/`middleware.ts` con `basePath` activo queda pendiente de
  confirmar en la Fase 4.

## 2026-08-30 — Fase 2: proyecto `nexo-core` + schema `core` + norma v3.0

- Proyecto Supabase `nexo-core` creado (ref `yrbjlmiqhkyxtlcerowh`,
  org `Grupo CT`, `us-east-1`, plan gratuito).
- Aplicadas las migraciones `core_schema` y `core_seed_apps`: 7 tablas del
  schema `core`, trigger `trg_seed_module_permission`, RLS habilitado en
  las 7 tablas, `core.apps` sembrada con los 4 módulos actuales.
- Verificado en vivo: el trigger creó solo los 4 permisos de visibilidad
  (`nexo.ver_modulo`, `rrhh.ver_modulo`, `flotilla.ver_modulo`,
  `crm.ver_modulo`) sin ningún INSERT manual.
- `get_advisors` (security): sin alertas más allá de "RLS sin policy" en
  las 5 tablas que se dejaron así a propósito (provisional hasta Fase 3+).
- Se construyó el motor de permisos fail-closed en
  `packages/permissions/index.ts` (`hasPermission`/`requirePermission`):
  un `permission_code` no registrado en `core.permissions_catalog` deniega
  siempre, incluso para owners/admins.
- Se agregó `CLAUDE.md` en la raíz del repo con la regla obligatoria de
  permisos, para que se aplique automáticamente en cualquier sesión de
  Claude Code que trabaje en este monorepo (pedido explícito del usuario:
  "esto tiene que ser algo que se dispare siempre").
- Pendiente: nada de esto está conectado todavía a ningún `apps/<módulo>`
  real — es la base, la integración es la Fase 3+.

## 2026-08-29 — Import de código real (git subtree, historial preservado)

Se trajo el código de los 4 productos existentes a sus carpetas en `apps/`,
usando `git subtree` para conservar el historial de commits de cada uno
(decisión tomada con el usuario ese mismo día). **Solo se importó el
código** — nada de Multi-Zones (`basePath`/`rewrites`), nada de Supabase
(`nexo-core` no existe todavía), nada de adaptación de permisos. Eso es la
siguiente fase.

| Módulo | Origen | Método | Commits traídos |
|---|---|---|---|
| `apps/web-corporativo` | `WEB Corporativo jcastillo/apps/web` | `git subtree split --prefix=apps/web` + `subtree add` | 3 |
| `apps/crm` | `WEB Corporativo jcastillo/apps/crm` | `git subtree split --prefix=apps/crm` + `subtree add` | 1 |
| `apps/flotilla` | `Desktop/Transporte` (repo completo, rama `master`) | `git subtree add` directo | historial completo de Ruta360 |
| `apps/rrhh` | `jcaatillo/marcacion-grupo-ct`, solo la carpeta `web/` (clonado a una carpeta temporal, ya eliminada) | `git subtree split --prefix=web` + `subtree add` | historial completo de `web/` |

Notas:

- El `docs/` en la **raíz** de `marcacion-grupo-ct` (`business_rules.md`,
  `database.md`, `repository_map.md`, minúsculas) **no se trajo** — parecía
  superado por el `docs/` propio de `web/` (`BUSINESS_RULES.md`,
  `DATABASE.md`, etc., mayúsculas), que sí viajó dentro de `apps/rrhh/docs/`.
  Si algo de esos 3 archivos viejos tenía información que no esté en la
  versión nueva, falta rescatarlo a mano.
- Quedan dos remotes en este repo apuntando a las carpetas locales de los
  proyectos originales, para poder traer fixes futuros mientras dure la
  transición (`git subtree pull --prefix=apps/<modulo> <remote> <rama>`):
  - `ruta360` → `Desktop/Transporte` (rama `master`, sin split, se puede
    hacer `pull` directo)
  - `materiales-jcastillo` → `WEB Corporativo jcastillo` (para `crm`/`web-corporativo`
    hay que **regenerar el split** — `git subtree split --prefix=apps/crm -b split-crm`
    de nuevo en ese repo — antes de poder hacer `pull`, porque un subfolder-split
    no seatualiza solo)
  - No quedó remote para `rrhh` (se clonó a una carpeta temporal ya borrada);
    para traer fixes futuros de Gestor360 hay que re-clonar
    `jcaatillo/marcacion-grupo-ct` y repetir el split de `web/`.
- Verificado: ningún `node_modules/` ni `.next/` quedó commiteado en ninguno
  de los 4 imports (los `.gitignore` de origen ya los excluían). Tamaño
  final de `.git`: ~2.4 MB.

## 2026-08-29 — Repo creado

- Se crea el repositorio local `Nexo` (`C:\Users\Gerencia\Desktop\Nexo`),
  esqueleto de monorepo Turborepo + pnpm workspaces.
- Se copian los documentos de planeación
  (`PLAN_UNIFICACION_NEXO.md`, `PROPUESTA_MARCA_MODULOS.md`) a
  `docs/planning/`.
- Ningún módulo migrado todavía. Ningún proyecto Supabase (`nexo-core`)
  provisionado todavía.
- Pendiente: crear el repositorio remoto en GitHub cuando el usuario lo
  indique (aún no solicitado).

## Próximos pasos pendientes de ejecutar

1. Provisionar el proyecto Supabase `nexo-core` y las tablas de `core.*`.
2. Elegir el módulo piloto (`web-corporativo` recomendado, menor riesgo) y
   migrarlo completo (app + datos) para validar el patrón Multi-Zones de
   punta a punta.
3. Construir la app `nexo` (panel) real sobre ese primer módulo migrado.

## RRHH P2 — archivo pendiente de aplicar
20261017131040_rrhh_p2_pin_unico_empresa.sql. Verificar definiciones sin random() y con advisory lock; probar activación/regeneración y concurrencia P7. Rollback: corregir hacia adelante conservando hashes; no volver al generador inseguro.

## RRHH P3 — pendiente de aplicar (2026-10-16)
20261017131113_rrhh_p3_marca_contrato.sql pendiente. Postcheck: columna NOT NULL, FK validada y authenticated sin INSERT/UPDATE/DELETE; verificar tambien particiones. Rollback: conservar vinculos e historia, corregir hacia adelante.

## RRHH P4 — preparado, sin aplicar
20261017131132_rrhh_p4a_kiosko_solicitudes.sql y 20261017131202_rrhh_p4b_marca_atomica_idempotente.sql pendientes. Verificar cuatro particiones, registro y grants, firma vieja ausente y nueva anon-callable. Rollback: preservar marcas/solicitudes; corregir hacia adelante sin restaurar firma de dos argumentos. Requiere desplegar cliente nuevo tras aplicar P4b.

## RRHH P6 — preparado, sin aplicar
20261017131221_rrhh_p6_consultar_marcas.sql pendiente. Postcheck: anon sin EXECUTE, authenticated con EXECUTE; interno restringido, autorizado ve solo su empresa y no autorizado denegado. Rollback: retirar pagina/wrapper de lectura sin tocar marcas ni vinculos.

## RRHH — entrega local 2026-10-16
Entrega solo de archivos: ninguna migración aplicada en esta sesión. Confirmar versiones remotas antes de aplicar. Orden, postchecks y rollback en el paquete.
[Paquete único](RRHH_PAQUETE_OPERADOR.md).
