# Catálogo de módulos

Ver el catálogo completo con equivalencias Odoo/SAP/Oracle en
[planning/PROPUESTA_MARCA_MODULOS.md](planning/PROPUESTA_MARCA_MODULOS.md)
sección 4. Esta tabla es el estado real de implementación, verificado
contra Supabase `nexo-core` y Vercel (2026-09-04) — no contra la
documentación de planeación, que puede estar desactualizada.

| Módulo | Slug / ruta | Categoría | Origen | Estado |
|---|---|---|---|---|
| Panel (Nexo) | `/` | — | Nuevo | ✅ **Operativo** — login, grilla de módulos por permiso, en producción |
| CRM | `/crm` | Ventas | materiales-jcastillo | ✅ **Operativo** — basePath, `nexo-core`, permisos con RLS real, en producción |
| RRHH | `/rrhh` | RRHH | Gestor360 (`marcacion-grupo-ct`) | 🟡 **En validación** — infraestructura completa y desplegada (ver detalle abajo), MVP operativo sin probar de punta a punta con datos reales. Ver [RRHH_MVP.md](RRHH_MVP.md) |
| Flotilla | `/flotilla` | Cadena de suministro | Ruta360 (`Desktop/Transporte`) | ⏳ Código importado (2026-08-29), sin adaptar — sigue apuntando a su Supabase original |
| Web Corporativo | *(dominio aparte, no es módulo del panel)* | — | materiales-jcastillo | ✅ No requiere adaptación — listo tal cual (2026-08-30) |
| Inventario | `/inventario` | Cadena de suministro | Nuevo (Fase 2) | Planeado |
| Compras | `/compras` | Cadena de suministro | Nuevo (Fase 2) | Planeado |
| Ventas / PdV | `/ventas` | Ventas | Nuevo (Fase 2) | Planeado |
| Contabilidad | `/contabilidad` | Finanzas | Nuevo (Fase 2) | Planeado |
| Proyectos | `/proyectos` | Servicios | Nuevo (Fase 3) | Planeado |
| Mantenimiento | `/mantenimiento` | Cadena de suministro | Nuevo (Fase 3) | Planeado |
| Soporte | `/soporte` | Servicios | Nuevo (Fase 3) | Planeado |
| Documentos | `/documentos` | Finanzas | Nuevo (Fase 3) | Planeado |

## RRHH — qué significa "en validación"

Verificado en vivo (2026-09-04), no asumido:

- **Listo y desplegado**: proyecto Vercel `nexo-rrhh` sirviendo bajo
  `/rrhh` (rewrite de Multi-Zones confirmado), schema `rrhh` con sus 8
  tablas (más particiones) aplicado a `nexo-core`, RLS + `GRANT`
  correctos (`has_schema_privilege('authenticated', 'rrhh', 'USAGE') =
  true`), permisos v3.0 con 37 códigos bajo `rrhh.*` en
  `core.permissions_catalog`, `core.company_apps` con `rrhh` habilitado,
  UI de alta de empleados (`/rrhh/expedientes/nuevo`) y kiosco de
  marcación (`/rrhh/kiosco`) funcionando.
- **Sin probar todavía**: no existe ningún empleado real cargado
  (`rrhh.empleados` en 0 filas al 2026-09-04), ninguna marca de
  asistencia, ninguna planilla. El motor que consolida marcas en horas
  trabajadas y genera una planilla **no está construido** —
  `/rrhh/planillas` es un placeholder explícito en el código. No se ha
  ejecutado el recorrido completo admin → empleado marca → planilla con
  datos de prueba.
- Detalle de alcance, criterios de aceptación y lo que falta:
  [RRHH_MVP.md](RRHH_MVP.md).

"Código importado, sin adaptar" (aplica solo a Flotilla) significa: el
código fuente ya vive en `apps/flotilla` con su historial de git, pero
todavía no tiene `basePath` de Multi-Zones, todavía usa su proyecto
Supabase original (no `nexo-core`), y todavía no valida permisos contra
`core.permissions_catalog`.

Cada módulo activo debe tener un `apps/<slug>/manifest.json`
(convención descrita en
[planning/PROPUESTA_MARCA_MODULOS.md](planning/PROPUESTA_MARCA_MODULOS.md)
sección 5) que alimenta esta tabla y la de `core.apps` en Supabase.
