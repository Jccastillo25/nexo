# 2026-10-15 — RRHH P1: rechazo del PIN ambiguo (fallo cerrado)

## Contexto

Primer ticket de la especificación de RRHH/kiosco aprobada el mismo día:
[RRHH P1 #30](https://github.com/Jccastillo25/nexo/issues/30), dentro del
piloto supervisado de `docs/RRHH_PILOTO_MVP_OPERATIVO.md` (la especificación
llega a `main` con el [PR #41](https://github.com/Jccastillo25/nexo/pull/41),
posterior a este registro).

Brecha real: desde F1.3, `rrhh.fn_registrar_marca_kiosko` resolvía la
credencial con `limit 1` sobre las credenciales vigentes de la empresa del
kiosco. Nada garantiza todavía que dos credenciales vigentes de esa empresa no
compartan el mismo PIN (la unicidad es P2 y no está implementada), así que con
dos coincidencias la marca quedaba atribuida a la persona que eligiera el plan
de ejecución, sin ninguna señal.

## Estado anterior → estado nuevo

- `limit 1` sobre las credenciales vigentes de la empresa → se **cuentan** las
  coincidencias: 0 = PIN inválido (sin cambios), 1 = marca normal (sin
  cambios), >1 = **fallo cerrado**: ninguna marca, ninguna identidad y señal
  técnica sin PIN.
- Implementado y probado; fusionado en `main` (`fc2b309`, vía PR #42).
  **La migración todavía no se aplicó a `nexo-core` ni a producción.**

## Entregado

- Migración nueva `20261015181000_p1_pin_ambiguo_fallo_cerrado` (ninguna
  migración histórica fue modificada). Reemplaza la definición de
  `rrhh.fn_registrar_marca_kiosko`: misma firma, mismo tipo de retorno, mismo
  rate-limit, mismos `GRANT`/`REVOKE`, mismo retorno sin datos personales.
  Cuenta con `array_agg`/`count` las credenciales vigentes de la empresa del
  kiosco que aceptan el PIN; con más de una coincidencia emite
  `RAISE WARNING` (sin PIN: solo `kiosko_id`, `company_id` y el número de
  coincidencias; va al log del servidor y PostgREST no lo expone al llamador)
  y recorre el mismo camino observable que un PIN inválido: cero filas y un
  intento contado en `rrhh.kiosko_rate_limits`.
- Decisión de diseño: el caso ambiguo no se distingue hacia afuera de un PIN
  inválido — así no existe diferencia observable que sirva de oráculo — y
  consume intento, de modo que 8 intentos ambiguos seguidos bloquean el kiosco
  5 minutos igual que 8 PINes inválidos.
- Costo asumido: un PIN válido ahora evalúa todas las credenciales vigentes de
  la empresa (antes cortaba en la primera coincidencia). Elimina el problema
  la unicidad de P2, que sigue pendiente.
- Primera suite de pruebas de base de datos del repo: `supabase/tests/`
  (13 casos / 28 aserciones, entorno desechable mínimo y runner con
  [Postgres embebido](../../supabase/tests/README.md)).
- `apps/rrhh` no cambió: la Server Action del kiosco ya respondía de forma
  genérica ("No se pudo registrar la marca." ante cero filas) y nunca devolvió
  identidad, así que P1 no necesita pantalla nueva.

## Pruebas ejecutadas

- PostgreSQL 18.6 embebido (PGlite `0.5.10`) con `contrib/pgcrypto` real
  (bcrypt real), en memoria y descartable: **28 aserciones en verde**, la
  migración se puede reaplicar sin error, 10 señales técnicas emitidas y
  **0 avisos del motor con un PIN**.
- Casos cubiertos: PIN inexistente; PIN único (entrada y luego salida); dos
  credenciales vigentes de la misma empresa con el mismo PIN (cero filas, cero
  marcas, ninguna de las dos credenciales marcada); reintento del mismo PIN
  ambiguo; la misma cifra en otra empresa (aislamiento: marca a su propio
  empleado y no alcanza las credenciales ajenas); credencial revocada; contrato
  finalizado; credencial bloqueada; kiosco inactivo; retorno sin columnas de
  identidad; bloqueo a los 8 intentos con PIN válido rechazado durante el
  bloqueo; `anon` sin `EXECUTE` sobre la función interna y con `EXECUTE` sobre
  el wrapper público.
- Control negativo: con la definición anterior (F1.3) la prueba falla en C4,
  es decir sí detecta el bug que P1 corrige.
- Remoto verificado **solo en lectura** antes de escribir la migración: la
  función desplegada todavía resuelve con `limit 1` y tiene el mismo tipo de
  retorno; `anon` no tiene `EXECUTE` sobre la función interna y sí sobre
  `public.registrar_marca_kiosko`. Hoy el proyecto tiene 1 kiosco,
  **0 credenciales vigentes** y 0 marcas: la colisión es teórica por ahora y
  la protección es preventiva, como exige el ticket.

## Pendiente / deuda (fuera del alcance pedido)

- **La migración no está aplicada a `nexo-core` ni a producción** (el código sí
  está fusionado en `main`).
- No ejecutados: `lint`/`typecheck`/`build` (no se tocó TypeScript ni ninguna
  app), pruebas contra el esquema real completo (RLS, particiones, resto de
  columnas), recorrido del kiosco en navegador (Server Action → PostgREST →
  RPC) ni prueba con dos empleados reales. La suite corre sobre un `rrhh`
  mínimo replicado a mano: pasar no equivale a validación en producción.
- P2 (unicidad al activar/regenerar) sigue pendiente y es la que evita la
  colisión; hasta entonces un PIN ambiguo deja el kiosco bloqueado tras 8
  intentos. **No se avanzó a P2.**
- La señal técnica vive solo en el log del servidor; el registro restringido
  de incidentes/reportes es P7 y no se construyó.
