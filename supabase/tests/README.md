# Pruebas de base de datos (`supabase/tests/`)

Este repo no tenía pruebas automáticas de base de datos. Estas son las primeras,
creadas con el ticket [RRHH P1 #30](https://github.com/Jccastillo25/nexo/issues/30).
Son scripts SQL autocontenidos: crean sus propios datos, verifican con
aserciones y **siempre terminan en `ROLLBACK`** (no persisten nada). Nunca se
conectan solas a un proyecto remoto: el destino lo decide quien las ejecuta.

## Archivos

| Archivo | Qué es |
|---|---|
| `rrhh_p1_pin_ambiguo.prueba.sql` | La prueba. 13 casos (C1–C13) sobre `rrhh.fn_registrar_marca_kiosko`: cero, una y varias coincidencias de PIN, aislamiento por empresa, credenciales no vigentes, ausencia de identidad en el retorno, límite de intentos y privilegios de `anon`. Si algo falla, aborta con `FALLO P1: ...`. |
| `rrhh_p1_pin_ambiguo_entorno.sql` | Entorno desechable para poder correrla sin clonar el esquema completo: un `rrhh` mínimo (solo lo que toca la función + las reglas que importan: una credencial por contrato, un contrato activo por empleado, FK compuesta) más `core.companies`, roles `anon`/`authenticated` y el wrapper público real. **No es el esquema de `nexo-core`; no aplicar a una base compartida.** |
| `run_rrhh_p1_pin_ambiguo.mjs` | Runner que levanta un PostgreSQL embebido (PGlite) en memoria, aplica el entorno, aplica **la migración real** y ejecuta la prueba. Además revisa los avisos del motor: la señal técnica de PIN ambiguo debe aparecer y ningún aviso puede contener un PIN. |

## Cómo se ejecuta

Una sola orden, desde la raíz del repo (Postgres embebido: no hace falta tener
Postgres instalado ni ninguna credencial):

```bash
pnpm install --frozen-lockfile
pnpm test:rrhh:p1
```

`@electric-sql/pglite` está fijado en la versión exacta `0.5.10` dentro de las
`devDependencies` de la raíz: no hay instalaciones ad hoc ni versiones
flotantes. El workflow `.github/workflows/ci.yml` ejecuta exactamente esta
orden como check obligatorio (`test-db-rrhh`); ver
[`docs/CI_CHECKS.md`](../../docs/CI_CHECKS.md) para el detalle de cobertura y
límites.

Contra un PostgreSQL propio (con o sin el esquema real de `nexo-core`):

```bash
# base desechable: primero el entorno, después la migración, después la prueba
psql "$PGURL" -v ON_ERROR_STOP=1 \
  -f supabase/tests/rrhh_p1_pin_ambiguo_entorno.sql \
  -f supabase/migrations/20261015181000_p1_pin_ambiguo_fallo_cerrado.sql \
  -f supabase/tests/rrhh_p1_pin_ambiguo.prueba.sql
```

La prueba necesita `crypt(text, text)` (pgcrypto) accesible como
`extensions.crypt` — el mismo `search_path` que usa la función en Supabase. El
entorno aborta con un mensaje claro si no lo encuentra, en vez de degradar la
comparación de PINes en silencio.

Cómo se ejecutó el 2026-10-15 (evidencia del PR de P1): PGlite
`@electric-sql/pglite@0.5.10` (PostgreSQL 18.6, `contrib/pgcrypto` real → bcrypt
real) — 28 aserciones en verde, 10 señales técnicas emitidas, 0 avisos con PIN.
Control negativo: con la definición anterior de la función (F1.3) la prueba
falla en C4, es decir sí detecta el bug que P1 corrige.

## Límites declarados

Estas pruebas corren sobre un esquema mínimo replicado a mano, no sobre
`nexo-core`. Por lo tanto **no** cubren RLS/policies, particiones, el resto de
las columnas del esquema real, ni el recorrido completo del kiosco en navegador
(Server Action → PostgREST → RPC), ni concurrencia real. Que pasen no equivale a
validación en producción. La matriz completa de límites (PGlite vs
Postgres/Supabase real, RLS, concurrencia, bcrypt) está en
[`docs/CI_CHECKS.md`](../../docs/CI_CHECKS.md#límites-de-cobertura-lo-que-estos-checks-no-prueban).
