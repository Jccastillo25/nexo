# apps/nexo — Panel central

Estado: **no iniciado.**

Esta será la zona raíz de Multi-Zones: login único (Supabase Auth) y la
grilla de módulos (home estilo Odoo). Ver
[docs/ARCHITECTURE.md](../../docs/ARCHITECTURE.md) y
[docs/planning/PROPUESTA_MARCA_MODULOS.md](../../docs/planning/PROPUESTA_MARCA_MODULOS.md).

Dominio de destino: `nexo.materialesjcastillo.com`.

## Pendiente

- [ ] Scaffold de Next.js real (`package.json`, `next.config.js` con los
      `rewrites` de Multi-Zones hacia cada módulo)
- [ ] Login con Supabase Auth contra el proyecto `nexo-core`
- [ ] Grilla de módulos leyendo `core.apps` + `core.company_apps` +
      `core.user_permissions`
