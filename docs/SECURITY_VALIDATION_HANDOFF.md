# Handoff — validación local pendiente de la auditoría de seguridad de RRHH

Estado: **nada de lo listado abajo está aplicado a ningún lado** (ni a
`nexo-core`, ni a una rama de Supabase, ni a un Supabase local). Todo es
código y SQL preparado, sin ejecutar, a la espera de validarse en la PC
que tiene Docker funcionando. No se hizo `commit` ni `push` de nada de
esto — sigue en el working tree.

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

## 1. Archivos modificados (estado real del working tree)

```
 M CLAUDE.md                                    (de la tarea anterior, sin commitear)
 M README.md                                    (de la tarea de documentación anterior)
 M apps/rrhh/src/app/kiosco/actions.ts           ← esta auditoría
 M apps/rrhh/src/app/kiosco/kiosk-client.tsx     ← esta auditoría
 M apps/rrhh/src/lib/supabase/database.types.ts  ← esta auditoría
 M docs/ARCHITECTURE.md                         (de la tarea de documentación anterior)
 M docs/DATABASE.md                             (de la tarea de documentación anterior)
 M docs/MIGRATION_LOG.md                        (de la tarea de documentación anterior)
 M docs/MODULES.md                              (de la tarea de documentación anterior)
 M docs/README.md                               (de la tarea de documentación anterior)
 M docs/ROADMAP.md                              (de la tarea de documentación anterior)
?? docs/RRHH_MVP.md                             (de la tarea de documentación anterior)
?? docs/SECURITY_VALIDATION_HANDOFF.md          ← este archivo
?? supabase/migrations/20260905000001_revoke_rrhh_internal_anon_execute.sql       ← esta auditoría
?? supabase/migrations/20260905000002_kiosko_minimize_exposure_and_bloqueo_check.sql ← esta auditoría
?? supabase/migrations/20260905000003_rrhh_rls_wrap_auth_uid_initplan.sql         ← esta auditoría
```

Los archivos marcados "de la tarea anterior" son de la sesión de
documentación previa (ya reportados en su momento) — se listan para que
el estado del working tree sea inequívoco, no son parte de esta
auditoría de seguridad. Nada de esto se commiteó: `git log` no tiene
ningún commit nuevo desde el inicio de esta sesión.

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

## 5. Matriz de validación local — pendiente de ejecutar

Ninguna fila de esta tabla se ejecutó todavía. "Evidencia ya reunida"
marca lo que **sí** se verificó de forma read-only contra `nexo-core`
antes de escribir las migraciones (sin aplicar nada) — el resto requiere
levantar Supabase local con Docker.

| # | Prueba | Rol | Resultado esperado | Evidencia |
|---|---|---|---|---|
| 1 | `anon` intenta ejecutar `crear_empleado`/`fn_crear_empleado` | `anon` | Denegado (`REVOKE` explícito, error de permiso de Postgres antes de llegar al chequeo interno) | Pendiente local |
| 2 | `anon` intenta ejecutar `set_pin_empleado`/`fn_set_pin_empleado` | `anon` | Denegado igual que #1 | Pendiente local |
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
| 14 | `get_visible_apps` ejecutado por `anon` | `anon` | Denegado después de la migración 1 (antes: permitido, confirmado por `get_advisors`) | Pendiente local |
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

1. Ejecutar la matriz completa de la sección 5 (puntos 1-15) en la PC con
   Docker y volcar los resultados reales en la tabla de la sección 5 (o
   en un archivo nuevo, a decidir).
2. Con la validación local en verde, decidir junto con el usuario cómo
   aplicar a `nexo-core` real: directo (con `apply_migration`, mismo
   patrón que todas las migraciones anteriores de este repo) o esperar a
   una rama de pago — **no se asume, se pregunta**.
3. Recién ahí correr los puntos 16-18 (advisors + deploy) contra el
   entorno real.
4. Solo después de eso, decidir si se hace `commit`/`push` — en dos
   commits separados como se pidió (seguridad/migraciones por un lado,
   documentación por otro), y solo con aprobación explícita.

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
