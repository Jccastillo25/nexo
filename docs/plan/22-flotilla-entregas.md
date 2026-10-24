# Plan 22 — Flotilla: Entregas (MVP)

> Parte de [`PLAN_MAESTRO_IMPLEMENTACION_NEXO.md`](../PLAN_MAESTRO_IMPLEMENTACION_NEXO.md) (índice). Especificación entregada por el usuario el 2026-10-23 con el pedido de implementarla y dejar Flotilla lista ("Lanza sin agentes para que podamos tener flotilla listo e implementar esto que te envié"). Es un corte operativo adelantado de la [Fase 4](07-fase4-transporte.md), no su cierre. El texto original sigue abajo sin cambios; la verificación E0 y el Paso Cero están en las secciones 18 y 19 al final.
>
> **Corrección a la sección 4:** los códigos de permiso del borrador tienen 3 segmentos (`flotilla.entregas.ver`). La norma exige 4 (`[app].[modulo].[recurso].[accion]`); la matriz vigente es la de la sección 19.

# Nexo Entregas

## Especificación funcional y técnica del MVP

Versión 1.0 · 23 de octubre de 2026 · Materiales JCastillo

**Propuesta:** incorporar la operación de entregas como una sección de Flotilla, con administración desde computadora y ejecución desde el teléfono del conductor. El MVP cubre desde la solicitud de envío de una venta existente hasta la recepción, conciliación de materiales y resolución de incidencias.

Este documento define un producto por implementar. No acredita software construido, migraciones aplicadas ni despliegues. Las decisiones de plazo, cobertura y condiciones comerciales se parametrizan antes del piloto.

## 1 Decisión de arquitectura y evidencia revisada

Revisión de `Jccastillo25/nexo`, rama principal, árbol `9b2d75ddab05127ccf9a02304153bdb89cee530d`. Se revisaron documentación de planificación y archivos concretos; no se inspeccionó la base remota ni los despliegues en esta tarea. Los cambios que existan solo en la computadora del usuario quedan fuera de esta revisión.

| Evidencia | Hallazgo | Consecuencia para el MVP |
|---|---|---|
| `docs/PLAN_MAESTRO_IMPLEMENTACION_NEXO.md` y árbol de apps | CRM retirado el 20 de octubre; existen Productos y Presupuesto | No depender de un CRM retirado ni crear uno dentro de Entregas |
| `README.md` | Todavía describe CRM operativo | Hay documentación desactualizada; verificar estado antes de implementar |
| `docs/plan/07-fase4-transporte.md` | Ordena reutilizar `apps/flotilla` | Extender Flotilla; no crear otra app con flota duplicada |
| `apps/flotilla/lib/trip-status.ts` | Existen estados de viaje, inspección y descarga | Reutilizar conceptos, separar viaje de cada parada de entrega |
| `apps/flotilla/lib/admin-auth.ts` y tipos de base | Modelo heredado con `public.admins`, `companies`, `drivers` | Adaptar identidad y autorización a Nexo antes del piloto |
| `apps/flotilla/next.config.ts` | Configuración vacía | No asumir que ya funciona bajo `/flotilla` |
| `packages/permissions/index.ts` | Permisos centralizados y denegación por defecto | Reusar autorización; no crear roles paralelos |
| `docs/plan/02-estrategia-movil.md` | Transporte exige operación offline | El MVP incluye captura offline limitada y sincronización segura |
| `apps/flotilla/lib/offline/sync.ts` | El `localId` local no se envía al insertar el evento | Riesgo de duplicar eventos al reintentar; corregir antes de reutilizar |

La política interna de coordinación y entrega de pedidos, versión 1.0, es la base operativa. Sus espacios pendientes de cobertura y tiempos siguen pendientes: no se interpretan como valores aprobados.

### Ubicación propuesta

- Launcher Nexo: tarjeta existente o adaptada **Flotilla**, con entrada a **Entregas** según permisos.
- Administración: `/flotilla/entregas`.
- Operación de conductor: `/flotilla/conductor`.
- App existente: `apps/flotilla`; esquema objetivo: `flotilla` en `nexo-core`.
- Misma identidad, empresas, permisos, componentes y diseño de Nexo.
- Un proyecto de despliegue para Flotilla, según la arquitectura existente; verificar si existe antes de crear alguno. Entregas no requiere un segundo proyecto propio.

Este es un corte operativo de Fase 4, no su terminación completa. Nexo Mobile nativo Android/iOS y la flota integral conservan sus fases posteriores. La web móvil del MVP debe probarse en ambos sistemas; no se presenta como una app nativa.

## 2 Objetivo y límites

El sistema debe responder: qué debe entregarse, quién lo coordina, cuándo se prometió, qué camión lo lleva, cuánto recibió el cliente y qué quedó pendiente.

### Incluido en la primera versión

1. Solicitudes de entrega vinculadas a pedido o factura existente.
2. Validación de disponibilidad, pago autorizado, ubicación y condiciones.
3. Zonas y reglas básicas de envío gratis o con flete.
4. Agrupación diaria y asignación manual a recorridos y paradas.
5. Control de capacidad, conductor, confirmación y preparación de carga.
6. Despacho e inspección básica del vehículo.
7. Vista móvil de recorridos asignados, navegación externa, recepción y evidencia.
8. Entregas completas, parciales, intentos fallidos, retornos y reprogramaciones.
9. Incidencias, responsables, compromisos y auditoría.
10. Confirmaciones manuales por WhatsApp y seguimiento interno.
11. Comprobante imprimible, manifiesto de carga y exportación CSV con permisos.
12. Tablero de pendientes y métricas operativas verificables.

### Fuera del MVP

Optimización automática de rutas, rastreo GPS continuo, promesas automáticas de hora de llegada, WhatsApp API, chatbot, portal público de rastreo, firma certificada, contabilidad, caja, facturación fiscal, kárdex, mantenimiento completo, comisiones y liquidaciones de conductor. Tampoco habrá integración automática con AG Negocio en esta primera versión.

El beneficio gratuito no implica entrega inmediata. Agrupar por zonas ayuda a reducir costo, pero no autoriza a incumplir fechas confirmadas ni a mantener pedidos sin fecha indefinidamente.

## 3 Fuentes de verdad e integración

| Información | Autoridad | Tratamiento inicial |
|---|---|---|
| Venta, factura, crédito y saldo | ERP vigente | Referencia y validación manual documentada; Nexo no emite factura ni da por pagada una venta |
| Identidad de producto | Productos de Nexo cuando esté disponible | Referencia al producto y copia histórica de descripción, unidad y dimensiones |
| Existencia y reserva comercial | ERP/Bodega | Validación humana con usuario y fecha; no inventar sincronización ni descontar inventario |
| Datos de cliente | Maestro comercial cuando esté disponible | Guardar destinatario como copia histórica en la orden, sin crear un segundo maestro de clientes |
| Personas y acceso | RRHH, identidad Nexo y `core` | Reutilizar empleado, usuario y permisos |
| Vehículo y conductor | Flotilla adaptada | Un solo catálogo, aunque las pantallas administrativas se reduzcan |
| Recorridos, intentos y evidencia | Entregas | Fuente operativa única |

Ingreso inicial: captura manual estructurada más adjunto del documento comercial. Si el catálogo no tiene aún el producto, permitir una línea con código externo, descripción y unidad verificadas; debe quedar marcada como pendiente de vincular, no convertirse en un alta automática de producto. Antes de cargar se exigen dimensiones y peso verificados necesarios para evaluar capacidad.

Una misma venta puede generar varias órdenes por destinos distintos. La clave de origen identifica empresa, sistema, tipo, serie y número del documento. El sistema muestra las órdenes existentes antes de permitir otra y exige identificar destino y motivo. Un reintento de entrega usa la misma orden; no genera otra venta ni otra demanda de material.

Para impedir duplicación entre destinos, registrar una referencia única por línea del documento origen y su cantidad autorizada para entrega, con validación de Bodega/Administración y detalle de lo ya entregado por otras vías. La suma neta comprometida entre todas las órdenes, incluidas las ya entregadas, no puede superar esa autorización. El control es transaccional por línea de origen, no solo una alerta visual. Si la cantidad de origen o las salidas externas no pueden verificarse, bloquear la programación definitiva. Este registro es un control logístico con respaldo documental, no una factura nueva ni una supuesta integración con el ERP. Anulaciones comerciales o entregas externas posteriores requieren reconciliar la autorización antes del siguiente despacho.

## 4 Usuarios y permisos

Los siguientes son perfiles de trabajo, no cuentas separadas. Se asignan mediante el sistema central de roles de Nexo. Si una persona cumple varias funciones, su rol debe reunir las acciones autorizadas.

| Perfil | Puede hacer | Restricciones |
|---|---|---|
| Vendedor | Crear órdenes, consultar las propias, completar datos, registrar comunicación | No autoriza pago, carga, excepciones o cierre administrativo |
| Coordinador | Ver operación de la empresa, programar, asignar, reprogramar, resolver incidencias y cerrar | No altera hechos físicos ni valida cobros por cuenta de Administración |
| Bodega | Confirmar material, preparar, registrar carga y retornos | No cambia promesas, condiciones comerciales ni pagos |
| Administración | Validar pago/crédito y conciliar cobros autorizados | No redefine cantidades recibidas por el cliente |
| Conductor | Consultar recorridos propios, registrar eventos, cantidades, evidencia e incidencias | Sin acceso a otras rutas, precios generales, márgenes o administración |
| Gerencia | Reglas, excepciones y reportes de su ámbito | Sus cambios también quedan auditados |

Catálogo propuesto, sujeto al Paso Cero y comparación contra permisos existentes:

- `flotilla.entregas.ver`, `.ver_todas`, `.crear`, `.editar`, `.cancelar`, `.cerrar`, `.reabrir`.
- `flotilla.entregas.validar_pago`, `.validar_material`, `.confirmar_cliente`, `.exportar`.
- `flotilla.rutas.ver`, `.programar`, `.asignar`, `.despachar`, `.reprogramar`, `.cerrar`.
- `flotilla.carga.preparar`, `.validar`, `.conciliar`.
- `flotilla.conductor.operar`, `flotilla.evidencias.ver`, `.adjuntar`.
- `flotilla.recepciones.corregir`, reservado a revisión autorizada de Coordinación.
- `flotilla.incidencias.crear`, `.gestionar`, `.resolver`.
- `flotilla.configuracion.editar`, `flotilla.excepciones.aprobar`.

El permiso de acción siempre se combina con empresa y alcance del registro. Tener `operar` no habilita cualquier recorrido. Ocultar botones no sustituye RLS ni validación en el backend.

## 5 Pantallas

### 5.1 Tablero de entregas

Tarjetas: pendientes de validar, listos para programar, programados hoy, en reparto, parciales e incidencias vencidas. Tabla priorizada por vencimiento y antigüedad. Filtros de fecha, zona, vendedor, estado y responsable. Cada pendiente muestra bloqueo, responsable y siguiente acción.

Botones: Nueva orden, Planificar recorridos, Ver incidencias. Los indicadores sin datos muestran “Sin registros”, no cifras de ejemplo.

### 5.2 Nueva orden y ficha del pedido

Formulario en secciones: documento comercial; destinatario y contacto; dirección y ubicación; productos y cantidades; condición de envío; acceso y descarga; validaciones.

La ficha conserva una línea de tiempo y pestañas: Resumen, Materiales, Entregas e intentos, Evidencias, Incidencias. Muestra solicitado, asignado, cargado, aceptado, retornado y saldo por producto. Botones según estado y permiso, con explicación concreta cuando estén bloqueados.

### 5.3 Planificador diario

Panel izquierdo: pedidos listos agrupados por zona. Panel derecho: recorridos del día con vehículo, conductor, capacidad y paradas ordenadas. Asignar mediante selección y botones; arrastrar es opcional, nunca el único método.

Orden manual de paradas y ventana estimada por cliente. Indicadores de kg, largo máximo, unidades, tiempo estimado y restricciones. Sin motor de mapas pagado en el MVP: enlaces de ubicación y navegación externa.

La zona facilita agrupar; no garantiza accesibilidad. Peso desconocido se muestra como “Sin validar”, nunca como cero. Sobrecarga bloquea el despacho; no existe excepción gerencial para exceder capacidad segura.

### 5.4 Bodega y despacho

Lista de recorridos aprobados. Detalle de carga por pedido y producto, cantidades planificadas y cargadas, diferencias, observaciones y evidencia. Acciones: Iniciar preparación, Registrar diferencia, Validar carga y Autorizar salida.

Se genera manifiesto con recorrido, vehículo, conductor, paradas y materiales. El documento es operacional; no sustituye factura ni movimiento de inventario.

### 5.5 Mi recorrido en teléfono

Solo el trabajo asignado: vehículo, inspección, lista de paradas, próxima acción y estado de sincronización visible. En cada parada: dirección, contacto, ubicación, material y restricciones.

Botones grandes: Navegar, Llamar, Abrir WhatsApp, Llegué, Iniciar descarga, Registrar recepción, Reportar problema. No exponer configuración ni finanzas generales. Cambiar secuencia de paradas requiere permiso del coordinador; el conductor puede solicitarlo.

### 5.6 Recepción y evidencia

Por línea: cargado, aceptado, rechazado y no entregado. Motivos cuando hay diferencias. Nombre del receptor y evidencia de aceptación: foto del comprobante firmado o confirmación de WhatsApp adjunta y vinculada al pedido. Fotos del material complementan la recepción.

La firma dibujada puede añadirse después; no es necesaria para completar el MVP. Si no hay constancia, se registra “Recepción reportada, pendiente de evidencia”; nunca se inventa aceptación.

### 5.7 Incidencias y cierre

Bandeja con tipo, gravedad operativa, pedido, recorrido, responsable, fecha de compromiso y estado. Acciones: asignar, documentar solución, crear nuevo intento para saldo, registrar retorno, resolver y cerrar. Un viaje puede terminar con incidencias abiertas; su liquidación física y la orden comercial se controlan por separado.

### 5.8 Configuración y reportes

Zonas, bodega de salida, vehículos y capacidades, habilitación de conductores, días y horarios, condiciones de envío, motivos, plantillas y límites operativos. Reutilizar catálogos existentes; no copiar usuarios ni empresas.

Reportes: entregas por período/zona/conductor; pendientes por antigüedad; incidencias; cantidades pendientes; costos capturados. Exportación restringida a la misma empresa y alcance que la pantalla.

## 6 Flujo completo

| Paso | Responsable y acción | Validación del sistema | Resultado |
|---|---|---|---|
| 1 | Ventas crea solicitud desde una venta | Origen, destino y productos; alerta de posible duplicado | Borrador |
| 2 | Ventas completa ubicación, receptor y condiciones | Campos completos y condiciones comunicadas | Pendiente de validación |
| 3 | Administración valida pago/crédito; Bodega material | Ambas validaciones registradas; responsable y siguiente acción | Lista para programar |
| 4 | Coordinación asigna cantidades a recorrido y parada | Saldo disponible, capacidad y disponibilidad de vehículo/conductor | Asignación tentativa |
| 5 | Coordinación propone fecha y registra aceptación | Receptor, ventana y evidencia de confirmación | Programada |
| 6 | Bodega prepara y conductor revisa | Cantidades físicas, amarre, inspección y documentos | Carga validada |
| 7 | Coordinación autoriza salida | Sin bloqueos; versión vigente de la planificación | En reparto |
| 8 | Conductor avisa y registra llegada | Parada asignada; evento válido online o pendiente de sincronizar | En destino |
| 9 | Equipo descarga y registra recepción | Cantidades consistentes, receptor y evidencia | Completa, parcial o fallida |
| 10 | Bodega recibe retornos; Administración concilia cobros | Conciliación de cada cantidad cargada y dinero autorizado | Recorrido conciliado |
| 11 | Coordinación resuelve saldos e incidencias | Reintentos o cancelaciones de saldo autorizadas | Pedido listo para cierre |
| 12 | Ventas hace seguimiento y Coordinación cierra | Sin pendientes materiales, evidencias ni incidencias abiertas | Cerrada con auditoría |

Revalidar en el despacho cualquier cambio de productos, cantidades, dirección, vehículo o pago. Cambiar destino o ventana invalida la confirmación correspondiente. Cambiar material invalida la preparación afectada. Cambiar vehículo exige nueva revisión de capacidad e inspección.

## 7 Estados separados y reglas de transición

No usar una sola columna para mezclar venta, viaje, confirmación y problemas.

### Orden de entrega

`borrador → pendiente_validacion → lista → programada → en_reparto → entregada → cerrada`.

- `parcial`: hay aceptación de parte del material y saldo pendiente.
- Un intento fallido conserva el saldo exigible. Si lleva material en tránsito o sin conciliar, pasa a pendiente de conciliación; solo después queda disponible para una nueva asignación. El intento original se conserva.
- `cancelada`: solamente si no hubo aceptación ni carga sin conciliar. Si ya hubo entrega, cancelar únicamente el saldo autorizado; conservar el resultado “parcial con saldo cancelado”.
- “Entregada” significa cantidades aceptadas completas; “cerrada” exige además evidencia y conciliación, incidencias resueltas y seguimiento registrado.
- Si la comunicación de seguimiento no obtiene respuesta, registrar intentos. El coordinador puede cerrar con motivo “sin respuesta al seguimiento” solo si existe recepción válida y ningún reclamo o saldo pendiente. El silencio no prueba satisfacción.
- Una queja posterior abre una incidencia y reabre el control administrativo con motivo; no borra la entrega anterior.

La fase general y los indicadores se calculan en backend a partir de líneas e intentos. Si algunas líneas siguen en reparto, la orden conserva esa fase y muestra el indicador “Entrega parcial”; si todo terminó pero hay material pendiente, muestra “Pendiente de conciliación” o “Lista para reprogramar” según disponibilidad. No permitir que un usuario elija un estado que contradiga cantidades. Los indicadores de incidencia y evidencia pendiente son independientes.

### Recorrido o viaje

`borrador → planificado → en_preparacion → listo_salida → en_curso → finalizado → conciliado`.

Finalizado: todas las paradas tienen resultado o reprogramación registrada y el vehículo ha terminado su jornada de recorrido. Conciliado: cantidades, retornos, cobros autorizados y gastos registrados están revisados. Cancelar antes de salir libera asignaciones; después de salir se aborta y concilia, no se borra.

### Parada e intento

`pendiente_confirmacion → confirmada → en_camino → en_destino → descargando → completa / parcial / fallida`.

Cada nuevo intento crea un registro nuevo, vinculado a la misma orden y a su saldo. Confirmación del cliente: `pendiente / aceptada / rechazada`; evidencia: `pendiente / adjunta / validada`; incidencia: `abierta / en_gestion / resuelta / cerrada`.

### Reglas cuantitativas

- Por línea: saldo = solicitado − aceptado acumulado − cancelado autorizado. Nunca negativo.
- La suma de asignaciones activas no supera el saldo; un mismo material no puede despacharse dos veces por concurrencia.
- En el MVP no se asigna una misma línea a dos recorridos activos simultáneamente. Sí se permiten entregas sucesivas de su saldo.
- En un intento: aceptado + rechazado + no entregado = cargado.
- Al conciliar: cargado = aceptado + retornado físicamente + pérdida/daño no retornado documentado. El rechazo no se suma dos veces: es el motivo del material que luego retorna o se documenta como pérdida.
- Material en tránsito o pendiente de conciliar no se libera automáticamente para otro recorrido.
- Distinguir saldo exigible, saldo asignado/en tránsito/pendiente de conciliación y saldo asignable. El planificador solo utiliza el saldo asignable; mostrar cada componente por separado.
- Las devoluciones de una entrega ya aceptada se registran como una operación posterior vinculada; no se resta silenciosamente del historial. El ERP resuelve su efecto comercial y de inventario.

**Corrección de un error de captura:** si se registraron 100 aceptadas y en realidad fueron 80, abrir una solicitud de corrección con motivo y evidencia. Coordinación con permiso específico revisa y ejecuta un ajuste vinculado al evento original, que permanece inmutable. La operación recalcula cantidades, saldos, estado y conciliación en una transacción. Si afecta material ya reservado o despachado en un intento posterior, bloquear el ajuste hasta conciliar las operaciones dependientes. Una corrección no sustituye una devolución física ni autoriza ajustes contables en el ERP.

## 8 Reglas comerciales y tiempos

Configuración por empresa y, cuando corresponda, zona: cobertura, compra mínima, productos excluidos, límite operativo, moneda, plazo mínimo, hora de corte, calendario de trabajo, plazo máximo para asignar fecha y plazo máximo de entrega. Mantener versión de reglas aplicada a cada orden.

**Las 24 horas requieren definición antes del piloto:** pueden significar tiempo mínimo hasta entregar o plazo para confirmar programación. Son reglas distintas. Se recomienda registrar y coordinar desde la venta, y configurar la restricción de entrega si esa es la intención. No activar un texto automático ambiguo.

El sistema separa `creada_en`, `lista_en`, `entrega_no_antes_de`, `confirmar_antes_de` y ventana comprometida. Gerencia define desde qué hito corre cada plazo y si son horas corridas o hábiles. Ningún valor se inventa a partir del horario del servidor; usar America/Managua para operación y UTC para persistencia.

Envío gratis: resultado `elegible / no_elegible / requiere_revision`. Si no existen parámetros o información, requiere revisión; nunca gratis por defecto. Flete: monto y moneda expresos, autorizador y aceptación del cliente. Un segundo intento no genera un cobro automático.

Reprogramación: preservar ventana original, motivo, usuario y nueva aceptación. No sobrescribir fechas para mejorar artificialmente la puntualidad. Cambios que incumplen la promesa generan alerta, aunque el cliente acepte una nueva fecha.

## 9 WhatsApp y alertas

Primera versión: plantillas con variables, botón Copiar o Abrir WhatsApp y registro manual de comunicación. Abrir WhatsApp no equivale a enviar; marcar enviado no equivale a aceptado. Para confirmar, registrar respuesta, canal, fecha, responsable y evidencia.

Plantillas: condiciones del envío, propuesta de fecha, aviso de llegada, atraso, incidencia y seguimiento posterior. Sin envíos automáticos ni dependencia de una API externa para el piloto.

Alertas internas: datos pendientes; plazo para programar próximo o vencido; cliente sin confirmar; peso desconocido; vehículo/conductor incompatible; entrega atrasada; evidencia pendiente; incidencia vencida; cola sin sincronizar. Se calculan desde datos persistidos y aparecen al entrar o actualizar el tablero. Notificaciones programadas fuera de la app se posponen; no dependen de que alguien tenga una pantalla abierta.

## 10 Operación sin señal

Antes de salir, descargar recorrido asignado y verificar disponibilidad local de datos necesarios. La autorización de despacho exige conexión. Offline se permite consultar el recorrido ya descargado y capturar llegada, descarga, cantidades, evidencia e incidencia; no cambiar asignaciones, crédito, condiciones comerciales ni capacidad.

Cada acción tiene UUID estable generado antes del primer intento de envío, empresa, actor, objeto, versión esperada, fecha del dispositivo y payload. Los reintentos reutilizan el mismo UUID. El servidor revalida sesión, permisos, habilitación y estado, y devuelve la misma respuesta a una operación ya aceptada. La fecha del dispositivo es evidencia declarada; la recepción del servidor queda registrada aparte.

Cola visible: pendiente, enviando, confirmado, requiere revisión. Nunca mostrar una acción solo local como confirmada por Nexo. Una revocación o conflicto no se reintenta indefinidamente: conservar el registro local para revisión autorizada sin conceder efectos de negocio.

La cola respeta el orden y las dependencias por agregado operativo. Por ejemplo, llegada, inicio de descarga y recepción se envían en secuencia; después del acuse de cada comando, el siguiente usa la nueva versión devuelta por el servidor. Una respuesta perdida se recupera consultando o reenviando la misma operación antes de avanzar. Un cambio externo incompatible detiene ese agregado para revisión, sin bloquear eventos independientes de otros recorridos. No sustituir ciegamente la versión esperada para forzar aceptación.

Evidencias: almacenar temporalmente el archivo, subir con identificador estable, verificar archivo y vincularlo antes de confirmar evidencia completa. Si se guarda el evento pero falla la foto, la orden conserva evidencia pendiente. No eliminar datos locales antes del acuse del servidor.

Límite explícito: el navegador puede perder almacenamiento y no se garantiza sincronización con la aplicación cerrada. Mostrar contador de pendientes y botón Sincronizar; exigir comprobación al terminar el recorrido. Contingencia: comprobante físico y carga posterior identificada como captura por coordinación, con actor y hora real declarados. No afirmar que coordinación fue el conductor original.

No cachear sesiones o datos de otras empresas mediante el service worker. Segregar caché por usuario/empresa, minimizar datos y borrar información sincronizada según retención configurada. Cerrar sesión con pendientes debe advertir y ofrecer conciliación, sin impedir el cierre de sesión ni exponer datos al siguiente usuario. Probar esta transición de forma explícita.

## 11 Modelo de datos propuesto

Nombres conceptuales. Revisar esquema real antes de generar migraciones; reutilizar entidades equivalentes y evitar traducciones que dupliquen tablas.

| Entidad | Contenido y relaciones |
|---|---|
| Configuración y zonas | Empresa, calendario, condiciones versionadas, cobertura y límites |
| Referencia de origen y líneas | Clave única del documento y cada línea, cantidades logísticas autorizadas y salidas externas verificadas; control compartido entre destinos |
| Orden de entrega | Empresa, origen, vendedor, destinatario histórico, dirección, zona, ventanas, estado, versión |
| Línea de orden | Producto o código externo, unidad, cantidad, peso unitario validado, dimensiones y descripción histórica |
| Validación | Orden, tipo, resultado, actor, fecha, evidencia y versión de orden validada |
| Viaje existente adaptado | Vehículo, conductor, fechas, estado y costos operativos opcionales |
| Parada | Viaje, orden, secuencia, ventana, confirmación e intento anterior |
| Asignación por línea | Parada, línea, cantidades reservadas y cargadas |
| Recepción por línea | Intento, cantidades aceptadas, rechazadas y no entregadas; receptor |
| Evidencia | Orden/parada/evento, ruta privada de archivo, tipo, estado, actor y fechas |
| Incidencia | Orden/parada, tipo, responsable, compromiso, estado y resolución |
| Conciliación | Viaje y línea, retornos recibidos, pérdidas documentadas, cobros y referencias externas |
| Comunicación | Orden, plantilla, canal, actor, envío declarado, respuesta y evidencia |
| Evento de auditoría | Empresa, actor, acción, objeto, antes/después pertinente, motivo y tiempos |
| Registro de operaciones | Clave idempotente, actor/empresa, hash del payload y resultado confirmado |

Todas las relaciones entre datos empresariales validan la misma empresa, incluida la relación entre órdenes, líneas, paradas y evidencia. Cantidades y dinero usan precisión decimal definida; unidades y monedas no se mezclan. El identificador de producto es inmutable; su descripción histórica no cambia cuando se edita el catálogo.

Conforme a AGENTS.md, las tablas de hechos e históricos continuos se particionan mensualmente desde su creación; los catálogos no. Antes de implementar se debe definir qué cabeceras transaccionales requieren partición y resolver sus claves compuestas y referencias. La unicidad idempotente no puede depender de una partición mensual: mantener un registro global de claves de operación por empresa, separado del histórico particionado. Índices para empresa/estado/fecha, FKs y búsquedas operativas; no añadir índices JSON sin consultas que los justifiquen.

## 12 Contratos de backend

Las acciones deben existir en RPC o servicios reutilizables por web y futuro móvil. Las Server Actions pueden invocarlos, pero no ser el único lugar de las reglas.

| Comando conceptual | Permiso y precondición | Resultado atómico |
|---|---|---|
| Crear/editar orden | Crear/editar y alcance; versión vigente | Orden y líneas con auditoría |
| Validar pago/material | Permiso específico; versión válida | Validación vinculada a la revisión correcta |
| Asignar parada | Programar; saldo y recursos disponibles | Reserva de cantidades y parada sin duplicación |
| Confirmar cliente | Confirmar; respuesta registrada | Ventana aceptada y evidencia referenciada |
| Validar carga | Validar carga; conteo, capacidad e inspección | Cantidades finales y responsables |
| Despachar | Despachar; todas las validaciones vigentes | Viaje en curso y pedidos afectados |
| Registrar intento | Operar; conductor asignado; cantidades válidas | Recepción, saldo e incidencia cuando aplique |
| Conciliar retorno | Conciliar; recepción física | Retorno documentado y saldo liberado cuando corresponda |
| Reprogramar | Reprogramar; motivo y saldo disponible | Nuevo intento sin borrar historial |
| Cerrar/reabrir | Permiso correspondiente y precondiciones | Estado administrativo y evento auditado |
| Corregir recepción | Corregir; motivo, evidencia y revisión de dependencias | Ajuste inmutable vinculado al original y recálculo de saldos |

Cada mutación acepta `operation_id` y `expected_version`. Misma clave con diferente payload se rechaza. Bloqueos transaccionales o control equivalente evitan que dos coordinadores asignen el mismo saldo o que se cierre una orden mientras aparece una incidencia. Los errores indican qué resolver; una denegación de permisos no se trata como desconexión.

RLS en tablas expuestas y protección por empresa/alcance. Archivos privados, descarga autorizada o enlace temporal; las fotos no son públicas. Claves privilegiadas solo en backend cuando sean necesarias. Revalidar permisos en cada acción, no confiar en valores enviados por el navegador ni en una lista cacheada de botones visibles. No copiar el bypass heredado de Ruta360.

## 13 Indicadores y definición de éxito

- **Pendientes:** órdenes no cerradas por bloqueo y antigüedad.
- **Puntualidad:** compromisos atendidos dentro de la ventana original sobre compromisos vencidos en el período; mostrar aparte reprogramaciones solicitadas por el cliente y por la empresa.
- **Éxito al primer intento:** órdenes completamente aceptadas sin diferencias en el primer intento sobre órdenes con primer intento en el período.
- **Incidencias:** abiertas, vencidas y tiempo hasta resolución; no confundir cerrar viaje con resolver reclamación.
- **Utilización de carga:** kg verificados cargados / capacidad útil; si falta peso no calcular porcentaje ficticio. No mide por sí sola eficiencia o accesibilidad.
- **Costo por entrega completada:** costos capturados del recorrido / entregas completadas, mostrando qué componentes faltan. Si no hay entregas, no dividir por cero.
- **Costo del envío gratis:** registrar gasto y relacionarlo con margen comercial solo si existe una fuente verificable de costo y venta. En caso contrario mostrar “Margen no disponible”.

El MVP permite controlar operación sin un presupuesto completo de transporte. Datos de combustible y gastos pueden ingresarse como resumen de costo, sin construir contabilidad o liquidaciones.

## 14 Plan de implementación

Cada bloque termina con evidencia de prueba y actualización documental. Trabajar sobre una rama y respetar el gate de Nexo; esta especificación no autoriza un despliegue.

| Ticket | Entrega | Depende de | Criterio mínimo |
|---|---|---|---|
| E0 | Comparación main/local/remoto y decisiones operativas | Ninguno | Reutilización, esquemas, identidades y alcance confirmados; divergencias registradas |
| E1 | Paso Cero y adaptación mínima de Flotilla a Nexo | E0 | Login compartido, empresa, permisos, UI y rutas; sin acceso heredado por PIN |
| E2 | Modelo, migraciones, RLS, auditoría e idempotencia | E1 | Integridad por empresa y concurrencia probadas en Postgres real |
| E3 | Alta y validación de órdenes | E2 | Venta documentada pasa a lista solo con datos y autorizaciones correctas |
| E4 | Planificador, capacidad y confirmación | E3 | Varias órdenes se agrupan sin duplicar cantidades ni recursos |
| E5 | Preparación, inspección y despacho | E4 | Carga incorrecta o insegura bloquea salida |
| E6 | Panel conductor, recepción y evidencia | E5 | Entrega completa, parcial y fallida conservan saldo correcto |
| E7 | Offline, reintentos y recuperación | E6 | Reintento después de respuesta perdida no duplica material ni eventos |
| E8 | Incidencias, retornos y cierre | E6 y E7 | Segundo intento entrega únicamente saldo; cierre exige conciliación |
| E9 | Tablero, comprobantes y exportaciones | E8 | Reportes coinciden con registros y respetan permisos |
| E10 | Pruebas integrales y piloto supervisado | E9 | Flujos operativos y fallos críticos verificados; acta de resultados |

Orden recomendado: construir primero una entrega completa de punta a punta y después completar variantes; no construir todo el dashboard antes del flujo. E7 y E8 son parte obligatoria del MVP liberable, no extras posteriores.

Documentar plan de entregas, arquitectura, base, permisos, módulos, estado e índice. Preservar el plan de Fase 4; si se aprueba adelantar este corte, registrarlo como decisión adicional sin declarar terminada Fase 4. Verificar `pnpm install --frozen-lockfile` y `pnpm verify`, además de pruebas específicas. Actualizar lockfile cuando cambien dependencias. La inspección del remoto y cualquier migración se realizan por separado bajo el flujo autorizado.

## 15 Pruebas y salida a piloto

Escenarios obligatorios:

1. Orden completa → validaciones → recorrido → carga → recepción → conciliación → cierre.
2. Tres clientes en un camión: sus productos y evidencias no se mezclan.
3. Peso desconocido y sobrecarga bloquean salida; un vendedor no puede eludirlos.
4. Dos coordinadores intentan asignar el mismo saldo: solo una operación obtiene la reserva.
5. Carga de 100 unidades, aceptación de 80 y retorno de 20: quedan 20 pendientes y el siguiente intento no puede cargar 100.
6. Cliente ausente: intento fallido, retorno conciliado y reprogramación sin duplicar orden.
7. Material dañado: incidencia, evidencia, solución y conciliación antes de cerrar.
8. Dirección cambiada después de confirmar: invalida confirmación y reevalúa recorrido.
9. Respuesta del servidor perdida: reenviar UUID estable devuelve el mismo resultado.
10. Evento sincronizado y foto fallida: no declarar evidencia completa ni perder el archivo pendiente.
11. Conductor deshabilitado o contrato finalizado durante la desconexión: backend rechaza nuevas operaciones al sincronizar; coordinación revisa los hechos reportados.
12. Otra empresa, otro vendedor sin alcance y conductor ajeno: sin lectura, escritura, exportación ni descarga de evidencia.
13. Sin señal, recarga de página, reconexión y cierre de sesión con pendientes: sin pérdida silenciosa o fuga a otro usuario.
14. Cierre con saldo, evidencia o incidencia pendiente: bloqueado.
15. Queja posterior: reapertura auditada sin borrar comprobantes.
16. Cambio de fecha: métricas conservan la promesa original.
17. Android e iPhone reales: login, navegación, cámara/adjunto, almacenamiento, reconexión y botones legibles.
18. Factura de 100 unidades y dos destinos: no permitir dos órdenes de 100 ni superar la cantidad autorizada entre todas las órdenes.
19. Corregir recepción de 100 a 80: conservar original y ajuste, recalcular saldo y bloquear si contradice una salida posterior sin conciliar.
20. Tres eventos consecutivos offline: sincronizar en orden con versiones actualizadas; un conflicto no bloquea otros recorridos independientes.

PGlite o mocks no sustituyen pruebas de RLS, particiones y concurrencia en Postgres. Separar resultados de código, remoto y prueba real. Cualquier falla crítica de identidad, cantidad, evidencia u operación offline pospone el piloto.

Piloto propuesto: una bodega, un coordinador, un vehículo y una zona, durante un período supervisado de dos semanas. Mantener soporte documental de contingencia. Revisar al cierre de cada día órdenes, evidencias, retornos y pendientes. Ampliar solo cuando no haya diferencias sin resolver y el equipo pueda completar los flujos sin ayuda del desarrollador.

## 16 Decisiones que faltan antes de operar

1. Cobertura gratuita, compra mínima y excepciones autorizadas.
2. Significado exacto de 24 horas, punto de inicio y horas hábiles o corridas.
3. Hora de corte, días de operación y plazo máximo para confirmar y entregar.
4. Bodega inicial, vehículos, capacidades verificadas y equipos de descarga.
5. Coordinador, suplente, usuarios y atribuciones de aprobación.
6. Fuente de factura/pedido y tratamiento de pago/crédito o contraentrega.
7. Evidencia aceptada, plazo de conservación y contingencia sin conexión.
8. Alcance de consulta del vendedor y disponibilidad real de identidades de conductores.

Se puede diseñar y construir con parámetros de prueba claramente identificados; no lanzar una promesa comercial sin completar estas decisiones.

## 17 Referencias verificadas

- Política interna de coordinación y entrega de pedidos, versión 1.0, Materiales JCastillo, documento Word preparado en esta conversación y leído nuevamente.
- [Plan Maestro](https://github.com/Jccastillo25/nexo/blob/9b2d75ddab05127ccf9a02304153bdb89cee530d/docs/PLAN_MAESTRO_IMPLEMENTACION_NEXO.md).
- [Fase 4 Transporte](https://github.com/Jccastillo25/nexo/blob/9b2d75ddab05127ccf9a02304153bdb89cee530d/docs/plan/07-fase4-transporte.md).
- [Estrategia móvil](https://github.com/Jccastillo25/nexo/blob/9b2d75ddab05127ccf9a02304153bdb89cee530d/docs/plan/02-estrategia-movil.md).
- [Acceso de conductores](https://github.com/Jccastillo25/nexo/blob/9b2d75ddab05127ccf9a02304153bdb89cee530d/docs/DRIVER_ACCESS_AND_KIOSK.md).
- [Estados de viaje](https://github.com/Jccastillo25/nexo/blob/9b2d75ddab05127ccf9a02304153bdb89cee530d/apps/flotilla/lib/trip-status.ts), [sincronización heredada](https://github.com/Jccastillo25/nexo/blob/9b2d75ddab05127ccf9a02304153bdb89cee530d/apps/flotilla/lib/offline/sync.ts), [permisos](https://github.com/Jccastillo25/nexo/blob/9b2d75ddab05127ccf9a02304153bdb89cee530d/packages/permissions/index.ts).
- [Supabase Storage y acceso privado](https://supabase.com/docs/guides/storage/buckets/fundamentals), consultado mediante documentación oficial.

**Resultado esperado:** una entrega siempre tiene origen verificable, cantidades trazables, responsable, compromiso, evidencia y cierre. Las automatizaciones avanzadas se incorporan sobre ese control, después de validar la operación.

## 18 E0 — Verificación del 2026-10-23 (local + remoto, solo lectura)

Rama local `deploy/2026-10-22-produccion`, limpia. Remoto: `nexo-core` (`yrbjlmiqhkyxtlcerowh`) y equipo de Vercel.

| Fuente | Hallazgo | Consecuencia |
|---|---|---|
| `core.apps` | `flotilla` existe, `route=/flotilla`, `active=true` | Se reutiliza; no se registra otra app |
| `core.company_apps` | Ninguna fila para `flotilla` | La empresa no la tiene habilitada: el mosaico no aparece todavía |
| `core.permissions_catalog` | Solo `flotilla.ver_modulo` | El Paso Cero parte de cero |
| `core.app_roles` | 0 plantillas `flotilla` | Hay que crearlas |
| Schemas | No existe `flotilla` (ni `transporte`/`entregas`) en `nexo-core` | El esquema nace con E2, en la misma migración que sus `GRANT` |
| Tablas heredadas en `public` | No existen `trips`, `drivers`, `admins`, `vehicles`… en `nexo-core` | Ruta360 vive en otro proyecto de Supabase; no se migra nada de él: se arranca limpio |
| Storage | Buckets `platform-assets` y `rrhh-documentos-privados` | Las evidencias necesitan un bucket privado propio |
| Vercel | 8 proyectos; **ninguno de Flotilla** | Proyecto nuevo (`nexo-flotilla`, Root Directory `apps/flotilla`) cuando el usuario decida desplegar; hoy todo es local |
| `apps/nexo/next.config.ts` | Sin rewrite `/flotilla` | Agregarlo con `FLOTILLA_APP_URL` (y en `turbo.json`) al desplegar |
| `apps/flotilla/package.json` | Nombre `transporte-app`, sin `@nexo/*`, `package-lock.json` propio | E1: renombrar a `flotilla`, usar el kernel (`@nexo/supabase`, `@nexo/auth`, `@nexo/permissions`, `@nexo/ui`) y quitar el lockfile de npm |
| `apps/flotilla/next.config.ts` | Vacío: sin `basePath` | E1: `basePath: "/flotilla"` |
| `apps/flotilla/proxy.ts` | Login propio, `/supadmin` con login aparte, roles por tablas `admins`/`drivers` | E1: reemplazar por el proxy de SSO de Nexo (login en el panel) y retirar `/supadmin`, `/login`, PIN y alta de admins |
| `apps/flotilla/lib/offline/sync.ts` | Inserta `trip_events` sin enviar `localId`; un reintento tras respuesta perdida duplica | No se reutiliza; la cola de E7 usa `operation_id` estable y RPC idempotente |
| `apps/flotilla/lib/trip-status.ts` | Un solo enum de viaje mezcla inspección, ruta y descarga | Se separan viaje, parada/intento, confirmación, evidencia e incidencia (sección 7) |
| CI | `flotilla` está en `lint-deuda` (no bloquea) | E1 debe sacarla de la deuda y meterla en el gate |
| RRHH | Puestos reales: "Vendedor Mostrador", "Auxiliar De Despacho" | La habilitación de conductor sale de empleado + contrato activo (`DRIVER_ACCESS_AND_KIOSK.md`) |
| Ventas | No hay pedidos ni facturas de AG Negocio en Nexo, salvo las facturas importadas de Presupuesto (cabeceras sin líneas) | La orden se captura a mano con su documento de origen (sección 3); la clave de origen deja preparada la integración futura |

## 19 Paso Cero — matriz de permisos y plantillas (aprobada y aplicada el 2026-10-23)

35 códigos nuevos de 4 segmentos, más `flotilla.ver_modulo`, que ya existe (36 en total). El alcance del registro (propio, asignado, empresa) lo aplica el backend; el permiso solo habilita la acción.

| Código | Qué permite |
|---|---|
| `flotilla.dashboard.indicadores.ver` | Tablero de entregas con sus indicadores |
| `flotilla.entregas.orden_propia.ver` | Ver las órdenes que uno creó |
| `flotilla.entregas.orden.ver` | Ver todas las órdenes de la empresa |
| `flotilla.entregas.orden.crear` | Crear la orden desde un documento de venta |
| `flotilla.entregas.orden.editar` | Completar o cambiar datos de la orden (invalida lo que corresponda) |
| `flotilla.entregas.orden.cancelar` | Cancelar la orden o su saldo |
| `flotilla.entregas.orden.cerrar` | Cierre administrativo |
| `flotilla.entregas.orden.reabrir` | Reabrir con motivo (queja posterior) |
| `flotilla.entregas.pago.validar` | Validar pago o crédito |
| `flotilla.entregas.material.validar` | Validar material y la cantidad autorizada por línea de origen |
| `flotilla.entregas.cliente.confirmar` | Registrar comunicación y aceptación del cliente |
| `flotilla.entregas.cobro.conciliar` | Conciliar cobros autorizados (contraentrega) |
| `flotilla.entregas.recepcion.corregir` | Corregir una recepción mal capturada (ajuste vinculado) |
| `flotilla.entregas.evidencia.ver` | Ver y descargar evidencias |
| `flotilla.entregas.evidencia.adjuntar` | Adjuntar evidencias |
| `flotilla.rutas.recorrido.ver` | Ver recorridos y planificador |
| `flotilla.rutas.recorrido.programar` | Crear recorridos, asignar paradas y cantidades, ordenar paradas |
| `flotilla.rutas.recorrido.despachar` | Autorizar la salida |
| `flotilla.rutas.parada.reprogramar` | Reprogramar paradas o crear un nuevo intento |
| `flotilla.rutas.recorrido.cerrar` | Finalizar y marcar conciliado el recorrido |
| `flotilla.bodega.carga.preparar` | Preparar la carga y registrar diferencias |
| `flotilla.bodega.carga.validar` | Validar la carga |
| `flotilla.bodega.retorno.conciliar` | Recibir y conciliar retornos y pérdidas |
| `flotilla.conductor.recorrido_propio.operar` | Panel de conductor: solo sus recorridos asignados |
| `flotilla.incidencias.incidencia.crear` | Reportar una incidencia |
| `flotilla.incidencias.incidencia.gestionar` | Asignar responsable, compromiso y documentar |
| `flotilla.incidencias.incidencia.resolver` | Resolver y cerrar incidencias |
| `flotilla.flota.vehiculo.ver` | Ver vehículos y capacidades |
| `flotilla.flota.vehiculo.gestionar` | Alta, edición y estado de vehículos |
| `flotilla.conductores.perfil.ver` | Ver conductores habilitados |
| `flotilla.conductores.perfil.habilitar` | Habilitar o deshabilitar a un empleado como conductor |
| `flotilla.configuracion.reglas.gestionar` | Zonas, bodegas, calendario, condiciones de envío, motivos y plantillas |
| `flotilla.configuracion.excepcion.aprobar` | Aprobar excepciones comerciales (envío gratis en revisión, flete) |
| `flotilla.reportes.entregas.ver` | Reportes de entregas, pendientes, incidencias y costos |
| `flotilla.reportes.entregas.exportar` | Exportar CSV con el mismo alcance |

Plantillas (`core.app_roles`, `module_slug = 'flotilla'`):

| Plantilla | Permisos | Notas |
|---|---|---|
| Vendedor | 8 | `ver_modulo`, indicadores, `orden_propia.ver`, crear, editar, confirmar cliente, ver evidencia, crear incidencia. No valida pago ni material, no programa ni cierra |
| Coordinador | 24 | Operación completa de la empresa: órdenes (incluye cancelar, cerrar, reabrir y corregir recepción), recorridos, despacho, reprogramación, incidencias, ver flota y conductores, reportes. No valida pago ni carga, no concilia cobros ni retornos, no cambia configuración |
| Bodega | 12 | Ver órdenes y recorridos, validar material, preparar y validar carga, conciliar retornos, evidencias, crear incidencia, ver flota |
| Administración | 10 | Ver órdenes y recorridos, validar pago, conciliar cobros, ver evidencia, crear incidencia, reportes |
| Conductor | 4 | `ver_modulo`, operar sus recorridos, adjuntar evidencia, crear incidencia. Sin órdenes ajenas, precios ni administración |
| Gerencia | 36 | Todo, incluidas reglas y excepciones. Sigue sin poder exceder la capacidad del vehículo: esa regla es del backend, no un permiso |

Migración **aplicada** en `nexo-core` con aprobación del usuario ("Si"): [`20261024034727_flotilla_entregas_paso_cero.sql`](../../supabase/migrations/20261024034727_flotilla_entregas_paso_cero.sql). No crea tablas, no cambia `core.apps.active` ni habilita la app para la empresa, y no asigna nada a usuarios ni a roles de empresa.

## 20 Avance

| Etapa | Estado | Nota |
|---|---|---|
| E0 | ✅ Hecho 2026-10-23 | Sección 18 |
| Paso Cero | ✅ Aplicado 2026-10-23 | `20261024034727` |
| E1 | 🟡 En local 2026-10-23 | Zona `/flotilla` con SSO, `NexoShell`, permisos y menú; Ruta360 retirado; typecheck/lint/build en 0. Habilitada para la empresa (`20261024035935`); proxy del panel corregido. **En producción** desde el 2026-10-24 (PR #51, proyecto `nexo-flotilla`), verificada con la sesión del owner |
| E2 | ✅ Aplicado 2026-10-24 (falta la prueba con dos sesiones concurrentes) | Sección 21. `20261024140400` + `20261024140609` (índices de FK); PGlite en verde; poscheque y advisors remotos |
| E3–E10 | ⏳ Pendiente | Sigue E3: alta y validación de órdenes (RPC y pantallas) |

## 21 E2 — Modelo de datos (decisiones del 2026-10-24)

Migración [`20261024140400_flotilla_e2_esquema.sql`](../../supabase/migrations/20261024140400_flotilla_e2_esquema.sql). Concreta la sección 11 sin reglas nuevas de negocio.

**Acceso.** Schema `flotilla` cerrado, igual que `presupuesto`: sin `USAGE` para `anon` ni `authenticated`, RLS activo en todas las tablas y particiones, y sin policies. Todo se lee y escribe por RPC `public.flotilla_*` con `security definer` (E3 en adelante), que validan permiso y empresa en el backend. Por eso no lleva el `GRANT` a `authenticated` del checklist de módulos nuevos: aquí nadie consulta las tablas directamente.

**Qué se particiona.** Se particionan por mes los hechos que solo se agregan: `eventos` (bitácora y línea de tiempo), `movimientos` (libro de cantidades) y `comunicaciones`. Las tablas de trabajo que cambian de estado y reciben FK (órdenes, líneas, recorridos, paradas, asignaciones, incidencias y evidencias) no se particionan, igual que la cabecera de planillas en RRHH. El registro de operaciones idempotentes tampoco, como pide la sección 11.

**Tablas (21).**

| Grupo | Tablas |
|---|---|
| Catálogos | `zonas`, `bodegas`, `vehiculos` (capacidad nula = sin verificar), `conductores` (extensión de `rrhh.empleados`, sin duplicar persona), `motivos`, `reglas_envio` (versionadas, `es_prueba`), `plantillas_mensaje` |
| Origen | `origenes` (clave única empresa + sistema + tipo + serie + número), `origen_lineas` (cantidad del documento, autorizada, entregada por fuera y comprometida) |
| Órdenes | `ordenes` (folio, destinatario y dirección como copia histórica, condición de envío, flete, estado, tiempos en UTC), `orden_lineas` (producto o código externo, peso y largo validados, contadores), `validaciones` (pago y material, atadas a la versión de la orden) |
| Rutas | `recorridos`, `paradas` (cada parada es un intento; el reintento crea otra), `parada_lineas` (reserva y ciclo físico por línea) |
| Seguimiento | `incidencias`, `evidencias` (metadatos; el bucket privado llega en E6) |
| Control | `operaciones` (idempotencia), `eventos`, `movimientos`, `comunicaciones` (particionadas) |

**Invariantes en la base, no solo en la UI.**

- Toda relación entre datos de negocio usa FK compuestas `(id, company_id)`, incluidas las de `rrhh.empleados` y `productos.productos`: no se puede mezclar empresas.
- `origen_lineas.comprometida` se mantiene por trigger con la suma de (solicitada − cancelada) de sus líneas de orden, incluidas las entregadas. Un CHECK impide superar lo autorizado (escenario 18).
- Los contadores de `orden_lineas` (asignada, en tránsito, aceptada, retornada, perdida) se mantienen por trigger desde `parada_lineas`. Un CHECK garantiza que aceptada + cancelada + asignada + en tránsito ≤ solicitada: no hay doble despacho ni saldo negativo.
- Un índice único parcial impide que una línea esté en dos recorridos activos. Otros dos impiden que un vehículo o un conductor estén en dos recorridos listos para salir o en curso.
- Por asignación: lo cargado ≤ lo reservado. En el intento, aceptado + rechazado + no entregado = cargado. Al conciliar, cargado = aceptado + retornado + pérdida. Lo rechazado o no entregado sigue en tránsito hasta conciliarse y no se libera solo.
- Transiciones de estado permitidas para órdenes, recorridos, paradas e incidencias, validadas por trigger.
- `eventos`, `movimientos` y `comunicaciones` son inmutables. Una corrección queda como un movimiento `ajuste` vinculado al original.
- Versión optimista (`version`) en toda tabla mutable, para el `expected_version` de las RPC.

**Concurrencia.** Las reservas y los compromisos actualizan contadores con `update ... set x = x + delta`, que toma el lock de la fila. Dos coordinadores que reservan el mismo saldo se serializan, y el segundo choca con el CHECK (escenario 4). Falta la prueba con dos sesiones reales en Postgres, porque el ensayo remoto corre en una sola sesión.

**Idempotencia.** `flotilla.fn_operacion_reclamar` registra `(company_id, operation_id)` en la misma transacción del efecto:
- una clave nueva se ejecuta;
- la misma clave con el mismo comando, actor y hash del payload devuelve el resultado guardado;
- con otros datos se rechaza (`nexo:operacion_distinta`);
- un reintento concurrente espera en la PK.

**Helpers para E3+.** `fn_exigir_alguno` (permiso y empresa), `fn_operacion_reclamar`/`fn_operacion_cerrar`, `fn_evento`, `fn_movimiento` y la vista `v_saldos_linea`, que separa saldo exigible, asignado, en tránsito y asignable (sección 7).

**Fuera de E2:** las RPC de cada comando (E3–E8), el bucket de evidencias (E6), el cálculo de la fase visible de la orden a partir de líneas e intentos (E3) y la semilla de motivos y parámetros de prueba (E3).
