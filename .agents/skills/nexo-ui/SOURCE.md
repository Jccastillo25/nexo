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

## Evaluación

No se comparó contra la skill original con una tarea real. La adaptación se
justifica por compatibilidad con las reglas del repo, no por un resultado
medido. Pendiente: medirla en la primera tarea de UI que se delegue.
