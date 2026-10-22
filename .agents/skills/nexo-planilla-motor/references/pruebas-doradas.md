# Pruebas doradas y ensayo de migraciones

## 1. Cómo corren hoy las pruebas SQL (verificado en el repo)

- `pnpm test:db` encadena scripts `test:rrhh:*` de `package.json`; cada uno ejecuta `node supabase/tests/run_rrhh_pglite.mjs <archivos .sql en orden>`.
- El runner (`supabase/tests/run_rrhh_pglite.mjs`) abre PGlite en memoria con `pgcrypto`, ejecuta cada archivo y no recibe URL ni credenciales.
- Orden típico: **entorno mínimo** (`supabase/tests/rrhh_kiosco_entorno.sql`: esquemas, `auth.uid()` leído de `request.jwt.claim.sub`, `core.prueba_permisos` + `core.has_permission` simulado) → **la migración real** de `supabase/migrations/` → **prueba** (`*.prueba.sql`, `begin; do $$ … $$; rollback;`).
- Las aserciones son `raise exception 'FALLO P3: …'` dentro de un `do $$`.
- **Límite del runner:** solo imprime el mensaje si coincide con `^FALLO P[2-7]: [\p{L} ]+$` (letras y espacios). Un mensaje con dígitos, puntos o un prefijo `PL2` sale solo como `SQLSTATE`. Para planilla hace falta que el coordinador autorice ampliar esa expresión (archivo fuera de `.claude/skills/`) o usar mensajes solo con letras.
- Dependencia fijada: `@electric-sql/pglite` `0.5.10`. Nada de instalaciones ad hoc.

Ejemplo de comando (PowerShell, en esta máquina):

```powershell
npx.cmd --yes pnpm@9.15.9 test:db
node supabase/tests/run_rrhh_pglite.mjs supabase/tests/<entorno>.sql supabase/migrations/<migracion>.sql supabase/tests/<caso>.prueba.sql
```

Un script nuevo `test:rrhh:planilla-<caso>` se suma a `test:db` (y así a
`pnpm verify`), según `docs/CI_CHECKS.md` ("Añadir pruebas más adelante").
`package.json` lo autoriza el coordinador.

## 2. Qué no prueba PGlite (no declararlo probado)

RLS y policies reales, roles y GRANT de Supabase, `service_role`, PostgREST,
`pg_cron`, concurrencia entre conexiones, el planificador de `nexo-core`
(`docs/CI_CHECKS.md`, "Límites de cobertura"). Una prueba verde no es validación
en remoto.

## 3. Entorno de planilla

Archivo nuevo (propuesta) `supabase/tests/rrhh_planilla_entorno.sql`, partiendo
del entorno compartido: lo mínimo de `rrhh.contratos`, `contrato_compensacion`,
`jornadas`/`contrato_jornadas`, `feriados`, `parametros_ley`,
`core.tablas_particionadas`, `core.fn_asegurar_particiones_futuras`,
`core.fn_auditar` y `core.fn_exigir_permiso` simulados. Empresas y personas con
prefijo `PRUEBA`. **Ningún archivo de entorno se aplica a una base compartida.**

## 4. Casos obligatorios

Cifras: [nexo-planilla-legal/references/caso-dorado.md](../../nexo-planilla-legal/references/caso-dorado.md).

| Caso | Aserción |
|---|---|
| G1 liquidación | diario 378.3333; 95 días; 35,941.66 + 7,566.67 + 1,513.33 = 45,021.66 |
| G2 provisiones de quincena | 472.92 × 3 = 1,418.76 |
| G3 aportes | 2,440.25 y 227.00 |
| G4, G5 IR | 333.33 y 1,636.67 |
| G6 tope | 150 días, 56,750.00 |
| G7 servicios profesionales | INSS, IR, patronal e INATEC en 0.00; aviso presente si hay jornada |
| Idempotencia | calcular dos veces ⇒ mismas líneas y misma `hash_insumos` |
| Insumo cambiado | aprobar tras cambiar una novedad ⇒ rechazo |
| Separación de funciones | el mismo usuario calcula y aprueba ⇒ rechazo, aun con ambos permisos |
| Permisos | cada RPC sin su código ⇒ 42501 |
| Empresa ajena | `company_id` de otra empresa ⇒ no encuentra ni modifica |
| Estados | transiciones ilegales (aprobar borrador, pagar calculada, recalcular aprobada) ⇒ rechazo |
| Inmutabilidad | `update`/`delete` de líneas de una planilla aprobada ⇒ rechazo del trigger |
| Anulación | libera novedades y cuotas; la regenerada apunta con `reemplaza_a` |
| Parámetro faltante | sin fila vigente ⇒ error con el código del parámetro |
| Tramos de IR | contiguos y sin huecos en cada vigencia |
| Particiones | insertar en un mes nuevo crea o exige su partición; la partición tiene RLS habilitado |
| Privilegios | `authenticated` sin INSERT/UPDATE/DELETE en tablas del motor; núcleos `rrhh.fn_*` sin EXECUTE para `anon`/`authenticated`; `public.planilla_*` sin EXECUTE para `anon` |
| Aguinaldo protegido | un préstamo pendiente no reduce la línea de aguinaldo |

## 5. Ensayo de la migración en `nexo-core` (solo coordinador)

Precedente: el Paso Cero de planilla se ensayó "dentro de una transacción
revertida" antes de aplicarse (`docs/status-log/2026-10-20-planilla-analisis.md`).

1. Verificación remota de solo lectura del estado (tablas, filas, permisos, parámetros) con el MCP de Supabase.
2. Ejecutar `begin; <migración completa>; <consultas de poscheque>; rollback;` en una sola llamada de `execute_sql`.
3. Confirmar después, con otra consulta, que no quedó nada (tablas, funciones, filas en catálogo).
4. Cuidados: las secuencias o `identity` avanzan aunque se revierta; `create index concurrently` no corre en transacción; no llamar `cron.schedule`; `nexo-core` es compartido, así que cualquier dato de prueba lleva prefijo `PRUEBA` y se revierte.
5. Solo con aprobación del usuario: `apply_migration`, renombrar el archivo local a la versión remota y documentar en `MIGRATION_LOG`/`DATABASE`/status-log (lo hace el coordinador).

## 6. Corrida en paralelo (PL7)

Antes de pagar con Nexo: al menos dos períodos completos calculados en Nexo y en
AG con los mismos datos; diferencia cero o explicada línea por línea
(plan 20 §6). Se guarda la comparación (anonimizada) como nuevo caso dorado.
