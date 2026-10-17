# RRHH — p2-pin-unico

Fecha: 2026-10-16. Rama: codex/rrhh-piloto-mvp.

P2 implementado: generacion criptografica y lock por empresa; firmas y autorizacion conservadas. Pruebas de unicidad, regeneracion, empresa ajena y agotamiento en PGlite.

Estado: implementación y pruebas locales; no aplicado en Supabase ni desplegado. Commit de entrega: `e88edec`. Verificación: `pnpm verify` correcto (typecheck, lint gate, pruebas locales y build de siete apps). Sin E2E remoto, RLS/concurrencia reales ni autorización de piloto.
