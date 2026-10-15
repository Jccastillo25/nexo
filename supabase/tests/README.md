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

Con Postgres embebido (no necesita Postgres instalado; sí red la primera vez):

```bash
npm i --no-save @electric-sql/pglite   # no toca package.json ni pnpm-lock.yaml
node supabase/tests/run_rrhh_p1_pin_ambiguo.mjs
```

Sin red, apuntando a una copia local del paquete:

```bash
PGLITE_DIR=/ruta/a/node_modules/@electric-sql/pglite node supabase/tests/run_rrhh_p1_pin_ambiguo.mjs
```

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
(Server Action → PostgREST → RPC). Que pasen no equivale a validación en
producción.
