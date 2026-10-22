# Procedencia de nexo-planilla-legal

| Campo | Valor |
|---|---|
| Tipo | Creación propia (2026-10-21), a pedido del coordinador para reconstruir Planilla y prestaciones de RRHH |
| Base principal | `docs/plan/20-planilla.md` (§1.3, §1.4, §2, §3, §5, §6, §8.3, §9), `docs/status-log/2026-10-20-planilla-analisis.md`, `supabase/migrations/20260902000008_rrhh_nicaragua_and_contracts.sql` (`parametros_ley`), `20260907153604_f1_2_rrhh_contratos.sql` (`contrato_compensacion`) |
| Archivos | `SKILL.md`, `references/marco-legal.md`, `formulas.md`, `regimenes.md`, `caso-dorado.md`. Sin scripts, sin `allowed-tools`, sin bloques de comandos, sin red |
| Licencia | Contenido propio del proyecto. Las normas citadas son texto legal público; no se copió texto literal |

## Fuentes externas consultadas por el especialista (2026-10-21, solo para datos "verificar")

| Fuente | Qué se confirmó | Uso |
|---|---|---|
| Código del Trabajo, Ley 185, en [Justia Nicaragua](https://nicaragua.justia.com/nacionales/codigos/codigo-del-trabajo-oct-30-1996/gdoc/) (copia publicada, no La Gaceta) | Arts. 42, 43, 44, 45 (contrato indeterminado, despido sin causa), 47 (confianza, 2–6 meses), 48 (causa justa: solo art. 42), 76–78, 93–97 | Resumen propio. Se leyó solo la primera mitad de la página (hasta el art. 97) |
| Ley 822 compilada en [nicatributos.com](https://nicatributos.com/ley-de-concertacion-tributaria/) (secundaria, la misma que cita el plan 20) | Art. 19 num. 3: indemnización exenta hasta 5 meses, adicional exento hasta C$500,000, excedente 15% definitivo; art. 23: tabla igual a plan 20 §2.1 | Dato |
| Búsqueda web sobre el techo del INSS (resultados de leybook, La Prensa y guías de nómina) | Una copia del Decreto 06-2019 dice que desde el 1-feb-2019 no hay límite máximo; no hay publicación oficial del INSS de 2026 en los resultados. Una guía dice "más de 50" para el 22.5% | Sigue en "verificar" |
| Búsqueda web sobre la retención del 10% a servicios profesionales | Sin fuente oficial vigente | Sigue en "verificar" |

No se usaron ni copiaron manuales o textos de AG Planilla (software propietario):
solo el funcionamiento y los totales que el plan 20 ya registró.

## Contenido de terceros con instrucciones al agente

Ninguno encontrado en lo consultado.

## Evaluación

No se probó en una tarea delegada ni contra otra skill (no existía ninguna de
este dominio). Las cifras de `caso-dorado.md` se verificaron a mano por el
especialista: G1 y G2 reproducen exactamente los montos de AG del plan 20 con
la convención de diario a 4 decimales y redondeo por línea; G3 coincide con la
cifra aproximada del plan 20 §9. G4–G8 son derivados sin validar por el
contador. Pendiente: correr G1–G8 en PGlite cuando exista el motor (PL2).
