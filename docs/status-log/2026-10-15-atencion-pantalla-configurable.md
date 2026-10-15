# 2026-10-15 — Pantalla de Atención: datos configurables y acceso sin sesión

## Contexto

Dos pedidos del usuario tras [nombres en la pantalla](2026-10-15-atencion-pantalla-nombres.md):

1. "Arreglar lo de la pantalla": en el dominio público,
   `/atencion/pantalla/<id>` redirigía al login de Nexo sin sesión.
2. Elegir en Configuración qué datos del turno llamado se muestran y cuáles
   se anuncian por voz.

## Diagnóstico (1)

`apps/nexo/src/proxy.ts` corría su guard de sesión en todo `/atencion/*`
(sí excluía `/crm`, `/rrhh` y `/agencia`). Como el proxy de Nexo corre antes
del rewrite Multi-Zones, la pantalla y también sus archivos
`/atencion/_next/static/*` iban al login, aunque `apps/atencion` ya deja
pública `/pantalla` en su propio proxy. Verificado con una petición sin
sesión al dominio público: `x-matched-path: /login`. Hasta ahora funcionaba
solo porque el televisor tenía una sesión abierta.

Sobre el reporte "sigue diciendo solo el puesto": la base y el bundle de
producción ya tenían el anuncio nuevo (verificado). La causa más probable es
que el televisor siguiera corriendo el JavaScript que descargó antes del
deploy, porque la página no se recarga sola. **No confirmado en el TV.**

## Estado anterior → estado nuevo

- Pantalla sin sesión en el dominio público: redirige al login → **excluida
  del guard de Nexo** (falta verificar en producción tras el merge).
- Datos del turno: fijos (cliente + agente + puesto) → **configurables por
  pantalla** (mostrar / anunciar por voz). El número siempre sale.

## Entregado

- `apps/nexo/src/proxy.ts`: `atencion(?:/|$)` agregado a las exclusiones del
  matcher. El guard de `apps/atencion` sigue protegiendo `/atencion/dashboard`,
  `/atender` y `/configuracion` (redirige al login del panel).
- Migración `20261015155035_atencion_pantalla_campos_configurables` (aplicada
  en `nexo-core`; archivo creado como `20261015170000_…` y renombrado a la
  versión remota sin tocar el SQL):
  - `atencion.fn_pantalla_campo(config, campo)`: un dato sale si se muestra
    **o** se anuncia; sin clave = sí. Sin `EXECUTE` para `anon`/`authenticated`.
  - `public.atencion_pantalla_estado`: `cliente`, `agente` y `puesto` llegan
    `null` cuando la pantalla no los usa. **El filtro es de la base**: si se
    apaga el nombre del cliente, deja de salir por la RPC anónima, no solo de
    la vista.
  - Config en `atencion.pantallas.config`: `mostrar` y `anunciar`, cada uno
    `{cliente, agente, puesto}` booleanos.
- `apps/atencion`:
  - Configuración → Pantallas → Editar: tabla de casillas Mostrar / Anunciar
    por dato, vista previa de la frase y aviso cuando el nombre del cliente
    queda expuesto por el enlace.
  - `guardarPantalla`: guarda `mostrar`/`anunciar` normalizados (solo las 3
    claves, booleanas). Sin permiso nuevo: `atencion.configuracion.pantalla.gestionar`.
  - Pantalla: muestra y anuncia solo lo configurado. La frase se arma con lo
    presente: "Turno 5, Juan Pérez, será atendido por María López en Puesto 2" /
    "…, pase a Puesto 2" / "Turno 5".

## Pruebas ejecutadas

- `next build` + `eslint` limpios en `apps/atencion` y `apps/nexo`.
- Matcher del proxy de Nexo probado con rutas: `/atencion`, `/atencion/pantalla/…`,
  `/atencion/_next/static/…`, `/atencion/dashboard` → excluidas; `/`, `/login`,
  `/configuracion/usuarios`, `/atencionx` → siguen en el guard de Nexo.
- SQL en un bloque revertido con un turno ficticio: sin config → los 3 datos;
  cliente apagado en mostrar y anunciar → `cliente: null`; cliente solo por voz
  → `cliente` presente, agente y puesto `null`.
- Remoto después: versión `20261015155035`, `anon` con `EXECUTE` en la RPC y
  sin `EXECUTE` en la función auxiliar; la pantalla real (sin config de campos)
  devuelve lo mismo que antes.

## Pendiente

- ~~Merge y deploy~~: PR #23 fusionado (`main` `6db1a54`, Codex sin
  hallazgos), los 5 deploys de producción READY. Verificado sin sesión en el
  dominio público: `/atencion/pantalla/<id>` → `x-matched-path: /pantalla/[id]`
  (antes `/login`); `/atencion/configuracion` sigue yendo al login central con
  `next=/atencion/configuracion`.
- Recargar el televisor y probar voz y casillas.

## Ampliación: número de factura (mismo día)

Pedido del usuario: que la pantalla traiga el número de factura del turno.

- Cuarto dato configurable, **apagado por defecto** (cliente, agente y puesto
  vienen encendidos). Motivo: en el plan 13 la factura era un dato protegido
  por `atencion.cliente.datos.ver`, y la pantalla se lee sin sesión; solo sale
  en las pantallas donde se marca en Configuración.
- Migración `20261015161222_atencion_pantalla_factura` (archivo creado como
  `20261015180000_…`, renombrado a la versión remota sin tocar el SQL). Solo un
  `create or replace` de `atencion_pantalla_estado`, que agrega `factura`.
  `atencion.fn_pantalla_campo` no cambia: la factura se evalúa en la RPC con
  "sin clave = no".
- Incidente al aplicar: dos intentos con un `DROP FUNCTION` de la auxiliar se
  cortaron a los 60 s sin aplicar nada (verificado: función vieja intacta, sin
  versión registrada). Un ensayo con `lock_timeout = 5s` también se cortó a los
  60 s y las consultas simples respondían. Hipótesis, sin confirmar: el
  conector de Supabase retiene sentencias destructivas esperando una
  confirmación. Se rediseñó sin `DROP` y se aplicó al primer intento.
- Pantalla: "Factura 001-1234" bajo el nombre del cliente y en las filas
  secundarias ("Fact. …"); voz: "Turno 5, Juan Pérez, factura 001-1234, será
  atendido por…". Configuración: fila "Número de factura" y aviso de exposición
  que incluye la factura.
- Pruebas: build/lint de `apps/atencion`; bloque revertido con turno ficticio
  (sin config → `null`; encendida → `001-1234`; apagada explícita → `null`);
  remoto después: la pantalla real devuelve `factura: null` hasta encenderla.
- En producción: PR #24 fusionado (`main` `953e52e`), los 5 deploys READY;
  pantalla verificada sin sesión en el dominio público. Falta probar en el TV.
