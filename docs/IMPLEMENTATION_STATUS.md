# Nexo — Estado Vivo de Implementación (dashboard)

**2026-10-24 — Flotilla EN PRODUCCIÓN (PR #51, `a43364b`) y E2 (esquema de Entregas) APLICADO en `nexo-core`.**
- `nexo-flotilla` READY. En el dominio público, `/flotilla` abre el Dashboard con la sesión del owner y el menú desplegable funciona. Sin sesión, manda al login del panel.
- `20261024140400` + `20261024140609`: schema `flotilla` cerrado (solo RPC) con 21 tablas, 3 de ellas hechos particionados. Invariantes en la base: sin sobrecomprometer la factura, sin doble despacho, una línea en un solo recorrido activo, transiciones, bitácora inmutable e idempotencia ([plan 22 §21](plan/22-flotilla-entregas.md)). 0 FK sin índice.
- PGlite en verde (`test:flotilla:e2`, dentro de `test:db`), con la mutación detectada. Poscheque y advisors remotos revisados.
- Vercel: proyecto `nexo-flotilla` (Root Directory `apps/flotilla`) y `FLOTILLA_APP_URL` en `nexocore` (Production). Los 7 proyectos de `main` quedaron READY ([log](status-log/2026-10-24-flotilla-e2-esquema.md)).
- Falta la prueba con dos sesiones concurrentes y E3 (RPC y pantallas de órdenes).
[Detalle](status-log/2026-10-24-flotilla-e2-esquema.md).

**2026-10-23 — Flotilla: Entregas. Paso Cero APLICADO en `nexo-core` (`20261024034727`); zona `/flotilla` adaptada en local (E1).**
- Pedido del usuario: implementar la especificación de Entregas y dejar Flotilla lista ([plan 22](plan/22-flotilla-entregas.md)).
- E0: `flotilla` existe en el catálogo pero **no está habilitada para la empresa**; no hay schema, tablas ni proyecto de Vercel.
- Paso Cero: 35 códigos de 4 segmentos y 6 plantillas; poscheque remoto con los conteos esperados.
- E1: Ruta360 retirado; `nexo-flotilla` con `basePath`, login único, `NexoShell`, permisos y menú; rewrite `/flotilla` en el panel; Flotilla entra al gate de lint. typecheck, lint y build en 0; sin sesión manda al login del panel.
- Habilitada para la empresa (`20261024035935`): el owner entra en local y ve el Dashboard. Se corrigió el `matcher` del proxy del panel, que no excluía `/flotilla` y provocó un 429 de Auth que cerró la sesión local.
- Falta: comprobar el menú desplegable tras volver a iniciar sesión, E2 (esquema) y el proyecto de Vercel. Sin commit.
[Detalle](status-log/2026-10-23-flotilla-entregas-e0.md).

**2026-10-23 — Panel de plataforma (super admin): Paso Cero APLICADO en `nexo-core` (`20261024033541`).**
- Pedido del usuario: crear empresas, asignarles módulos y un cupo de usuarios ([plan 21](plan/21-plataforma-empresas.md)).
- Decisiones del usuario:
  - un usuario puede estar en varias empresas y elige una al entrar;
  - roles y apps por empresa;
  - el super admin puede entrar a cualquier empresa, con auditoría;
  - el primer administrador se crea en el alta;
  - el cupo cuenta los usuarios activos.
- 9 códigos `nexo.plataforma.*`. Precheck en 0; poscheck con 9 códigos de 4 segmentos y 0 asignaciones; advisors sin hallazgos nuevos.
- **Divergencia:** el código usa una sola empresa (`NEXO_COMPANY_ID`). La etapa 3 la toma de la cookie de empresa activa en las 6 zonas.
- Transitorio: los códigos aparecen en el editor de roles de la empresa, pero nada los evalúa. Sin esquema, sin código y sin commit.
[Detalle](status-log/2026-10-23-plataforma-paso-cero.md).

**2026-10-22 — Planilla: techo del INSS por persona en el mes, APLICADO en `nexo-core` (`20261022034035`).**
- Corrige el hallazgo P1 de la revisión del PR #50: el techo del INSS se topaba por quincena, con la mitad, y un mes con quincenas desiguales cotizaba de menos.
- **Regla, aprobada por el usuario:** techo acumulado del mes. Ninguna planilla cotiza más de lo devengado ni deja un neto negativo. Por encima del techo, la 1.ª quincena cotiza más que la 2.ª. Se descartó el ajuste en la 2.ª quincena porque dejaba netos negativos.
- **Verificación:** `test:rrhh:planilla` con 17 OK y la mutación detectada; dos rondas de revisión; dos ensayos revertidos; poscheque remoto con la huella igual a la local. Advisors sin cambios.
- Hoy no cambia ningún cálculo: no hay planillas y ningún contrato activo cotiza INSS.
[Detalle](status-log/2026-10-22-planilla-techo-inss.md).

**2026-10-22 — Planilla PL2b, PL2c y pantallas: APLICADAS en `nexo-core` (9 migraciones); pantallas en el PR #50, todavía sin fusionar.**
- Paso Cero de PL2b (`20261021235639`): `liquidaciones.pagar` y `.anular`, solo admin (27 códigos).
- PL2b en 5 partes (`20261022000001` a `20261022001314`): vacaciones, préstamos, embargos, aguinaldo, liquidación como documento, pasivo y provisiones (particionadas). PL2c en 3 partes (`20261022001530` a `20261022001922`): detalle, comparación, régimen, simulador, conceptos, tipos, tabla de IR, declaraciones e importación desde Asistencia.
- Antes de aplicar: dos rondas de revisión por migración, `test:rrhh:planilla` en PGlite con código 0 y un ensayo revertido por parte con datos reales (quincena, aguinaldo, liquidación, préstamo, embargo, provisiones, RLS y Asistencia). Las 79 funciones de planilla son idénticas en remoto y en local; advisors sin hallazgos nuevos.
- Pantallas: 40 rutas bajo `/rrhh/planillas` (Nómina, Prestaciones, Análisis y Configuración); typecheck, lint y build de `rrhh` en 0. **Sin recorrido visual con sesión.**
- Bloqueo práctico: solo el owner tiene permisos de Planilla y, por la separación de funciones, no puede aprobar lo que calcula; hace falta una segunda persona aprobadora.
[Detalle](status-log/2026-10-21-planilla-pl2b-pl2c-pantallas.md).

**2026-10-21 — Planilla PL2a: esquema y motor de cálculo en RPC, APLICADA en `nexo-core` (`20261021191441`).**
- Migración `20261021191441`:
  - régimen por contrato con vigencia, 16 conceptos, planillas por línea y novedades particionadas;
  - 12 RPC `public.planilla_*` (crear, calcular, aprobar, pagar, anular, novedades, régimen, antigüedad, parámetros y simulador de liquidación);
  - INSS patronal en 21.5%, los 14 feriados de 2026 y los contratos activos en frecuencia quincenal.
- Hay 9 decisiones del usuario, todas en el [plan 20 §3.1](plan/20-planilla.md): aguinaldo ene–dic, aprobación estricta, IR quincenal con ajuste, provisión a 1/12, antigüedad heredada y los contratos de hoy como servicios profesionales exentos, entre otras.
- `test:db` en verde, con los casos dorados G1–G8 (liquidación de C$45,021.66) y 3 pruebas de mutación detectadas.
- Revisión independiente: 2 hallazgos altos y 10 medios, todos corregidos.
- Ensayo completo en `nexo-core`, revertido: los poscheques pasan y la quincena real se calcula con 4 personas.
- **Aplicada** el 2026-10-21 con aprobación del usuario: el poscheque remoto da OK y los advisors no muestran hallazgos nuevos fuera del patrón. Sin commit y sin UI.
[Detalle](status-log/2026-10-21-planilla-pl2a-motor.md).

**2026-10-21 — Implementación de la revisión integral: código en local (sin commit) y migraciones APLICADAS en `nexo-core`.**
- **Seguridad:** Next 16.3.8 y `pnpm audit` en 0. Cabeceras de seguridad en las 6 zonas. Login sin redirección abierta. Kiosco heredado retirado.
- **Kernel compartido:** `@nexo/supabase`, `@nexo/auth` y `misPermisos`, con las 6 apps migradas: una consulta de permisos y una llamada a `getUser()` por carga.
- **Kit Enterprise UI v2:** `Button`, `Field`, `Alert`, `Skeleton`, `ErrorState`, `Pagination`, `Tabs` y `formato`; Fase 3 en todas las apps, dashboards nuevos en RRHH, Asistencia y Atención, y español neutro.
- `pnpm verify` en verde. Dos revisiones independientes sin hallazgos críticos ni altos.
- **4 migraciones aplicadas** con aprobación del usuario: `20261021164649` (`mis_permisos`), `…164748` (indicadores, 181 ms frente a 660, misma salida), `…164902` (kiosco heredado cerrado y tope de 200 filas en reportes; los reportes del owner dan la misma salida) y `…165004` (101 índices).
  - Advisors: 0 FK sin índice, 0 `auth_rls_initplan` y funciones ejecutables por `anon` de 6 a 5.
- Falta el recorrido visual con sesión.
[Detalle](status-log/2026-10-21-mejoras-revision-integral.md).

**2026-10-20 — Planilla y prestaciones: análisis (solo documentación).**
- El usuario quiere reemplazar AG Planilla con Nexo y mejorarla ([plan 20](plan/20-planilla.md)).
- Se documentó el marco legal 2026: Código del Trabajo, IR de la DGI, INSS, INATEC y salario mínimo.
- **Recorrido de AG Planilla con sesión (2026-10-21, solo lectura):**
  - el menú tiene unas 120 opciones;
  - hay 6 contratos vigentes, todos "Free-lance" **sin INSS ni IR** (decisión 0 pendiente, para el contador);
  - una planilla quincenal y una de aguinaldo;
  - INSS integral 21.5%;
  - IR igual a la DGI;
  - provisiones del 25%;
  - se paga con cheque;
  - hay un caso dorado de liquidación.
- En `nexo-core` (solo lectura):
  - `parametros_ley` tiene el INSS patronal en 22.5%, pero con menos de 50 trabajadores es 21.5%;
  - el techo de C$100,000 es un valor de ejemplo;
  - `planilla_detalles` no tiene `contrato_id`;
  - `feriados` está vacía.
- **2026-10-21, decisión del usuario:** dejar preparadas las dos modalidades (laboral y servicios profesionales), con el régimen por contrato.
- **Paso Cero aplicado** (`20261021160943`): 15 permisos `rrhh.planillas.*` y separación de funciones (el especialista ya no aprueba ni anula). Verificado en remoto.
- El modelo de datos sigue siendo propuesta. Sin tablas, sin código y sin commit.
[Detalle](status-log/2026-10-20-planilla-analisis.md).

**2026-10-20 — Revisión integral con subagentes (solo diagnóstico).**
- Cuatro frentes, a pedido del usuario: UI/UX, rendimiento, seguridad y módulos repetidos o integración.
- Hubo verificación remota (advisors, `pg_stat_statements`, Vercel) y un recorrido visual con la sesión del usuario.
- **Seguridad:** 13 hallazgos, 0 críticos y 2 altos:
  - N1: Next 16.3.0, con avisos críticos según `pnpm audit`;
  - N2: sin MFA y con la protección de contraseñas filtradas apagada.
  H5 se puede cerrar ya, porque `NEXO_KIOSKO_ID` no está en `nexo-rrhh`.
- **Rendimiento:** unas 20 llamadas a `has_permission` por página. `presupuesto_indicadores` tarda 660 ms. La primera entrada a cada app tarda de 2,7 a 3,2 s.
- **UI/UX:** al kit le faltan piezas básicas, hay controles falsos y los dashboards no tienen comparación.
- **Módulos:** ninguna app está repetida, salvo una posible duplicación entre Agencia y `materiales-jcastillo-marketing-dashboard`, que es inferencia. El código de infraestructura está copiado en 6 apps, las personas existen en 4 lugares y no hay eventos entre módulos.
- Sin cambios de código ni migraciones. Hay 8 decisiones pendientes del usuario.
[Detalle](status-log/2026-10-20-revision-integral.md).

**Última actualización documental: 2026-10-20 — App Presupuesto: esquema aplicado y app en local.**
- El usuario pidió Presupuesto "como una app aparte pero que viva en el despliegue de CRM" ([plan 19](plan/19-presupuesto.md)).
- Paso Cero aprobado y aplicado (`20261020183127`): 9 permisos `presupuesto.*`, plantillas Vendedor 3, Gerente 7 y Administrador 9, app inactiva.
- Esquema aplicado (`20261020184030`): schema `presupuesto` cerrado, 14 RPC y facturas e importaciones particionadas. Antes se ensayó con todas sus pruebas en una transacción revertida.
- `apps/presupuesto` está en local, con el código de Metas recuperado de la rama de respaldo. typecheck, lint, 9 pruebas y build en verde.
- Hubo revisión independiente, sin hallazgos altos. Sus correcciones se aplicaron, incluida la migración `20261020191334`: el correo del vendedor vinculado ya solo lo ve quien administra vendedores.
- **Activada** para la empresa (`20261020192310`), para probarla en local. El mosaico ya aparece en el Launcher de producción, pero no abre hasta el despliegue.
- **Datos reales cargados** desde la app, con la sesión del usuario:
  - 47 301 facturas del Excel, de 2023 a sep-2026, que cuadran al centavo por año, con 0 errores y 11 vendedores;
  - el presupuesto 2026 de US$ 4,082,909.31 con el reparto del Excel.
- Para no perder la factura `52372-A`, que tiene un vencimiento con el año 20233, se corrigió el lector: un vencimiento imposible queda vacío con aviso. Son 10 pruebas.
- Las metas sugeridas de septiembre a diciembre están generadas con el reparto del Excel, que fue la decisión del usuario. Cada mes suma su meta de la empresa.
- Nuevo (`20261020194816`, sin permisos nuevos):
  - elegir los vendedores del cuadro de meta;
  - **Clientes / Mis clientes**, con la última factura y lo facturado a cada cliente. El vendedor ve solo lo suyo y gerencia ve todo.
  - Se ensayó en transacción revertida y se probó en el Chrome del usuario.
- **KPIs del Dashboard** (`20261020204854`, solo lectura), elegidos tras investigar en internet:
  - ritmo del mes: proyección al cierre y venta necesaria por día hábil, de lunes a sábado;
  - comparación con el año anterior y acumulado del año;
  - clientes atendidos y nuevos, clientes por recuperar, venta de contado y concentración top 10;
  - Mi última factura y los clientes recientes.
  - "Vario" (contado) no cuenta como cliente.
  - Se probó la vista del equipo en Chrome. Mi avance solo se probó por SQL, porque ningún vendedor tiene usuario todavía.
- **Ventas al 20/10/2026 importadas:** 717 facturas nuevas, para un total de 48,018. Octubre lleva 712 facturas, US$ 240,878.76. Antes se corrigió el lector: AG pone 0 en la columna de la otra moneda y ahora ese 0 se calcula con el tipo de cambio. Septiembre se verificó día por día.
- **Dashboard del equipo rediseñado**, en pirámide:
  - el número del mes con su ritmo y una barra de meta;
  - 4 indicadores;
  - la venta acumulada día a día, interactiva;
  - el panel de clientes;
  - el ranking de vendedores con su proyección.
  - Usa la RPC nueva `presupuesto_venta_diaria` (`20261020210947`, solo lectura).
  - Se probó en Chrome a 1024 px. La vista en celular no se comprobó.
- Faltan vincular vendedores con usuarios, asignar plantillas y el despliegue en el proyecto `nexo-crm`. Sin commit.
[Detalle](status-log/2026-10-20-presupuesto-app.md).

**2026-10-20 — CRM retirado; réplica de AG Negocio en preparación.**
- El usuario pidió replicar completo su ERP actual, AG Negocio (software propietario de AG Software, S.A.), y borrar el CRM.
- Inventario hecho en solo lectura: 144 pantallas en 11 grupos ([plan 18](plan/18-replica-ag-negocio.md)).
- Se borró `apps/crm`; el respaldo está en la rama local `respaldo/crm-2026-10-20`.
- En nexo-core (`20261020143821`) se borró la app `crm` del Launcher con sus 34 permisos, el esquema `metas` completo y todo el contenido de `crm`. El esquema `crm` queda vacío hasta que el usuario lo quite de "Exposed schemas". No había datos.
- typecheck 7/7, lint 6/6, test:db y build 7/7 en verde. Sin commit.
- Sigue el Paso Cero de R1 (base) y R2 (contabilidad) del plan 18.
[Detalle](status-log/2026-10-20-retiro-crm-replica-ag-negocio.md) · [Plan 18](plan/18-replica-ag-negocio.md).

**2026-10-18 a 2026-10-20 — Metas y embudo comercial del CRM: retirados el 2026-10-20.** Se construyeron Metas y Presupuesto (`20261018135152`, `20261018184849`) y el embudo tipo NextCRM (`20261019152215`, `20261020060058`), pero se borraron sin datos al cambiar la referencia a AG Negocio. Su historia sigue en [Metas](status-log/2026-10-18-metas-dentro-de-crm.md) · [Embudo](status-log/2026-10-20-crm-embudo-esquema.md).

**2026-10-17 — RRHH P1–P6 aplicadas en `nexo-core`.**
Con aprobación del usuario, P1 → P2 → P3 → P4a → P4b → P6 aplicadas
(`20261017131004` … `20261017131221`), postchecks del paquete y P7 sección A
en verde en remoto; advisors solo con hallazgos esperados. El código (kiosco
con confirmación/reintento y pantalla Marcas) está en el [PR #47](https://github.com/Jccastillo25/nexo/pull/47),
**sin fusionar**: hasta entonces el kiosco desplegado falla cerrado (0 marcas).
Pendiente: fusionar, P7 con concurrencia y sesiones reales, recorrido P7.2.
Sin piloto autorizado. [Detalle](status-log/2026-10-17-rrhh-p1-p6-aplicadas.md) · [Paquete](RRHH_PAQUETE_OPERADOR.md).

**2026-10-16 — RRHH, entrega local P2–P6:** rama `codex/rrhh-piloto-mvp`: 0.2–0.3 rehechos, decisiones 0.4 registradas, kiosco configurado en 0.5 sin marcaciones; P2–P6 implementados y probados localmente; paquete P7 preparado.

**2026-10-16 — Productos (esquema + app):** schema `productos` (12 tablas, 12 RPC `public.productos_*`) aplicado en `nexo-core` (`20261016214634`) tras 17 pruebas en transacción revertida (+11 después de aplicar). `apps/productos` (zona `/productos`, puerto 3005) implementada: dashboard, listado, ficha con ID inmutable y código `CCTTKK-NNN` editable, clasificación, catálogos e importación/exportación del Excel del ERP; typecheck/lint/build OK y lector probado con los 699 productos reales. Sin datos, sin commit ni proyecto Vercel (el usuario quiere probar en local primero). **Activada** para la empresa el mismo día (`20261016220935`) para probar en local: la tarjeta ya aparece en el Launcher de producción pero no abre hasta el deploy. [Detalle](status-log/2026-10-16-productos-esquema-app.md).

**2026-10-16 — Productos (Paso Cero):** nuevo módulo `productos` (catálogo maestro de productos, base de Listas de precios). Diseño a partir de las plantillas de importación del ERP actual; matriz aprobada por el usuario y aplicada a `nexo-core` (`20261016203638`): app **inactiva**, 16 permisos + `productos.ver_modulo`, plantillas Consulta/Editor/Contabilidad/Administrador. Nexo será el maestro de productos. Sin tablas, sin `apps/productos` ni proyecto Vercel. [Detalle](status-log/2026-10-16-productos-paso-cero.md) · [Plan](plan/14-productos.md).

**2026-10-16 — CI y validación (issue #43):** primera puerta de calidad del repo: workflow `CI` en `.github/workflows/ci.yml` (checks `typecheck`, `lint`, `build`, `test-db-rrhh`, `test-agencia-access` + `lint-deuda` informativo), orden local única `pnpm install --frozen-lockfile && pnpm verify`, `typecheck` real en las 7 apps (antes ejecutaba **0 tareas con exit 0**) y prueba SQL de P1 conectada con `@electric-sql/pglite` fijado en `0.5.10`. **El gate de merge está ACTIVO y verificado** en `main`: los cinco checks obligatorios (app GitHub Actions), `strict: false`, `enforce_admins: true`, sin force push ni borrado de rama — `lint-deuda` no bloquea ([detalle y comandos](CI_CHECKS.md)). Sin migraciones aplicadas ni despliegues. [Detalle](status-log/2026-10-16-ci-checks-automatizados.md).

**2026-10-15 — RRHH P1 (issue #30):** `rrhh.fn_registrar_marca_kiosko` deja de resolver la credencial con `limit 1`: cuenta las credenciales vigentes de la empresa del kiosco que aceptan el PIN y, con más de una coincidencia, **falla cerrado** (ninguna marca, ninguna identidad, señal técnica sin PIN). Migración `20261015181000`, ya **fusionada en `main` (`fc2b309`)** y probada en un PostgreSQL embebido con bcrypt real (13 casos/28 aserciones + control negativo); **la migración todavía no se aplicó a `nexo-core`**. No se avanzó a P2. [Detalle](status-log/2026-10-15-rrhh-p1-pin-ambiguo.md).

**2026-10-15 — RRHH/kiosco:** aprobado el [diseño de piloto supervisado y MVP operativo](RRHH_PILOTO_MVP_OPERATIVO.md) y el correo corporativo de RRHH con registro restringido como canal de reportes. De sus tickets, **P1 (PIN ambiguo) ya está implementado y fusionado**; **P2–P7 y M1–M4 siguen pendientes**, sin usuarios reales ni piloto autorizado. La designación privada de funciones, buzón y dispositivo se exige en P7, no antes de crear tickets. [Detalle](status-log/2026-10-15-rrhh-piloto-mvp-especificacion.md).

**2026-10-15 — Atención (2):** la pantalla de TV ya no pasa por el login de Nexo (`/atencion` excluido del proxy del panel) y cada pantalla elige en Configuración qué datos del turno muestra y anuncia; la base filtra lo apagado (`20261015155035`). En producción (PR #23, `main` `6db1a54`): pantalla verificada sin sesión en el dominio público; falta probar en el TV. [Detalle](status-log/2026-10-15-atencion-pantalla-configurable.md).

**2026-10-15 — Atención:** la pantalla de turnos anuncia "Turno 5, Juan Pérez, será atendido por María López en Puesto 2" (decisión del usuario que revierte "solo números y puestos"). Migración `20261015151609` aplicada y probada en transacción revertida; en producción (PR #22, `main` `9e52219`, `nexo-atencion` READY); sin probar en un televisor real. [Detalle](status-log/2026-10-15-atencion-pantalla-nombres.md).

**2026-10-14 — ticket #18:** matriz mínima aprobada y aplicada; Dashboard separado en `apps/agencia` y proyecto Vercel creado. Lint, typegen, tipos y build locales en Agencia/Nexo OK, 12 pruebas técnicas de denegación OK. Previews preparados; revisión final de Claude en curso; merge, publicación/activación y pruebas manuales pendientes. No se declara validación completa. [Detalle](status-log/2026-10-14-agencia-independiente.md).


> Tracker operativo. Debe actualizarse en cada sesión que cambie código, base de datos, permisos, despliegue o estado funcional. La fuente del objetivo es `docs/PLAN_MAESTRO_IMPLEMENTACION_NEXO.md`; este archivo registra la realidad verificada.
>
> **Este archivo es un dashboard corto, no el historial completo.** Desde 2026-09-11 el detalle narrativo de cada subfase (qué se auditó, qué migraciones se aplicaron, qué se verificó paso a paso) vive en archivos individuales bajo [`docs/status-log/`](status-log/), enlazados desde la tabla de la sección 0 de abajo. Las secciones 1-7 de este archivo son el estado consolidado vigente — se leen siempre; el log detallado se lee solo si hace falta el detalle de verificación de una subfase puntual.

También **2026-10-14** (administración de usuarios y roles — Paso Cero +
esquema/`has_permission`/RPC aplicados en `nexo-core` y pantallas en la
rama `feat/usuarios-roles-nexo`, que desde el mismo día **incluye el
ticket #18 de Agencia** por merge; ver
[`status-log/2026-10-14-usuarios-roles-esquema.md`](status-log/2026-10-14-usuarios-roles-esquema.md),
[`status-log/2026-10-14-usuarios-roles-pantallas.md`](status-log/2026-10-14-usuarios-roles-pantallas.md)
y [`plan/12`](plan/12-administracion-usuarios-roles.md)).
Referencia documental anterior: **2026-09-17** (auditoría del botón
"Crear borrador" deshabilitado en `/contratacion/contratos/nuevo` +
reglas de negocio de creación de contratos (departamento→puesto→plantilla
obligatorios y en cascada, plantilla persistida, sin fecha fin al crear) +
endurecimiento de seguridad/integridad del bloque pre-F1.5 (FKs
compuestas multiempresa, condición de carrera en beneficiarios, límites
reales del bucket de Storage, verificación de metadata real de
documentos) + App Launcher sin ningún chrome de módulo + sidebar con
texto fijo "Nexo" en vez de logo/nombre de app; ver
[`status-log/2026-09-17-contratos-reglas-y-endurecimiento.md`](status-log/2026-09-17-contratos-reglas-y-endurecimiento.md).
Código commiteado y pusheado a `main` (`392f676`); migración
[`20260918043955_rrhh_contratos_reglas_y_endurecimiento.sql`](../supabase/migrations/20260918043955_rrhh_contratos_reglas_y_endurecimiento.sql)
**aplicada a `nexo-core`** con ese nombre de archivo (versión remota real
`20260918043955` — el archivo se creó localmente con el prefijo
`20260917100000` y se renombró después, sin tocar su SQL, para que
coincida con la versión que quedó registrada en
`supabase_migrations.schema_migrations`; ver detalle en el status-log).
Antes, bloque "pre-F1.5" del 2026-09-16: cédula
obligatoria, favicon en RRHH/CRM, catálogos de Contratación
(puestos/departamentos/plantillas), Storage privado de documentos y
expediente ampliado (Dirección/Información complementaria/Cuentas
bancarias/Beneficiario); ver
[`status-log/2026-09-16-rrhh-pre-f1-5.md`](status-log/2026-09-16-rrhh-pre-f1-5.md).
Antes de eso, reconciliación funcional y visual del 2026-09-14 — bug P0 de
Marca, App Launcher puro + logo en el sidebar, Expediente separado de
Contratación, edición real del Expediente General; ver
[`status-log/2026-09-14-reconciliacion-navegacion-rrhh.md`](status-log/2026-09-14-reconciliacion-navegacion-rrhh.md)).

## Estados

- ✅ Validado — recorrido ejecutado y comprobado.
- 🟡 En progreso — existe parcialmente.
- ⛔ Bloqueado — falta decisión/requisito.
- ⏳ Pendiente — no iniciado.
- ⚠️ Deuda/refactor — existe, pero contradice o no cumple el modelo objetivo.

---

# 0. Log detallado (`docs/status-log/`)

Cada fila es una subfase o bloque ya cerrado, con el detalle completo de qué se auditó/migró/verificó. Leer solo la fila relevante a la tarea actual, no todas.

| Fecha | Entrada | Resumen de una línea |
|---|---|---|
| 2026-10-24 | [Flotilla: E2, esquema de Entregas](status-log/2026-10-24-flotilla-e2-esquema.md) | `20261024140400` y `20261024140609` **aplicadas**: schema `flotilla` cerrado, 21 tablas (3 particionadas), contadores e invariantes por trigger y CHECK, transiciones, inmutabilidad, idempotencia y 0 FK sin índice. PGlite en verde con mutación detectada; poscheque y advisors remotos. Proyecto de Vercel `nexo-flotilla` creado |
| 2026-10-23 | [Flotilla: Entregas, E0, Paso Cero y E1](status-log/2026-10-23-flotilla-entregas-e0.md) | Especificación del usuario registrada como plan 22. E0: app `flotilla` sin habilitar para la empresa, sin schema ni proyecto de Vercel. Paso Cero `20261024034727` **aplicado**: 35 códigos de 4 segmentos y 6 plantillas. E1 en local: Ruta360 retirado, `nexo-flotilla` con SSO, `NexoShell`, permisos y menú, rewrite `/flotilla`, gate de lint con 8 apps. typecheck, lint y build en 0. Sin sesión real ni commit |
| 2026-10-23 | [Panel de plataforma: diseño y Paso Cero](status-log/2026-10-23-plataforma-paso-cero.md) | Plan 21 con las decisiones del usuario (multiempresa con selector, super admin que entra auditado, primer administrador en el alta, cupo de activos). `20261024033541` **aplicada**: 9 códigos `nexo.plataforma.*`, 0 asignaciones, advisors sin cambios. El código sigue con una sola empresa (`NEXO_COMPANY_ID`). Sin esquema, código ni commit |
| 2026-10-22 | [Planilla: techo del INSS por persona en el mes](status-log/2026-10-22-planilla-techo-inss.md) | Migración `20261022034035` **aplicada en `nexo-core`**: techo acumulado del mes, sin netos negativos. Corrige el P1 de la revisión del PR #50. 17 pruebas OK, mutación detectada, dos revisiones y dos ensayos revertidos. Huella remota igual a la local |
| 2026-10-22 | [Planilla PL2b, PL2c y pantallas](status-log/2026-10-21-planilla-pl2b-pl2c-pantallas.md) | Prestaciones, reportes y configuración aplicadas en `nexo-core` (9 migraciones, `20261021235639` a `20261022001922`) y 40 pantallas de Planilla en local; sin commit ni recorrido visual con sesión |
| 2026-10-21 | [Planilla PL2a: esquema y motor en RPC](status-log/2026-10-21-planilla-pl2a-motor.md) | Migración `20261021191441` **aplicada en `nexo-core`**. Régimen por contrato, conceptos, planillas por línea y novedades particionadas. 12 RPC con separación de funciones, huella e inmutabilidad, y simulador de liquidación por causa. IR y techo del INSS por persona, días 30/360, INSS patronal en 21.5%, 14 feriados y contratos en quincenal. 9 decisiones del usuario. PGlite pasa G1–G8 (C$45,021.66) y más de 40 reglas, con mutaciones detectadas. Revisión independiente (2 altos y 10 medios) corregida. Ensayo completo en `nexo-core` revertido: poscheques OK y la quincena real se calcula con 4 personas. Sin commit. |
| 2026-10-21 | [Implementación de la revisión integral](status-log/2026-10-21-mejoras-revision-integral.md) | Flujo coordinador → 9 ejecutores → 2 revisores → correcciones. Seguridad: Next 16.3.8 y overrides (`pnpm audit` 28 → 0), cabeceras compartidas, N8/N12 cerrados y el kiosco heredado retirado. Kernel `@nexo/supabase`/`@nexo/auth`/`getPermisos` con las 6 apps migradas. Kit Enterprise UI v2, Fases 3 y 4, menú filtrado por permiso y español neutro. 4 migraciones **aplicadas el 2026-10-21** (`20261021164649`–`20261021165004`) y verificadas en remoto con la misma salida que antes; advisors con 0 FK sin índice y `anon` de 6 a 5. `pnpm verify` en verde. Sin commit ni deploy; falta el recorrido visual. |
| 2026-10-20 | [Planilla y prestaciones: análisis de AG Planilla y marco legal](status-log/2026-10-20-planilla-analisis.md) | El usuario quiere reemplazar AG Planilla ([plan 20](plan/20-planilla.md)). Ley de 2026 documentada (Código del Trabajo, IR de la DGI, INSS, INATEC y salario mínimo) y recorrido de AG con sesión el 2026-10-21: menú de unas 120 opciones, 6 contratos vigentes "Free-lance" sin INSS ni IR, INSS 21.5%, provisiones del 25% y un caso dorado de liquidación. Decisión: preparar las dos modalidades. Paso Cero aplicado (`20261021160943`): 15 permisos y el especialista ya no aprueba ni anula. Sin tablas. Remoto en solo lectura: INSS patronal sembrado en 22.5% cuando corresponde 21.5% con menos de 50 trabajadores, techo de ejemplo, `planilla_detalles` sin `contrato_id` y feriados vacíos. Paso Cero y modelo propuestos; sin código ni migraciones. |
| 2026-10-20 | [Revisión integral: UI/UX, rendimiento, seguridad y módulos](status-log/2026-10-20-revision-integral.md) | Diagnóstico con 4 subagentes en solo lectura, más verificación remota y visual del coordinador. Seguridad: 13 hallazgos (2 altos: Next 16.3.0 vulnerable; sin MFA ni protección de contraseñas filtradas); H5 se puede cerrar. Rendimiento: unos 20 `has_permission` por página, `presupuesto_indicadores` de 660 ms, sin `loading.tsx` ni caché. UI/UX: 8 causas de lo genérico y propuesta Enterprise UI v2 en `packages/ui`. Módulos: infraestructura copiada en 6 apps, personas en 4 lugares, sin eventos; propuesta de maestros en `core` y outbox. Corregida la divergencia de `nexo-productos`. Sin código, sin migraciones, sin commit. |
| 2026-10-20 | [App Presupuesto: Paso Cero, esquema y app](status-log/2026-10-20-presupuesto-app.md) | Es una app aparte que vivirá en el proyecto de Vercel `nexo-crm` ([plan 19](plan/19-presupuesto.md)). Paso Cero (`20261020183127`): 9 permisos y plantillas 3/7/9, app inactiva. Esquema (`20261020184030`): schema `presupuesto` cerrado, 14 RPC y hechos particionados, ensayado completo en transacción revertida (importación sin duplicar, metas sugeridas y ajustadas, el vendedor solo ve lo suyo, sin sesión se deniega todo). `apps/presupuesto` en local con el código de Metas del respaldo: typecheck, lint, 9 pruebas y build en verde. Revisión independiente sin hallazgos altos; sus correcciones van en `20261020191334` (el correo del vendedor solo lo ve quien administra vendedores; la importación no aborta por una fila mal numerada). Falta activar, el recorrido con sesión y el despliegue. Sin commit. |
| 2026-10-20 | [Retiro del CRM + inventario de AG Negocio](status-log/2026-10-20-retiro-crm-replica-ag-negocio.md) | El usuario pidió replicar AG Negocio, su ERP actual, y borrar el CRM. Inventario en solo lectura de 144 pantallas ([plan 18](plan/18-replica-ag-negocio.md)). `apps/crm` borrada, con respaldo en la rama local `respaldo/crm-2026-10-20`. `20261020143821`: app `crm` y sus 34 permisos y 3 plantillas fuera, esquema `metas` borrado y `crm` vaciado (queda vacío por "Exposed schemas"); ensayado antes en transacción revertida y sin datos. Rewrite `/crm` y CI de metas retirados; un solo mosaico ERP en el Launcher. typecheck, lint, test:db y build en verde. Sin commit. |
| 2026-10-20 | [ERP: plan y Paso Cero](plan/17-erp.md) | Decisiones del usuario: reemplazar el ERP actual por etapas, facturación fiscal DGI (ya hay autorización), costo promedio ponderado, catálogo de cuentas importado del ERP, una sola app ERP y libros en C$. Paso Cero aplicado (`20261020064732`): apps `precios` y `erp` inactivas, 11 + 52 permisos y 12 plantillas, ensayado antes en transacción revertida. Sin tablas. Sigue E1 Listas de precios; faltan los datos de la resolución DGI y los Excel. |
| 2026-10-20 | [CRM: esquema del embudo comercial](status-log/2026-10-20-crm-embudo-esquema.md) | Se aplicaron 9 tablas en `crm`: actividades, cotizaciones con sus líneas y eventos van particionadas por mes. Además, 48 RPC `public.crm_*` con alcance propio o del equipo, control de versión, totales calculados en el servidor, aprobación de descuentos y la regla de que nadie aprueba lo propio (`20261020060058`). La configuración S6 quedó sembrada. Las 19 pruebas pasaron en transacción revertida; los avisos muestran solo lo esperado. Falta la UI y no hay datos ni commit. |
| 2026-10-19 | [CRM: Paso Cero del embudo comercial](status-log/2026-10-19-crm-embudo-paso-cero.md) | Matriz aprobada y aplicada (`20261019152215`). Agrega 21 permisos para Leads, Oportunidades, Actividades y Cotizaciones, más el alcance de equipo, la reasignación y la configuración del embudo. Plantillas Vendedor 17, Gerente 27 y Administrador 34. Se ensayó en una transacción revertida antes de aplicar. NextCRM (MIT) sirve de referencia funcional. Sin tablas, pantallas ni commit. |
| 2026-10-18 | [Metas y Presupuesto dentro del CRM](status-log/2026-10-18-metas-dentro-de-crm.md) | Decisión del usuario: un solo módulo de ventas. 8 permisos `crm.*` + plantillas Vendedor/Gerente/Administrador de ventas, 13 RPC reescritas con los códigos nuevos y app `metas` retirada (`20261018184849`, probada en transacción revertida). Pantallas movidas a `apps/crm` (`/crm/metas`…), `apps/metas` y rewrite `/metas` eliminados; deuda de lint del CRM corregida (CRM en el gate). lint/typecheck/test/build en verde. Sin datos, sin sesión real, sin commit. |
| 2026-10-18 | [Metas de ventas: app + importador del Excel en bruto](status-log/2026-10-18-metas-app-importador.md) | `apps/metas` (zona `/metas`, 3006) con 6 pantallas; lector del Excel del ERP sin depurar (hojas, títulos, totales, duplicados, montos y fechas en texto) probado con el Excel real: 47 301 facturas que cuadran con su Dashboard; validador en Node; lotes de 1000 medidos (0.9 s). typecheck/lint/test/build en verde. Rewrite `/metas`, icono `target`. App inactiva, sin sesión real, sin datos, sin commit. |
| 2026-10-18 | [Metas de ventas: Paso Cero + esquema](status-log/2026-10-18-metas-paso-cero-esquema.md) | App `metas` inactiva con 9 permisos y plantillas Vendedor/Gerente/Administrador (`20261018133816`); schema `metas` (6 tablas, facturas/importaciones particionadas, 13 RPC) aplicado (`20261018135152`) tras 18 pruebas revertidas: importación sin duplicar, anuladas fuera, reparto por 3 meses, vendedor ve solo lo suyo, `anon` sin acceso. Advisors solo con lo esperado. Sin datos, sin pantallas, sin commit. |
| 2026-10-18 | [Reportes de Asistencia + PDF](status-log/2026-10-18-asistencia-reportes.md) | Paso Cero `reportes.ver`/`.exportar` y núcleo `rrhh.fn_asistencia_dias` + 6 RPC **aplicados** (`20261018014012`, `20261018014127`; advisors 62/6/81/1, +6 RPC autenticadas esperadas). En local: 5 reportes (diaria, resumen, tardanzas, incidencias, tarjeta), PDF en Route Handler (jspdf fijado) y vista de impresión, ambos auditados. typecheck, lint, build y 24 pruebas en verde; `reviewer` sin altos (bajos corregidos). Recorrido con sesión real en local como owner: 5 pantallas, PDF, impresión y 4 auditorías verificadas. Sin commit ni deploy (todo en local por pedido del usuario). |
| 2026-10-18 | [Despliegue único: PR #48](status-log/2026-10-17-asistencia-app.md#despliegue-en-producción-2026-10-18) | `feat/launcher-iconos` fusionada en `main` (`9e11e82`) con los 5 checks obligatorios en verde (`lint-deuda` falla y no bloquea; es deuda previa). Los 6 proyectos de Vercel quedan READY en Production. En el dominio público, `/rrhh/kiosco` muestra «Terminal sin asignar» y `/rrhh/asistencia` y `/agencia` llevan al login. Falta el recorrido con sesión real en producción. |
| 2026-10-20 | [Kiosco: rutas que mandaban al login sin sesión](status-log/2026-10-20-kiosco-rutas-sin-sesion.md) | En producción, `/rrhh/kiosco` abre sin sesión, pero `/kiosco`, `/asistencia/kiosco`, `/rrhh/asistencia/kiosco` y `/rrhh/Kiosco` caían en el login. Ahora redirigen a `/rrhh/kiosco` antes del guard (`redirects` de nexo y rrhh, y el proxy de rrhh insensible a mayúsculas, que solo exime la ruta exacta). Fusionado con el PR #49 (`a072908`). |
| 2026-10-17 | [Enrolamiento de terminales de kiosco](status-log/2026-10-17-asistencia-app.md#enrolamiento-decisiones-y-migraciones-preparadas) | Paso Cero (`kioskos.asignar`/`revocar`) y tablas + 6 RPC aplicadas (`20261017180753`, `20261017180853`; 12 comprobaciones en transacción revertida; advisors solo con lo esperado). UI: código en Dispositivos, pantalla "Terminal sin asignar" (`/rrhh/kiosco?asignar=1`) y cookie httpOnly. Revisada por `reviewer` (sin altos); typecheck, lint, build, lint:gate y P5 en verde. Sin recorrido real ni commit. |
| 2026-10-17 | [App Asistencia separada de RRHH](status-log/2026-10-17-asistencia-app.md) | Mosaico propio en `/rrhh/asistencia` (mismo deploy que RRHH): Dashboard, Marcas (movida, `/rrhh/marcas` redirige) y Dispositivos (registrar, editar, desactivar, reactivar). `core.apps` registrada (`20261017173701`, aplicada; solo el owner la ve). Vía `ux-planner` → `ui-frontend` → `reviewer` (sin bloqueos de código); typecheck, lint, lint:gate y build de RRHH en verde. Sin sesión real, sin deploy, sin commit. |
| 2026-10-17 | [Revisión de seguridad](status-log/2026-10-17-revision-seguridad.md) | Diagnóstico (advisors + SQL de solo lectura en `nexo-core`): 0 críticos, 1 alto, 1 medio, 7 bajos. Correcciones con el flujo coordinador → 3 ejecutores `ui-frontend` → 2 rondas de `reviewer` (sin altos ni medios al final). Resueltos: H1 (PR #47 fusionado, `6619646`), H2 en código (`mensajeDeError` de `@nexo/permissions` en RRHH, Productos, CRM, Atención y Nexo), H7, H8, H9 y `weak_password` de Auth con mensaje propio. H4: migración `20261017164447` **aplicada en `nexo-core`** con aprobación del usuario (`anon` sin EXECUTE en `update_platform_settings`; advisor de funciones ejecutables por `anon` bajó de 4 a 3, todas intencionales). H3 y H5 quedan como propuesta; H6 lo hace el usuario en Supabase. `pnpm verify` en verde. Sin commit de estas correcciones, sin push. |
| 2026-10-17 | [Sistema de trabajo con subagentes](status-log/2026-10-17-subagentes.md) | Coordinador (sesión principal) + `skills-specialist`, `ux-planner`, `ui-frontend` y `reviewer` en `.claude/agents/`; registro de skills; sección en `CLAUDE.md`. 3 skills adaptadas (`nexo-ui`, `nexo-react-next`, `nexo-ui-review`) con procedencia; delegación real validada en sesión nueva (4 agentes, ninguno escribió); 6 hallazgos de producto, corregidos en la fila siguiente. Sin commit. |
| 2026-10-17 | [Hallazgos UI de Productos y sidebar](status-log/2026-10-17-hallazgos-ui-productos.md) | Orden del menú de Productos, `NexoSidebar` oculta grupos vacíos (en cascada) con `aria-expanded` y foco visible, errores sin texto técnico, Toast con nombre en español (sonner ya tenía `aria-live`). Vía `ui-frontend` + `reviewer` (sin altos); typecheck y lint:gate en 0. Sin verificación visual; sin commit. |
| 2026-10-17 | [Launcher con grilla de iconos](status-log/2026-10-17-launcher-iconos.md) | Pantalla de inicio estilo Odoo: mosaicos blancos con icono a color por app (`AppTileIcon` en `@nexo/ui`) y fondo degradado, agrupados en secciones por categoría con título; Configuración va en "Administración". Menú desplegable en todas las apps. Cuadrícula fija con Ventas arriba y apps "Próximamente". **Agencia activada en `nexo-core`** (`20261017171359`); `AGENCIA_APP_URL` de Production creada en `nexocore`, efectiva con el próximo deploy. **Listas de precios decidida como app aparte**: sale de Productos y su Paso Cero queda pendiente. Commit `82664fb`; lo demás aún sin commit y sin verificación visual con sesión. |
| 2026-10-17 | [RRHH P1–P6 aplicadas en `nexo-core`](status-log/2026-10-17-rrhh-p1-p6-aplicadas.md) | Seis migraciones aplicadas con aprobación del usuario; postchecks y P7 sección A en verde en remoto; advisors sin sorpresas. Código en el PR #47, **fusionado en `main` el 2026-10-17 (`6619646`)**: el cliente compatible del kiosco sale con el despliegue de `main`. |
| 2026-10-16 | [RRHH publicación pendiente](status-log/2026-10-16-rrhh-publicacion-pendiente.md) | Implementación local verificada; push sin credencial de escritura. PR y CI pendientes, sin cambios remotos. |
| 2026-10-16 | [RRHH revisión final](status-log/2026-10-16-rrhh-revision-final.md) | Regresiones: agotamiento al activar y rechazo de PIN ambiguo tras P4; solo PGlite, sin remoto. |
| 2026-10-16 | [RRHH p7-paquete](status-log/2026-10-16-rrhh-p7-paquete.md) | Paquete unico del Operador preparado: migraciones P1-P6 con postchecks y rollback, SQL de grants/RLS/particiones, arnes remoto de carreras y guion manual P7. Sin ejecucion remota ni autorizacion de piloto. Solo local; pendiente de aplicar y validar en remoto. |
| 2026-10-16 | [RRHH p6-marcas](status-log/2026-10-16-rrhh-p6-marcas.md) | P6 implementado: consulta segura por empresa con marcas.ver, listado de solo lectura, filtros y detalle con numero de contrato, estados calculables y paginacion. Pruebas SQL y validacion de fechas locales. Solo local; pendiente de aplicar y validar en remoto. |
| 2026-10-16 | [RRHH p5-confirmacion](status-log/2026-10-16-rrhh-p5-confirmacion.md) | P5 implementado: confirmacion generica de toda salida, cancelar sin RPC, reintento con mismo UUID y borrado del PIN en memoria al terminar. Tres pruebas del controlador local aprobadas. Solo local; pendiente de aplicar y validar en remoto. |
| 2026-10-16 | [RRHH p4-secuencia](status-log/2026-10-16-rrhh-p4-secuencia.md) | P4a y P4b implementados: resultados particionados, locks de envio y contrato/dia, reintentos sin duplicar, confirmacion de salida y limite de intentos conservado. Cliente y tipos adaptados; concurrencia real pendiente de P7. Solo local; pendiente de aplicar y validar en remoto. |
| 2026-10-16 | [RRHH p3-contrato](status-log/2026-10-16-rrhh-p3-contrato.md) | P3 implementado: contrato obligatorio con FK compuesta, indices y cierre de escrituras directas en padre y particiones. PGlite comprueba vinculo, recontratacion y revocacion. Solo local; pendiente de aplicar y validar en remoto. |
| 2026-10-16 | [RRHH p2-pin-unico](status-log/2026-10-16-rrhh-p2-pin-unico.md) | P2 implementado: generacion criptografica y lock por empresa; firmas y autorizacion conservadas. Pruebas de unicidad, regeneracion, empresa ajena y agotamiento en PGlite. Solo local; pendiente de aplicar y validar en remoto. |
| 2026-10-16 | [RRHH 0-4-0-5-preparacion](status-log/2026-10-16-rrhh-0-4-0-5-preparacion.md) | Decisiones aprobadas: cierre de escritura directa en P3, kiosco PRUEBA separado ya creado por el Operador y limpieza final completa. Variable local configurada sin versionar su valor; sin marcaciones ni conexion remota. Solo local; pendiente de aplicar y validar en remoto. |
| 2026-10-16 | [RRHH 0-3-entorno](status-log/2026-10-16-rrhh-0-3-entorno.md) | Entorno desechable compartido conectado a test:db; P1 conserva su prueba aislada y se prueba tambien en el compartido. Solo local; pendiente de aplicar y validar en remoto. |
| 2026-10-16 | [RRHH 0-2-runner](status-log/2026-10-16-rrhh-0-2-runner.md) | Runner genérico PGlite añadido; dependencia fijada, sin PGLITE_DIR ni conexión remota. Solo local; pendiente de aplicar y validar en remoto. |
| 2026-10-16 | [Productos — esquema, RPC y `apps/productos`](status-log/2026-10-16-productos-esquema-app.md) | Schema `productos` + 12 RPC (`20261016214634`, 28 pruebas en transacciones revertidas); app con dashboard, listado, ficha, clasificación, catálogos e importación del ERP; build OK y lector probado con 699 productos reales. Inactiva, sin datos, sin commit. |
| 2026-10-16 | [Paso Cero — módulo Productos](status-log/2026-10-16-productos-paso-cero.md) | Catálogo maestro de productos diseñado sobre las plantillas del ERP; app `productos` registrada inactiva, 16 permisos + `ver_modulo`, 4 plantillas (`20261016203638`). Modelo de datos, pantallas y Listas de precios pendientes. |
| 2026-10-16 | [CI: pruebas automatizadas y checks obligatorios](status-log/2026-10-16-ci-checks-automatizados.md) | Workflow `CI` + orden local `pnpm verify`; `typecheck` real en las 7 apps y prueba SQL P1 con PGlite fijado. Protección de `main` **activa y verificada**: los cinco checks (`typecheck`, `lint`, `build`, `test-db-rrhh`, `test-agencia-access`) son obligatorios antes de fusionar, con `strict: false` y `enforce_admins: true`; `lint-deuda (no bloquea)` no bloquea. |
| 2026-10-15 | [RRHH P1 — PIN ambiguo, fallo cerrado](status-log/2026-10-15-rrhh-p1-pin-ambiguo.md) | La búsqueda del kiosco cuenta coincidencias y no marca si el PIN es ambiguo. Migración `20261015181000` fusionada en `main` (`fc2b309`) y probada en PG embebido; sin aplicar a remoto. |
| 2026-10-15 | [RRHH/kiosco — especificación de piloto y MVP operativo](status-log/2026-10-15-rrhh-piloto-mvp-especificacion.md) | Corte y tickets P1–P7/M1–M4 aprobados como diseño; sin implementación ni validación con usuarios reales. |
| 2026-10-14 | [Agencia digital independiente](status-log/2026-10-14-agencia-independiente.md) | Matriz mínima aplicada e inactiva; app/proyecto propio y compilación local preparados. Previews preparados; revisión final de Claude, merge, activación y pruebas manuales pendientes. |
| 2026-09-07 | [F1.0 — Auditoría real](status-log/2026-09-07-f1-0-auditoria-real.md) | Comparación Plan vs `main` vs migraciones vs remoto vs Vercel; detectó `main` local 13 commits atrás (reconciliado) y el hallazgo de seguridad D-06. |
| 2026-09-07 | [F1.0.1 — Cierre de acceso operativo PIN heredado](status-log/2026-09-07-f1-0-1-cierre-pin-heredado.md) | `EXECUTE` de `public.validar_acceso_operativo` revocado de `anon`/`authenticated` (hotfix inmediato). |
| 2026-09-07 | [Paso Cero — matriz de permisos de contratos/credenciales](status-log/2026-09-07-paso-cero-permisos-contratos-credenciales.md) | 7 códigos de permiso nuevos en el dominio `expedientes`, asignados a los 5 roles reales de RRHH. |
| 2026-09-07 | [F1.1 — Separar Expediente General/Laboral](status-log/2026-09-07-f1-1-expediente-general-laboral.md) | `fn_crear_empleado` ya no acepta datos laborales/PIN; columnas viejas deprecadas, no eliminadas. |
| 2026-09-07 | [F1.2 — `rrhh.contratos` + compensación contractual](status-log/2026-09-07-f1-2-contratos-compensacion.md) | Tabla de contratos con máquina de estados, RLS, trigger de transición y RPC; `contrato_compensacion` 1:1 con el contrato. |
| 2026-09-07 | [F1.3 — PIN exclusivamente contractual](status-log/2026-09-07-f1-3-pin-contractual.md) | `rrhh.contrato_credenciales` nueva; PIN nace al activar, se revoca al finalizar; kiosko migrado; verificado end-to-end real (23 pasos). |
| 2026-09-07 | [F1.4 — Jornadas mínimas](status-log/2026-09-07-f1-4-jornadas-minimas.md) | `jornadas`/`jornada_dias`/`contrato_jornadas`/`feriados`; jornada obligatoria para activar contrato; gap de rol señalado (`gestor_expedientes` sin `turnos.ver`). |
| 2026-09-07 | [Nexo Enterprise UI — rediseño visual transversal](status-log/2026-09-07-nexo-enterprise-ui.md) | Sidebar azul + topbar con breadcrumb (`NexoShell`) en `apps/nexo`/`rrhh`/`crm`, tema claro por defecto, kit compartido nuevo en `packages/ui`. |
| 2026-09-08 | [Fix de estabilización RRHH](status-log/2026-09-08-fix-estabilizacion-rrhh.md) | P0: bug real que tumbaba `/expedientes/[id]` (función pasada a Client Component). P1: paralelización de round-trips. P2: UX de Expedientes/Contratos/Jornadas + fix de acordeón del sidebar. |
| 2026-09-11 | [Limpieza de datos de prueba residuales](status-log/2026-09-11-limpieza-datos-prueba-residuales.md) | Verificación remota de rutina encontró 1 empleado/contrato/PIN de prueba sin limpiar en `nexo-core` (contradecía "0 filas" documentado) — borrado con aprobación explícita del usuario; también corrige una imprecisión de conteo de migraciones de F1.0 (duplicados inertes del bootstrap, sin impacto). |
| 2026-09-14 | [Reconciliación de navegación — Marca, Launcher, Expediente/Contratación](status-log/2026-09-14-reconciliacion-navegacion-rrhh.md) | Bloque pedido explícitamente (P0-P4, sin iniciar F1.5): fix P0 real de `/configuracion/marca` (límite de body + error boundary global), App Launcher puro sin KPIs con logo en la cabecera del sidebar, Expediente General separado de Contratación (ciclo contractual completo movido a `/contratacion/contratos`), edición real del Expediente General (`rrhh.fn_editar_empleado` nuevo). Mergeado a `main` (`4cc8a6a`, fast-forward) y verificado `READY` en Vercel producción el mismo día — smoke test autenticado NO ejecutado (sin credenciales; el usuario eligió cerrar documentando la limitación). |
| 2026-09-16 | [Bloque "pre-F1.5" — cédula, favicon, catálogos, Storage privado, expediente ampliado](status-log/2026-09-16-rrhh-pre-f1-5.md) | Bloque pedido explícitamente antes de F1.5: cédula obligatoria (DB+RPC+UI), favicon dinámico en RRHH/CRM, catálogos de Contratación (`rrhh.puestos`/`rrhh.departamentos`/`rrhh.plantillas_contrato`/`rrhh.puesto_plantillas`, `rrhh.contratos.puesto_id`/`departamento_id`), Storage privado (`rrhh-documentos-privados`, subida por URL firmada directa — evita el techo de 4.5MB de Vercel), expediente ampliado (Dirección con geografía de Nicaragua en `core.geografia_ni_*`, Información complementaria, Cuentas bancarias, Beneficiario). `next build`+`eslint` limpios en `apps/rrhh`/`apps/crm`, sin smoke test autenticado (sin credenciales). Deuda explícita: `core.geografia_ni_municipios` queda vacía (fuente web no confiable, ver detalle), falta `SUPABASE_SERVICE_ROLE_KEY` en el proyecto Vercel de RRHH. |
| 2026-10-15 | [Atención — métricas y dashboards](status-log/2026-10-15-atencion-metricas-dashboards.md) | `atencion_metricas` (`20261015173729`); `/metricas` (propias) y `/reportes` (global: por agente, puesto, hora y día). Sin sesión real. |
| 2026-10-15 | [Atención — Paso Cero de métricas, reactivar y factura única](status-log/2026-10-15-atencion-reactivar-factura-unica.md) | Permisos `mis_metricas.ver` y `cola.turno.reactivar` (`20261015165620`); reactivar "no se presentó" al final de la fila, factura única por sucursal, fila por `en_fila_desde` (`20261015172012`). |
| 2026-10-15 | [Atención — cronómetros de espera y atención](status-log/2026-10-15-atencion-cronometros.md) | `atencion.turnos.inicio_atencion_en` (no cambia con "Repetir llamado") + `atencion_cola_v2`; cronómetros en puesto y recepción (`20261015163957`). Dashboards: Paso Cero propuesto, sin aprobar. |
| 2026-10-15 | [Atención — fila en tiempo real + aviso sonoro](status-log/2026-10-15-atencion-fila-tiempo-real.md) | Realtime (`postgres_changes` sobre `public.atencion_cola_senales`, sin datos del cliente) en puesto y recepción; sonido y título con la cantidad en espera (`20261015162540`). Sin prueba en navegador real. |
| 2026-10-15 | [Atención — factura en la pantalla](status-log/2026-10-15-atencion-pantalla-configurable.md#ampliación-número-de-factura-mismo-día) | Número de factura como cuarto dato configurable, apagado por defecto (`20261015161222`). |
| 2026-10-15 | [Atención — pantalla configurable y sin login](status-log/2026-10-15-atencion-pantalla-configurable.md) | Proxy de Nexo excluye `/atencion` (la pantalla iba al login sin sesión); casillas Mostrar/Anunciar por pantalla; la RPC anónima no devuelve los datos apagados (`20261015155035`). |
| 2026-10-15 | [Atención — nombres en la pantalla](status-log/2026-10-15-atencion-pantalla-nombres.md) | `atencion_pantalla_estado` devuelve cliente y agente de los turnos llamados (`20261015151609`); voz y TV: "Turno N, cliente, será atendido por agente en puesto". Riesgo de privacidad aceptado por el usuario. Sin prueba en TV real. |
| 2026-10-14 | [Atención — pantallas y Sucursales](status-log/2026-10-14-atencion-pantallas.md) | `/configuracion/sucursales` y sucursales en Usuarios (Nexo); nueva `apps/atencion` con Iniciar/Cerrar atención, recepción, puesto, configuración y pantalla de TV. Build/lint limpios; sin proyecto Vercel ni activación. |
| 2026-10-14 | [Atención — esquema, RPC y pg_cron](status-log/2026-10-14-atencion-esquema.md) | Sucursales + schema `atencion` (7 tablas, 3 particionadas), 19 RPC con asignación automática de puesto y cierre a medianoche, `pg_cron` instalado (`20261014224341`). Probado de punta a punta en transacción revertida. App inactiva; pantallas pendientes. |
| 2026-10-14 | [Paso Cero — módulo Atención](status-log/2026-10-14-atencion-paso-cero.md) | Sistema de turnos de sala de espera (`atencion`): app registrada inactiva, 15 permisos + 2 de sucursales, plantillas Recepción/Agente/Supervisor (`20261014222454`). Tablas, RPC y pantallas pendientes. |
| 2026-10-14 | [Pantallas de usuarios, roles y auditoría](status-log/2026-10-14-usuarios-roles-pantallas.md) | `/configuracion/usuarios`, `/roles` (editor opción A con plantillas), `/auditoria`, `/cambiar-contrasena` + Server Actions de Auth; fix de redirección abierta en el login. `next build`/`eslint` limpios; sin recorrido con sesión real. |
| 2026-10-14 | [Esquema de usuarios y roles + nueva `has_permission`](status-log/2026-10-14-usuarios-roles-esquema.md) | `core.roles`/`rol_permisos`/`perfiles`, un rol por usuario, `has_permission` con módulo habilitado + usuario activo + rol de empresa, 14 RPC `admin_*` con anti-escalada y auditoría (`20261014203144`). Validada antes con 15 pruebas en transacción revertida. Pantallas sin implementar. |
| 2026-10-14 | [Paso Cero — administración de usuarios y roles](status-log/2026-10-14-paso-cero-administracion-usuarios-roles.md) | Decisiones del usuario (1 rol por usuario, rol = apps + permisos internos, contraseña puesta por el admin, vínculo RRHH) + 9 códigos `nexo.administracion.*` aplicados en `nexo-core` (`20261014201119`). Esquema/RPC/UI solo diseñados en [`plan/12`](plan/12-administracion-usuarios-roles.md). Detectada migración `agencia_dashboard_access` en remoto sin estar en `main`. |
| 2026-09-17 | [Auditoría botón "Crear borrador" + reglas de contratación + endurecimiento](status-log/2026-09-17-contratos-reglas-y-endurecimiento.md) | Causa real del botón deshabilitado: `<select>` de empleados sin opción vacía (bug de UI, no de negocio — 0 contratos en remoto en el momento del reporte). Reglas nuevas: puesto/departamento/plantilla obligatorios y en cascada, sin fecha fin al crear, plantilla persistida (no solo sugerida), validación 100% server-side (`fn_crear_contrato`/`fn_editar_contrato` reescritas). Endurecimiento: FKs compuestas multiempresa en toda tabla de expediente ampliado/catálogos, condición de carrera corregida en beneficiarios, límites reales del bucket de Storage, verificación de metadata real (no la del navegador) al confirmar una subida. Launcher de Nexo sin ningún chrome de módulo; sidebar de RRHH/CRM/Nexo con texto fijo "Nexo" en vez de logo/nombre de app. Código commiteado y pusheado a `main` (`392f676`); migración `20260918043955_rrhh_contratos_reglas_y_endurecimiento` **aplicada a `nexo-core`** (2026-09-18, prechecks/postchecks de solo lectura verificados, archivo local renombrado de `20260917100000_...` a `20260918043955_...` sin tocar su SQL para reflejar la versión remota real). |

Deuda general no bloqueante detectada de paso (rendimiento pre-existente fuera de RRHH): ver el cierre de la entrada de F1.0 de arriba.

---

# 1. Estado general

P2–P6 implementados en rama y verificados localmente, incluidas regresiones de agotamiento y ambigüedad; remoto y E2E pendientes. Ver el paquete del Operador.










| Área | Estado | Realidad conocida / siguiente paso |
|---|---|---|
| Agencia digital | 🟡 Preparada, sin activar | `apps/agencia`, `/agencia`, proyecto `nexo-agencia`; matriz aplicada, código compilado y pruebas técnicas OK. Revisión final de Claude y activación pendientes; cuentas y visualización manuales. |
| CI / validación automatizada | ✅ Gate activo y verificado; workflow en uso | `.github/workflows/ci.yml` corre en cada PR con `typecheck` (7 apps, `next typegen && tsc --noEmit`), `lint` (todas las apps **excepto** la deuda documentada; el conjunto se deriva de `apps/*` y falla si una app no está clasificada), `build` (7 apps), `test-db-rrhh` (prueba SQL P1 contra la migración real, en PGlite) y `test-agencia-access`; `lint-deuda` expone la deuda de `flotilla` sin bloquear. El job `test-metas-importacion` se retiró con el CRM el 2026-10-20, y el gate quedó en 6 apps más 1 con deuda. Una sola orden local: `pnpm verify`. **`main` exige los cinco checks desde el 2026-10-16** (`strict: false`, `enforce_admins: true`, sin force push ni borrado de rama; verificado por API). Límites (PGlite ≠ Postgres/Supabase real; sin RLS ni concurrencia) y comandos en [CI_CHECKS.md](CI_CHECKS.md). |
| Nexo Core / Launcher | ✅ Validado | Monorepo, SSO, Multi-Zones, permisos y `nexo-core` operativos según última documentación verificada. Desde 2026-09-14, `/` es un App Launcher puro (selector de aplicaciones, sin KPIs) — ver fila siguiente. |
| Administración de usuarios y roles (`apps/nexo`) | 🟡 En producción 2026-10-14 (PR #20, `main` `ff46bce`), sin validar con sesión real | Pantallas `/configuracion/usuarios`, `/roles`, `/auditoria`, `/cambiar-contrasena` + tarjeta "Configuración" en el Launcher; `nexocore` READY en Production; sin sesión redirige al login (verificado en el dominio público). Base de datos: Paso Cero (`20261014201119`) + esquema (`20261014203144`) — roles de empresa (un rol por usuario), `core.has_permission` reescrita, 14 RPC `admin_*` con anti-escalada y auditoría, vínculo con `rrhh.empleados.user_id`; 15 pruebas SQL. Pendiente: recorrido con sesión real. Ver [status-log](status-log/2026-10-14-usuarios-roles-pantallas.md) y [`plan/12`](plan/12-administracion-usuarios-roles.md). |
| Nexo Enterprise UI (shell/navegación) | 🟡 Pusheado a `main` 2026-09-17 (`392f676`), sin verificar en producción | Sidebar azul persistente + topbar con breadcrumb en RRHH/CRM (`NexoShell`). Desde 2026-09-17: la cabecera del sidebar muestra **texto fijo "Nexo"** (sin logo/ícono, nunca el nombre de la app activa) en vez del logo dinámico + nombre de módulo de 2026-09-14 — el nombre de la app sigue en el breadcrumb/contenido. `/` de `apps/nexo` (App Launcher) se movió fuera del grupo `(app)` y ya no usa `NexoShell` en absoluto (sin sidebar/topbar/buscador/menú) — header propio mínimo. `/configuracion/marca` conserva su `NexoShell` sin cambios de comportamiento. Código en `main`, `next build` limpio en las 3 apps — sin recorrido autenticado real ni verificación visual del deployment de Vercel disparado por el push. |
| RRHH infraestructura | ✅ Desplegada | Schema, permisos, RLS, expedientes básicos y kiosko existen. |
| RRHH modelo Expediente General/Laboral | ✅ F1.1 (datos) + reconciliación de UI 2026-09-14 + expediente ampliado 2026-09-16 | `rrhh.empleados` ya no acepta datos laborales/credenciales en el alta (2026-09-07); `documento_identidad` obligatorio desde 2026-09-16. Columnas viejas deprecadas, no eliminadas — limpieza final pendiente. `/expedientes/[id]` (persona) tiene sus 6 pestañas con modelo real desde 2026-09-16 (Datos personales, Dirección, Información complementaria, Cuentas bancarias, Beneficiario, Documentos) — ver fila "RRHH expediente ampliado" abajo. El ciclo contractual completo sigue en `/contratacion/contratos`. |
| RRHH contratos | ✅ Reglas nuevas aplicadas en `nexo-core` 2026-09-18 | `rrhh.contratos`/`rrhh.contrato_compensacion` existen, con RLS, trigger de estado y RPC (2026-09-07); `puesto_id`/`departamento_id` desde 2026-09-16. Desde la migración `20260918043955_rrhh_contratos_reglas_y_endurecimiento` (aplicada a `nexo-core`, verificado post-aplicación): puesto/departamento/plantilla son `NOT NULL` con FKs compuestas al mismo tenant, `plantilla_contrato_id` nueva (persistida, no solo sugerida), sin `fecha_fin_prevista` al crear, `fn_crear_contrato`/`fn_editar_contrato` validan la relación completa server-side y rechazan un segundo contrato abierto por empleado. Código en `main` (`392f676`), sin recorrido autenticado real todavía. |
| RRHH catálogos de Contratación | ✅ CRUD 2026-09-16 + departamento obligatorio aplicado 2026-09-18 | `rrhh.puestos`/`rrhh.departamentos`/`rrhh.plantillas_contrato`/`rrhh.puesto_plantillas` — CRUD real en Contratación → Catálogos. `rrhh.puestos.departamento_id` es `NOT NULL` en `nexo-core` (con FK compuesta a `rrhh.departamentos` del mismo tenant) — el formulario de Puestos ya exige departamento. Plantillas sin archivo adjunto todavía (catálogo de nombre solamente). |
| RRHH Storage privado (documentos) | 🟡 Implementado 2026-09-16, endurecido y aplicado 2026-09-18, sin validar con credenciales reales | Bucket `rrhh-documentos-privados` + `rrhh.empleado_documentos`, subida por URL firmada directa (evita el techo de 4.5MB de Vercel). `confirmarDocumentoSubido` verifica el objeto y su metadata REALES en Storage (antes confiaba en lo que reportaba el navegador); el bucket ya tiene `file_size_limit=10485760`/`allowed_mime_types` reales en `nexo-core` (verificado post-aplicación). Pendiente: `SUPABASE_SERVICE_ROLE_KEY` en el proyecto Vercel de RRHH y un recorrido autenticado real de subir/descargar. |
| RRHH expediente ampliado (Dirección/Info. complementaria/Cuentas/Beneficiario) | 🟡 Implementado 2026-09-16, endurecido y aplicado 2026-09-18, geografía de municipios pendiente | Modelo + UI real para las 4 pestañas + Documentos (fila de arriba). `core.geografia_ni_departamentos` sembrada (17 filas); `core.geografia_ni_municipios` **vacía a propósito**. Ya aplicado en `nexo-core`: FK compuesta multiempresa `(empleado_id, company_id)` en las 4 tablas + `empleado_documentos`; FK compuesta que exige que el municipio elegido pertenezca al departamento geográfico elegido; corregida una condición de carrera real en el trigger de validación de porcentaje de beneficiarios (dos escrituras concurrentes podían superar 100% en conjunto). |
| RRHH PIN contractual | ✅ F1.3 completada | El PIN nace solo al activar contrato, se revoca al finalizar, kiosko validado end-to-end contra la nueva credencial (2026-09-07). |
| RRHH jornadas | ✅ F1.4 completada (modelo mínimo) | `rrhh.jornadas`/`jornada_dias`/`contrato_jornadas`/`feriados` existen, con RLS, RPC de asignación e interfaz de lectura para F1.5 (2026-09-07). Jornada obligatoria para activar contrato. Falta el motor de consolidación (F1.5) y las decisiones de negocio (hora extra, feriado pagado, etc.), explícitamente no implementadas. |
| Asistencia (app) | 🟡 Implementada en local 2026-10-17, sin sesión real ni deploy | Separada de RRHH por decisión del usuario; vive en `apps/rrhh` (route group `(asistencia)`, `/rrhh/asistencia`). Visibilidad `asistencia.ver_modulo` (`20261017173701`, aplicada; hoy solo el owner); contenido con los permisos `rrhh.asistencia.*`. Pendiente: asignar el permiso de visibilidad a roles (Paso Cero), RPC de envíos del kiosco, enrolamiento de dispositivos (hoy manda `NEXO_KIOSKO_ID`), Incidencias/Justificaciones (F1.6). [Detalle](status-log/2026-10-17-asistencia-app.md). |
| Asistencia reportes | 🟡 RPC aplicadas 2026-10-18; UI en local, recorrida como owner, sin commit ni deploy | 5 reportes con PDF e impresión auditados. [Detalle](status-log/2026-10-18-asistencia-reportes.md). |
| RRHH consolidación de asistencia | ⏳ Pendiente | No existe marcas → horas consolidadas persistidas. El cálculo por día ya existe en `rrhh.fn_asistencia_dias` (reportes, 2026-10-18) y F1.5 debe reutilizarlo, no duplicarlo. |
| RRHH planillas | 🟡 PL2a, PL2b y PL2c **aplicadas en `nexo-core`** (2026-10-21 y 2026-10-22) y probadas en PGlite; pantallas construidas en local, sin commit y sin recorrido visual | Motor ordinario y de aguinaldo, vacaciones, préstamos, embargos, liquidación como documento, pasivo, provisiones, declaraciones e importación desde Asistencia, todo en RPC. 40 rutas bajo `/rrhh/planillas`. Falta el recorrido con sesión, una segunda persona aprobadora, confirmar valores con el contador y la corrida en paralelo con AG. [PL2a](status-log/2026-10-21-planilla-pl2a-motor.md), [PL2b, PL2c y pantallas](status-log/2026-10-21-planilla-pl2b-pl2c-pantallas.md). |
| Kiosko RRHH | ✅ Migrado a PIN contractual | `rrhh.fn_registrar_marca_kiosko` valida contra `rrhh.contrato_credenciales` desde F1.3 (2026-09-07), verificado end-to-end. Misma UI/rate-limit de antes. **2026-10-15 (P1, issue #30, en `main` `fc2b309`):** además cuenta coincidencias y no marca si el PIN es ambiguo en la empresa del kiosco — misma UI; la migración `20261015181000` sigue sin aplicarse a `nexo-core`. [Detalle](status-log/2026-10-15-rrhh-p1-pin-ambiguo.md). **2026-10-20, en producción:** el usuario reportó que en un iPad sin sesión el kiosco lo mandaba al login. `/rrhh/kiosco` sí abría sin sesión, pero `/kiosco`, `/asistencia/kiosco`, `/rrhh/asistencia/kiosco` y `/rrhh/Kiosco` (con mayúscula) caían en el login. Ahora esas rutas redirigen a `/rrhh/kiosco` antes del guard: van en `redirects` de `apps/nexo` y `apps/rrhh`, y en `apps/rrhh/src/proxy.ts`, que además deja de eximir rutas como `/kioscoX`.
- Se fusionó con el [PR #49](https://github.com/Jccastillo25/nexo/pull/49) (`a072908`), con los cinco checks obligatorios en verde.
- `nexocore` y `nexo-rrhh` quedaron READY en Production.
- Verificado en el dominio público sin sesión y con User-Agent de iPad: las variantes llegan a "Terminal sin asignar" y `/rrhh/kioscos` y `/rrhh/asistencia` siguen pidiendo login.
- Falta la prueba del usuario en el iPad.
- [Detalle](status-log/2026-10-20-kiosco-rutas-sin-sesion.md), que está en `main`. |
| RRHH piloto supervisado / MVP operativo (corte 2026-10-15) | 🟡 P2–P6 locales; piloto sin autorizar | PIN único, contrato, secuencia/idempotencia, confirmación y Marcas en rama. Sin aplicación remota ni E2E; M1–M4 fuera de alcance. [Paquete](RRHH_PAQUETE_OPERADOR.md). |
| Identidad digital de empleados | ⚠️ Refactor de PIN cerrado, identidad digital sigue pendiente | `nombre_usuario + PIN` para acceso operativo ya no existe como diseño vigente (D-06 cerrado F1.3). Falta construir usuario+contraseña vía Supabase Auth (Fase 2, `core.identidad`) — diseño objetivo documentado, sin implementar. |
| Panel de Conductor Web | 🟡 Código legacy aprovechable | Ruta360 tiene flujo de conductor, pero falta adaptación a identidad Nexo, contrato RRHH y permisos unificados. |
| CRM | ❌ Retirado 2026-10-20 | Borrado por pedido del usuario: `apps/crm`, la app `crm` del Launcher con sus 34 permisos, el esquema `metas` y todo el contenido de `crm` (`20261020143821`). No había datos. El código está en la rama local `respaldo/crm-2026-10-20`. Pendiente del usuario: quitar `crm` de "Exposed schemas" (luego se borra el esquema vacío) y decidir qué hacer con el proyecto de Vercel del CRM. [Detalle](status-log/2026-10-20-retiro-crm-replica-ag-negocio.md). |
| Réplica de AG Negocio (app `erp`) | 🟡 Inventario hecho 2026-10-20; falta el Paso Cero | El ERP actual (AG Negocio, propietario) se replica completo dentro de Nexo, sin el bloque académico. Son 144 pantallas en 11 grupos y las etapas van de R0 a R9; R0 (retiro del CRM) está hecha. Apps `erp` y `precios` registradas inactivas, con el Paso Cero del plan 17. Hay que rehacerlo con la matriz recurso × acción de AG antes de crear tablas. [Plan 18](plan/18-replica-ag-negocio.md). |
| Transporte / Flotilla | 🟡 Zona adaptada (E1) y esquema de Entregas aplicado (E2, 2026-10-24); sin RPC ni pantallas de órdenes | 2026-10-23, [plan 22](plan/22-flotilla-entregas.md) (Entregas): Paso Cero aplicado (`20261024034727`), Ruta360 retirado y `apps/flotilla` como zona de Nexo (SSO, `NexoShell`, permisos). Falta habilitar la app para la empresa, E2 (schema `flotilla`), la habilitación de conductores sobre RRHH y el proyecto de Vercel. |
| Productos (catálogo maestro) | 🟡 Esquema aplicado + app implementada en local (2026-10-16), sin validar con sesión real | Paso Cero (`20261016203638`) + esquema/RPC (`20261016214634`) en `nexo-core`, probados en transacciones revertidas. `apps/productos` compila (typecheck/lint/build). App **activa** para la empresa desde 2026-10-16 (`20261016220935`, para probar en local); sin datos, sin commit ni proyecto Vercel: la tarjeta del Launcher de producción no abre hasta el deploy. Nexo es el maestro; el ERP se alimenta por exportación. Ver [plan 14](plan/14-productos.md). |
| Listas de precios | ⏳ Pendiente | App aparte `precios` (decisión del 2026-10-17), registrada inactiva el 2026-10-20. Replicará las escalas de precio, los multiprecios y los usuarios por escala de AG Negocio (etapa R3 del [plan 18](plan/18-replica-ag-negocio.md)). |
| Inventario | ⏳ Pendiente | Va dentro de la app `erp` (etapa R3 del plan 18): bodegas, kardex a costo promedio, ajustes, transferencias, levantamiento, fábrica y recetas. Lee el catálogo de Productos, no lo duplica. |
| Fabricación | ⏳ Pendiente | No existe app/schema. |
| Nexo Mobile Android/iOS | ⏳ Preparación arquitectónica | No existe `apps/mobile`. La app será operacional y no replicará toda la Web. Primera vertical productiva prevista: conductor/Transporte. |
| Kernel compartido `@nexo/supabase/@nexo/auth` | ⚠️ Deuda | Existe estructura, pero la arquitectura documenta duplicación de clientes/middleware entre apps. |

---

# 2. Divergencias conocidas: estado actual vs modelo objetivo

D-04 resuelto en el SQL P3 de esta rama; pendiente de aplicación. El resto fuera del piloto conserva su estado.










Confirmadas en remoto durante **F1.0** (2026-09-07, ver [`status-log/2026-09-07-f1-0-auditoria-real.md`](status-log/2026-09-07-f1-0-auditoria-real.md)). Pendientes de corregirse mediante migraciones nuevas en F1.1–F1.3 (la mayoría ya resuelta, ver estado de cada una).

## D-01 — `rrhh.empleados` mezcla identidad y relación laboral

**Confirmado por `information_schema.columns` contra `nexo-core` remoto.** `rrhh.empleados` tiene hoy, en producción: `puesto`, `departamento`, `fecha_ingreso` (`NOT NULL`), `fecha_baja`, `estado` (`NOT NULL`), `pin_hash`, `nombre_usuario` (`NOT NULL`, único por `company_id`), `pin_bloqueado`, `intentos_fallidos`, `user_id` (único).

Objetivo: `rrhh.empleados` = Expediente General. Puesto, departamento, fechas laborales, estado y PIN dependen del contrato.

**Estado: ✅ resuelto en F1.1** — columnas deprecadas explícitamente (nullable + `comment on column`), `fn_crear_empleado` ya no las acepta. Las columnas en sí siguen existiendo (sin eliminar) hasta una migración de limpieza posterior tras F1.2.

## D-02 — `fn_crear_empleado` generaba PIN

**Estado: ✅ completamente resuelto (F1.1 + F1.3)** — `rrhh.fn_crear_empleado` ya no acepta ni genera nada de eso; `rrhh.fn_activar_contrato` genera el PIN automáticamente al activar. Flujo completo verificado end-to-end.

## D-03 — compensación ligada al empleado

**Confirmado**: `rrhh.empleado_compensacion` tenía `primary key (empleado_id)` — 1:1 real con el empleado, verificado en `pg_constraint` remoto.

**Estado: ✅ resuelto en F1.2** — `rrhh.contrato_compensacion` ahora es 1:1 con `rrhh.contratos`, no con `rrhh.empleados`. `rrhh.empleado_compensacion` (la vieja) sigue existiendo, sin datos, pendiente de una migración de limpieza posterior.

## D-04 — marcas no contienen `contrato_id`

Objetivo: cada marca válida debe quedar contextualizada con el contrato laboral vigente.

**Estado: implementado en rama (P3), pendiente de aplicar y verificar en remoto** — `rrhh.contratos` (F1.2) y `rrhh.contrato_jornadas`/`rrhh.fn_jornada_vigente_contrato` (F1.4) ya existen, pero el vínculo aún está pendiente en main/remoto según la última evidencia. P3 lo implementa en esta rama; consolidación F1.5 sigue pendiente.

## D-05 — planilla sin motor

Las tablas base (`rrhh.planillas`, `rrhh.planilla_detalles`) existen y están vacías (0 filas); el motor consolidación → planilla no está construido.

Estado: 🟡 PL2a aplicada en `nexo-core` (2026-10-21, `20261021191441`): motor de la planilla ordinaria en RPC, con líneas por concepto y `contrato_id`. `planilla_detalles` queda en desuso. Las horas extra y las faltas entran como novedades; desde PL2c (2026-10-22) también se pueden importar, elegidas a mano, desde Asistencia. PL2b agrega las prestaciones. [Detalle](status-log/2026-10-21-planilla-pl2a-motor.md), [PL2b y PL2c](status-log/2026-10-21-planilla-pl2b-pl2c-pantallas.md).

## D-06 — PIN usado como login operativo

Existe la migración `20260902000008_rrhh_nicaragua_and_contracts.sql`, aplicada en remoto, que define `nombre_usuario + PIN` y `rrhh.fn_validar_acceso_operativo()`/`public.validar_acceso_operativo()` como mecanismo de acceso operativo. Sin consumidor en ningún frontend del monorepo.

**Estado: ✅ refactor de PIN completamente cerrado (F1.3)** — `rrhh.fn_registrar_marca_kiosko` ya no depende en absoluto de `rrhh.empleados.pin_hash`; el PIN vive exclusivamente en `rrhh.contrato_credenciales`, ligado al ciclo de vida del contrato. Pendiente solo la mitad de identidad digital (usuario+contraseña), que es Fase 2 y no bloquea RRHH.

## D-07 — identidad de conductor no debe ser independiente

Ruta360 legacy (`apps/flotilla`) mantiene sus propios conceptos de conductor/login, con su propio `supabase/migrations` apuntando a un proyecto Supabase distinto al de Nexo. Confirmado que no consume nada de `nexo-core` y que no tiene proyecto Vercel dentro del equipo de Nexo.

Estado: ⚠️ confirmado, Fase 4, con preparación desde Fase 1/2. Sin código actual que lo contradiga (Ruta360 todavía no está conectado a Nexo).

## D-08 — quinto rol RRHH: `consulta`

`core.app_roles` (`module_slug='rrhh'`) tiene 5 filas, no 4: `admin` (36 permisos), `supervisor_asistencia` (16), `especialista_planillas` (12), `gestor_expedientes` (9) y **`consulta`** (7, solo lectura). Cualquier Paso Cero de permisos nuevo debe asignar explícitamente el alcance de `consulta`.

Estado: ℹ️ hallazgo de F1.0, sin urgencia — no contradice el modelo objetivo, solo estaba subdocumentado.

---

# 3. Fase 1 — tablero de ejecución RRHH

P1–P6 preparados en rama; P7 remoto/manual y autorización pendientes. F1.5–F1.10 completos y M1–M4 no se dan por cerrados.










| ID | Entregable | Estado | Evidencia / nota |
|---|---|---|---|
| F1.0 | Auditoría real `main` + Supabase + Vercel + permisos + datos | ✅ | [Detalle](status-log/2026-09-07-f1-0-auditoria-real.md). Sin código/DB pendiente de revisión. |
| F1.0.1 | Cierre de acceso operativo PIN heredado (D-06) | ✅ | [Detalle](status-log/2026-09-07-f1-0-1-cierre-pin-heredado.md). |
| F1.1 | Separar Expediente General / Expediente Laboral | ✅ | [Detalle](status-log/2026-09-07-f1-1-expediente-general-laboral.md). |
| F1.2 | `rrhh.contratos` + compensación contractual | ✅ | [Detalle](status-log/2026-09-07-f1-2-contratos-compensacion.md). |
| F1.3 | PIN generado solo al activar contrato | ✅ | [Detalle](status-log/2026-09-07-f1-3-pin-contractual.md). Verificado end-to-end real (23 pasos), incl. 2 bugs reales encontrados y corregidos. |
| F1.4 | Jornadas/turnos/feriados mínimos | ✅ | [Detalle](status-log/2026-09-07-f1-4-jornadas-minimas.md). Gap de rol señalado (`gestor_expedientes` sin `turnos.ver`), pendiente de aprobación aparte. |
| F1.5 | Consolidación diaria de asistencia | ⏳ | Marcas → horas/incidencias. **Próximo trabajo** — ver sección 7. |
| F1.6 | Incidencias/justificaciones | ⏳ | Validación previa a planilla. |
| F1.7 | Motor de planillas + snapshots | 🟡 | PL2a, PL2b y PL2c aplicadas en `nexo-core` y probadas en PGlite; pantallas construidas en local sin recorrido visual ([plan 20](plan/20-planilla.md), [PL2a](status-log/2026-10-21-planilla-pl2a-motor.md), [PL2b y PL2c](status-log/2026-10-21-planilla-pl2b-pl2c-pantallas.md)). Falta el recorrido con sesión, la segunda persona aprobadora y la corrida en paralelo. Sin integración contable todavía. |
| F1.8 | UI administración de kioscos | ⏳ | Eliminar SQL manual como operación normal. |
| F1.9 | Seguridad/RBAC/E2E | ⏳ | Roles + RPC directa + RLS + advisors + contrato finalizado + PIN revocado. Incluye las pruebas por rol real pendientes de F1.3/F1.4 (ver esas entradas del log). |
| F1.10 | Recorrido completo validado | ⏳ | Criterio para declarar RRHH MVP listo. |
| P1–P7 | Piloto supervisado de kiosco/marcas | 🟡 P2–P6 implementados y verificados localmente | Rama `codex/rrhh-piloto-mvp`; migraciones pendientes. P7 remoto/manual y autorización sin ejecutar. [Paquete](RRHH_PAQUETE_OPERADOR.md). |
| M1–M4 | Corrección auditada y validación de MVP operativo | ⏳ | Posterior a P1–P7; permiso específico y original conservado. Sin implementación. No incluye nómina. |

---

# 4. Acceso de Conductores y Kiosko

Cliente de kiosco con confirmación genérica e idempotencia preparado; no autentica usuarios ni modifica la identidad digital.










Fuente específica: [`DRIVER_ACCESS_AND_KIOSK.md`](DRIVER_ACCESS_AND_KIOSK.md).

## Regla vigente

```text
PIN                 = asistencia
usuario+contraseña  = identidad digital
conductor            = habilitación/rol operacional
```

### Kiosko

- dispositivo autorizado;
- usuario introduce solo PIN;
- backend resuelve contrato activo;
- determina entrada/salida por secuencia cuando sea inequívoco;
- no crea sesión Auth.

Para el **piloto propuesto** rige [el corte 2026-10-15](RRHH_PILOTO_MVP_OPERATIVO.md): un par por contrato/día local, confirmación de toda salida, reintentos idempotentes y protección ante PIN ambiguo —esta última ya implementada y fusionada en `main` (`fc2b309`), con la migración `20261015181000` aún sin aplicar a `nexo-core`—. El resto del corte sigue sin implementar y el piloto no está autorizado.

### Panel de Conductor Web

- login con usuario + contraseña;
- Supabase Auth;
- valida contrato activo + habilitación conductor + permisos;
- misma identidad que Nexo Mobile.

### Habilitación conductor

```text
Empleado + contrato activo
→ habilitar conductor
→ crear/reutilizar auth.users
→ asignar rol/permisos Transporte
```

Si ya existe identidad digital, no crear otra.

### Deshabilitar conductor

- no nuevos viajes;
- Transporte deja de autorizar;
- PIN de asistencia sigue activo si el contrato sigue activo;
- historial se conserva.

### Finalizar contrato

- PIN revocado;
- no nueva marcación;
- no nuevos viajes;
- revocar habilitaciones laborales dependientes del contrato;
- conservar historial.

---

# 5. Preparación Nexo Mobile

La lógica nueva reside en RPC autorizadas reutilizables. No se implementó app móvil.










## Estado actual

No existe una app móvil Nexo integrada al monorepo.

Ruta objetivo futura:

```text
apps/mobile
```

## Principio de alcance

**Nexo Mobile no replica la versión Web.** Es una superficie operacional por rol y permisos.

Ejemplo conductor:

```text
Viaje actual
Mi vehículo
Inspección
Iniciar/continuar/finalizar viaje
GPS
Incidencias
Evidencia de entrega
Mis viajes
Liquidación
Perfil
```

No debe incluir por defecto administración de empleados, planillas, permisos, configuración global o administración completa de flota.

## Requisitos que deben cumplirse desde ya

| Requisito | Estado |
|---|---|
| Lógica de negocio en RPC/servicio reutilizable, no solo Server Actions web | 🟡 aplicar a toda lógica nueva |
| Supabase Auth compartido | ✅ backend disponible; integración móvil futura |
| usuario+contraseña para sesiones operativas | ⏳ diseño aprobado; implementación pendiente |
| PIN separado de Auth | ⚠️ requiere refactor de diseño existente |
| permisos `core.has_permission()` como autoridad | ✅ modelo existente |
| tipos compartidos | ⚠️ centralización pendiente |
| `@nexo/supabase` maduro | ⚠️ Fase 2 |
| almacenamiento seguro móvil | ⏳ |
| offline queue/idempotencia | 🟡 existe experiencia legacy en Ruta360; falta adaptar a Nexo |
| GPS/cámara | 🟡 existe experiencia legacy en Ruta360; falta adaptar |
| push notifications | ⏳ |
| Android build | ⏳ |
| iOS build | ⏳ |

### Primera vertical móvil prevista

**Transporte / conductor**, porque requiere GPS, cámara y offline-first y el código legacy ya contiene esos flujos.

---

# 6. Protocolo de actualización para Claude

Cada entrega conserva registro y commit. Pruebas locales no sustituyen validación remota; sin UUID del dispositivo ni PIN versionados.










En cada subfase ejecutada, actualizar este archivo en el mismo commit o conjunto de commits que cambia el producto:

1. Crear una entrada nueva en `docs/status-log/YYYY-MM-DD-slug.md` con el detalle completo (qué se auditó/migró/verificó, evidencia, deuda pendiente) — **no** volver a convertir este archivo en un monolito narrativo.
2. Agregar una fila a la tabla de la sección 0 (arriba) apuntando a esa entrada.
3. Actualizar las secciones 1-7 de este archivo (estado general, divergencias, tablero de fase, próxima acción) para que reflejen la realidad nueva — son el dashboard que se lee siempre, deben quedar correctas sin tener que abrir el log.

Registrar como mínimo en la entrada de `status-log/`:

- estado anterior;
- estado nuevo;
- fecha;
- commit SHA;
- migración(es);
- tablas/RPC afectadas;
- pruebas realizadas;
- resultado remoto;
- blockers pendientes.

Si el código/DB remoto contradice este tracker:

1. verificar la realidad;
2. corregir el tracker;
3. explicar la divergencia;
4. después continuar desarrollo.

Nunca ajustar la realidad para que coincida artificialmente con un documento viejo.

---

# 7. Próxima acción obligatoria

**Planilla ([plan 20](plan/20-planilla.md)):** PL2a, PL2b y PL2c están **aplicadas** en `nexo-core` y las pantallas están en local, sin commit. Pasos siguientes:
1. Recorrido visual con sesión de las 40 pantallas (`/rrhh/planillas`) y verificación de cálculos por el usuario.
2. Commit de las migraciones, pantallas y documentación cuando el usuario lo pida.
3. Regenerar los tipos de `apps/rrhh` cuando el archivo compartido `database.types.ts` no tenga cambios de otra sesión, y tipar `periodos/datos.ts`.

Pendientes del usuario:
- dar el rol de aprobador a una segunda persona (sin eso nadie puede aprobar planillas, liquidaciones ni vacaciones);
- asignar salario al contrato activo que no lo tiene;
- validar con el contador los valores "verificar", el tope del embargo, la fracción de horas extra y el INSS e IR de vacaciones pagadas;
- registrar el número INSS en el expediente;
- corrida en paralelo con AG.

**Réplica de AG Negocio ([plan 18](plan/18-replica-ag-negocio.md), pedido del usuario 2026-10-20):** R0 está hecho: el CRM se retiró (`20261020143821`) con respaldo en la rama local `respaldo/crm-2026-10-20`. Pasos siguientes:
1. Paso Cero de R1 (base) y R2 (contabilidad): **preparado y ensayado, sin aplicar**. Son 50 códigos, que reemplazan 10 del plan 17 ([plan 18 §9](plan/18-replica-ag-negocio.md), `supabase/migrations/20261021090000_erp_r1_r2_paso_cero.sql`). Espera la aprobación del usuario.
2. Esquema con pruebas en transacción revertida.
3. Pantallas en `apps/erp`.

Pendientes del usuario:
- Quitar `crm` de "Exposed schemas"; después se borra el esquema vacío.
- Pedir a AG Software un respaldo completo de sus datos.
- Dar los datos de la resolución DGI.

**Presupuesto ([plan 19](plan/19-presupuesto.md), pedido del usuario 2026-10-20):** es una app aparte que vivirá en el proyecto de Vercel `nexo-crm`, así que con eso queda decidido qué hacer con ese proyecto. El Paso Cero (`20261020183127`), el esquema (`20261020184030`), los ajustes de la revisión (`20261020191334`) y la activación (`20261020192310`) están **aplicados**. `apps/presupuesto` está en local y en verde ([detalle](status-log/2026-10-20-presupuesto-app.md)). Siguen:
1. ~~Activar la app~~ ✅
2. ~~El recorrido y la carga del Excel real~~ ✅ (47 301 facturas y presupuesto 2026).
3. Commit y PR. Falta además generar las metas sugeridas y vincular los vendedores, que decide el usuario.
4. Cambiar el *Root Directory* de `nexo-crm` a `apps/presupuesto` justo antes de fusionar, y poner `PRESUPUESTO_APP_URL` en `nexocore`.
5. Importar el Excel real y vincular vendedores.
6. Fase 2 (presupuesto por centro de costo), después de R2.

**RRHH/kiosco:** P1–P6 **aplicadas** en `nexo-core` y su cliente **fusionado en `main`** (PR #47, `6619646`, 2026-10-17). Siguiente: P7 según [el paquete del Operador](RRHH_PAQUETE_OPERADOR.md). No iniciar marcaciones reales antes. P7 requiere remoto, usuarios reales y decisión de autorizar o posponer. No se sustituyen F1.5–F1.10 ni se inicia M1–M4.

**`feat/launcher-iconos`:** commit `82664fb` + merge de `main` (con el PR #47) en local; conflictos resueltos en `apps/rrhh/src/lib/nav.ts` (Marcas con `href` e icono) y en este archivo. Encima, las correcciones de seguridad H2/H7/H8/H9 están sin commit y `pnpm verify` está en verde. Pendiente:
- activar H6 en el dashboard de Supabase;
- el usuario sigue sumando cambios antes de **un solo push** y PR.

Detalle: [status-log](status-log/2026-10-17-revision-seguridad.md).

**Productos (pedido del usuario 2026-10-16):** esquema y app listos y activados; app corriendo en `localhost:3005`. Siguiente: el usuario hace el recorrido con su sesión; después, importación real de los 699 productos, commit + PR, proyecto Vercel `nexo-productos` con `PRODUCTOS_APP_URL` y prueba en producción. Luego, Paso Cero de Listas de precios (app aparte o sección: sin decidir).

**RRHH P1 (issue #30): aplicada.** Se aplicó en `nexo-core` el 2026-10-17 junto con P2–P6, con la versión remota `20261017131004` (el archivo `20261015181000_…` se renombró sin tocar su SQL).

**CI (issue #43) — protección de `main`: hecha y verificada.** Desde el 2026-10-16 `main` exige los cinco checks del workflow `CI` (`typecheck`, `lint`, `build`, `test-db-rrhh`, `test-agencia-access`, app GitHub Actions `app_id 15368`) antes de fusionar, con `strict: false`, `enforce_admins: true` y sin force push ni borrado de rama; **no** se exigen `lint-deuda (no bloquea)`, `Vercel Preview Comments` ni `Supabase Preview`. Verificado por API: `GET /branches/main` → `"protected": true` y `GET /branches/main/protection` devuelve exactamente esos cinco contextos. Comandos reproducibles y cómo cambiarlo: [CI_CHECKS.md](CI_CHECKS.md#protección-de-main-estado-verificado). Queda pendiente, aparte, corregir el lint pre-existente de `flotilla` para moverlo a `lint:gate`.

**Bloque complementario #18:** revisar Claude/Previews y obtener aprobación humana antes de publicar Agencia, fusionar su integración y habilitar la tarjeta. El orden de RRHH de abajo no cambia. Las pruebas de navegador son manuales por decisión del usuario.

```text
F1.0   — Auditoría de realidad RRHH        ✅ completada 2026-09-07
F1.0.1 — Cierre PIN heredado (D-06)        ✅ completada 2026-09-07
Paso Cero — Matriz contratos/credenciales  ✅ aplicada 2026-09-07
F1.1   — Separar Expediente General/Laboral ✅ completada 2026-09-07
F1.2   — rrhh.contratos + compensación      ✅ completada 2026-09-07
F1.3   — PIN exclusivamente contractual     ✅ completada 2026-09-07
F1.4   — Jornadas mínimas                   ✅ completada 2026-09-07
Nexo Enterprise UI — rediseño visual        ✅ completada 2026-09-07
Fix estabilización RRHH — nav/UX/bug P0     ✅ completado 2026-09-08
Reconciliación func./visual — Marca/Launcher/
  Expediente-Contratación/edición real       ✅ completado y en producción 2026-09-14
                                              (main 4cc8a6a, Vercel READY)
Bloque "pre-F1.5" — cédula/favicon/catálogos/
  Storage privado/expediente ampliado         ✅ implementado y compilado 2026-09-16
                                              (build+lint limpios, sin merge a main todavía —
                                               ver docs/status-log/2026-09-16-rrhh-pre-f1-5.md)
Bloque 2026-09-17 — reglas de contratación,
  endurecimiento de seguridad e integridad,
  Launcher/sidebar sin chrome de módulo        ✅ código en main (392f676) + migración
                                              APLICADA a nexo-core (2026-09-18,
                                               versión remota 20260918043955) —
                                               ver docs/status-log/2026-09-17-contratos-reglas-y-endurecimiento.md
Paso Cero — administración de usuarios/roles ✅ aplicado 2026-10-14
                                              (20261014201119, rama feat/usuarios-roles-nexo)
 ↓
Administración de usuarios/roles — esquema + RPC ✅ aplicado 2026-10-14
                                              (20261014203144, 15 pruebas SQL)
 ↓
Administración de usuarios/roles — pantallas  🟡 EN PRODUCCIÓN 2026-10-14 (PR #20,
                                              main ff46bce, nexocore READY); falta
                                              recorrido con sesión real (crear rol/usuario,
                                              primer ingreso, desactivar)
Agencia digital (#18)                         ⏸ en espera por decisión del usuario: código en
                                              main, app inactiva en nexo-core, sin
                                              AGENCIA_APP_URL de Production (/dashboard no
                                              funciona hasta activarla)
 ↓
Atención (turnos de sala de espera) — Paso Cero ✅ aplicado 2026-10-14 (20261014222454)
 ↓
Atención — tablas + RPC + pg_cron  ✅ aplicado 2026-10-14 (20261014224341), app inactiva
 ↓
Atención — pantallas (Sucursales en Configuración, apps/atencion, pantalla pública)  🟡 implementadas
                                              2026-10-14 (build/lint limpios)
 ↓
Atención — proyecto Vercel nexo-atencion ✅ creado 2026-10-14 + ATENCION_APP_URL (Preview)
 ↓
Atención — activada en nexo-core 2026-10-14 (20261014230022), antes del merge por decisión
                                              del usuario: la tarjeta ya aparece en producción
                                              pero /atencion solo funciona en el preview
 ↓
Atención — ATENCION_APP_URL de Production ✅ configurada 2026-10-14 (efectiva tras el merge)
 ↓
Atención — merge a main + prueba real en producción  ⏳ siguiente
 ↓
Atención — nombre del cliente y del agente en la pantalla  🟡 en producción 2026-10-15
                                              (PR #22, main 9e52219, nexo-atencion READY,
                                              migración 20261015151609); falta prueba en el televisor
 ↓
Atención — pantalla sin login + datos configurables  🟡 en producción 2026-10-15
                                              (PR #23, main 6db1a54, migración 20261015155035);
                                              pantalla sin sesión verificada; falta prueba en TV
 ↓
Atención — número de factura en la pantalla (opt-in)  🟡 en producción 2026-10-15
                                              (PR #24, main 953e52e, migración 20261015161222);
                                              falta prueba en TV
 ↓
Atención — fila en tiempo real + aviso sonoro  🟡 en producción 2026-10-15
                                              (PR #25, main 9e015cc, migración 20261015162540);
                                              falta prueba en el puesto con navegador real
 ↓
Atención — cronómetros de espera y atención  🟡 en producción (PR #26, main 88748ea);
                                              falta prueba en el puesto
 ↓
Atención — Paso Cero métricas/reactivar  ✅ aplicado 2026-10-15 (20261015165620)
 ↓
Atención — reactivar "no se presentó" + factura única  🟡 en producción (PR #27,
                                              main 23329db); falta prueba con sesión real
 ↓
Atención — métricas y dashboards por agente y global  🟡 en producción 2026-10-15
                                              (PR #28, main bf21845, migración 20261015173729);
                                              falta prueba con sesión real
 ↓
F1.5 — Consolidación de asistencia  ⏳ pendiente (sigue explícitamente NO iniciado —
                                          "no iniciar F1.5" fue parte del alcance de ambos
                                          bloques anteriores — pendiente de instrucción
                                          explícita del usuario)
```

Antes de dar el bloque "pre-F1.5" por completamente cerrado (no solo
implementado): completar `core.geografia_ni_municipios` con una fuente
oficial verificada, agregar `SUPABASE_SERVICE_ROLE_KEY` al proyecto
Vercel de RRHH, y ejecutar un recorrido autenticado real (subir/descargar
un documento, CRUD de cada catálogo, alta con cédula duplicada) — ver
deuda completa en
[`status-log/2026-09-16-rrhh-pre-f1-5.md`](status-log/2026-09-16-rrhh-pre-f1-5.md).

**Bloque 2026-09-17/18 — cerrado**: código commiteado y pusheado a `main`
(`392f676`), migración
[`20260918043955_rrhh_contratos_reglas_y_endurecimiento.sql`](../supabase/migrations/20260918043955_rrhh_contratos_reglas_y_endurecimiento.sql)
**aplicada a `nexo-core`** el 2026-09-18 (prechecks de solo lectura antes
de aplicar, postchecks de firma/`NOT NULL`/permisos/bucket después,
`get_advisors(security)` sin hallazgos nuevos). El archivo se creó
localmente con el prefijo `20260917100000` (fecha de escritura) y se
renombró a `20260918043955` (fecha/hora real de aplicación) sin modificar
su SQL, para que el nombre del archivo coincida con la versión que quedó
registrada en `supabase_migrations.schema_migrations` — mismo criterio ya
usado en migraciones anteriores de este proyecto (ej. `20260916150000_...`
quedó como `20260916152106` en remoto). Pendiente, sin relación con la
migración: un recorrido autenticado real en navegador (sin credenciales
de prueba en este entorno) y verificar que el deployment de Vercel
disparado por el push de `392f676` terminó `READY`. Ver deuda completa en
[`status-log/2026-09-17-contratos-reglas-y-endurecimiento.md`](status-log/2026-09-17-contratos-reglas-y-endurecimiento.md).

Detalle completo del recorrido de verificación de F1.3 (23 pasos) y de la comparación explícita `Plan vs main vs migraciones vs remoto vs Vercel vs permisos vs datos` de F1.0: ver [`status-log/2026-09-07-f1-3-pin-contractual.md`](status-log/2026-09-07-f1-3-pin-contractual.md) y [`status-log/2026-09-07-f1-0-auditoria-real.md`](status-log/2026-09-07-f1-0-auditoria-real.md) respectivamente.

Solo después de aprobado el Paso Cero correspondiente se inicia cada tramo de la migración hacia:

```text
Persona
→ Contrato
→ PIN asistencia
→ Jornada
→ Asistencia
→ Planilla

Persona
→ identidad digital Nexo
→ roles/habilitaciones
→ Panel Conductor Web / Nexo Mobile
```
