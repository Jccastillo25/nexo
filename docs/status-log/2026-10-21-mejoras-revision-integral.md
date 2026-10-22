# 2026-10-20/21 — Implementación de la revisión integral

**Estado:** el código está implementado y verificado en local, **sin commit, sin push y sin deploy**. Las 4 migraciones están **aplicadas en `nexo-core`** desde el 2026-10-21, con aprobación del usuario (ver "Aplicación en `nexo-core`" al final).

**Pedido del usuario:** "Empieza a hacer todo", después de la [revisión integral](2026-10-20-revision-integral.md).

**Decisión del usuario durante la tarea:** todo el lenguaje en **español neutro**, sin voseo.

## Cómo se hizo

El trabajo siguió el flujo coordinador → ejecutores `ui-frontend` → 2 revisores independientes → ronda de correcciones, en estas olas:

1. **Ola 1** (en paralelo):
   - E1: seguridad y configuración de las zonas;
   - E2: kit Enterprise UI v2 en `packages/ui`;
   - el coordinador: dependencias y migraciones.
2. **Ola 2:**
   - E3: kernel en `packages/supabase`, `packages/auth` y `packages/permissions`, con Productos como app de referencia;
   - `ux-planner`: especificación de las Fases 3 y 4.
3. **Ola 3:** 6 ejecutores por app en paralelo: nexo, rrhh (RRHH-A), Asistencia (RRHH-B), atencion, presupuesto, y productos + agencia.
4. **Revisión:** 2 revisores, uno de seguridad, kernel y SQL, y otro de interfaz, dashboards y accesibilidad. Ninguno encontró hallazgos críticos ni altos. Después, una ronda de correcciones.

El coordinador:
- hizo las instalaciones de pnpm, una sola vez por ola, para que dos agentes no tocaran el lockfile;
- corrió los builds de RRHH, que dos ejecutores editaban a la vez;
- borró los reexportadores temporales de RRHH;
- filtró el menú de RRHH por permiso;
- agregó al kit los iconos `plus`, `download`, `pencil` y `lock`, y `createAnonBrowserClient`.

## Qué cambió

### Seguridad
- **N1:** Next 16.3.0 → **16.3.8** en las 8 apps, más los overrides de pnpm `sharp@0.35.5`, `source-map-js@1.2.2` y `dompurify@3.4.17`. `pnpm audit --prod` pasó de **28 avisos (6 críticos, 9 altos)** a **"No known vulnerabilities found"**.
- **N4:** `@nexo/config/next-security`, con las cabeceras HSTS, `X-Frame-Options`, CSP `frame-ancestors 'none'; base-uri 'self'; object-src 'none'; form-action 'self'`, nosniff, Referrer-Policy y Permissions-Policy, en las 6 zonas. La CSP con `script-src` y nonces queda documentada como deuda en el archivo.
- **N7/H5:** se retiró el camino heredado `NEXO_KIOSKO_ID` del kiosco, porque se verificó que esa variable no existe en `nexo-rrhh`. La revocación en la base va en la migración `20261021164902`, ya aplicada.
- **N8:** `destinoSeguro` del login resiste caracteres de control, `\`, `//`, codificaciones y `/a/..//`. Lo probaron 19 casos del ejecutor y 25 del revisor.
- **N12:** el matcher de Atención usa `pantalla/` con barra, y el del panel, `rrhh(?:/|$)`. El kiosco de RRHH es público solo en su ruta exacta.
- **`buscarEmpleados`:** ahora exige un permiso de usuarios en el servidor.
- **Confirmación** antes de Finalizar contrato, Regenerar PIN y eliminar documento, jornada o feriado.

### Rendimiento
- **Permisos en una sola consulta por carga** con `misPermisos(LISTA)`, cacheada por request. Antes eran unas 20 por página (Productos llegaba a 34). Depende de que se aplique `mis_permisos`; mientras tanto, el respaldo hace un `has_permission` por código.
- **Una sola llamada a `getUser()` por carga**, contando el proxy aparte: `sesionActual` en el layout y `contextoActual` en páginas y acciones.
- **`getPlatformSettings`** cacheada entre requests (5 minutos), con un cliente anónimo.
- **Redirección de la raíz** de los 5 módulos en `next.config` (la resuelve el borde de Vercel). Antes pagaba dos veces todo el recorrido.
- **`loading.tsx` y `error.tsx`** en las 6 apps.
- **Presupuesto:**
  - los indicadores del dashboard van en `Suspense`;
  - el Excel se analiza en un Web Worker con respaldo;
  - la migración `20261021164748` hace la RPC unas 3 veces más rápida (en remoto, 181 ms de media frente a 660), con el mismo JSON verificado en 44 casos antes de aplicarla y en los 10 meses de 2026 después.
- **Atención:**
  - Realtime con debounce de 300 ms, sondeo solo sin conexión en vivo y foco unificado;
  - la pantalla de TV hace sondeo cada 5 s y solo con la pestaña visible.
- **RRHH:**
  - el cliente de Supabase de Documentos se carga con un import dinámico;
  - Expedientes pide sus datos en paralelo.

### Kernel compartido
Ver [ARCHITECTURE §8.1](../ARCHITECTURE.md):
- `@nexo/supabase`: `createServerClient`, `createAnonClient`, `updateSession` y `redirigirConSesion`, más las entradas `/client` y `/admin`.
- `@nexo/auth`: `getCompanyId`, `getPanelUrl`, `sesionActual`, `contextoActual`, `misPermisos`, `signOut` y `getPlatformSettings`.
- `@nexo/permissions`: agrega `getPermisos`.

Las 6 apps quedaron migradas y se borraron sus copias locales de `lib/supabase/*`, `company.ts`, `panel.ts`, `platform-settings.ts` y `signOut`.

### UI/UX: Nexo Enterprise UI v2
Ver [DESIGN_SYSTEM](../DESIGN_SYSTEM.md):
- **Kit nuevo:** `Button`, `ButtonLink`, `SubmitButton`, `Field` con `Input`/`Select`/`Textarea`, `Alert`, `Skeleton`, `PageSkeleton`, `ErrorState`, `Pagination`, `Tabs`, `TabLinks`, `formato.ts` (zona `America/Managua` y montos en C$/US$) y `theme.css`.
- **Kit actualizado:** `MetricCard` (con `delta`), `PageHeader`, `EmptyState` (variantes), `DataTable` (`numeric`, `rowHref`), `StatusBadge`, un Toast claro, y un sidebar con barra activa, grupos recursivos, menú flotante cuando está colapsado y drawer accesible.
- **Tokens:** ahora hay un solo azul (las variables de Tailwind v4).
- **Fase 3:** las pantallas de las 6 apps usan los componentes del kit.
  - Ya no se muestran códigos de permiso.
  - Las fechas usan la zona horaria de Managua.
  - El error y el vacío ya no se muestran a la vez.
  - Contratos muestra etiquetas de estado y una fila clicable, sin la acción duplicada.
  - El catálogo de Productos está paginado ("1–50 de 699").
  - El voseo de la interfaz quedó corregido, salvo en las claves que se comparan contra los textos de las RPC.
- **Fase 4: dashboards nuevos** en RRHH, Asistencia y Atención, con datos que ya existían y sin RPC nuevas. Se quitaron los `QuickActions` y las tarjetas "Pendiente de integración".
- **Menú filtrado por permiso** en Nexo y RRHH, según la regla de `CLAUDE.md`. Asistencia y Presupuesto ya lo filtraban.
- **Decisiones por defecto del coordinador**, reversibles:
  - el Launcher mantiene su degradado;
  - "Owner" pasa a "Propietario";
  - se quitó la tarjeta "Planillas pendientes";
  - los dos botones de Atención quedan al mismo nivel.

### Base de datos (escrita, no aplicada)
Ver la tabla y el rollback en [MIGRATION_LOG](../MIGRATION_LOG.md):
Ahora están aplicadas. Los nombres son los de la versión remota; se escribieron como `20261021030100…030400`:
- `20261021164649_core_mis_permisos_rls_initplan`;
- `20261021164748_presupuesto_indicadores_acotado`;
- `20261021164902_seguridad_kiosco_reportes_exportar`;
- `20261021165004_indices_llaves_foraneas`.

Antes de la aprobación:
- el ensayo de los indicadores se hizo en transacción revertida;
- el de las otras tres lo **bloqueó el control de permisos de la sesión**, por ser DDL contra `nexo-core`, y una consulta de lectura confirmó que el remoto quedó sin cambios.

Después las revisó el revisor de seguridad, se aplicaron con aprobación del usuario y se verificaron en remoto (ver al final).

## Verificación

- **`pnpm verify`** completo, exit 0:
  - typecheck 8/8;
  - lint:gate 7/7;
  - pruebas de base de datos de RRHH P1–P7 en PGlite;
  - acceso de Agencia 18/18, ahora con el código real del kernel;
  - Presupuesto 22/22;
  - build 8/8.
- **Revisor de seguridad:**
  - 0 críticos y 0 altos;
  - las 34 acciones y el Route Handler siguen llamando a `requirePermission` antes del efecto;
  - ningún Client Component importa `@nexo/auth`, `@nexo/supabase` ni `/admin` por valor;
  - las 4 migraciones se pueden aplicar con los ajustes ya hechos (`lock_timeout`, `notify pgrst` y el tope del resumen).
- **Revisor de interfaz:** 0 altos y 3 medios.
  - El contraste quedó corregido.
  - Las RPC de indicadores de RRHH y Asistencia quedan como Fase 4b.
- **Ronda de correcciones:** ver al final.

## Ronda de correcciones (después de las dos revisiones)

Hizo los 17 puntos pedidos.

**Interfaz:**
- `neutral-400` → `neutral-500` en texto con información, para cumplir el contraste.
- El gráfico por hora ya no tiene barras enfocables sin nombre.
- Una sola `primary` en Dispositivos.
- `h1` (`PageHeader`) en las ramas sin acceso de RRHH.
- `FormTabs` del expediente con nombre accesible.
- Error controlado al subir documentos.
- Contratos con filtro `?estado=`: los KPI de RRHH enlazan al listado filtrado y "Vencen en 30 días" no lleva enlace.
- Asistencia:
  - pista en "Marcas incompletas";
  - puntualidad con `porcentaje()` del kit;
  - variación con punto decimal.
- RRHH reutiliza `fecha-managua`.
- Presupuesto usa `TabLinks`.
- Productos consulta después de comprobar el permiso.

**Kit y estructura:**
- `Button` con `loading` usa `aria-disabled` y conserva el foco.
- La región del Toast se llama "Avisos".
- `global-error.tsx` en las 6 apps.

**Rendimiento:**
- Debounce de Realtime con espera máxima de 2 s y una sola carga al montar.
- Timeout de 60 s del Worker, que pasa al respaldo.

**Seguridad:**
- Kiosco público solo en la ruta exacta `/kiosco`.
- `buscarEmpleados` con verificación de permiso en el servidor.

**Coordinador**, en las migraciones:
- `lock_timeout` y `statement_timeout` en la de índices;
- `notify pgrst` en la de `mis_permisos` y en la de seguridad;
- `asistencia_reporte_resumen` también envuelta, con un tope de 200 filas para quien no puede exportar y `truncado: true`.

**Pruebas:** typecheck 6/6, lint:gate 7/7, P5 9/9, P6 15/15, Presupuesto 22/22 y Agencia 18/18.

**`pnpm verify` final**, después de las correcciones, exit 0:
- typecheck 8/8;
- lint:gate 7/7;
- `test:db` de RRHH P1–P7 en verde;
- acceso de Agencia 18/18;
- Presupuesto 22/22;
- build 8/8 (Agencia, Atención, Flotilla, Nexo, Presupuesto, Productos, RRHH y la web corporativa).

## Aplicación en `nexo-core` (2026-10-21, aprobada por el usuario)

**Cómo se aplicaron:**
- Las 4 fueron una por una con `apply_migration`, entre las 10:46 y las 10:50 (hora de Managua).
- Antes de cada una se comprobó que no hubiera sesiones abiertas en Atención, consultas activas, transacciones largas ni locks en los esquemas.
- `pg_depend` no mostró ninguna función que dependiera de las que se renombran o revocan.
- Antes de empezar, la última migración remota era `20261021160943_rrhh_planilla_paso_cero`, de otra sesión (Planilla). No entra en conflicto.

**Verificación en remoto:**

| Migración | Resultado |
|---|---|
| `mis_permisos` | Como owner devuelve solo los códigos válidos; sin sesión devuelve `{}` |
| Indicadores | Huella md5 de los 10 meses de 2026 (equipo) **idéntica** a la de antes; **181 ms** de media frente a los 660 medidos |
| Seguridad | Huella de los 4 reportes de Asistencia (owner) **idéntica** a la de antes. Un usuario sin permiso que pide 300 filas recibe `42501`. `registrar_marca_kiosko` ya no la puede ejecutar `anon`; `registrar_marca_terminal`, `canjear_codigo_terminal` y `estado_terminal` sí |
| Índices | Poscheque con 0 FK sin índice |

**Advisors después:**
- `unindexed_foreign_keys`: de 188 a **0**.
- `auth_rls_initplan`: de 2 a **0**.
- Funciones ejecutables por `anon`: de 6 a **5**, todas intencionales.
- `unused_index`: de 124 a 329. Es informativo, porque los índices nuevos todavía no tienen uso.
- `auth_leaked_password_protection`: sigue pendiente; lo configura el usuario.

## No verificado / pendiente

- **Recorrido visual con sesión real** en local o en preview: aspecto, celular, teclado, Realtime en vivo, el Worker con el Excel real, la TV y el kiosco.
- **Configuración que hace el usuario en Supabase:** activar la protección de contraseñas filtradas (H6/N2), MFA, CAPTCHA, límites de sesión (N3) y quitar `crm` de "Exposed schemas".
- **Vercel:** marcar `SUPABASE_SERVICE_ROLE_KEY` de `nexo-rrhh` como *Sensitive*.
- **Decisiones pendientes:**
  - marca o logo (A, B o C) y el nombre oficial;
  - login en tema claro;
  - buscador y campana;
  - Agencia frente al dashboard de marketing;
  - qué pasa con la cuenta al finalizar un contrato (N9);
  - `getClaims`;
  - `core.terceros` y el tipo de cambio en `core`, **antes del Paso Cero de ERP R1**.
- **Fase 4b (requiere RPC):** indicadores de RRHH y de Asistencia, envíos del kiosco, voseo dentro de las RPC de Atención y de administración, y filtros de Productos.
- **Deuda:**
  - N5: auditar y poner topes a las lecturas de Presupuesto y RRHH;
  - formato de porcentaje de los reportes y el PDF de Asistencia ("12,5 %") frente al kit ("12.5%");
  - dependencias `@supabase/*` sin uso directo en los `package.json` de las apps;
  - kit: `Card`, `BarraMeta`, `Checkbox`, variante de éxito y botón destructivo de texto.
- **Datos de prueba en producción:** el empleado "Empleado Prueba" y el rol "Prueba", con la limpieza pendiente.
