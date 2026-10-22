# 2026-10-20 — CRM: esquema del embudo comercial (tablas + 48 RPC)

- **Estado:** el Paso Cero ya estaba aplicado (2026-10-19). Con esta migración, el esquema y las RPC quedan **aplicados** en `nexo-core`. Todavía sin pantallas, sin datos y sin commit.
- **Migración:** [`20261020060058_crm_embudo_esquema.sql`](../../supabase/migrations/20261020060058_crm_embudo_esquema.sql). Se escribió como `20261019200000_…` y se renombró a la versión remota.
- **Decisiones:**
  - El usuario respondió el 2026-10-19: "De acuerdo con todo: acepto las recomendaciones de P1–P7 y los datos iniciales (S6)" ([16a §10](../plan/16a-crm-embudo-especificacion-ux.md)).
  - Ese mismo día decidió que el ERP/CRM se construye dentro de Nexo, con ERPNext y NextCRM solo como referencia.

## Qué se creó (schema `crm`, cerrado a la API: RLS sin políticas y sin GRANT)

| Tabla | Tipo | Nota |
|---|---|---|
| `embudo_parametros` | configuración | Descuento máximo (5 %), IVA (15 %), tipo de cambio (36.6243), validez (15 días) y datos de la empresa para el PDF |
| `etapas` | catálogo | Nuevo 10 % · Calificado 25 % · Cotización enviada 50 % · Negociación 75 % · Ganada · Perdida. Ganada y Perdida son únicas, no se pueden desactivar y su probabilidad es fija |
| `origenes` | catálogo | Sala de ventas, Llamada, WhatsApp, Referido, Redes sociales y Visita de campo |
| `motivos_perdida` | catálogo | Precio, Sin stock, Tiempo de entrega, Compró a la competencia, Proyecto cancelado y Otro (este último pide detalle) |
| `correlativos` | contador | `COT-AAAA-00001` por empresa y año; nunca se reutiliza |
| `leads` | registro | Estados: nuevo, contactado, calificado, descartado y convertido. Exige teléfono o correo. Borrado lógico y `version` |
| `oportunidades` | registro | Etapa, monto, probabilidad (ajustable), cierre estimado. Estados: abierta, ganada y perdida, con motivo |
| `actividades` | **particionada por mes** (`fecha`) | Ligada a exactamente un lead, una oportunidad o un cliente; una nota no se puede agendar |
| `cotizaciones` + `cotizacion_lineas` | **particionadas por mes** (`fecha`) | Totales calculados por el servidor; aprobación si el descuento supera el máximo |
| `eventos` | **particionada por mes** (`creado_en`) | Hitos para la línea de tiempo, además de `core.audit_log` |

- Las particiones de octubre de 2026 a enero de 2027 ya están creadas; las siguientes las crea `core.fn_asegurar_particiones_futuras`, y las RPC crean la del mes cuando hace falta.
- La siembra S6 se aplicó a la empresa con CRM, y `crm.fn_sembrar_embudo` la repite de forma idempotente.

**48 RPC `public.crm_*`**, todas `security definer`, con `core.has_permission` y el filtro de alcance. Las de escritura usan `p_version`. Están en [16a §7](../plan/16a-crm-embudo-especificacion-ux.md), más tres:
- `crm_actividad_reprogramar`;
- `crm_embudo_eliminar`;
- `crm_embudo_guardar_parametros`, que también guarda los datos de la empresa (P3).

Reglas aplicadas:
- **P1:** el costo de referencia solo se muestra con `productos.catalogo.costo.ver`.
- **P4:** `crm_productos_buscar` no devuelve costo.
- **P7:** nadie aprueba ni rechaza sus propias cotizaciones.
- **S2:** la primera actividad completada pasa el lead a "contactado".
- **S3:** al convertir, las actividades agendadas pasan a la oportunidad.

## Pruebas (transacción revertida en `nexo-core`, antes de aplicar)

**19 grupos de pruebas en verde.** Usaron cuatro usuarios reales con roles `PRUEBA` armados con las plantillas: el owner, dos vendedores y un gerente. Se probó:
- siembra;
- vendedor con 17 permisos;
- validación y normalización de teléfono (+505);
- alcance: un vendedor no ve lo de otro y el gerente ve todo;
- el vendedor no puede cambiar el responsable;
- la actividad pasa el lead a "contactado" y se aplican las reglas de fecha, nota y relacionado;
- conversión con cliente nuevo y traslado de lo agendado;
- RUC repetido: se rechaza sin dejar nada creado;
- conflicto de versión;
- totales: 10 × 100 con 3 % de descuento más 15 % de IVA = 1,115.50;
- marcas de agua;
- aprobación: el vendedor no puede y el gerente sí;
- nadie aprueba lo propio, tampoco el owner;
- el costo solo lo ve quien tiene permiso;
- aceptar una cotización gana la oportunidad con el total;
- perder una oportunidad rechaza sus cotizaciones y cancela lo agendado;
- reasignación;
- reglas de etapas y propagación de la probabilidad;
- reprogramar mueve la actividad de partición;
- seguimiento al completar;
- duplicar una cotización;
- línea de tiempo;
- `anon` sin `EXECUTE`.

El primer intento falló por la preparación de la prueba: faltaba `numero_id` del producto. Se corrigió y todo pasó.

## Postcheck remoto

- Versión `20261020060058`.
- 48 RPC.
- 6 etapas, 6 orígenes, 6 motivos y 1 fila de parámetros.
- 16 particiones.
- 0 leads y 0 cotizaciones.
- Advisors de seguridad:
  - 142 `rls_enabled_no_policy` y 142 `authenticated_security_definer`: las tablas y RPC del embudo se suman al patrón ya aceptado de Metas y Productos.
  - 6 `anon_security_definer`, ninguna del CRM.
  - Protección de contraseñas filtradas: ya existía.

## Deuda / pendiente

- **Clientes con historial:** `crm.clientes` ahora tiene FK desde leads, oportunidades, actividades y cotizaciones. Borrar un cliente que ya tiene ese historial va a fallar por la restricción, y la pantalla actual de Clientes muestra un error genérico. Hay que manejarlo al tocar Clientes.
- **UI en `apps/crm`:**
  - menú;
  - Leads, Conversión, Embudo, Oportunidad, Agenda, Actividad, Cotizaciones e impresión;
  - Configuración del embudo;
  - KPIs del Dashboard.
  Además: iconos `funnel`, `phone` y `mail`, y `ConfirmDialog` con `children`, Escape y foco.
- Revisión, pruebas de UI, commit y deploy.
- Asignar los permisos a roles de empresa.
