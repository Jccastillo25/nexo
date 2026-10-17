# RRHH — p3-contrato

Fecha: 2026-10-16. Rama: codex/rrhh-piloto-mvp.

P3 implementado: contrato obligatorio con FK compuesta, indices y cierre de escrituras directas en padre y particiones. PGlite comprueba vinculo, recontratacion y revocacion.

Estado: implementación y pruebas locales; no aplicado en Supabase ni desplegado. Commit de entrega: `6a95c5e`. Verificación: `pnpm verify` correcto (typecheck, lint gate, pruebas locales y build de siete apps). Sin E2E remoto, RLS/concurrencia reales ni autorización de piloto.
