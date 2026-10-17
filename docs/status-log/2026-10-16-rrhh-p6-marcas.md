# RRHH — p6-marcas

Fecha: 2026-10-16. Rama: codex/rrhh-piloto-mvp.

P6 implementado: consulta segura por empresa con marcas.ver, listado de solo lectura, filtros y detalle con numero de contrato, estados calculables y paginacion. Pruebas SQL y validacion de fechas locales.

Estado: implementación y pruebas locales; no aplicado en Supabase ni desplegado. Commit de entrega: `afa957d`. Verificación: `pnpm verify` correcto (typecheck, lint gate, pruebas locales y build de siete apps). Sin E2E remoto, RLS/concurrencia reales ni autorización de piloto.
