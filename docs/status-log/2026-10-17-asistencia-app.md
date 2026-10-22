# 2026-10-17 — App Asistencia, separada de RRHH

- **Pedido del usuario:** "Tenemos que separar RRHH: la gestión del personal,
  contrataciones, planilla, etc. de kiosco y todas sus configuraciones", con
  "un análisis de qué debe estar en qué módulo y que el otro pueda llamar
  información de ahí".
- **Decisión aprobada:** app propia en el Launcher, en el mismo código y deploy
  que RRHH (`apps/rrhh`, proyecto `nexo-rrhh`), ruta `/rrhh/asistencia`. Se
  descartó una app independiente (proyecto Vercel propio y matriz `asistencia.*`
  nueva) por costo; se puede retomar más adelante.
- **Estado anterior → nuevo:** grupo "Asistencia" dentro del menú de RRHH →
  app Asistencia propia. Implementada y revisada en local; sin recorrido con
  sesión real, sin deploy ni commit.
- **Rama:** `feat/launcher-iconos` (se suma al push único).

## División

| App | Qué tiene |
|---|---|
| RRHH | Expedientes y documentos, contratos, compensación, PIN del contrato, jornadas, feriados, catálogos y planillas |
| Asistencia | Terminal del kiosco (`/rrhh/kiosco`, sin cambios y fuera de los menús), dispositivos, historial de envíos (pendiente), marcas, incidencias y justificaciones ("Pronto") |

Datos compartidos, todo en el schema `rrhh` y por RPC con permiso (también
para Mobile):
- Asistencia lee empleados y contratos ya dentro de `fn_consultar_marcas`, sin
  necesitar permisos de expedientes.
- Planillas leerá el resumen de asistencia con una RPC de la consolidación F1.5
  (propuesta: `asistencia_resumen_diario`); su permiso se decide en F1.5.

## Base de datos

`20261017173701_asistencia_registrar_app`, aplicada (ver MIGRATION_LOG):
`core.apps` `asistencia` + `company_apps` y el permiso `asistencia.ver_modulo`
(trigger). Sin permisos de contenido nuevos: se usan
`rrhh.asistencia.{marcas,kioskos,justificaciones,turnos,feriados}.*`.

## Código

- `apps/rrhh/src/app/(asistencia)/asistencia/`:
  - `layout.tsx`: NexoShell "Asistencia", con guard de `asistencia.ver_modulo` y menú filtrado por permiso.
  - `page.tsx`: redirige a `dashboard`.
  - `dashboard/`: tarjetas "Marcas de hoy" (`marcado_en` del día de America/Managua) y "Dispositivos activos"; "Envíos no aceptados hoy" muestra "Pendiente de integración".
  - `marcas/`: movida desde `(app)/marcas`.
  - `dispositivos/`: registrar, editar, desactivar con confirmación y reactivar. Sin eliminar. El `id` solo llega al navegador con `kioskos.editar` ("Copiar identificador"). `NEXO_KIOSKO_ID` se compara en el servidor ("En uso por esta terminal").
- `apps/rrhh/src/lib/`: `asistencia-nav.ts`, `permisos-asistencia.ts` (con `cache()` por solicitud) y `fecha-managua.ts`.
- `apps/rrhh/src/lib/nav.ts`: sin el grupo Asistencia ni el enlace al kiosco.
- Dashboard de RRHH: 3 KPIs. "Marcas del día" se fue a Asistencia; tenía además un error de zona horaria (medianoche UTC).
- `apps/rrhh/next.config.ts`: `/marcas` → `/asistencia/marcas` (307).
- `sin-acceso`: texto genérico.
- `packages/ui/app-icons.tsx`: icono `clock` para el mosaico.

## Flujo y verificación

1. `ux-planner`: especificación (rutas, menús, dashboard, dispositivos, contrato de datos y criterios). El usuario la aprobó junto con las respuestas del coordinador a las dudas.
2. `ui-frontend` implementó. El coordinador ajustó el esqueleto de carga del dashboard de RRHH.
3. `reviewer`: sin bloqueos de código. Corregido por el coordinador: permisos calculados una vez por solicitud, `hoyManagua` movida a `lib/` y foco devuelto al cerrar el formulario de dispositivos.
4. Pruebas: typecheck y lint de `rrhh` y `nexo-panel`, `lint:gate`, `--filter rrhh build` (lista `/asistencia/*` y ya no `/marcas`) y typecheck completo, en verde. Después de las correcciones del coordinador se repitieron typecheck y lint de `rrhh`.

## Botón "Abrir terminal" (mismo día)

Pedido del usuario: "no veo dónde puedo entrar al kiosko para asignarle el
número, o sea, a la pantalla". La terminal (`/rrhh/kiosco`) no va en ningún
menú. Por eso, en Dispositivos, la fila marcada "En uso por esta terminal"
(si está activa) tiene un enlace "Abrir terminal" que la abre en otra pestaña
(`next/link`, `target="_blank"`). La asignación del dispositivo a la pantalla
sigue haciéndose con `NEXO_KIOSKO_ID`. El usuario pidió además especificar el
enrolamiento desde la propia pantalla. El `ux-planner` entregó la
especificación como **propuesta pendiente de aprobación**, sin implementar:

- código de un solo uso, generado en Dispositivos y canjeado en la terminal
  por un token en cookie httpOnly;
- tablas `rrhh.kiosko_credenciales` y `rrhh.kiosko_canje_limites`, sin grants;
- 6 RPC;
- convivencia temporal con `NEXO_KIOSKO_ID` y una migración de cierre que
  revoca a `anon` la RPC `registrar_marca_kiosko` (cierra H5).

Se comprobó en remoto que `anon` sigue pudiendo ejecutar
`public.registrar_marca_kiosko` y que no tiene grants sobre
`kiosko_dispositivos`. Por eso la terminal nunca muestra el nombre del
dispositivo, que era una "lectura best-effort". Typecheck y lint de `rrhh` en verde. Sin verificación con
sesión real.

## Enrolamiento: decisiones y migraciones preparadas

El usuario aprobó la especificación con las recomendaciones del coordinador:

- permisos nuevos `kioskos.asignar` y `kioskos.revocar`, solo para el Administrador de RRHH;
- código de 10 dígitos que vence en 10 minutos;
- desactivar un dispositivo conserva su equipo;
- el token no vence;
- el nombre del dispositivo se ve en la terminal;
- se hace antes de P7.

Las migraciones `20261017180753` (Paso Cero) y `20261017180853` (tablas y RPC) se ensayaron en `nexo-core` con todo revertido y, con la aprobación del usuario, **se aplicaron** (advisors en MIGRATION_LOG: solo los avisos esperados). Falta la UI: columna "Equipo" y acciones en Dispositivos, y la pantalla de asignación y la cookie en `/kiosco`.

### Interfaz del enrolamiento

Hecha por `ui-frontend` y revisada por `reviewer`.

- **Dispositivos:**
  - columna "Equipo": Sin equipo, Código pendiente (con su vencimiento) o Equipo asignado (con el último uso);
  - acciones "Asignar equipo", "Cancelar código" y "Revocar equipo", con confirmación al reasignar y al revocar;
  - panel del código, que lo muestra una sola vez con su vencimiento.
- **Terminal:**
  - `kiosco/terminal-cookie.ts`: cookie `nexo_terminal` (httpOnly, `sameSite=strict`, `path=/rrhh/kiosco`, 400 días);
  - con cookie se usa solo el token y nunca la env;
  - sin cookie se usa la env;
  - sin ninguna de las dos, o con `?asignar=1`, aparece la pantalla de asignación;
  - el token nunca va al cliente ni a los logs.

Correcciones del coordinador tras la revisión:

- **M1:** al revocar, la cookie queda con un valor inútil en vez de borrarse, así que recargar no vuelve a la env.
- **M2:** `?asignar=1`, para poder enrolar mientras exista `NEXO_KIOSKO_ID` (local y probablemente `nexo-rrhh`). El panel del código y "Abrir terminal" apuntan ahí.
- **B1:** el foco va al título después de cancelar o revocar.
- **B2:** el freno corto de doble envío ya no se muestra como "demasiados intentos".
- **B3:** la cookie se renueva con cada marca registrada.
- **B5:** se corrigió el texto accesible de "Abrir terminal".

Typecheck, lint y P5 (3/3) en verde después de las correcciones. En el navegador del panel, `/rrhh/kiosco` sigue en modo heredado y `?asignar=1` muestra la pantalla de asignación sin desbordar el ancho. No se canjeó ningún código real.

Deuda registrada:

- **M3:** cualquiera puede mantener bloqueada la asignación para todas las empresas con unas 20 llamadas anónimas cada ~25 min. **Resuelto:** `20261017183023` aplicada con la aprobación del usuario (umbral 300, bloqueo auditado y SQL de desbloqueo en el encabezado); advisors sin cambios.
- **M4:** `ConfirmDialog` del kit sin manejo de foco ni Escape. Ya está propuesto como tarea aparte.
- **B4:** un código de reemplazo con un equipo vigente no se ve ni se puede cancelar sin revocar.
- **B6:** con `sameSite=strict`, la primera visita desde un enlace externo llega sin cookie.
- **B7:** la pantalla "desactivada" no se recupera sola.
- **B9:** los canjes fallidos no se auditan.
- **B10:** el hash del código no lleva sal.
- **B11:** comprobar si los logs de Postgres guardan parámetros de RPC.
- **B12:** foco al pasar del PIN a la asignación.
- **`RowActionsMenu` del kit:** sin foco visible ni Escape.

## Corrección: Contratos no cargaba (bug previo, mismo día)

Al probar el flujo completo, el usuario reportó: "contrato muestra error al entrar". Log del servidor: `Could not embed because more than one relationship was found for 'contratos' and 'empleados'` (PGRST201).

- **Causa:** la migración `20260918043955` agregó claves foráneas compuestas por empresa (`contratos_*_company_fk`) junto a las simples (`*_fkey`). Desde entonces, los embeds sin indicación de `/contratacion/contratos` y `/contratacion/contratos/[id]` son ambiguos. Seguramente fallaba también en producción desde esa fecha; no es una regresión de esta entrega.
- **Corrección:** los dos `select` indican la FK simple (`empleados!contratos_empleado_id_fkey`, `puestos!contratos_puesto_id_fkey`, `departamentos!contratos_departamento_id_fkey`, `plantillas_contrato!contratos_plantilla_contrato_id_fkey`). Las claves del resultado no cambian.
- **Verificación:**
  - typecheck de `rrhh` en verde;
  - contra la API REST de `nexo-core`: sin indicación da PGRST201; con indicación la relación se resuelve y solo queda el 401 esperado sin sesión.
  - No quedan otros embeds ambiguos en `apps/rrhh`. Se revisaron todas las tablas de `rrhh` que tienen FK duplicadas.

## Teclado físico en el PIN del kiosco (mismo día)

El usuario reportó que el teclado numérico de la PC no funcionaba en el kiosco. La pantalla del PIN no escuchaba el teclado físico; solo lo hacía la de asignación. Ahora las dos aceptan:
- la fila de números;
- el teclado numérico, también con Bloq Num apagado (se lee `code` = `Numpad0`…`Numpad9`);
- la tecla de retroceso.

Usan las mismas funciones que el teclado táctil, así que respetan sus bloqueos. Typecheck, lint y P5 (3/3) en verde. Se probó en el navegador sin completar el PIN (nada enviado a la base).

## Descanso en las marcas: cambio de alcance (en especificación)

Pedido del usuario: controlar la entrada, el inicio y el fin del descanso y el fin de jornada. Decisiones del 2026-10-17:
- botones con las acciones válidas después del PIN;
- un descanso por día;
- se puede salir sin marcar descanso, pero "cuenta como si lo tomó" (interpretación pendiente de confirmar);
- se hace **antes de P7**.

**Cambia el corte de piloto aprobado el 2026-10-15** (un par entrada/salida, sin descanso marcado). Especificación del `ux-planner` aprobada con las recomendaciones del coordinador:
- D1 (a): el sistema asume el descanso no marcado y lo descuenta en F1.5;
- no se puede salir con el descanso abierto;
- el botón es la confirmación, también para la entrada;
- espera de 20 s;
- las vistas previas cuentan en el límite;
- la vista por día queda para después;
- "Iniciar descanso" aparece siempre.

Migración `20261017233458_rrhh_p4c_marcas_descanso` ensayada con todo revertido y **aplicada** con la aprobación del usuario (ver MIGRATION_LOG). Documentos del corte actualizados: `RRHH_PILOTO_MVP_OPERATIVO` (reglas 1 y 3, estados, recorrido, kiosco, tickets P4c/P5b/P6b y lista P7), `RRHH_PAQUETE_OPERADOR` (guion P7.2), `plan/03-rrhh-dominio` y `RRHH_MVP`. Pendientes: el kiosco con botones, el freno por IP y Marcas (`ui-frontend`), las pruebas P4/P5/P7 y los documentos del corte (`RRHH_PILOTO_MVP_OPERATIVO`, `RRHH_PAQUETE_OPERADOR`, `plan/03`, `RRHH_MVP`).

### Interfaz del descanso (P5b/P6b) y revisión

El `ui-frontend` hizo el kiosco con botones:
- `kiosco/acciones.ts` (nuevo), `actions.ts`, `kiosk-flow.ts` con `choose()` y `kiosk-client.tsx` con `AccionesPanel`;
- 20 s de espera, teclas 1…n y Escape;
- resultado con la hora `h23` del servidor.

También cubrió Marcas (4 tipos, 6 estados y filtro), el texto del dashboard, `database.types.ts` y P5 (9 casos). El coordinador corrigió `asistencia_marcas.tipo` en los tipos.

El `reviewer` encontró dos problemas bloqueantes:
1. `rrhh_p6_filtros.test.mjs` importaba la ruta vieja de Marcas, así que `test:db`/`verify` fallaba. **Corregido:** apunta a la ruta nueva y tiene casos para los estados de descanso; P6 2/2.
2. **Salto del freno de PIN:** el PIN válido reiniciaba el contador de inválidos, y las confirmaciones no pasaban por el freno por IP.
   - **Código, corregido:** las confirmaciones tienen su propio freno por IP (60/min, sin intervalo mínimo).
   - **Base:** migración `20261018002033_rrhh_p4d_freno_pin` ensayada y **aplicada** con la aprobación del usuario (ver MIGRATION_LOG).

También se corrigieron:
- **#3:** la pantalla de reintento se cancela a los 20 s.
- **#5:** una tecla sostenida no elige un botón.
- **#6:** un estado desconocido en Marcas se muestra tal cual, en advertencia.
- **#9:** un temporizador ya no queda colgado al desmontar.

Typecheck y lint de `rrhh`, P5 9/9 y P6 2/2 en verde.

Deuda:
- **#4:** `rrhh_p7_concurrencia.mjs` y `rrhh_p4_secuencia_idempotencia.prueba.sql` siguen con la firma vieja. Falta una prueba PGlite de P4c/P4d en `test:db`.
- **#8:** clave del freno por IP compartida entre terminales detrás de una misma IP.
- **#10:** anuncio de regiones vivas por lectores de pantalla, sin probar.
- **Reloj:** el reloj del kiosco está en 12 h y la hora del resultado en 24 h.

## Despliegue en producción (2026-10-18)

- **Antes del push:** `pnpm install --frozen-lockfile` y `pnpm verify` en verde en local: typecheck, lint y build de las 8 apps, P1–P7 en PGlite, P5 9/9 y P6 2/2.
- **Rama y PR:** commit `5a7a6a6` (120 archivos) en `feat/launcher-iconos` y PR [#48](https://github.com/Jccastillo25/nexo/pull/48). El repositorio no permite la fusión automática, así que se fusionó a mano por pedido del usuario cuando pasaron los checks obligatorios (`typecheck`, `lint`, `build`, `test-db-rrhh`, `test-agencia-access`). `lint-deuda (no bloquea)` falló por la deuda previa de CRM y Flotilla.
- **Merge:** `main` `9e11e82`. Producción READY en los 6 proyectos: `nexocore`, `nexo-rrhh`, `nexo-productos`, `nexo-agencia`, `nexo-atencion` y `nexo-crm`.
- **Comprobado en el dominio público, sin sesión:**
  - `/rrhh/kiosco` muestra «Terminal sin asignar» (`NEXO_KIOSKO_ID` no está en Production);
  - `/rrhh/asistencia` redirige a `/login?next=%2Frrhh%2Fasistencia`;
  - `/agencia` responde 307 al login, con `AGENCIA_APP_URL` ya efectiva.
- **Desde este deploy** el kiosco de producción vuelve a poder marcar con la firma nueva. Entre la aplicación de P4c y este deploy no pudo hacerlo.
- **Pendiente:** recorrido con sesión real (Asistencia, enrolamiento de un equipo, entrada → descanso → salida, Marcas) y la deuda #4 de pruebas.

## Pendiente y deuda

- **Recorrido con sesión real:** guard, redirección, CRUD contra RLS, conteo de Managua y portapapeles. Tampoco hay verificación visual del mosaico.
- **Paso Cero de roles:** hoy solo el owner tiene `asistencia.ver_modulo`. Un rol con `marcas.ver` y sin ese permiso termina en `/sin-acceso` al abrir `/rrhh/marcas`.
- **El permiso de visibilidad no protege las acciones:** las Server Actions validan solo el permiso de contenido (`kioskos.*`), igual que RLS. `asistencia.ver_modulo` es una barrera de interfaz.
- **`get_visible_apps` no evalúa `depends`:** si RRHH se deshabilita, el mosaico de Asistencia sigue visible. Si cae el deploy de RRHH, caen las dos apps.
- **El editor de roles agrupa por `module_slug`:** Asistencia aparece solo con "Acceso", y sus permisos funcionales siguen bajo RRHH.
- **`ConfirmDialog` del kit** no atrapa el foco ni cierra con Escape (deuda previa, afecta a todas las apps).
- **Fuera de alcance:**
  - RPC y pantalla de envíos del kiosco;
  - enrolamiento de equipos para retirar `NEXO_KIOSKO_ID`;
  - eliminar o revocar dispositivos (F1.8);
  - Incidencias y Justificaciones (F1.6);
  - corrección de marcas (M1–M4);
  - título de la terminal (después de P7).
