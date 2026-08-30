# Catálogo de módulos

Ver el catálogo completo con equivalencias Odoo/SAP/Oracle en
[planning/PROPUESTA_MARCA_MODULOS.md](planning/PROPUESTA_MARCA_MODULOS.md)
sección 4. Esta tabla es el estado real de implementación.

| Módulo | Slug / ruta | Categoría | Origen | Estado |
|---|---|---|---|---|
| Panel (Nexo) | `/` | — | Nuevo | No iniciado |
| RRHH | `/rrhh` | RRHH | Gestor360 (`marcacion-grupo-ct`) | Código importado (2026-08-29), sin adaptar |
| Flotilla | `/flotilla` | Cadena de suministro | Ruta360 (`Desktop/Transporte`) | Código importado (2026-08-29), sin adaptar |
| CRM | `/crm` | Ventas | materiales-jcastillo | ✅ Adaptado (2026-08-30): basePath, nexo-core, permisos con RLS real. Falta exponer schema `crm` en el dashboard (manual) y copiar datos reales |
| Web Corporativo | *(dominio aparte, no es módulo del panel)* | — | materiales-jcastillo | ✅ No requiere adaptación — listo tal cual (2026-08-30) |
| Inventario | `/inventario` | Cadena de suministro | Nuevo (Fase 2) | Planeado |
| Compras | `/compras` | Cadena de suministro | Nuevo (Fase 2) | Planeado |
| Ventas / PdV | `/ventas` | Ventas | Nuevo (Fase 2) | Planeado |
| Contabilidad | `/contabilidad` | Finanzas | Nuevo (Fase 2) | Planeado |
| Proyectos | `/proyectos` | Servicios | Nuevo (Fase 3) | Planeado |
| Mantenimiento | `/mantenimiento` | Cadena de suministro | Nuevo (Fase 3) | Planeado |
| Soporte | `/soporte` | Servicios | Nuevo (Fase 3) | Planeado |
| Documentos | `/documentos` | Finanzas | Nuevo (Fase 3) | Planeado |

"Código importado, sin adaptar" significa: el código fuente ya vive en
`apps/<módulo>` con su historial de git, pero todavía **no** tiene
`basePath` de Multi-Zones, todavía usa su proyecto Supabase original (no
`nexo-core`, que aún no existe), y todavía no valida permisos contra
`core.user_permissions`. Es decir, cada app sigue funcionando exactamente
igual que antes de ser importada — el import fue solo mover el código,
nada de lo demás.

Cada módulo activo debe tener un `apps/<slug>/manifest.json`
(convención descrita en
[planning/PROPUESTA_MARCA_MODULOS.md](planning/PROPUESTA_MARCA_MODULOS.md)
sección 5) que alimenta esta tabla y la de `core.apps` en Supabase.
