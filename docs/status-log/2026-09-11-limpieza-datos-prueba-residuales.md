# Limpieza de datos de prueba residuales + corrección de imprecisión de migraciones (2026-09-11)

> Entrada nueva del log detallado de [`IMPLEMENTATION_STATUS.md`](../IMPLEMENTATION_STATUS.md), generada durante la reestructuración de documentación de 2026-09-11 (ver [[nexo-docs-restructure-2026-09-11]] en memoria de sesión). No es una subfase del Plan Maestro — es una corrección de higiene de datos + documentación, detectada por una verificación remota de rutina.

## Hallazgo — datos de prueba sin limpiar en `nexo-core`

Una verificación remota de solo lectura (Supabase `execute_sql`/`get_advisors`, Vercel) ejecutada como parte de esta sesión encontró que, contrario a lo documentado en varias entradas previas del log ("0 filas antes y después", "`rrhh.empleados` sigue en 0 filas reales"), el proyecto remoto tenía datos reales residuales de una verificación end-to-end anterior:

| Tabla | Filas encontradas |
|---|---|
| `rrhh.empleados` | 1 (`Julio Cesar Castillo Canales`, documento `0010601980001F`, creado 2026-09-07 16:47 UTC) |
| `rrhh.contratos` | 1 (`numero_contrato=5`, `estado=activo`, creado 2026-09-07 22:18 UTC) |
| `rrhh.contrato_compensacion` | 1 |
| `rrhh.contrato_credenciales` | 1 (PIN activo) |
| `rrhh.contrato_jornadas` | 1 (asignaba la jornada `Ventas` al contrato, vigente desde 2024-01-01) |
| `rrhh.jornadas` / `rrhh.jornada_dias` | 1 / 7 (plantilla `Ventas`, 7/7 días) |

No se pudo determinar con certeza en qué sesión exacta quedó sin limpiar (F1.3 y F1.4 ambas ejecutaron pruebas end-to-end el mismo día, 2026-09-07, y ambas afirmaron dejar las tablas en 0 filas al final) — no es relevante para la corrección, solo se documenta que la afirmación de "0 filas" de esas entradas fue **inexacta en algún punto posterior a su verificación original**, no necesariamente en el momento en que se escribió.

## Acción tomada (aprobada explícitamente por el usuario, con el detalle exacto de los datos mostrado antes de proceder)

```sql
delete from rrhh.contrato_credenciales where contrato_id = '453b5355-d726-4e17-b742-cac98b0f6fb9';
delete from rrhh.contrato_compensacion where contrato_id = '453b5355-d726-4e17-b742-cac98b0f6fb9';
delete from rrhh.contrato_jornadas where contrato_id = '453b5355-d726-4e17-b742-cac98b0f6fb9';
delete from rrhh.contratos where id = '453b5355-d726-4e17-b742-cac98b0f6fb9';
delete from rrhh.empleados where id = '7d21ed94-6368-4dfe-b09d-8cd0dd38e325';
```

Ejecutado en una única transacción vía `execute_sql` (no es DDL, no requiere migración). **Deliberadamente NO se borró** la jornada plantilla `Ventas` (`rrhh.jornadas`/`rrhh.jornada_dias`, 1 fila + 7 días) — el usuario decidió conservarla, ya que a diferencia del empleado/contrato/credencial no está atada a un registro de identidad real y puede ser una plantilla reutilizable legítima.

Verificado post-borrado (`select count(*)` sobre las 5 tablas): `empleados=0`, `contratos=0`, `contrato_compensacion=0`, `contrato_credenciales=0`, `contrato_jornadas=0`, `jornadas=1`, `jornada_dias=7` — exactamente el resultado esperado. `get_advisors(security)` re-ejecutado post-borrado: mismo set de hallazgos ya documentado (17 `rls_enabled_no_policy` INFO, 3 funciones `SECURITY DEFINER` ejecutables por `anon`, 16 por `authenticated`, leaked-password-protection deshabilitado) — sin cambios, como se esperaba de un `DELETE` sin tocar esquema/permisos.

**Consecuencia para el estado documentado**: `rrhh.empleados`/`contratos`/etc. vuelven a estar en 0 filas reales, consistente con lo que el resto de la documentación (incluida la reestructuración de `IMPLEMENTATION_STATUS.md` de esta misma sesión) asume como estado de partida para F1.5 en adelante.

## Hallazgo secundario — imprecisión en el conteo de migraciones de F1.0 (sin impacto funcional)

La misma verificación remota encontró que `list_migrations` sobre `nexo-core` devuelve **44 migraciones aplicadas**, mientras que `supabase/migrations/` en `main` tiene **42 archivos**. La diferencia son 2 migraciones del bootstrap original (2026-08-30) aplicadas dos veces bajo versiones distintas en el remoto:

- `core_schema`: versiones `20260830041012` y `20260830042052`
- `core_seed_apps`: versiones `20260830041027` y `20260830042100`

Git solo tiene un archivo de cada una (`20260830000001_core_schema.sql`, `20260830000002_core_seed_apps.sql`). La entrada de [F1.0 — Auditoría real](2026-09-07-f1-0-auditoria-real.md) (sección "0.3") afirmó "30 migraciones... coincide 1:1 con Git" — en ese momento eso significaba 28 archivos reales + estos mismos 2 duplicados = 30, así que la cifra bruta coincidía pero la frase "1:1" no describía con precisión que había duplicados. Desde `20260905000001` en adelante (incluida toda la serie F1.0-F1.4/Enterprise UI/fix de estabilización) cada versión remota coincide exactamente con su archivo local — **no hay ninguna migración aplicada fuera de Git ni pendiente de aplicar**. No se tocó nada de esto (son duplicados inertes del bootstrap, sin efecto en el esquema actual); se documenta aquí para que una futura auditoría no vuelva a interpretar la cifra bruta como "sin duplicados".

## Vercel — sin divergencia

Los 3 proyectos (`nexocore`, `nexo-rrhh`, `nexo-crm`, equipo `julio-s-projects7`) están `READY` en su deployment de producción con `githubCommitSha` igual al HEAD real de `origin/main` (`36fb029`). Coincide exactamente con lo esperado.
