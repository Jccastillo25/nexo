# 2026-10-22 — Planilla: techo del INSS por persona en el mes

**Estado:** aplicada en `nexo-core` (versión `20261022034035`). Probada en PGlite. Sin planillas reales todavía.

## Origen

La revisión automática del PR #50 (Codex, P1) encontró un error en `rrhh.fn_planilla_calcular_nucleo`: cada planilla topaba la base del INSS con el techo prorrateado al período (la mitad en una quincena) y solo sumaba los otros contratos de la persona en la misma planilla. Con ingresos desiguales entre quincenas, el mes quedaba por debajo del techo. Por ejemplo, C$80,000 y C$20,000 con un techo de C$100,000 cotizaban sobre C$70,000. El plan 20 §3 dice que el techo del INSS se calcula por persona en el mes.

## Decisión

- El usuario pidió "la mejor" opción.
- Primero se programó el **ajuste en la 2.ª quincena**, como el IR. La revisión independiente encontró un hallazgo alto: deja **netos negativos** cuando la 2.ª devenga poco, por ejemplo con ausencias o con un egreso cuyo salario va en la liquidación. Se reprodujeron −C$3,500 y −C$1,750.
- Se cambió a **techo acumulado** y el usuario lo aprobó en el chat ("Si"):
  - cada planilla cotiza lo devengado en ella, hasta lo que le queda del techo del mes a la persona: se resta la base de sus otros contratos en la planilla y, en la 2.ª quincena, la de la 1.ª, que tiene que estar aprobada;
  - el mes queda en min(devengado, techo), y ninguna planilla cotiza más de lo devengado ni deja un neto negativo por el INSS;
  - por debajo del techo nada cambia;
  - por encima, la 1.ª quincena cotiza más que la 2.ª. Con C$150,000 fijos: INSS de C$5,250 y C$1,750, IR de C$12,450 y C$13,150, neto de C$57,300 y C$60,100. Los totales del mes no cambian;
  - quien entra el 16 se topa con el techo del mes, como en la planilla mensual;
  - la semanal sigue prorrateada; hoy no se ejecuta, porque el IR semanal no está definido.
- Marcado "verificar con el contador" en el plan 20 §3.1.

## Cambios

| Archivo | Qué |
|---|---|
| `supabase/migrations/20261022034035_rrhh_planilla_techo_inss_quincena.sql` | prechequeo por md5 de la versión de `20261022000431`; `create or replace` del núcleo con el bloque "3 y 4" nuevo; revocación y poscheques |
| `supabase/tests/rrhh_planilla_pl2c.prueba.sql` | caso de junio de 2027: LQ con comisión alta, LH fijo sobre el techo, LN que entra el 16, RN que termina el 16 y L3 debajo del techo. Invariantes por persona: el mes cotiza min(devengado, techo), ninguna fila cotiza más de lo devengado y ningún neto queda negativo. Declaración del INSS de LQ y LH |
| `package.json` | la migración entra en `test:rrhh:planilla` |
| `docs/plan/20-planilla.md` §3.1, `docs/RRHH_MVP.md`, `docs/MIGRATION_LOG.md` | regla y aplicación |

Tablas, RPC y rutas afectadas: solo `rrhh.fn_planilla_calcular_nucleo`, a la que llaman `public.planilla_calcular` y el recálculo. Sin cambios de esquema, permisos ni UI.

## Pruebas

- `test:rrhh:planilla`: 17 OK.
- Mutación: con el motor anterior la prueba falla ("techo del mes en la primera quincena: base de LQ 50000.0000").
- Dos rondas de `reviewer`:
  - la 1.ª encontró el neto negativo del ajuste en la 2.ª quincena;
  - la 2.ª confirmó el techo acumulado sin netos negativos. Su escenario cubrió reingreso, 1.ª quincena anulada y reemplazada, 1.ª con devengado 0, contrato `ninguno` junto a uno laboral y salario pagado en una liquidación. Seguridad §3 sin hallazgos.
- Dos ensayos revertidos en `nexo-core` (ajuste y techo acumulado): las dos quincenas reales de octubre se calcularon con 4 personas y 0 netos negativos. La huella del motor en remoto coincidió con la local. Después se comprobó que quedaron 0 planillas y el motor anterior.

## Remoto

- Aplicada con `apply_migration`. El primer intento no respondió, se verificó que no había quedado nada aplicado y se reintentó.
- Poscheque: `md5(prosrc)` = `77c5da7208807ebaade89670f22c072e`, igual que en PGlite; `security definer` y `search_path=""`; sin EXECUTE para `anon` ni `authenticated`; 0 planillas.
- Hoy ningún contrato activo cotiza INSS (todos son servicios profesionales), así que no cambia ningún cálculo.
- Advisors de seguridad: las mismas 4 categorías, las mismas 5 funciones ejecutables por `anon` y ningún hallazgo sobre el motor.

## Deuda que queda

- Casos que la revisión comprobó en su escenario, pero que no quedaron como aserciones permanentes: reingreso, 1.ª anulada y reemplazada, contrato `ninguno` junto a uno laboral, salario en la liquidación.
- El techo solo se acumula dentro del mismo tipo de planilla, igual que el IR. Ya existía.
- La liquidación no retiene INSS. Ya existía y queda para el contador.
- Si se define el IR semanal, también habrá que acumular el techo entre las semanas del mes.
