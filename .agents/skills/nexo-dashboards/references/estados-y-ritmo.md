# Estados, casos borde y ritmo (pacing)

## Estados por bloque

El planner llena esta tabla para cada bloque; el frontend la implementa; el
reviewer la comprueba.

| Estado | Cómo se detecta | Qué se muestra |
|---|---|---|
| Cargando | navegación del Server Component | `loading.tsx` de la ruta con el mismo esqueleto (ver `apps/rrhh/src/app/(app)/dashboard/loading.tsx`); al refrescar, no vaciar la pantalla |
| Vacío (nunca hubo datos) | la RPC responde bien y el total es 0 | `Banner`/`EmptyState` con el primer paso ("Ir a Importar") solo si tiene el permiso |
| Sin datos del período | RPC bien, período sin movimientos | valor `—` o 0 según el KPI, `hint` "Sin facturas de este mes"; estado neutral, **no** rojo |
| **Error de la RPC principal** | `error` de la RPC que alimenta el número principal | página con `PageHeader` + `ErrorCarga` (`role="alert"`); nada de ceros |
| **Error de un complemento** | `error` de una RPC secundaria | solo ese bloque dice "No se pudo cargar …" o `MetricCard` con `value="—"`, `hint="No disponible"`, `tone="pending"`; el resto sigue |
| Período en curso | días transcurridos < días del período | ritmo, proyección, "hoy tocaba" |
| Período cerrado | transcurridos ≥ total | cumplimiento final ("Cumplida", "Faltó 8 %"); sin proyección |
| Período futuro / posterior al corte | período > fecha del último dato | sin comparaciones acumuladas (`mesPosteriorAlCorte`); aviso de frescura |
| Sin meta | meta `null` | "Sin meta para este mes", estado neutral; sin barra |
| Meta 0 | meta = 0 | igual que sin meta en cálculos (`cumplimiento` devuelve null); texto "meta en 0" |
| Sin permiso | `hasPermission` false | el bloque no se consulta ni se muestra; si no queda nada, `EmptyState` "Tu rol no tiene indicadores en esta app" |
| Sin vínculo | la RPC responde `{ vinculado: false }` (usuario sin vendedor/empleado asociado) | mensaje con quién lo vincula; nunca ceros |
| Ritmo no disponible | falló la RPC que trae los días hábiles | "Ritmo no disponible" / "No se pudo calcular el ritmo"; nunca "Sin facturas" |

**Regla de oro: "sin datos" ≠ "falló".** Nunca `data ?? []` o `count ?? 0` sin
revisar antes `error`. Un error se registra en el servidor con contexto
(`mensajeDeError(err, "nombre_rpc", "texto para el usuario")` de
`@nexo/permissions`, o el envoltorio de la app como `mensajeUsuario` en
Presupuesto o `contar()` en Asistencia) y se muestra como error.

Un dashboard sin ningún permiso de lectura no redirige a sí mismo (ciclo):
redirige a otra pantalla permitida o muestra el `EmptyState`.

## Ritmo (pacing)

Funciones puras en `apps/presupuesto/src/lib/metas/ritmo.ts`. Con
`total` = días hábiles del período, `trans` = días hábiles transcurridos hasta
el corte (acotado a `[0, total]`), `m` = meta (> 0, si no `null`):

| Medida | Fórmula | Nulo cuando |
|---|---|---|
| estado | `trans = 0` → `sin_datos`; `trans ≥ total` → `cerrado`; si no `en_curso` | — |
| esperado a la fecha | `m × trans / total` | sin meta o sin días |
| fracción a la fecha | `logrado / esperado` | idem |
| proyección | en curso: `logrado / trans × total`; cerrado: `logrado` | `sin_datos` |
| fracción proyectada | `proyección / m` | sin meta o sin proyección |
| requerido por día | `max(0, m − logrado) / (total − trans)` | sin meta, cerrado o sin días restantes |
| promedio diario | `logrado / trans` | `trans = 0` |
| variación | `(actual − anterior) / anterior` | anterior ≤ 0 |

Reglas:

- **Compara contra el ritmo, no contra la meta completa**, mientras el período está en curso. Un 50 % de la meta al día 15 de 30 es "en ritmo", no "En riesgo". Error real corregido en la revisión de Presupuesto.
- **El corte es el último dato**, no la fecha de hoy: si las facturas llegan hasta el día 12, se calcula con los días hábiles hasta el 12.
- **Días hábiles definidos por dominio y escritos en pantalla.** Presupuesto: lunes a sábado, sin feriados ("Quedan 9 · lunes a sábado"). Si un dominio usa feriados (RRHH tiene catálogo de feriados), la regla se decide con el usuario y se implementa en la RPC.
- **Mismo período para comparar.** Vs. año anterior = mismo rango de días a la fecha, no el mes completo. Acumulado del año = meta de meses previos + meta del mes × fracción transcurrida; no se compara si el mes elegido es posterior al corte.
- **Un solo umbral por app**, exportado (como `UMBRAL_RIESGO = 0.9` en `formato.ts`) y usado por cumplimiento, ritmo, proyección, acumulado e insignias del ranking. Dos vistas con umbrales distintos para la misma medida es un hallazgo.
- **Escala de estados con texto:** ≥ 1 positivo ("Cumplida", "Va a cumplir", "x % arriba del ritmo"); ≥ umbral advertencia ("En riesgo"); < umbral negativo ("Baja", "No llega", "x % abajo del ritmo"); sin meta neutral.
- **Redondeo honesto:** `pct()` trunca hacia abajo para que 99.96 % nunca se vea "100 %" sin estar cumplido.
- Moneda: montos de Presupuesto en US$ con `usd()`; C$ como referencia secundaria. Formato siempre con `Intl` `es-NI`.
