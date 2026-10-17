# 2026-10-17 — RRHH: P1–P6 aplicadas en `nexo-core`

- **Subfase / entregable:** aplicación remota del [paquete del Operador](../RRHH_PAQUETE_OPERADOR.md) (P1 → P2 → P3 → P4a → P4b → P6) y P7 sección A.
- **Aprobación:** usuario, 2026-10-17: "Apruebo aplicar P1 a P6 en nexo-core en el orden del paquete del Operador, con sus verificaciones".
- **Estado anterior → nuevo:** implementado solo en la rama, sin aplicar → **aplicado en remoto y con postchecks en verde**. El código del kiosco y de Marcas sigue en el [PR #47](https://github.com/Jccastillo25/nexo/pull/47) (borrador), sin fusionar ni desplegar.
- **Rama / PR:** `codex/rrhh-piloto-mvp` → PR #47 (incluye `main` con Productos).

## Precondiciones verificadas (solo lectura, antes de aplicar)

0 marcas, 0 contratos activos, 0 credenciales vigentes, 2 kioscos activos;
`core.tablas_particionadas` presente; `rrhh.kiosko_solicitudes` inexistente;
`fn_registrar_marca_kiosko` sin P1; políticas de escritura de marcas con los
nombres exactos que P3 retira; `fn_activar_contrato` y
`fn_regenerar_pin_contrato` remotas iguales a lo que P2 reemplaza (salvo el PIN
con `random()`). Únicos escritores de credenciales: esas dos funciones y el
kiosco.

## Migraciones (versión remota → archivo renombrado sin tocar su SQL)

| Paso | Versión remota | Archivo | Postcheck |
|---|---|---|---|
| P1 | `20261017131004` | `20261017131004_p1_pin_ambiguo_fallo_cerrado.sql` (antes `20261015181000_…`, ya en `main`) | `tiene_p1 = true` |
| P2 | `20261017131040` | `20261017131040_rrhh_p2_pin_unico_empresa.sql` | 2 funciones × `sin_random`, `lock_empresa`, `generador_seguro` = true |
| P3 | `20261017131113` | `20261017131113_rrhh_p3_marca_contrato.sql` | contrato obligatorio, FK validada, sin escritura directa, sin políticas de escritura, particiones cerradas = true |
| P4a | `20261017131132` | `20261017131132_rrhh_p4a_kiosko_solicitudes.sql` | registrada, 4 particiones mensuales, privada = true |
| P4b | `20261017131202` | `20261017131202_rrhh_p4b_marca_atomica_idempotente.sql` | firma antigua cerrada, nueva disponible, wrapper anónimo permitido, interna denegada = true |
| P6 | `20261017131221` | `20261017131221_rrhh_p6_consultar_marcas.sql` | autenticado, no anónimo, interna restringida = true |

P1 se aplicó con las mismas sentencias del archivo (sin el bloque de
comentarios de cabecera). Las referencias en `package.json`, pruebas y
documentos se actualizaron a los nombres nuevos.

## P7 sección A (remoto, transacción revertida)

`supabase/tests/rrhh_p7_remoto.sql` sección A completa: grants, RLS sin
identidad, `INSERT` directo denegado, RPC de consulta sin identidad denegada,
`anon` sin acceso a la función interna ni a `kiosko_solicitudes`, particiones
protegidas y registro automático. **Todas pasaron.**

## Advisors de seguridad

Base antes: INFO `rls_enabled_no_policy` 56 · WARN anon 4 · WARN authenticated
68 · WARN leaked password 1. Después: 60 · 4 · 69 · 1. Nuevos hallazgos, todos
esperados por diseño: 4 particiones `kiosko_solicitudes_*` cerradas (RLS sin
políticas, igual que las demás tablas cerradas); el wrapper
`public.registrar_marca_kiosko` de 4 parámetros (reemplaza al de 2, por eso
anon sigue en 4); `public.consultar_marcas` para `authenticated`.

## Efecto en producción y pendientes

- **El kiosco desplegado hoy (cliente de `main`) falla cerrado** desde P4b:
  llama la firma de 2 parámetros, que ya no existe. Previsto por el paquete;
  hay 0 marcas. Se resuelve fusionando el PR #47 (cliente compatible).
- Pendiente: fusionar PR #47; P7 con el arnés de concurrencia y sesiones
  reales (`rrhh_p7_concurrencia.mjs`), sección B y recorrido manual P7.2. Sin
  piloto autorizado.
- Corrección de documentación en la misma entrega: `DATABASE.md`,
  `MIGRATION_LOG.md` y `RRHH_MVP.md` tenían 59 renglones partidos (`` `n ``
  convertido en salto de línea al escribirlos desde PowerShell); reparados
  contra el texto de `main`.
