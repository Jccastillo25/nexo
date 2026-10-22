# Pantallas: permisos y estados

Prefijo `rrhh.planillas.` omitido. Lista completa de los 25 códigos y quién los
tiene: [nexo-planilla-motor/references/estados-y-permisos.md](../../nexo-planilla-motor/references/estados-y-permisos.md).
Sin el permiso de ver, la página muestra el estado "Acceso denegado"
(`EmptyState variant="no-access"`; fuera del layout, `apps/rrhh/src/app/sin-acceso/page.tsx`).

## 1. Permiso por pantalla y acción

| Pantalla | Ver | Acciones (permiso) |
|---|---|---|
| Dashboard | `planilla.ver` (cada bloque con el suyo) | — |
| Planillas (lista) | `planilla.ver` | Nueva planilla (`planilla.generar`) |
| Planilla (detalle) | `planilla.ver` | Calcular (`planilla.generar`), Aprobar (`planilla.aprobar`), Pagar (`planilla.pagar`), Anular (`planilla.anular`), Exportar (`reportes.exportar`), Publicar colillas (`colillas.enviar`) |
| Novedades | `movimientos.ver` | Agregar, importar (`movimientos.crear`), Eliminar (`movimientos.eliminar`) |
| Colillas | `planilla.ver` | Publicar o enviar (`colillas.enviar`), Imprimir |
| Vacaciones | `vacaciones.ver` | Registrar (`vacaciones.registrar`), Aprobar o rechazar (`vacaciones.aprobar`) |
| Préstamos y embargos | `prestamos.ver` | Crear, editar (`prestamos.gestionar`) |
| Liquidaciones | `liquidaciones.ver` | Simular y preparar (`liquidaciones.calcular`), Aprobar (`liquidaciones.aprobar`) |
| Declaraciones | `declaraciones.generar` | Generar, exportar |
| Simulador de régimen | `regimen.ver` | — |
| Régimen por contrato | `regimen.ver` | Cambiar, descartar aviso (`regimen.cambiar`) |
| Conceptos y tipos | `conceptos.ver` | Crear, editar (`conceptos.gestionar`) |
| Parámetros y tabla de IR | `parametros.ver` | Nueva vigencia (`parametros.editar`) |

Observación para el coordinador: la plantilla `consulta` tiene `planilla.ver` y
por tanto verá salarios en las líneas, aunque no tiene
`rrhh.expedientes.compensacion.ver` (`20260902000005:146-158`). Confirmar si es
lo deseado.

## 2. Estados de cada pantalla

| Estado | Cómo se muestra | Texto guía |
|---|---|---|
| Cargando | `PageSkeleton`/`Skeleton` con la forma de la tabla | — |
| Vacío | `EmptyState` con la siguiente acción si hay permiso | "Todavía no hay planillas. Crea la primera para el período actual." |
| Sin resultados del filtro | `EmptyState variant="no-results"` | "No hay planillas con estos filtros." |
| Error de RPC | `ErrorState` o `EmptyState variant="error"`, distinto de vacío | "No se pudo cargar la planilla. Intenta de nuevo." |
| Acceso denegado | `EmptyState variant="no-access"` | "No tienes permiso para ver planillas." |
| Pendiente de integración | `EmptyState variant="pending"` | "Las horas extra desde Asistencia estarán disponibles más adelante." |
| Borrador | `StatusBadge tone="neutral"` "Borrador" | — |
| Calculada | `StatusBadge tone="info"` "Calculada" | Aviso si hubo cambios después del cálculo |
| Aprobada | `StatusBadge tone="positive"` "Aprobada" + `Alert tone="info"` | "Aprobada el <fecha> por <nombre>. Para corregirla, anúlala y genera otra." |
| Pagada | `StatusBadge tone="positive"` "Pagada" | Método y fecha |
| Anulada | `StatusBadge tone="negative"` "Anulada" | Motivo y enlace a la de reemplazo |
| Bloqueo de cálculo | `Alert tone="error"` con la lista de motivos y la persona afectada | "No se puede calcular: el salario de 1 contrato está bajo el mínimo del sector." |
| Aviso de régimen | `Alert tone="warning"` | "Revisar régimen con el contador" |
| Dato por verificar | `Alert tone="info"` | "Valor pendiente de confirmar con el contador." |
| Acción no permitida por separación | Botón deshabilitado con texto visible | "La aprobación la hace otra persona." |

`StatusBadge` acepta `neutral | positive | warning | negative | info`;
`Alert`, `info | warning | error | success`; `EmptyState`, `empty | no-results |
no-access | error | pending | dropzone` (verificado en `packages/ui`).

## 3. Criterios de aceptación que se repiten

- Cada botón que escribe está oculto o deshabilitado sin su permiso, y la Server Action responde con mensaje claro si se llama igual.
- Aprobar, anular y pagar piden confirmación con el resumen de montos.
- Una planilla aprobada no muestra ningún control de edición.
- Los montos coinciden con la RPC al centavo (no se recalculan en la vista).
- En celular: tablas con desplazamiento horizontal o tarjetas por persona; el neto siempre visible.
- Sin datos personales en textos de ejemplo, capturas ni pruebas.
