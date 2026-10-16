# 2026-10-15 — especificación aprobada de RRHH/kiosco

## Cambio de estado

Se aprobó el **diseño** de [piloto supervisado y MVP operativo](../RRHH_PILOTO_MVP_OPERATIVO.md), y el correo corporativo de RRHH como canal inicial con registro restringido (`recibido`, `en revisión`, `pendiente de corrección`, `cerrado con explicación`). Las funciones se nombran por responsabilidad, sin personas ni direcciones reales en documentación/tickets públicos. Una persona podrá cubrir varias funciones, con permisos independientes.

No se implementó código, no se configuraron usuarios, no se creó ni cambió ninguna marca/contrato/dato, no se aplicó migración y no se publicó despliegue. Los tickets P1–P7/M1–M4 son trabajo pendiente. No se hizo recorrido con usuarios reales ni se autorizó el piloto.

> **Actualización posterior el mismo día (2026-10-15):** P1 (rechazo del PIN ambiguo, [issue #30](https://github.com/Jccastillo25/nexo/issues/30)) quedó implementado y fusionado en `main` (`fc2b309`, PR #42), con la migración `20261015181000` todavía **sin aplicar** a `nexo-core`. El resto de P2–P7/M1–M4 sigue como trabajo pendiente y sin autorización.

## Alcance y evidencia de preparación

- Base local: pantallas/rutas de administración de usuarios y roles, Expedientes, Contratos, Jornadas y Kiosco existentes en código. La existencia de ruta no valida el flujo real.
- La revisión técnica anterior identificó búsqueda del PIN limitada a la empresa del dispositivo, `LIMIT 1` ante coincidencia, falta de unicidad demostrada, marcas sin `contrato_id` y ausencia de garantía de idempotencia/concurrencia; la especificación convierte esas brechas en P1–P4.
- P7 exige registrar privadamente responsables funcionales, dirección exacta del buzón, dispositivo y resultados de pruebas, y posponer ante cualquier prueba crítica fallida. Esos datos todavía no están designados y no bloquean documentar ni abrir tickets.
- M1–M4 separan el permiso de corrección, auditoría de originales, servicio, pantalla y validación real. Nómina y cálculos salariales quedan fuera de este corte.

## Pendiente antes de autorizar

Completar P1–P7, designaciones privadas, dispositivo único, compatibilidad de jornada (incluida «Ventas» solo donde corresponda), límite de intentos, unicidad, concurrencia, idempotencia, permisos/tenant y recorrido con usuarios reales. El MVP operativo requiere adicionalmente M1–M4 y su recorrido real. No confundir esta aprobación documental con aprobación de operación.
