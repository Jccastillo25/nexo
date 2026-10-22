# 2026-10-18 — Reportes de Asistencia con exportación a PDF

**Estado:** ⏳ Pendiente → 🟡 Implementado en local, migraciones aplicadas en `nexo-core`. Sin recorrido con sesión real, sin commit, sin push ni deploy (el usuario pidió mantener todo en local).

## Pedido y decisiones del usuario

"Necesitamos implementar los reportes en asistencia. Tienen que poder exportarse en pdf." Respuestas:
- los cuatro reportes propuestos, más una revisión de plataformas similares, de donde salió la tarjeta individual;
- horas netas;
- PDF generado y vista de impresión;
- permisos nuevos.

Con "Ok" aprobó la matriz y las decisiones recomendadas; con "Aplícalo", la aplicación.

Reglas de cálculo, en `rrhh.fn_asistencia_dias`:
- Marcas truncadas al minuto.
- Netas = salida − entrada − descanso. Si no marcó descanso, se descuenta el programado (D1).
- Tardanza y salida temprana cuentan completas desde la hora programada si superan la tolerancia.
- El trabajo en feriado o en día no laborable va aparte, sin tardanza.
- "Sobre jornada" es informativo; no son horas extra autorizadas.
- "Sin marcas" no es falta injustificada, porque aún no hay vacaciones ni permisos.
- Rango máximo de 62 días, y nunca después de hoy en Managua.

Riesgo conocido: se usan las reglas de jornada vigentes hoy, porque `jornada_dias` no guarda versiones.

## Migraciones (aplicadas, ver MIGRATION_LOG)

| Archivo | Contenido |
|---|---|
| `20261018014012_asistencia_reportes_paso_cero` | `rrhh.asistencia.reportes.ver` / `.exportar`. Plantillas: Admin RRHH, Supervisor de Asistencia y Especialista de Planillas ver + exportar; Consulta General solo ver. Ningún rol de empresa recibe permisos. |
| `20261018014127_asistencia_reportes` | Núcleo `rrhh.fn_asistencia_dias`, que F1.5 debe reutilizar. `rrhh.fn_reporte_validar`. RPC `asistencia_reporte_{diario,resumen,tardanzas,incidencias,opciones}` y `asistencia_registrar_exportacion`, que audita `rrhh.asistencia.reporte.exportado`. Solo `authenticated`; el núcleo no se expone. |

**Ensayos antes de aplicar:** casos sintéticos A–I con los valores esperados y el archivo exacto contra datos reales, ambos revertidos.

**Después de aplicar:**
- Advisors 62 / 6 / 81 / 1. Los +6 son las RPC autenticadas; `anon` sin cambios.
- Consulta como owner del 1 al 17 de octubre: 15 filas y las 3 funciones responden.

## Interfaz (`apps/rrhh`, vía `ux-planner` → `ui-frontend` → `reviewer`)

- **Pantallas:** `/asistencia/reportes/{diaria,resumen,tardanzas,incidencias,tarjeta}`.
  - Filtros en la URL; paginación de 100 en diaria, tardanzas e incidencias.
  - Totales en `MetricCard`; estados de vacío, error y acceso denegado.
- **PDF:** `GET /asistencia/reportes/exportar/[reporte]`, Route Handler en Node.
  - Valida 401, 403 y 400; más de 5000 filas da 422.
  - Audita y genera con jspdf 4.2.1 + jspdf-autotable 5.0.8, ahora fijadas.
  - Helvetica, A4 horizontal (tarjeta vertical), pie "Emitido… · Página X de Y", firmas en la tarjeta.
- **Impresión:** `(impresion)/asistencia/imprimir/[reporte]`, sin NexoShell, con `@media print` / `@page`; también audita (formato `impresion`).
- **Lógica común:** `src/lib/reportes-asistencia/` tiene formatos, columnas, documento, PDF, datos y rutas, compartidos por pantalla, PDF e impresión. Mobile usa las mismas RPC.
- **Menú:** grupo "Análisis" con los 5 reportes; "Envíos del kiosco" sigue como Pronto. El dashboard tiene accesos rápidos a los reportes.
- **Descarga:** `fetch` con la constante `RRHH_BASE_PATH` (fetch no aplica basePath), luego blob y `<a download>`.

## Pruebas

- `rrhh` typecheck, lint y build en verde. El build lista las 7 rutas nuevas.
- `node --experimental-strip-types --test` de reportes_formato, p6_filtros y p5: 21/21. El archivo nuevo quedó agregado a `test:rrhh:p6`.
- PDF sintético (300 filas, 16 páginas; tarjeta, 2 páginas) revisado visualmente por el ejecutor.

## Revisión independiente (`reviewer`)

Sin hallazgos críticos, altos ni medios. De los hallazgos bajos, se devolvieron al ejecutor:
- validación con `Object.hasOwn` y mensaje de filtro genérico;
- estados no laborables que fuerzan "incluir no laborables";
- `aria-invalid` y foco por campo;
- dashboard sin cuadrícula vacía;
- `asistencia.ver_modulo` en el PDF;
- `prefetch={false}` en Imprimir;
- encabezado con nombre largo.

Corregidos y verificados por el coordinador:
- typecheck, lint y build de `rrhh` en verde;
- 24/24 pruebas de Node, incluida una prueba de humo de `generarPdf` con 300 filas.

Aceptados como deuda:
- **Auditoría antes de generar el PDF.** Si jspdf falla, queda registrada una exportación no entregada. La auditoría registra aperturas y descargas pedidas, no impresiones físicas.
- **Nombre del emisor.** `asistencia_registrar_exportacion` lo toma de `raw_user_meta_data.full_name`, que el propio usuario puede editar. La auditoría guarda el `auth.uid()` real. Corregir en una migración futura tomando el nombre de una fuente que el usuario no controle.
- **`hasPermission` con 403 en el Route Handler**, en lugar de `requirePermission`. Equivale: falla cerrado.

## Recorrido con sesión real en local (owner, Chrome, 2026-10-18)

- **Las 5 pantallas cargan con datos de `nexo-core` entre el 1 y el 17 de octubre:**
  - diaria: 15 días-persona, 1 completo, 6:20 netas y una tardanza de 5:20;
  - resumen: 129:00 programadas y 0,0 % de puntualidad;
  - tardanzas: 1 fila;
  - incidencias: 14 sin marcas;
  - tarjeta: 17 días, con domingos "Día de descanso" y horario programado por día.
- **PDF diaria y tarjeta:** 200 `application/pdf`. La tarjeta se revisó en el visor de Chrome: encabezado con empresa, ficha, totales, nota, firmas y el pie "Emitido el 17/10/2026 20:39 por … · Página 1 de 1".
- **Rango de 290 días:** 400 con "Rango inválido…" y sin auditoría.
- **Vista de impresión:** sin NexoShell, con `@page` A4 horizontal y el pie con contador de páginas. No se abrió el diálogo nativo de impresión.
- **`core.audit_log`:** 4 registros `rrhh.asistencia.reporte.exportado`, 3 `pdf` y 1 `impresion`, con filtros y número de filas.
- **Visto en el recorrido:** la empresa no tiene RUC cargado (`core.companies.tax_id`), así que el encabezado sale solo con el nombre.

## Pendiente

- Probar con un rol que tenga solo `reportes.ver` (sin exportar) y en móvil; el diálogo nativo de impresión.
- Asignar `asistencia.ver_modulo` y `reportes.*` a roles de empresa (Configuración → Roles).
- Versionar jornadas para que reportes de períodos pasados no usen la regla actual.
- Envíos del kiosco; vacaciones y permisos, que son los que hacen falta para distinguir ausencias justificadas.
