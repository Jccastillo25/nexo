# Nexo — Acceso de Conductores, Identidad Operativa y Kiosko

> Decisión funcional vigente desde **2026-09-06**. Este documento define la separación entre marcación de asistencia, identidad digital del empleado y acceso al panel de conductores en Web y Nexo Mobile. Prevalece sobre diseños anteriores que reutilizaban el PIN del kiosko como contraseña de acceso operativo.

---

# 1. Principio central

Nexo tendrá tres superficies de acceso distintas:

```text
                    NEXO
                      │
        ┌─────────────┼─────────────┐
        │             │             │
  WEB ADMINISTRATIVO  KIOSKO     CONDUCTOR
       NEXO           RRHH       WEB + APP
        │              │            │
   SSO / Auth       SOLO PIN    USUARIO +
                                CONTRASEÑA
```

No se debe pedir al backend que "adivine" si un PIN significa marcación o inicio de sesión. Cada superficie tiene un contexto y una credencial diferentes.

---

# 2. Regla de credenciales

## 2.1 PIN contractual

El PIN es exclusivamente una credencial de **asistencia**.

```text
Contrato activo
      ↓
PIN generado automáticamente
      ↓
Kiosko RRHH
      ↓
Entrada / salida
```

Reglas:

- nace al activar un contrato laboral válido;
- no existe antes del contrato;
- no se elige manualmente;
- se guarda solo como hash;
- se muestra una sola vez cuando se genera/regenera;
- se revoca al finalizar el contrato;
- se regenera solo desde un contrato activo;
- nunca se utiliza como contraseña de una sesión Web o Mobile;
- nunca crea por sí solo una sesión de Supabase Auth.

## 2.2 Usuario + contraseña

El acceso digital operativo usa:

```text
nombre_usuario + contraseña
```

La contraseña es administrada por **Supabase Auth**. No se almacena ni se hashea manualmente en tablas de negocio.

La misma identidad digital debe funcionar en:

- Panel de Conductor Web;
- Nexo Mobile Android;
- Nexo Mobile iOS;
- cualquier otro módulo operacional futuro que el empleado tenga permitido.

---

# 3. Identidad digital pertenece al empleado, no al módulo

Evitar:

```text
usuario_rrhh
usuario_transporte
usuario_crm
usuario_fabricacion
```

Modelo objetivo:

```text
rrhh.empleados
      │
      └── identidad digital Nexo
              │
              └── auth.users
                    │
                    ├── rol/permisos RRHH
                    ├── rol/permisos Transporte
                    ├── rol/permisos CRM
                    └── rol/permisos Fabricación
```

Una persona tiene como máximo una identidad digital Nexo por empresa/contexto definido. Los módulos visibles y acciones autorizadas se determinan por permisos y roles.

---

# 4. Habilitar a un empleado como conductor

Ser empleado no implica ser conductor.

Flujo objetivo:

```text
Expediente General
      ↓
Contrato activo
      ↓
PIN de asistencia activo
      ↓
Administración selecciona "Habilitar como conductor"
      ↓
Validar requisitos de conductor
      ↓
Crear/activar extensión operativa de Transporte
      ↓
Asignar rol/permisos de conductor
      ↓
Si no posee identidad digital:
     provisionar cuenta Nexo
```

La habilitación de conductor debe validar como mínimo:

- empleado existente;
- contrato laboral activo;
- estado permitido para trabajar;
- licencia/categorías requeridas cuando estén implementadas;
- ausencia de duplicación de perfil de conductor.

## 4.1 Si ya existe identidad digital

No se crea otro usuario.

```text
Empleado ya tiene auth.users
      ↓
Habilitar conductor
      ↓
Agregar rol/permisos Transporte
```

## 4.2 Si no existe identidad digital

Se provisiona una cuenta mediante Supabase Auth.

Se puede exponer al usuario un nombre corto como:

```text
jcastillo48
```

Si Supabase necesita un identificador email interno, la implementación puede mapearlo internamente a algo como:

```text
jcastillo48@nexo.internal
```

El conductor no necesita conocer ese identificador técnico. Esta estrategia debe validarse técnicamente antes de producción y documentarse en la implementación final.

---

# 5. Contraseña inicial y ciclo de vida

Al provisionar una identidad digital para un conductor:

```text
Habilitar conductor
      ↓
Crear auth.users
      ↓
Generar contraseña temporal segura
      ↓
Mostrar/entregar de forma controlada
      ↓
Primer login
      ↓
Forzar cambio de contraseña
```

Requisitos:

- contraseña temporal no persistida en tablas de negocio;
- nunca reutilizar PIN como contraseña temporal;
- permitir restablecer contraseña;
- permitir bloquear/desbloquear acceso;
- permitir revocar sesiones cuando sea necesario;
- registrar auditoría de altas, bloqueos, restablecimientos y cambios administrativos.

La implementación concreta del flujo de contraseña temporal/primer cambio debe usar mecanismos soportados por Supabase Auth; no escribir directamente en `auth.users` mediante SQL crudo.

---

# 6. Relación con el contrato laboral

El contrato es la autoridad de habilitación laboral.

## 6.1 Contrato finalizado

Cuando el contrato termina:

```text
Contrato → FINALIZADO
```

Debe producir:

- revocación del PIN de asistencia;
- bloqueo de nuevas marcaciones;
- bloqueo de nuevas operaciones laborales;
- conductor no puede iniciar nuevos viajes;
- acceso operacional dependiente de ese contrato debe quedar suspendido/revocado según sus demás roles vigentes;
- conservar historial de contratos, marcas, viajes, liquidaciones e incidencias.

Importante: si la misma identidad digital tiene permisos válidos por otra relación/rol vigente, no se elimina `auth.users`; se revocan únicamente las habilitaciones que dejaron de ser válidas.

## 6.2 Deja de ser conductor pero continúa empleado

```text
Contrato = ACTIVO
Conductor = DESHABILITADO
```

Resultado:

- PIN de asistencia sigue funcionando;
- acceso a autoservicio RRHH puede seguir funcionando;
- módulo/panel Transporte deja de estar disponible;
- no puede iniciar nuevos viajes;
- historial de Transporte se conserva.

---

# 7. Kiosko RRHH

El kiosko es una superficie especial, anónima respecto a Supabase Auth, pero el dispositivo debe estar autorizado.

Flujo:

```text
Kiosko autorizado
      ↓
Empleado introduce PIN
      ↓
Backend resuelve credencial contractual activa
      ↓
Valida contrato activo
      ↓
Determina entrada/salida
      ↓
Registra marca
```

El kiosko no utiliza `nombre_usuario` ni contraseña.

## 7.1 Entrada o salida

El sistema debe inferir el tipo de marca a partir de la secuencia de asistencia, siempre que el estado sea inequívoco.

Ejemplo:

```text
07:58 ENTRADA
12:03 SALIDA
13:01 ENTRADA
17:08 SALIDA
```

Regla inicial:

- sin entrada abierta → siguiente marca = entrada;
- con entrada abierta → siguiente marca = salida.

Si el historial es anómalo o no permite determinar una transición segura, generar incidencia para revisión en vez de inventar un estado.

La inferencia definitiva deberá considerar jornada, múltiples pares, cierres de día y reglas aprobadas durante F1.4–F1.6.

---

# 8. Panel de Conductor Web

El Panel de Conductor es una experiencia operacional, distinta del panel administrativo de Transporte.

Acceso:

```text
/flotilla/conductor/login
      ↓
usuario + contraseña
      ↓
Supabase Auth
      ↓
validar contrato + habilitación conductor + permisos
      ↓
Panel de Conductor
```

La URL exacta puede ajustarse durante la adaptación Multi-Zone, pero el principio de separación se mantiene.

Contenido mínimo previsto:

- viaje actual;
- vehículo asignado;
- inspección pre-viaje;
- iniciar/continuar/finalizar viaje;
- eventos/incidencias;
- evidencia de entrega;
- historial de viajes;
- liquidación/gastos cuando aplique;
- perfil operacional.

No debe exponer administración de empleados, planillas, permisos, configuración de flota o funciones administrativas solo porque esas funciones existan en la versión web de Nexo.

---

# 9. Nexo Mobile

Nexo Mobile no replica toda la Web.

Es una superficie operacional por rol/permisos.

Para un conductor puede mostrar únicamente:

```text
NEXO MOBILE
├── Viaje actual
├── Mi vehículo
├── Inspección
├── Iniciar/continuar viaje
├── GPS/navegación operativa
├── Incidencias
├── Evidencia de entrega
├── Finalizar viaje
├── Mis viajes
├── Mi liquidación
└── Mi perfil
```

La misma sesión `auth.users` usada por el Panel de Conductor Web debe servir para Android/iOS.

La app no debe incorporar pantallas administrativas por defecto. Los módulos y acciones se habilitan exclusivamente por permisos y por el diseño móvil aprobado.

---

# 10. Autenticación técnica

Modelo objetivo:

```text
Web Conductor ─┐
               ├── Supabase Auth ── auth.uid()
Nexo Mobile ───┘          │
                          ↓
                 core.has_permission()
                          │
                          ↓
                       RLS/RPC
```

El backend sigue siendo la autoridad.

El login con `nombre_usuario` puede implementarse mediante una capa de resolución segura hacia la identidad soportada por Supabase Auth. No crear un sistema paralelo de sesiones caseras.

No usar el antiguo diseño:

```text
nombre_usuario + PIN → fn_validar_acceso_operativo() → sesión
```

como arquitectura final.

`fn_validar_acceso_operativo()` y cualquier infraestructura construida bajo el concepto de "PIN de doble propósito" pasan a ser **deuda/refactor** y deben revisarse durante F1.0/F1.3 y la adaptación de Transporte.

---

# 11. Modelo de datos objetivo

La estructura exacta se aprobará mediante migración y Paso Cero, pero conceptualmente se separan:

## RRHH

```text
rrhh.empleados
rrhh.contratos
rrhh.contrato_credenciales   # solo PIN asistencia
```

## Identidad digital

```text
auth.users
+ relación empleado ↔ auth_user_id
```

La relación puede residir en una tabla de acceso/perfil de `core` o RRHH según se defina durante el diseño, pero debe ser única y reutilizable entre módulos.

## Transporte

```text
flotilla.conductores
    empleado_id
    estado_operativo
    datos de licencia/categorías
    demás atributos propios de conducción
```

`flotilla.conductores` no duplica nombres, documento de identidad, relación laboral ni contraseña.

---

# 12. Permisos a diseñar

Antes de implementar, aplicar Paso Cero y revisar la matriz remota.

Ejemplos a evaluar:

```text
flotilla.conductores.perfil.ver
flotilla.conductores.perfil.habilitar
flotilla.conductores.perfil.deshabilitar
flotilla.conductores.acceso.provisionar
flotilla.conductores.acceso.bloquear
flotilla.conductores.acceso.restablecer
flotilla.conductores.viajes.ver
flotilla.conductores.viajes.operar
```

Los nombres finales deben respetar la norma vigente de permisos y ser aprobados antes de crear UI/tablas nuevas.

---

# 13. Casos E2E obligatorios

## Asistencia

```text
Empleado + contrato activo
→ PIN válido
→ kiosko autorizado
→ entrada
→ salida
```

Probar también PIN inválido, contrato finalizado, kiosko inválido, rate limit y secuencia anómala.

## Habilitación como conductor

```text
Empleado + contrato activo
→ habilitar conductor
→ crear/reutilizar identidad digital
→ asignar permisos
→ usuario + contraseña
→ login Web
→ login Mobile
```

## Deshabilitar conductor

```text
conductor activo
→ deshabilitar
→ no nuevos viajes
→ Transporte desaparece/no autoriza
→ PIN de RRHH continúa si contrato activo
```

## Finalizar contrato

```text
contrato activo
→ finalizar
→ PIN revocado
→ no nueva marcación
→ no nuevo viaje
→ historia intacta
```

---

# 14. Migración desde el diseño actual

Existe código versionado que:

- guarda `nombre_usuario` en `rrhh.empleados`;
- reutiliza `pin_hash` para kiosko y login operativo;
- contiene `rrhh.fn_validar_acceso_operativo()`;
- contempla provisión de `auth.users` mediante una identidad interna.

Ese código no debe borrarse ni reescribirse modificando migraciones aplicadas.

Proceso obligatorio:

1. F1.0 verifica estado remoto y si existen datos reales dependientes de ese diseño;
2. documentar el diff;
3. aprobar nueva matriz de permisos;
4. crear migraciones nuevas;
5. separar PIN de asistencia de identidad digital;
6. adaptar funciones y UI;
7. validar Web + kiosko + futuro Mobile;
8. deprecar funciones/columnas antiguas cuando ya no tengan consumidores;
9. limpiar columnas solo en una migración posterior y segura.

---

# 15. Regla final

```text
PIN                 = asistencia
usuario+contraseña  = identidad digital
conductor            = habilitación/rol operacional
Web + Mobile         = superficies sobre la misma identidad y backend
```

Cualquier implementación que vuelva a utilizar el PIN de 4 dígitos como contraseña del Panel de Conductor contradice esta decisión de negocio.
