# RRHH — revisión final de regresiones

Fecha: 2026-10-16. Rama: `codex/rrhh-piloto-mvp`.

La revisión previa a publicar añadió dos controles que faltaban: el agotamiento
al activar debe conservar borrador y no crear credencial; la ambigüedad P1 debe
seguir rechazándose al ejecutar la nueva firma P4. Ambos se construyen solo con
datos efímeros de PGlite y sin escribir PIN en archivos o logs.

Estado anterior: implementación P2–P6 y paquete P7 local. Estado nuevo:
cobertura explícita de esas dos regresiones. No cambia el SQL ni el estado
remoto. Commit: el que incorpora este registro y sus pruebas. Verificación:
`pnpm verify` correcto para esta revisión, incluyendo las dos regresiones nuevas y todos los checks locales.
Sin Supabase/Vercel, sin E2E ni autorización de piloto.
