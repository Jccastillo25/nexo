# Dashboard de agencia — entrega técnica y revisión manual

> Historial del ticket #13. El candidato del ticket #18 extrae esta vista a
> `apps/agencia`, con deploy independiente y ruta `/agencia/dashboard`.
> Al publicar el cambio aprobado, `/dashboard` de Nexo queda como redirect.
> Estado vigente y matriz: `docs/status-log/2026-10-14-agencia-independiente.md`.
> Las pruebas manuales del ticket #13 siguen pendientes.

## Estado

Etapas 1–3 implementadas. Etapa 4 con validación de navegador MANUAL PENDIENTE.
Decisión del usuario del 2026-10-14: revisar visualización, navegación y acceso
manualmente cuando el deploy esté listo. No se declara validación completa.

El controlador ejecuta lint, next typegen, tsc y build antes de solicitar
la revisión de Claude. Sus códigos de salida y registros son las evidencias
automáticas de esta ejecución; no se sustituyen por pruebas del agente sin red
o sin tipos generados. El PR solo puede entregarse si esos controles pasan
y Claude aprueba el cambio técnico. La revisión manual sigue pendiente.

## Alcance

Ruta /dashboard de apps/nexo, datos locales de ejemplo, solo lectura.
Se conserva la etiqueta de demostración. No conecta agentes reales ni añade
acciones de escritura. La página consulta nexo.ver_modulo mediante hasPermission;
el guard de servidor deniega si el permiso falta o la consulta falla.
Ese rechazo muestra un EmptyState; no redirige actualmente a /sin-acceso.
No se modifican permisos, roles, migraciones, dependencias ni lockfiles.

La entrada de Dashboard del menú no sustituye el control de servidor.
getCompanyId obtiene la empresa de configuración; este documento no afirma
que exista selección multiempresa ni verifica pertenencia de cuentas reales.

## Evidencia del intervalo completo

El controlador ejecutó la comparación del padre de la etapa 1 hasta la base
actual, incluyendo el modelo de datos de etapa 2 y la interfaz de etapa 3.
La comparación del candidato de esta etapa es separada: solo este Markdown.
El diff completo y su SHA-256 se conservan en el expediente de la ejecución.

Base: 4b81a00891ccc46d875baa3a971b289097b2715e
Head: c705782a65104a051ecba3d32ed6fd843785ced4
SHA-256 del diff: 9b3ee9d7bfd4f993ddc05eade3bb23b39f2079ee5e63bac2d3a988b16ec8e3e7

Comando reproducible (salida íntegra de Git, incluido el salto de línea final):

    git diff --no-ext-diff --no-textconv 4b81a00891ccc46d875baa3a971b289097b2715e c705782a65104a051ecba3d32ed6fd843785ced4 | sha256sum

Archivos del intervalo:

A	apps/nexo/docs/DASHBOARD_AGENCIA_IMPLEMENTACION.md
A	apps/nexo/docs/DASHBOARD_AGENCIA_PROPUESTA.md
A	apps/nexo/src/app/(app)/dashboard/agent-card.tsx
A	apps/nexo/src/app/(app)/dashboard/labels.ts
A	apps/nexo/src/app/(app)/dashboard/page.tsx
A	apps/nexo/src/app/(app)/dashboard/progress-bar.tsx
A	apps/nexo/src/app/(app)/dashboard/ticket-card.tsx
A	apps/nexo/src/app/sin-acceso/page.tsx
A	apps/nexo/src/lib/agency/checks.ts
A	apps/nexo/src/lib/agency/fixtures.ts
A	apps/nexo/src/lib/agency/selectors.ts
A	apps/nexo/src/lib/agency/types.ts
M	apps/nexo/src/lib/nav.ts

## Lista de revisión manual del usuario

- [ ] Abrir el Dashboard y comprobar el aviso de demostración, agentes,
      responsables, estados, porcentajes y progreso por etapa.
- [ ] Revisar a 360, 768 y 1440 píxeles sin recortes, solapamientos o
      desbordamiento; revisar títulos largos y foco de teclado.
- [ ] Probar entrada sin sesión y con una cuenta autorizada.
- [ ] Probar una cuenta autenticada sin permiso: no debe ver datos del Dashboard.
- [ ] Comprobar /, /login, /configuracion/marca y enlaces CRM/RRHH.
- [ ] Revisar estados vacíos con datos controlados, sin cambiar datos reales.

Estos pasos no se ejecutaron automáticamente en esta etapa y no están aprobados.
Se revisan en el deploy/Preview. La aprobación de código de Claude y la
autorización humana de merge no sustituyen la confirmación de estas pruebas.

## Observaciones y límites

La sección Progreso por etapa de la interfaz actual no muestra un mensaje
específico para un ticket con cero etapas. TicketCard sí tiene esa presentación.
Este estado y los demás vacíos deben comprobarse manualmente; no se afirma
que los fixtures actuales permitan activar cada caso desde la interfaz.

La semántica de nexo.ver_modulo, el icono provisional y una eventual redirección
a /sin-acceso se conservan sin ampliar el alcance. El mapa de administración
de usuarios y permisos se trabajará por separado después.

No hay capturas automatizadas ni pruebas con cuentas reales en este expediente
generado por el controlador. No hay autorización automática de merge.
