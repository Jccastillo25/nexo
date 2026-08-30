# Catálogo de módulos

Ver el catálogo completo con equivalencias Odoo/SAP/Oracle en
[planning/PROPUESTA_MARCA_MODULOS.md](planning/PROPUESTA_MARCA_MODULOS.md)
sección 4. Esta tabla es el estado real de implementación.

| Módulo | Slug / ruta | Categoría | Origen | Estado |
|---|---|---|---|---|
| Panel (Nexo) | `/` | — | Nuevo | No iniciado |
| RRHH | `/rrhh` | RRHH | Gestor360 (`marcacion-grupo-ct`) | No iniciado |
| Flotilla | `/flotilla` | Cadena de suministro | Ruta360 (`Desktop/Transporte`) | No iniciado |
| CRM | `/crm` | Ventas | materiales-jcastillo | No iniciado |
| Web Corporativo | *(dominio aparte, no es módulo del panel)* | — | materiales-jcastillo | No iniciado |
| Inventario | `/inventario` | Cadena de suministro | Nuevo (Fase 2) | Planeado |
| Compras | `/compras` | Cadena de suministro | Nuevo (Fase 2) | Planeado |
| Ventas / PdV | `/ventas` | Ventas | Nuevo (Fase 2) | Planeado |
| Contabilidad | `/contabilidad` | Finanzas | Nuevo (Fase 2) | Planeado |
| Proyectos | `/proyectos` | Servicios | Nuevo (Fase 3) | Planeado |
| Mantenimiento | `/mantenimiento` | Cadena de suministro | Nuevo (Fase 3) | Planeado |
| Soporte | `/soporte` | Servicios | Nuevo (Fase 3) | Planeado |
| Documentos | `/documentos` | Finanzas | Nuevo (Fase 3) | Planeado |

Cada módulo activo debe tener un `apps/<slug>/manifest.json`
(convención descrita en
[planning/PROPUESTA_MARCA_MODULOS.md](planning/PROPUESTA_MARCA_MODULOS.md)
sección 5) que alimenta esta tabla y la de `core.apps` en Supabase.
