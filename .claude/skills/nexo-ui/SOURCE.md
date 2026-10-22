# Procedencia de nexo-ui

| Campo | Valor |
|---|---|
| Fuente | https://github.com/anthropics/skills/tree/main/skills/frontend-design |
| Commit evaluado | `41bbe19d1a1a7eaab5e7bb9050a417e5c6cffc8f` (2026-09-03, "Update frontend-design skill to avoid generic design defaults (#1713)") |
| Licencia | Apache License 2.0 (`LICENSE.txt` en la carpeta de la skill) |
| Fecha de evaluación | 2026-10-17 |
| Inspección | Solo `SKILL.md` y `LICENSE.txt`, sin scripts, `allowed-tools`, comandos ni red. |

## Qué se tomó (adaptado y redactado de nuevo, no es copia literal)

- El ciclo planear → revisar → construir → criticar.
- La estructura como información: un borde, separador o etiqueta solo si significa algo.
- La mesura: quitar un elemento antes de terminar, y el movimiento solo cuando aporta.
- El piso de calidad: responsivo, foco visible, `prefers-reduced-motion`, accesibilidad.
- La escritura en la interfaz: perspectiva del usuario, botones específicos, errores con solución, vacíos que invitan a actuar.

## Qué se descartó y por qué

- La búsqueda de **identidad distintiva**: paletas propias de 4–6 hex, tipografías elegidas por proyecto y "riesgos estéticos". Contradice la regla obligatoria de `CLAUDE.md`, "una sola paleta y tipografía, ningún módulo tiene identidad visual propia" (decisión del usuario del 2026-08-30, tras el intento fallido del CRM).
- El "hero" de landing y las referencias de calibración de sitios de marketing: Nexo es una suite interna de gestión, no un sitio público.

## Incorporación de antislop (2026-10-21)

| Campo | Valor |
|---|---|
| Fuente | https://github.com/miqdadbadjuber/anti-slop (`antislop.md`, `skills/antislop-ui/SKILL.md`, `skills/antislop-copywriting/SKILL.md`) |
| Commit | `439a2ef5b9dd0ebe74e8113ff43f5928d0fe2a6a` (2026-10-16), release declarada v3.2.21 |
| Licencia | MIT, © 2026 Miqdad Badjuber (`LICENSE` del repo) |
| Inspección | Lectura vía WebFetch; no se instaló ni ejecutó nada. Detalle de instalador y scripts en `../README.md` |

Se tomó (resumido, en español, con ejemplos de Nexo) la sección "Anti-relleno":
CTA específicos (R-15), sin palabras de folleto (R-16), sin cifras ni
afirmaciones inventadas (R-17, R-36, R-38), sin emojis (R-04), insignias solo de
estado (R-09), sombras solo de elevación (R-12), flechas con propósito (R-08),
puntos de estado sin brillo ni pulso (antislop-ui), franja lateral solo de
estado, controles con comportamiento real (R-24, R-26), y de antislop-copywriting
las muletillas, la cautela apilada, la triada forzada, los verbos mentales del
sistema y el actor nombrado.

Adaptaciones: la prohibición total de la raya (R-02) quedó en "no unir frases
con raya en la interfaz", porque el repo usa "—" como valor vacío en celdas
(141 apariciones en 61 archivos `.tsx` de `apps/`, conteo del 2026-10-21) y en
español la raya es puntuación válida. Las listas de palabras en inglés se
reemplazaron por sus equivalentes en español.

Descartado (contradice `CLAUDE.md` o `docs/DESIGN_SYSTEM.md`): elegir paleta,
tipografía o identidad por marca (R-01, R-06, R-20, R-29), modo oscuro o
interruptor de tema (R-21, R-34), variedad de secciones y tarjetas de distinto
tamaño (R-05, R-14, dial RHYTHM), los diales ENERGY/RHYTHM/MOTION y el "Design
Read" (R-37), y "no clonar" otros productos (R-30): Nexo sigue a propósito un
kit único estilo Odoo. Detalle completo en `../README.md`.

## Evaluación

No se comparó contra la skill original con una tarea real. La adaptación se
justifica por compatibilidad con las reglas del repo, no por un resultado
medido. Pendiente: medirla en la primera tarea de UI que se delegue.
