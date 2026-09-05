# Handoff — validación local de la auditoría de seguridad de RRHH

Estado (actualizado 2026-09-05, segunda vuelta): las migraciones
`20260905000001` a `003` y el código del kiosco se commitearon y
pushearon a la rama `security/rrhh-audit-hardening` (no a `main`, sin PR,
sin merge). La validación local con Docker en la otra PC **ya corrió una
vez y encontró un fallo real** en `20260905000001` — ver "Hallazgo de la
validación local" más abajo. La corrección (`20260905000004`) está
escrita y commiteada en la misma rama, **todavía sin volver a validar
localmente** — nada de esto se aplicó a `nexo-core` ni a ninguna rama de
Supabase en ningún momento.

## Por qué se llegó a este punto (contexto de la sesión)

1. Se pidió cerrar los riesgos de seguridad de RRHH antes de las pruebas
   funcionales del MVP, usando una rama de Supabase para probar sin
   tocar producción.
2. `get_cost`/`get_organization` confirmaron que la organización
   `Grupo CT` está en plan **free**; branching de Supabase solo existe en
   plan **Pro o superior** (`PaymentRequiredException: Branching is
   supported only on the Pro plan or above` — falló recién al intentar
   crear la rama, no antes).
3. Como alternativa sin costo se intentó Supabase local vía CLI (`npx
   supabase`, versión 2.116.0, instalada sin problema) + Docker. Docker
   Desktop no tiene el demonio corriendo en esta máquina (`docker info`/
   `docker ps` fallan con "no se pudo conectar al pipe de Docker
   Desktop"), y no se encontró el ejecutable, servicio ni proceso de
   Docker Desktop en esta PC (`Get-Service`, `Get-CimInstance` y
   búsquedas en las rutas estándar de instalación, todas vacías).
4. Se confirmó explícitamente: **no usar `BEGIN...ROLLBACK` contra
   `nexo-core`** para esta validación, y **retomar en la PC que sí tiene
   Docker funcionando**.

## 1. Estado de commits en `security/rrhh-audit-hardening`

Todo lo de la primera vuelta ya está commiteado y pusheado a la rama
`security/rrhh-audit-hardening` (no a `main`, sin PR, sin merge):

```
f43ae8b docs: sincronizar CLAUDE.md y docs/ con el estado real de Supabase/Vercel
fa5d27f security(rrhh): cerrar hallazgos de get_advisors en RPC y RLS antes del MVP
```

El hallazgo de esta segunda vuelta (sección 2b) agrega un tercer commit
en la misma rama con:

```
?? supabase/migrations/20260905000004_revoke_rrhh_internal_public_execute.sql
 M docs/SECURITY_VALIDATION_HANDOFF.md
```

Ningún commit de esta auditoría tocó `main` ni se aplicó a `nexo-core` o
a ninguna rama de Supabase.

## 2. Las 3 migraciones nuevas — resumen, privilegios, motivo

Ninguna se aplicó a `nexo-core` ni a ninguna rama. Numeradas
`20260905000001` a `003`, siguiente después de `20260904000001` (última
aplicada al remoto).

### `20260905000001_revoke_rrhh_internal_anon_execute.sql`

| Objeto | Antes | Después | Por qué |
|---|---|---|---|
| `rrhh.fn_crear_empleado(...)` | `EXECUTE` a `anon` (confirmado por SQL directo y por `get_advisors`) | `REVOKE EXECUTE ... FROM anon` | Su wrapper público `public.crear_empleado` ya tiene el `EXECUTE` revocado de `anon`/`PUBLIC` explícitamente (desde `20260902000009`) — la función interna del schema `rrhh` nunca recibió el mismo revoke, así que `anon` podía llamarla directo si conoce el nombre calificado por schema (`Content-Profile: rrhh`), saltándose el wrapper por completo |
| `rrhh.fn_set_pin_empleado(...)` | `EXECUTE` a `anon` (confirmado igual) | `REVOKE EXECUTE ... FROM anon` | Mismo patrón que arriba, mismo wrapper (`public.set_pin_empleado`) ya protegido, función interna sin proteger |
| `public.get_visible_apps(uuid)` | `EXECUTE` a `anon` (confirmado por `get_advisors`, pese a que `20260830000008` ya hace `revoke ... from public`) | `REVOKE EXECUTE ... FROM anon` explícito | `revoke ... from public` no alcanza contra un `GRANT` directo al rol `anon` (mismo bug de `ALTER DEFAULT PRIVILEGES` del proyecto, ya diagnosticado una vez para `crear_empleado`) — se corrige con el mismo patrón: revoke explícito al rol real |

`authenticated` conserva `EXECUTE` en las tres — ninguna deja de
funcionar para el uso legítimo (alta de empleado, cambio de PIN, grilla
de módulos), todos autenticados hoy.

### `20260905000002_kiosko_minimize_exposure_and_bloqueo_check.sql`

Requiere `DROP FUNCTION` + `CREATE` (no `CREATE OR REPLACE`) porque
cambia el tipo de retorno — Postgres no permite cambiar `RETURNS TABLE`
de una función existente sin dropearla primero. Los `GRANT` se pierden en
el drop y se re-otorgan explícitamente al final de la migración.

| Cambio | Antes | Después | Por qué |
|---|---|---|---|
| Retorno de `rrhh.fn_registrar_marca_kiosko`/`public.registrar_marca_kiosko` | `(empleado_nombre text, tipo text, marcado_en timestamptz)` | `(tipo text, marcado_en timestamptz)` | Regla obligatoria del kiosko anónimo: no debe revelar datos personales. El nombre completo del empleado se devolvía a una llamada sin sesión — se quita, el feedback del kiosko queda limitado a qué tipo de marca quedó y a qué hora |
| Filtro del `SELECT` que busca al empleado por PIN | `estado = 'activo' and pin_hash is not null and crypt(...)` | + `and not pin_bloqueado` | Gap confirmado por lectura de código: un empleado bloqueado por 3 fallos en `fn_validar_acceso_operativo` (login del módulo móvil) podía seguir marcando en el kiosko físico sin restricción, pese a compartir el mismo PIN/hash. La verificación pedida explícitamente incluye "empleado bloqueado" como caso a rechazar |
| `EXECUTE` en `public.registrar_marca_kiosko` | `anon, authenticated` | `anon, authenticated` (sin cambio, re-otorgado tras el drop) | Decisión deliberada, no tocada: el kiosko físico no tiene sesión de Supabase Auth, el PIN + `kiosko_id` es el mecanismo de autenticación |

**Decisión deliberada documentada en el propio archivo, no aplicada:** el
kiosko no incrementa `intentos_fallidos` ni fija `pin_bloqueado` cuando
el PIN es incorrecto — eso sigue siendo exclusivo de
`fn_validar_acceso_operativo`. Extender el bloqueo al kiosko abriría una
superficie de abuso nueva (alguien frente al kiosko físico podría
bloquear a propósito el acceso móvil de un compañero probando PINs
ajenos). Si se quiere ese comportamiento, es una decisión de negocio
nueva a confirmar aparte, no algo que se infirió de la auditoría.

### `20260905000003_rrhh_rls_wrap_auth_uid_initplan.sql`

Usa `ALTER POLICY` (no `DROP`/`CREATE`) sobre las 25 policies de las 7
tablas de `rrhh` (`empleados`, `empleado_compensacion`,
`kiosko_dispositivos`, `asistencia_marcas`, `planillas`,
`planilla_detalles`, `parametros_ley`), reemplazando cada
`core.has_permission(auth.uid(), ...)` por
`core.has_permission((select auth.uid()), ...)`.

**No cambia autorización** — la condición evaluada es idéntica, solo dej
de re-evaluarse `auth.uid()` fila por fila (el optimizador de Postgres
cachea el resultado de un subselect estable una sola vez por consulta en
vez de una vez por fila). Motivo: 25 avisos WARN
`auth_rls_initplan` en `get_advisors(type=performance)`, exactamente el
patrón que la documentación de Supabase recomienda corregir así. `crm` y
`core` tienen el mismo aviso en sus propias policies — **no se tocan en
esta migración**, quedan anotadas como pendiente aparte en
`docs/DATABASE.md` porque el pedido fue específicamente sobre RRHH.

## 2b. Hallazgo confirmado por validación local — corregido en `20260905000004`

La primera vuelta de validación local (Docker, otra PC) corrió las
pruebas 1-15 de la matriz de la sección 5 contra `20260905000001-003`
aplicadas desde cero (`supabase db reset`). Resultado real, no asumido:

| Prueba | Resultado obtenido | Esperado |
|---|---|---|
| `anon` ejecuta `rrhh.fn_crear_empleado(...)` directo | **Permitido** ❌ | Denegado |
| `anon` ejecuta `rrhh.fn_set_pin_empleado(...)` directo | **Permitido** ❌ | Denegado |
| `anon` ejecuta `public.get_visible_apps(uuid)` | Denegado ✅ | Denegado |
| `anon` ejecuta `public.registrar_marca_kiosko(text, uuid)` | Permitido ✅ (deliberado) | Permitido |

**Causa verificada**: `20260905000001` revocó `EXECUTE` de `anon`
puntualmente en `rrhh.fn_crear_empleado` y `rrhh.fn_set_pin_empleado`,
pero nunca tocó el `EXECUTE` que ambas funciones conservaban para el
pseudo-rol `PUBLIC` desde su creación (`create function` en Postgres
otorga `EXECUTE` a `PUBLIC` por defecto salvo que se revoque
explícitamente — es el mismo patrón que motivó el
`revoke ... from public` de `public.crear_empleado` en `20260902000009`,
pero esa vez nunca se replicó contra las funciones *internas* del schema
`rrhh`). Todo rol, incluido `anon`, hereda cualquier permiso otorgado a
`PUBLIC` — por eso revocar solo de `anon` no alcanza mientras `PUBLIC`
siga teniendo el grant: la herencia lo repone.

`public.get_visible_apps` no tuvo este problema porque nunca tuvo el
grant a `PUBLIC` en primer lugar (su único problema real era el grant
directo a `anon`, que si se corrigió bien).

### Revisión estática — quién llama a estas funciones (2026-09-05)

Búsqueda de `fn_crear_empleado`/`fn_set_pin_empleado` en todo el
monorepo (`apps/`, `packages/`, `supabase/`):

| Archivo | Qué contiene | Es una llamada real |
|---|---|---|
| [`apps/rrhh/src/app/(app)/expedientes/nuevo/actions.ts:72`](../apps/rrhh/src/app/(app)/expedientes/nuevo/actions.ts) | `supabase.rpc("crear_empleado", {...})` — **sin** `.schema("rrhh")` | ✅ Sí — pero resuelve contra el wrapper `public.crear_empleado`, nunca contra `rrhh.fn_crear_empleado` directo |
| `apps/rrhh/.../expedientes/nuevo/{actions.ts,page.tsx,nuevo-empleado-form.tsx}` (resto de menciones) | Comentarios explicando dónde vive el chequeo de permiso real | No |
| `apps/rrhh/src/lib/supabase/database.types.ts`, `apps/crm/src/lib/supabase/database.types.ts` | Declaración manual de tipos para `set_pin_empleado` (el wrapper público) | No — son tipos, no invocaciones. `apps/crm` no tiene ningún código que llame a esta función; el tipo está ahí como referencia/boilerplate compartido |
| Cualquier archivo de `apps/` | `.rpc("set_pin_empleado", ...)` o `.rpc("fn_set_pin_empleado", ...)` | **Ninguno encontrado** — no existe todavía una pantalla para cambiar/reasignar el PIN de un empleado ya creado (consistente con "Exclusiones" en `docs/RRHH_MVP.md`) |

**Conclusión**: ninguna aplicación llama a las funciones internas del
schema `rrhh` directamente, solo a sus wrappers en `public`. Por eso la
corrección no necesita compensar con ningún `GRANT` nuevo a
`authenticated`: un wrapper `SECURITY DEFINER` invoca la función interna
en su cuerpo SQL con los privilegios de su **dueño** (`postgres`), no con
los del caller original — el `GRANT`/`REVOKE` de la función interna nunca
afectó ni afecta la capacidad del wrapper de llamarla. Revocar de
`PUBLIC` sin agregar ningún grant nuevo dejó (a falta de la próxima
validación local) el wrapper funcionando igual y cierra el acceso
directo.

### Migración `20260905000004_revoke_rrhh_internal_public_execute.sql`

```sql
revoke execute on function rrhh.fn_crear_empleado(
  uuid, text, text, text, text, text, text, text, text, text, date, text, numeric
) from public;

revoke execute on function rrhh.fn_set_pin_empleado(uuid, uuid, text) from public;
```

Sin `GRANT` de compensación a `anon` ni a `authenticated` (justificado
arriba). No modifica ninguna migración existente — es un archivo nuevo,
inmutable como las anteriores. No toca `public.registrar_marca_kiosko`.

### Matriz esperada para la próxima validación local

| Comprobación | Resultado esperado |
|---|---|
| `has_function_privilege('anon', rrhh.fn_crear_empleado, 'EXECUTE')` | `false` |
| `has_function_privilege('anon', rrhh.fn_set_pin_empleado, 'EXECUTE')` | `false` |
| `has_function_privilege('anon', public.get_visible_apps, 'EXECUTE')` | `false` |
| `has_function_privilege('anon', public.registrar_marca_kiosko, 'EXECUTE')` | `true` |
| `has_function_privilege('PUBLIC', rrhh.fn_crear_empleado, 'EXECUTE')` | `false` |
| `has_function_privilege('PUBLIC', rrhh.fn_set_pin_empleado, 'EXECUTE')` | `false` |

Pendiente: correr `supabase db reset` de nuevo (aplica las 27 migraciones
del repo desde cero, incluida `20260905000004`) en la PC con Docker y
completar esta tabla con el resultado real — no dar el hallazgo por
cerrado hasta esa confirmación.

## 3. Cambios de código — enumerados

- **`apps/rrhh/src/app/kiosco/actions.ts`**: se quitó `empleadoNombre` de
  la interfaz `MarcarResult` y de la respuesta que arma
  `marcarAsistencia()` — ya no hay ningún campo con el nombre del
  empleado en el objeto que llega al cliente.
- **`apps/rrhh/src/app/kiosco/kiosk-client.tsx`**: se quitó el bloque JSX
  que mostraba `result.empleadoNombre` en el panel de éxito del kiosko;
  queda solo el mensaje genérico ("Entrada registrada"/"Salida
  registrada").
- **`apps/rrhh/src/lib/supabase/database.types.ts`**: se quitó
  `empleado_nombre` del tipo `Returns` de `registrar_marca_kiosko` (este
  archivo es manual, no autogenerado, porque `rrhh` todavía no está
  expuesto para `generate_typescript_types` — ver el comentario en la
  cabecera del archivo) para que el tipo declarado coincida con lo que
  la función de la migración 2 va a devolver una vez aplicada.

Ninguno de los tres cambia lógica de nómina, permisos, ni construye el
motor de planillas — fuera de alcance, como se pidió.

## 4. Verificación de secretos, PIN, hashes y llaves — hecha, sin hallazgos

Se corrió `grep` (case-insensitive) sobre las 3 migraciones nuevas y
sobre todos los `.md` tocados en esta sesión, buscando:
`service_role`, `jwt_secret`, prefijos de llave tipo `sk_`, `password`,
`secret`, `api key`/`apikey`, tokens `Bearer`, asignaciones literales de
`pin_hash =`, llamadas `crypt('<valor literal>'`, JWT en texto
(`eyJhbGciOi...`), y un PIN de 4 dígitos en texto libre. **Cero
coincidencias** en migraciones y documentación de esta sesión. El único
identificador incluido en documentación previa
(`901098a8-dac4-4185-aa1c-530ab69b768b`, el `id` del kiosko de prueba) es
un UUID aleatorio no-secreto por diseño — es la credencial pública del
dispositivo, no un dato personal ni una clave (ver el comentario de
`rrhh.kiosko_dispositivos` en `docs/DATABASE.md`).

## 5. Matriz de validación local — primera vuelta corrida, un fallo en corrección

Esta tabla ya se ejecutó una vez completa contra `20260905000001-003`
(sección 2b tiene el detalle de las filas 1 y 2, que fallaron). Falta
una segunda vuelta contra `20260905000001-004` para confirmar que la
corrección funcionó — ninguna fila de esa segunda vuelta está corrida
todavía. "Evidencia ya reunida" marca lo que se verificó de forma
read-only contra `nexo-core` antes de escribir las migraciones (sin
aplicar nada).

| # | Prueba | Rol | Resultado esperado | Evidencia |
|---|---|---|---|---|
| 1 | `anon` intenta ejecutar `crear_empleado`/`fn_crear_empleado` | `anon` | Denegado | **1ª vuelta: FALLÓ** (`fn_crear_empleado` directo permitido, ver 2b) — corregido en `20260905000004`, pendiente 2ª vuelta local |
| 2 | `anon` intenta ejecutar `set_pin_empleado`/`fn_set_pin_empleado` | `anon` | Denegado igual que #1 | **1ª vuelta: FALLÓ** (mismo motivo que #1) — corregido en `20260905000004`, pendiente 2ª vuelta local |
| 3 | `authenticated` sin `rrhh.expedientes.empleados.ver` lee `rrhh.empleados` | `authenticated` (sin permiso) | 0 filas (RLS deny), no error | Pendiente local |
| 4 | Igual que #3 sobre `empleado_compensacion`, `asistencia_marcas`, `planillas` | `authenticated` (sin permiso) | 0 filas en cada una | Pendiente local |
| 5 | `authenticated` con `rrhh.expedientes.empleados.crear` (+`compensacion.editar` si fija salario) crea un empleado de prueba | `authenticated` (admin de prueba) | Alta exitosa, PIN devuelto en texto plano una sola vez | Pendiente local |
| 6 | Kiosko autorizado marca con PIN válido del empleado de prueba | `anon` | `{ ok: true, tipo: "entrada", marcado_en }`, **sin** `empleado_nombre` en la respuesta | Pendiente local |
| 7 | Segunda marca del mismo empleado | `anon` | Alterna a `tipo: "salida"` | Pendiente local |
| 8 | PIN inexistente/incorrecto | `anon` | Mensaje genérico de error, sin distinguir causa | Pendiente local |
| 9 | Kiosko con `activo = false` | `anon` | Rechazado ("Kiosco inválido o inactivo") | Pendiente local |
| 10 | Empleado con `pin_bloqueado = true` intenta marcar | `anon` | Rechazado (mismo mensaje genérico que PIN incorrecto — fix de la migración 2) | Pendiente local |
| 11 | Más de 8 intentos en 60s desde el mismo `kiosko_id`+IP | `anon` (vía Server Action, no SQL puro) | "Demasiados intentos" | Pendiente local (requiere levantar `apps/rrhh` contra el Supabase local) |
| 12 | `SELECT` directo a `rrhh.asistencia_marcas_2026_09` (o la partición vigente al momento de la prueba) | `authenticated` sin policy que lo permita | 0 filas | **Evidencia ya reunida** contra `nexo-core` (read-only, `SET LOCAL ROLE authenticated`): 0 filas, confirmado 2026-09-05 |
| 13 | Antes/después de la migración 3: mismo usuario, mismo permiso, misma consulta sobre `rrhh.empleados` | `authenticated` (con y sin permiso) | Resultado de autorización idéntico antes y después (la migración no cambia qué se permite, solo cómo se evalúa) | Pendiente local |
| 14 | `get_visible_apps` ejecutado por `anon` | `anon` | Denegado después de la migración 1 | **1ª vuelta: OK**, confirmado denegado |
| 15 | `get_platform_settings` ejecutado por `anon` | `anon` | Sigue permitido — decisión deliberada, sin cambios (necesario para la pantalla de login) | Pendiente local (regresión) |
| 16 | `get_advisors(type=security)` | — | Sin el WARN de `fn_crear_empleado`/`fn_set_pin_empleado`/`get_visible_apps` ejecutables por `anon` | **No reproducible en Supabase local** — `get_advisors` es un servicio de la plataforma hospedada, atado a un `project_id` real. Solo se puede re-correr después de aplicar a una rama de pago o a `nexo-core` |
| 17 | `get_advisors(type=performance)` | — | Sin los 25 WARN `auth_rls_initplan` de tablas `rrhh.*` | **No reproducible en Supabase local**, mismo motivo que #16 |
| 18 | Nexo, CRM y RRHH siguen desplegables; `/rrhh` sigue accesible | — | Deploys de Vercel exitosos, `/rrhh` sin 404/500 | **No reproducible localmente en absoluto** — depende de Vercel + `nexo-core` real. Solo se verifica después de aplicar la migración al proyecto real y desplegar |

Los puntos 16, 17 y 18 quedan fuera del alcance de cualquier validación
local, con o sin Docker — son inherentemente del entorno hospedado. Se
ejecutan recién en la fase siguiente (después de que la validación local
1-15 pase, y con aprobación explícita para tocar `nexo-core` de verdad).

## 6. Dependencias y comandos para la PC con Docker (no ejecutados aquí)

Este repo **no tiene `supabase/config.toml`** todavía (nunca se corrió
`supabase init` — las migraciones se aplicaron siempre directo al
proyecto remoto vía el MCP de Supabase, nunca vía CLI local). Hace falta
crearlo antes de `supabase start`.

```bash
# 1. Confirmar Docker realmente corriendo (no solo instalado)
docker info

# 2. Inicializar la config de Supabase CLI en el repo (una sola vez,
#    crea supabase/config.toml — no toca las migraciones existentes)
npx supabase init

# 3. Levantar el stack local (Postgres + Auth + PostgREST + Studio)
npx supabase start

# 4. Aplicar TODAS las migraciones del repo (23 ya existentes + las 3
#    nuevas de esta auditoria) contra la base local desde cero
npx supabase db reset

# 5. Confirmar que las 3 migraciones nuevas quedaron aplicadas sin error
npx supabase migration list --local

# 6. Pruebas de la matriz de la sección 5 — via `psql` directo a la
#    conexion local que imprime `supabase start` (SET LOCAL ROLE
#    anon/authenticated + SET LOCAL request.jwt.claims para simular
#    auth.uid() sin necesitar un usuario real de Supabase Auth), y via
#    curl al endpoint local de PostgREST (puerto que imprime `supabase
#    start`, tipicamente 54321) con el anon key local para las pruebas
#    6-11 (llamadas RPC reales, no solo SQL).

# 7. Al terminar, bajar el stack local
npx supabase stop
```

`npx supabase --version` ya se confirmó instalable en este entorno
(2.116.0) — no hace falta instalar nada global, `npx` lo resuelve solo.

## 7. Qué falta después de la validación local

1. Correr `supabase db reset` de nuevo en la PC con Docker (ahora aplica
   también `20260905000004`) y repetir **al menos** las filas 1, 2 y la
   matriz nueva de la sección 2b — confirmar que `PUBLIC` y `anon` quedan
   en `false` para ambas funciones internas y que `public.crear_empleado`
   (la única llamada real, vía `expedientes/nuevo/actions.ts`) sigue
   funcionando de punta a punta para un usuario autenticado con permiso.
2. Completar el resto de la matriz de la sección 5 (3-13, 15) que todavía
   no se corrió.
3. Con la validación local en verde (incluida la reconfirmación del
   punto 1), decidir junto con el usuario cómo aplicar a `nexo-core`
   real: directo (con `apply_migration`) o esperar a una rama de pago —
   **no se asume, se pregunta**.
4. Recién ahí correr los puntos 16-18 (advisors + deploy) contra el
   entorno real.
5. Solo después de eso, actualizar `docs/DATABASE.md`, `docs/RRHH_MVP.md`
   y `docs/MIGRATION_LOG.md` con el estado verificado, y decidir sobre
   merge a `main` — con aprobación explícita en cada paso.

## 8. Actualización pendiente de documentación (no hecha todavía a propósito)

`docs/DATABASE.md`, `docs/RRHH_MVP.md` y `docs/MIGRATION_LOG.md` **todavía
describen el estado de antes de esta auditoría** (funciones
`fn_crear_empleado`/`fn_set_pin_empleado` ejecutables por `anon` como
hallazgo pendiente, `fn_registrar_marca_kiosko` devolviendo
`empleado_nombre`, los 25 avisos de rendimiento sin corregir) — a
propósito, porque el pedido fue documentar **solo el estado posterior
verificado**, y todavía no hay nada verificado (nada se aplicó). Cuando
la validación de la sección 5 pase, esos 3 documentos se actualizan en un
commit de documentación aparte, con los resultados reales, no antes.
