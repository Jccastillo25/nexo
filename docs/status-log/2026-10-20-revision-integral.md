# 2026-10-20 — Revisión integral: UI/UX, rendimiento, seguridad y módulos

**Estado:** diagnóstico, solo lectura. No hubo cambios de código ni migraciones, y no hay commit.

El usuario pidió revisar cuatro frentes con subagentes:
1. UI/UX: "la experiencia se siente muy genérica" y no es "el sistema limpio, profesional y detallado que queremos".
2. Velocidad de carga y fluidez.
3. Ciberseguridad y protección contra robos.
4. Que no haya módulos repetidos, y cómo optimizar el flujo para que todos se comuniquen.

## Cómo se hizo

- **Subagentes:** el coordinador lanzó 4, en paralelo y en solo lectura:
  - `ux-planner` para UI/UX;
  - `reviewer` para rendimiento, con la skill `nexo-react-next`;
  - `reviewer` para seguridad, con `nexo-security`;
  - `Plan` para módulos e integración.
- **Datos remotos que reunió el coordinador:**
  - advisors de `nexo-core`;
  - `pg_stat_statements`, acumulado desde 2026-08-30;
  - errores de runtime de Vercel en los últimos 7 días;
  - lista de proyectos de Vercel;
  - nombres de las variables de `nexo-rrhh`, sin descifrar.
- **Recorrido visual:** se hizo en el Chrome del usuario, con su sesión. Se recorrieron el Launcher, el Dashboard de RRHH, el de Asistencia, Expedientes, Atención, Agencia y Configuración → Usuarios. En cada pantalla se midió Navigation Timing y LCP. El login también se revisó, sin sesión, en el navegador integrado.
- **Verificación en el código** de los hallazgos clave, hecha por el coordinador:
  - el buscador del topbar es falso;
  - solo existe `error.tsx` en Presupuesto;
  - los textos del login todavía nombran al CRM;
  - `MetricCard` no admite comparación;
  - Productos pide 17 permisos sueltos por página;
  - los paquetes `@nexo/auth`, `@nexo/supabase` y `@nexo/types` están vacíos;
  - el filtro de `presupuesto_indicadores` no tiene límite inferior;
  - `next` está en 16.3.0;
  - `destinoSeguro` no filtra caracteres de control;
  - `NEXO_KIOSKO_ID` no está en `nexo-rrhh`.
- Ningún subagente escribió archivos. Se comprobó por fecha de modificación: el único archivo tocado fue `apps/nexo/next-env.d.ts`, que el build regeneró sin cambiar su contenido.

## Medido en remoto

**Supabase, `pg_stat_statements`:**

| Función | Llamadas | Media | Máximo | Lectura |
|---|---|---|---|---|
| `has_permission` | 6 489 | 5,4 ms | 1 807 ms | Contra 265 de `mi_perfil` y 338 de `get_visible_apps`: unas 20 por carga de página |
| `get_platform_settings` | ~3 880 | — | — | Se pide 2 veces por request |
| `presupuesto_indicadores` | — | 660 ms | 1,3 s | — |
| `presupuesto_equipo` | — | 226 ms | — | — |
| `presupuesto_mi_avance` | — | 158 ms | — | — |
| `presupuesto_importar_facturas` | — | 1,1 s por lote | — | Aceptable para una importación |

**Advisors de seguridad:**
- 6 funciones `security definer` ejecutables por `anon`: `atencion_pantalla_estado`, `canjear_codigo_terminal`, `estado_terminal`, `get_platform_settings`, `registrar_marca_kiosko` y `registrar_marca_terminal`.
- 100 ejecutables por `authenticated`.
- `auth_leaked_password_protection` desactivado: es H6.
- 119 tablas con RLS y sin políticas (presupuesto 57, rrhh 18, atencion 16, core 16, productos 12). Responden al patrón de schema cerrado y acceso por RPC.

**Advisors de rendimiento:**
- 106 FK sin índice en tablas padre: rrhh 52, productos 17, atencion 16, core 14, presupuesto 7.
- 2 políticas RLS con `auth.<fn>()` sin `(select …)`, en `core.company_memberships` y `core.user_app_roles`.
- 124 índices sin uso.

**Vercel:**
- Un solo grupo de errores en 7 días: `/rrhh/contratacion/contratos`, el 2026-10-17, con *"more than one relationship was found for 'contratos' and 'empleados'"*. Ya está corregido en el código con `empleados!contratos_empleado_id_fkey`.
- En `nexo-rrhh`, `SUPABASE_SERVICE_ROLE_KEY` tiene el aviso de Vercel `readable-secret`: está guardada como variable común, no *Sensitive*.
- Las métricas de TTFB y Speed Insights por API requieren Observability Plus (plan Pro), así que no se pudieron leer.

**Navegador, carga real:**

| Pantalla | Situación | TTFB | LCP | JS |
|---|---|---|---|---|
| Dashboard de RRHH | Primera entrada a la app (salto de zona, navegación completa) | 92 ms | 2,8 s | 235 KB |
| Atención | Primera entrada | 1,16 s (con redirección) | 2,7 s | 300 KB |
| Agencia | Primera entrada | 1,39 s | 3,2 s | 502 KB, dashboard de demostración |
| Expedientes | Misma zona, JS en caché | — | 0,6 s | — |
| Usuarios | Misma zona, JS en caché | — | 0,6 s | — |
| Dashboard de Asistencia | Misma zona, JS en caché | — | 1,0 s | — |

Según el build local, el ~0,5 MB de JS **no es código de Agencia**. Es el runtime base de React y Next que cada zona descarga una vez: el `/dashboard` de RRHH también suma unos 515 KB sin comprimir. La diferencia entre 235 y 502 KB viene de cómo se midió, comprimido frente a descomprimido o con caché. Es un costo propio de Multi-Zones.

## Seguridad: 13 hallazgos

0 críticos, 2 altos, 7 medios y 4 bajos.

| ID | Gravedad | Hallazgo | Corrección |
|---|---|---|---|
| N1 | Alta | Next 16.3.0 en todas las apps (Flotilla 16.2.12). `pnpm audit --prod` informa 6 críticos y 9 altos, incluidos RCE y SSRF en Image Optimization. No se verificó si se pueden explotar en Vercel. | Subir a next ≥ 16.3.8 y actualizar el lockfile |
| N2 | Alta | Sin MFA. El login no frena intentos. La protección de contraseñas filtradas está apagada (H6). Mínimo de 8 caracteres. | MFA TOTP para owner, administración y roles sensibles (`aal2`); activar contraseñas filtradas, CAPTCHA y límites en Supabase Auth |
| N3 | Media | La cookie de sesión de `@supabase/ssr` dura 400 días y no es httpOnly. | Time-box e inactividad en Auth y `cookieOptions` con `maxAge` corto |
| N4 | Media | Ninguna app tiene CSP, HSTS ni Permissions-Policy. El login se puede meter en un iframe. | Helper de cabeceras compartido |
| N5 | Media | Lectura masiva sin rastro: `presupuesto_facturas` (200 por página, sin tope de offset), `presupuesto_clientes` y `productos_exportar` (todo con costos, sin auditar), y cuentas bancarias y compensación de RRHH. | Auditar lecturas sensibles, contadores por usuario y día, tope de offset |
| N6 | Media | En Asistencia, ver y exportar están separados solo en la pantalla: con `reportes.ver`, la RPC devuelve hasta 5 000 filas sin auditar. | RPC de exportación que exija `exportar` y audite en la misma transacción |
| N7 | Media | `registrar_marca_kiosko` sigue ejecutable por `anon` (H5). Como `NEXO_KIOSKO_ID` **no está** en `nexo-rrhh` (verificado), se puede cerrar ya. | `revoke execute … from anon, authenticated` y quitar el camino heredado |
| N8 | Media, probable | `destinoSeguro` del login acepta `/%09/evil.com`: posible redirección abierta. No se probó en ejecución. | Rechazar caracteres de control y validar el origen con `new URL` |
| N9 | Media | Finalizar el contrato solo revoca el PIN. No desactiva la cuenta de Nexo ni el vínculo con `presupuesto.vendedores`. | Revocación automática o reporte diario |
| N10 | Baja | La importación de Presupuesto sobrescribe facturas sin guardar el valor anterior. | — |
| N11 | Baja | El "Emitido por" del PDF sale de `raw_user_meta_data`, que el propio usuario puede editar. | — |
| N12 | Baja | El matcher del proxy de Atención usa el prefijo `pantalla` sin barra. | — |
| N13 | Baja | Funciones nuevas de P1–P4c con `search_path` no vacío (H3, mitigado). | — |

Estado de los hallazgos anteriores:
- **H3:** sigue abierto.
- **H5:** sigue abierto, pero se puede cerrar ya.
- **H6:** sigue abierto.

Bien resuelto (verificado):
- Las RPC de Presupuesto, Productos, Asistencia y el enrolamiento validan el permiso, filtran por empresa, usan `search_path=''` y no dejan EXECUTE a `anon`.
- Las Server Actions llaman a `requirePermission` antes de actuar.
- No hay secretos versionados ni `dangerouslySetInnerHTML`.
- La cookie del kiosco es httpOnly y `strict`.
- `canjear_codigo_terminal` tiene límite de intentos global.

## Rendimiento

Causas principales:
0. **Cada entrada a un módulo paga dos veces el recorrido completo.** La raíz de 5 apps hace `redirect()` a `/dashboard` desde un Server Component (`apps/*/src/app/page.tsx`), así que la cadena borde → rewrite → función → proxy con `getUser()` → `generateMetadata` se repite. Esto explica los TTFB de más de 1 s medidos en Atención y Agencia. La corrección es mover la redirección a `redirects()` de cada `next.config.ts`, que Vercel resuelve en el borde.
1. Los permisos se piden uno por uno y sin `cache()` entre layout y página. En Productos son 34 RPC por carga; en la ficha de expediente, 14; en el contrato, 12.
2. `getUser()` va contra Auth dos veces por navegación: una en el proxy y otra en el layout.
3. `presupuesto_indicadores` recorre toda la historia, porque su CTE solo filtra `fecha <= v_fin`. El dashboard no pinta hasta que termina.
4. No hay streaming: Productos, Atención, Agencia y Nexo no tienen `loading.tsx`, y solo el login usa `Suspense`.
5. No hay caché de datos: `get_platform_settings` se pide 2 veces por request y vuelve dinámicas todas las rutas.

Otros hallazgos:
- Awaits en cascada.
- Atención llama a una Server Action por cada evento de Realtime, sin debounce, y la pantalla de TV hace sondeo cada 3 s.
- El cliente de Supabase pesa 268 KB y solo lo usa `/expedientes/[id]`.
- El análisis del Excel de Presupuesto bloquea el hilo principal unos 2 s.

Cambios estructurales propuestos:
- Una RPC `public.mis_permisos(company, codigos[])` con `getPermisos` cacheado en `@nexo/permissions`, que también sirva para Mobile.
- Una tabla resumen `presupuesto.ventas_cliente_mes`.
- Medir el costo del salto de Multi-Zones.

Builds locales de `rrhh` y `nexo`: OK, con todas las rutas dinámicas (ƒ).

## UI/UX

8 causas de lo "genérico":
1. Faltan `Button`, `Field`, `Alert`, `Skeleton`, `Pagination` y `Card` en `@nexo/ui`. Hay 46 botones primarios escritos a mano y unas 20 copias de `inputClass`.
2. Tokens a medias: hay dos azules (hex de Tailwind v3 en `tokens.css` contra OKLCH de v4), un Toast oscuro y el Launcher con fondo violeta.
3. Controles falsos en todas las pantallas: el buscador "próximamente", la campana y muchos ítems "Pronto"/"Próximamente".
4. Dashboards hechos de tarjetas iguales sin comparación. Agencia muestra datos de demostración en producción.
5. Los estados de error, vacío, carga y acceso denegado no tienen diseño. Se muestran códigos técnicos de permiso al usuario.
6. Datos crudos de la base (estado en minúsculas, fechas ISO), voseo y tuteo mezclados, y errores de formulario sin asociar a su campo.
7. Sidebar colapsado sin acceso a los hijos y menú móvil sin Escape ni foco retenido.
8. Marca incoherente: "Nexo", "Grupo CT" y "Materiales J Castillo". El login es la única pantalla oscura, y su texto nombra al CRM retirado y a Flotilla.

Propuesta "Nexo Enterprise UI v2", toda en `packages/ui`: tokens, `Button`, `Field`, MetricCard v2, PageHeader v2, DataTable v2, EmptyState v2, `Alert`, `Skeleton` y `formato.ts` con `America/Managua`. Fases 0 a 4. El logo de Grupo Castillo Torrez admite 3 opciones (A, B o C, ver decisiones).

En el recorrido se vieron datos de prueba en producción: el empleado "Empleado Prueba" y el rol "Prueba".

## Módulos e integración

- **Apps repetidas:** no hay dos apps que hagan lo mismo. Una inferencia a confirmar: `apps/agencia` y el proyecto de Vercel `materiales-jcastillo-marketing-dashboard`, que no está en el monorepo.
- **Código repetido:** cliente y middleware de Supabase, `company.ts`, `getPanelUrl`, `platform-settings`, `sin-acceso` y signOut están copiados en 6 apps. Los middlewares ya divergieron en cabeceras de caché y cookies.
- **Más repeticiones:** 3 formas de leer permisos, 3 traductores de errores, 2 formatos de C$, 2 lectores de Excel de AG y 4 `database.types.ts` escritos a mano.
- **Paquetes vacíos:** `@nexo/auth`, `@nexo/supabase` y `@nexo/types` no tienen contenido, y `@nexo/config` solo tiene su `package.json`.
- **Dominio repetido:**
  - personas en 4 lugares: `rrhh.empleados`, `core.perfiles`, `presupuesto.vendedores` y Flotilla;
  - clientes como texto libre;
  - tipo de cambio fijo en el código (36.6243);
  - el Paso Cero de R1 del ERP (`20261021090000`, **no aplicado**) propone una empresa y una sucursal propias del ERP, que se superponen con `core.companies` y `core.sucursales`.
- **Comunicación:** no hay ningún mecanismo de eventos entre módulos. Solo existe `core`.
- **Propuesta:**
  - datos maestros en `core`: empresa fiscal, sucursales, `terceros`, monedas y tipo de cambio;
  - contratos `public.<modulo>_*` versionados;
  - outbox `core.eventos` particionado, con despachador `pg_cron`;
  - paquetes `@nexo/supabase`, `@nexo/auth`, `@nexo/format`, `@nexo/excel` y `@nexo/config`.
- **Hoja de ruta:** F0 higiene → F1 kernel de código (la Fase 2 del Plan Maestro) → F2 contratos → F3 maestros, **antes de aplicar el Paso Cero de R1** → F4 eventos → F5 identidad.

## Divergencias documentales encontradas

- **Productos:** `MODULES.md` decía "sin proyecto Vercel", pero `nexo-productos` existe, con un deploy de producción READY (`dpl_H1bQ2hnbkWZP9beJE5psAyDUNcjk`). Ya se corrigió en `MODULES.md`.
- **`ARCHITECTURE.md` §12** lista solo 3 proyectos de Vercel; hoy hay 8 en el equipo.
- **`MODULES.md`:**
  - repite Listas de precios (dos filas);
  - Inventario y Fabricación aparecen como apps propias, aunque el plan 18 los metió en el ERP.
- **`CLAUDE.md`** enlaza `packages/ui/Sidebar.tsx`, que ya no existe.
- **`company.ts`:** las 6 copias todavía comentan `apps/crm`.

## Decisiones pendientes del usuario

1. **Marca:**
   - **A:** logo en el login, el Launcher, el PDF y el favicon;
   - **B:** A, más el azul y el naranja como acento;
   - **C:** monograma en el sidebar, que revierte la decisión del 2026-09-17.
   Para cualquiera hace falta el nombre oficial y el logo en SVG.
2. ¿El login pasa al tema claro?
3. ¿Se ocultan el buscador y la campana hasta que funcionen?
4. ¿La interfaz habla de vos o de tú?
5. ¿Qué se hace con Agencia: ocultarla, o fusionarla con `materiales-jcastillo-marketing-dashboard`?
6. ¿`core.terceros` será el ancla única de identidad? ¿El tipo de cambio va en `core`?
7. ¿Finalizar un contrato suspende la cuenta de Nexo?
8. ¿`getClaims()` en los layouts? Es más rápido, pero una sesión revocada se detecta con hasta 1 h de retraso.

## Pendiente / no verificado

- Si N1 se puede explotar en Vercel.
- Si N8 se puede explotar en ejecución.
- Límites y sesiones de Supabase Auth.
- Lista de "Exposed schemas" (`crm` sigue ahí, vacío).
- Quién tiene en remoto `cuentas_bancarias.ver`, `compensacion.ver` y `presupuesto.ventas.factura.ver`.
- `EXPLAIN ANALYZE` de las RPC de Presupuesto.
- Vista móvil.
- Speed Insights por API, que requiere el plan Pro.
