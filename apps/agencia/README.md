# Agencia digital

Módulo independiente de Nexo, de solo lectura con datos de ejemplo. Proyecto Vercel `nexo-agencia`, Root Directory `apps/agencia`; zona `/agencia`.

Comparte Supabase Auth, el motor de permisos y `NexoShell`. Sin login propio ni claves service_role. Exige `agencia.ver_modulo` y `agencia.dashboard.resumen.ver`; matriz aprobada por el usuario y aplicada antes del frontend.

- `pnpm --filter nexo-agencia dev:zone`: puerto 3003.
- `pnpm --filter nexo-agencia lint`
- `pnpm --filter nexo-agencia exec next typegen`
- `pnpm --filter nexo-agencia exec tsc --noEmit --incremental false`
- `pnpm --filter nexo-agencia test:access`
- `pnpm --filter nexo-agencia build`

Copiar `.env.local.example` y configurar las variables en el proyecto nuevo. En Nexo, configurar `AGENCIA_APP_URL` con el origen del destino; el catálogo conserva la ruta relativa.

[Estado, evidencia y orden de activación](../../docs/status-log/2026-10-14-agencia-independiente.md). Aún no se declara validación manual ni activación del Launcher.
