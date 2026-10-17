# RRHH y kiosco — piloto supervisado y MVP operativo

**Ejecución 2026-10-16:** P2–P6 implementados y verificados localmente en `codex/rrhh-piloto-mvp`; P7 preparado, sin aplicación ni autorización remota. [Paquete](RRHH_PAQUETE_OPERADOR.md). El estado histórico siguiente describe main/remoto previo a aplicar.

**Decisión aprobada el 2026-10-15. Estado: especificación. De sus tickets, P1 (PIN ambiguo) ya está implementado y fusionado; el resto no está implementado ni validado con usuarios reales.** Este corte incremental no sustituye el objetivo completo de F1.5–F1.10 ni incluye nómina, cálculos salariales, descansos marcados o turnos que crucen medianoche. [RRHH_MVP.md](RRHH_MVP.md) conserva el alcance completo futuro.

## 1. Base comprobada y límites

- Hay código para Configuración → Usuarios/Roles, Expedientes, Contratación → Contratos, Jornadas y `/kiosco`. La existencia de código no equivale a recorrido probado con usuarios reales.
- El PIN contractual nace al activar y se revoca al finalizar; el kiosco busca credenciales de la empresa del dispositivo. La búsqueda actual puede escoger una coincidencia ambigua; no hay garantía demostrada de unicidad entre credenciales activas de esa empresa.
- `rrhh.asistencia_marcas` aún no conserva `contrato_id`. No se ha demostrado idempotencia de envíos ni secuencia atómica por contrato y día. La pantalla Marcas y la corrección auditada son trabajo nuevo.
- La jornada conservada «Ventas» solo se asigna si coincide con el horario real de la persona. En la verificación anterior figuraba lunes–viernes 07:30–17:00, sábado 07:30–15:00, domingo no laborable y descanso programado de 30 minutos; P7 debe reconfirmar su configuración antes de asignarla. Ese descanso no se marca como pausa en este piloto. Cualquier jornada que exija marcaciones de descanso, varios pares o cruce de medianoche queda fuera.
- Los permisos se deciden por empresa mediante un rol y posibles excepciones individuales. El catálogo debe registrar cualquier permiso nuevo antes de usarlo; el owner no es requisito para activar contratos si se concede el permiso específico a RRHH.

## 2. Reglas aprobadas

1. Zona de día local: `America/Managua`. Máximo **un par entrada/salida por contrato y día local**. No se marca descanso. Una tercera marca del mismo día se rechaza sin insertar nada.
2. Entrada de ayer sin salida: su día muestra **Falta salida**; la primera marca de hoy es una entrada nueva. No se inventa salida. Un turno que cruce medianoche no participa en el piloto.
3. Reintento del mismo envío: mismo resultado, ninguna marca adicional. Una digitación nueva no tiene bloqueo fijo de 60 segundos. Toda salida —también la inmediata— requiere una confirmación genérica «¿Registrar salida?» con Confirmar/Cancelar; el kiosco no revela identidad ni guarda nada al cancelar.
4. Contrato finalizado: PIN revocado. Recontratación: nuevo contrato y nueva credencial; las marcas antiguas permanecen vinculadas al contrato anterior. No reutilizar una marca para completar otro contrato.
5. PIN de cuatro dígitos y un solo kiosco **solo si P7 demuestra** unicidad en todo el conjunto que la búsqueda del kiosco alcanza (empresa, no solo dispositivo/sucursal), límite de intentos, idempotencia, concurrencia y permisos. Si una prueba crítica falla, posponer el piloto y corregir la causa. Un PIN más largo solo puede mitigar un problema propio del espacio de PIN; no arregla duplicados, carreras ni permisos.
6. El piloto permite Marcas **solo lectura**. Los errores se reportan por el **correo corporativo de RRHH** y quedan en un registro restringido con folio, código de empleado, contrato/fecha de marca, descripción, función responsable, estado y fechas. Estados: `recibido`, `en revisión`, `pendiente de corrección`, `cerrado con explicación`. Nunca registrar PIN, ni en el correo, registro, logs o tickets públicos. La dirección exacta y las personas se consignan solo en preparación privada antes del piloto.
7. El **MVP operativo** añade corrección manual auditada: permiso independiente `rrhh.asistencia.marcas.corregir` (propuesto, todavía no registrado), motivo obligatorio, autor y fecha automáticos, marca original conservada y vínculo a la corrección. No se permite sobrescribir o borrar el original por vías heredadas. No incluye nómina.

### Estados de consulta que sí se pueden prometer

| Estado | Datos necesarios | En piloto |
|---|---|---|
| Marca registrada | Marca real, tipo, fecha/hora, empleado y contrato | Sí, tras P3–P6. |
| Entrada abierta hoy | Entrada sin salida del mismo contrato/día local | Sí, tras P4–P6. |
| Falta salida | Entrada de día local anterior sin salida real, asociada a contrato | Sí, tras P3–P6; nunca salida ficticia. |
| Empleado esperado sin ninguna marca | Padrón esperado por jornada/feriado/ausencia y día, aunque no exista marca | **No**. Un filtro vacío dice «Sin marcas registradas», no «Ausente». |

## 3. Recorrido de trabajo

1. Una persona con permisos de administración configura el rol de empresa y sus permisos internos; asigna el rol al usuario de RRHH. No se configuran usuarios como parte de esta especificación. La función **responsable de activación y entrega de PIN** recibe lectura de contratos y permiso de activar; no necesita ser owner ni permiso de ver el PIN después.
2. RRHH crea el Expediente General sin PIN; comprueba los datos obligatorios. Después crea contrato borrador con departamento, puesto y plantilla válidos de la misma empresa, asigna la jornada real y revisa fechas. Una jornada incompatible se corrige antes de activar.
3. La persona autorizada activa el contrato. El sistema emite una credencial única dentro de la empresa y muestra el PIN una sola vez para entrega privada. Si no puede asegurar unicidad o hay conflicto concurrente, falla cerrado; no activa una credencial ambigua.
4. En el kiosco autorizado, el empleado digita el PIN. Si no hay entrada del contrato hoy, registra entrada. Al siguiente envío nuevo se propone salida sin identificar al empleado; Confirmar registra, Cancelar no registra. El mismo envío repetido reproduce su respuesta; otra marca posterior al par se rechaza.
5. El **responsable de reportes** revisa Marcas por fecha/contrato. Ve marcas reales, entrada abierta de hoy y falta salida de ayer; no ve una ausencia derivada de cero marcas. Recibe reportes por el buzón aprobado, asigna folio y estado en el registro restringido. El **custodio del registro** controla acceso, retención y cierre documental.
6. Durante el piloto, el reporte queda pendiente de corrección fuera del producto; no se altera la marca. En el MVP operativo, el **corrector autorizado** abre el reporte desde Marcas, añade/corrige con motivo obligatorio y guarda una corrección auditada sin eliminar el original. El responsable de reportes verifica el resultado y cierra el caso con explicación. Una persona puede desempeñar varias funciones, pero cada permiso se concede y se prueba por separado.

## 4. Pantallas y comportamiento observable

| Pantalla / estado | Acceso y campos/acciones | Validaciones, vacío y resultado |
|---|---|---|
| **Existente en código:** Nexo → Configuración → Roles/Usuarios | Administrador con `nexo.administracion.roles.{ver,crear,editar}` y `nexo.administracion.usuarios.{ver,crear,editar}` según acción. Rol: nombre, apps y permisos; usuario: datos de cuenta y rol. Crear/Guardar/Asignar. | Denegar sin permiso, empresa ajena o autoescalada. Lista vacía explicativa. Guardar refleja rol/asignación; probar con rol real en P7. No otorgar corrección hasta M1. |
| **Existente en código:** RRHH → Expedientes/Nuevo/Detalle | `rrhh.ver_modulo` y permisos `rrhh.expedientes.empleados.{ver,crear,editar}` según acción. Datos de identidad obligatorios; Crear/Guardar. | Sin datos requeridos no guardar; sin expedientes, estado vacío. Tras crear, abrir expediente sin PIN. Verificar de punta a punta en P7. |
| **Requiere cambio/verificación:** Contratación → Contratos/Nuevo/Detalle | `contratos.ver/crear/editar`; activar exige `rrhh.expedientes.contratos.activar`. Campos: empleado, departamento, puesto, plantilla, jornada y fechas. Crear borrador/Asignar jornada/Activar. | Mostrar falta de jornada o relación inválida. Tras activar, PIN una sola vez, solo en sesión autorizada y entrega privada; P2 bloquea colisión. El responsable autorizado no depende del owner. Lista vacía: «Sin contratos». P7 verifica permisos reales. |
| **Existente en código:** Jornadas | `rrhh.asistencia.turnos.ver` para elegir; gestión exige permisos de turnos. Días, horario y descanso; Guardar/Asignar. | «Ventas» solo si horario real coincide; si no, crear/asignar jornada correcta antes de activar. Vacío: sin jornadas disponibles, no se activa contrato. |
| **Requiere cambio:** Kiosco | Dispositivo autorizado; empleado solo ve PIN de cuatro dígitos, Enviar y confirmación genérica de toda salida con Confirmar/Cancelar. | PIN inválido/bloqueo: mensaje genérico sin identidad; kiosco inválido: denegar. Reintento mismo envío no duplica, Cancelar no escribe, entrada abierta ayer no bloquea entrada hoy, tercer envío nuevo del día se rechaza. Sin PIN: campo vacío, sin nombres. |
| **Nueva P6:** Marcas (lectura) | `rrhh.asistencia.marcas.ver`, con acceso a datos mínimos de empleado/contrato según consulta. Filtros fecha/empleado/contrato/estado; Ver detalle y Reportar error (instrucciones para correo, sin incluir PIN). | Muestra solo estados calculables de §2. Vacío: «Sin marcas registradas»; errores de acceso/consulta comprensibles. No editar en piloto. Tras consultar no hay mutación. |
| **Nuevo procedimiento P7:** registro restringido de reportes | Responsable de reportes y custodio; folio, código de empleado, contrato/fecha, descripción, responsable funcional, estado y marcas de tiempo. Recibir/Asignar/Actualizar estado/Cerrar. | Sin casos: «Sin reportes». No PIN. Al guardar, folio y estado visibles solo a autorizados. Puede ser herramienta interna restringida existente; P7 registra cuál y valida acceso, sin imponer producto nuevo. |
| **Nueva M3:** corrección de Marcas | Solo `rrhh.asistencia.marcas.corregir`; marca original de solo lectura, operación (agregar salida faltante/corregir marca), valor corregido, motivo obligatorio, Confirmar/Cancelar. | No aceptar motivo vacío, contrato/empresa ajenos, secuencia imposible o corrección duplicada. Guardar crea evento con autor/fecha y original intacto; muestra marca efectiva y enlace al historial. Sin permiso, botón ausente y RPC deniega. |

## 5. Matriz mínima de funciones y permisos

| Función | Permisos necesarios | No se concede por esa función |
|---|---|---|
| Responsable de activación y entrega de PIN | `rrhh.ver_modulo`, `rrhh.expedientes.contratos.ver`, `rrhh.expedientes.contratos.activar`; para preparar borrador/jornada, añadir `contratos.crear/editar` y `rrhh.asistencia.turnos.ver` según tarea. | `credenciales.regenerar`, `marcas.corregir`, owner; `credenciales.ver` no es requisito para entregar el PIN emitido una vez. |
| Responsable de reportes | `rrhh.ver_modulo`, `rrhh.asistencia.marcas.ver`, lectura mínima de empleado/contrato; acceso restringido al buzón y registro. | Activar PIN, regenerar PIN o corregir marcas. |
| Corrector autorizado (solo MVP operativo) | `rrhh.ver_modulo`, `rrhh.asistencia.marcas.ver`, nuevo `rrhh.asistencia.marcas.corregir`, lectura mínima de empleado/contrato. | Activación, regeneración y administración de roles. |
| Custodio del registro | Acceso restringido al registro y control de estados/retención; permisos de RRHH solo si además asume otra función. | Corrección o activación por el mero hecho de custodiar. |
| Empleado ante kiosco | PIN contractual vigente y dispositivo autorizado; sin cuenta Web requerida. | Lectura de marcas ajenas, identidad en pantalla o sesión Auth. |

El owner administra la delegación inicial, no las operaciones diarias obligatoriamente. El permiso `rrhh.asistencia.marcas.corregir` requiere Paso Cero, catálogo, rol y protección de servidor/RLS antes de crear la corrección. Los permisos legados de crear/editar/eliminar marcas no deben permitir eludir el historial: M1 define y prueba la política efectiva.

## 6. Tickets pequeños en orden de dependencia

### Piloto supervisado

| ID | Ticket y dependencia | Criterios de aceptación observables |
|---|---|---|
| **P1** | PIN ambiguo: fallo cerrado. Sin dependencia. **Implementado y fusionado en `main` `fc2b309` (migración `20261015181000`, todavía no aplicada a `nexo-core`).** | Si dos credenciales vigentes de la empresa coinciden, ninguna marca se inserta ni se identifica al empleado; error genérico y señal técnica sin PIN. Búsqueda limitada a empresa del kiosco y prueba con dos coincidencias. |
| **P2** | PIN único al activar/regenerar. Depende de P1. | Unicidad para todas las credenciales que puede hallar un kiosco de esa empresa; dos activaciones/regeneraciones simultáneas no producen PIN vigente repetido. Entrega una sola vez y sin exposición en logs. Agotamiento del espacio falla cerrado. |
| **P3** | Vínculo contractual de marca. Depende de P2. | Toda marca nueva guarda `contrato_id` de la credencial validada; FK/tenant consistentes; recontratación conserva historia en el contrato anterior. Marcas históricas sin vínculo no se atribuyen por conjetura; plan de migración/revisión explícito. |
| **P4** | Secuencia diaria atómica e idempotencia. Depende de P3. | Un par por contrato/día `America/Managua`; token del envío repetido devuelve mismo resultado; envíos simultáneos no duplican ni invierten orden; ayer abierto = Falta salida, hoy empieza entrada nueva; tercer envío nuevo se rechaza; sin cierre ficticio ni bloqueo fijo de 60 s. Probar rate limit vigente (8 intentos inválidos/minuto → bloqueo 5 min) y permisos del RPC. |
| **P5** | Confirmar toda salida en kiosco. Depende de P4. | Antes de cualquier salida aparece mensaje genérico sin identidad; Cancelar no inserta; Confirmar usa el mismo token idempotente; una salida inmediata puede confirmarse sin espera fija. Mensajes de PIN inválido no revelan datos. |
| **P6** | Marcas de solo lectura. Depende de P3, P4 y P5. | Filtros y detalle solo a autorizado; muestra marcas reales, entrada abierta hoy y Falta salida pasada; filtro vacío no implica ausencia. No hay botón de corrección ni escritura. Pruebas de denegación y empresa ajena. |
| **P7** | Preparación y autorización del piloto. Depende de P1–P6. | Checklist privado completo, pruebas críticas aprobadas y recorrido con usuarios reales; si falla una, estado «piloto pospuesto» y ticket de causa/corrección. No declarar piloto autorizado por pruebas solo técnicas. |

**Lista P7 — registrar en ubicación restringida, no en el ticket público:**

- [ ] Persona designada para activación/entrega de PIN, reportes, corrección futura y custodia; permisos separados y probados. Una persona puede cubrir más de una función.
- [ ] Dirección exacta del buzón corporativo de RRHH, acceso y resguardo probados; nombre de la herramienta/ubicación restringida del registro y acceso del custodio. No copiar direcciones ni datos personales al issue.
- [ ] Identificador y ubicación privada del único dispositivo/kiosco autorizado; estado, revocación y aislamiento de empresa probados.
- [ ] Empleados y jornadas reales compatibles, especialmente «Ventas» solo si corresponde; sin descanso marcado ni cruce de medianoche.
- [ ] Resultado, fecha, responsable y evidencia de unicidad de PIN, límite de intentos, concurrencia, reintento idempotente, permisos/RLS, empresa ajena, cierre/recontratación y entrada de ayer abierta.
- [ ] Recorrido real: expediente → contrato/jornada → activación/entrega privada → entrada → salida confirmada → consulta → reporte por correo/registro; casos de error y usuarios sin permiso.
- [ ] Decisión explícita de autorizar o posponer. Cualquier prueba crítica fallida obliga a posponer y corregir la causa; luego repetir la prueba afectada y el recorrido.

### MVP operativo (posterior al piloto supervisado)

| ID | Ticket y dependencia | Criterios de aceptación observables |
|---|---|---|
| **M1** | Paso Cero de corrección y modelo de auditoría. Depende de P6. | `rrhh.asistencia.marcas.corregir` aprobado y registrado, concedido solo a corrector designado; tablas/eventos de corrección de solo anexar, con tenant, original y política de retención/partición según norma del repo; cerrar bypass de escrituras directas/legadas. Denegación probada por RPC y RLS. |
| **M2** | Servicio transaccional de corrección. Depende de M1. | Agregar salida faltante o corregir marca con motivo obligatorio, autor/fecha del servidor, original preservado y enlace; concurrencia/doble envío no duplican; validación de contrato/día/empresa y estado efectivo. Sin permiso no escribe. |
| **M3** | Pantalla de corrección desde Marcas. Depende de M2 y P6. | Solo corrector ve acción; formulario muestra original inmutable, exige motivo, confirma y muestra resultado/historial. Cancelar no escribe; error comprensible, no datos de otra empresa. |
| **M4** | Validación del MVP operativo. Depende de M3 y P7. | Recorrido con usuarios reales y roles separados, reporte→corrección→verificación→cierre, auditoría e historial preservados, denegación y concurrencia probadas. Solo entonces puede declararse operativo; nómina sigue fuera. |

## 7. Condición de salida

**Piloto supervisado:** P1–P7 terminados y P7 autorizado tras pruebas críticas y usuarios reales. **MVP operativo:** M1–M4 terminados y M4 validado con usuarios reales. Hasta entonces estos nombres describen alcances, no un estado funcional comprobado. Nombres, correos personales y dirección exacta del buzón son datos de preparación privada pendientes antes del piloto, pero no bloquean esta documentación ni la creación de tickets.
