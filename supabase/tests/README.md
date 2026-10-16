# Pruebas RRHH

## Locales, sin conexión remota

```powershell
pnpm install --frozen-lockfile
pnpm test:db
pnpm verify
```

`@electric-sql/pglite` está fijado en `0.5.10` como devDependency. No instalar
paquetes ad hoc ni usar `PGLITE_DIR`. P1 conserva su runner original y sus
28 aserciones; el genérico carga SQL en orden sobre un motor efímero.

| Script | Cobertura local |
|---|---|
| `test:rrhh:p1` | P1 original sobre fixture aislado, bcrypt real |
| `test:rrhh:compartido` | P1 sobre `rrhh_kiosco_entorno.sql` |
| `test:rrhh:p2` | Unicidad, regeneración, empresa ajena y agotamiento |
| `test:rrhh:p3` | FK contractual, cierre directo, revocación y recontratación |
| `test:rrhh:p4` | Secuencia diaria, reintentos, vista previa y límite de fallos |
| `test:rrhh:p5` | Controlador de cliente: cancelar, reintentar y doble pulsación |
| `test:rrhh:p6` | Lectura autorizada, empresa, estados, paginación y filtros |
| `test:rrhh:p7-catalogo-local` | Sección A del SQL remoto sobre el modelo local |

Todos se encadenan a `test:db`. El fixture compartido parte de P1 y agrega lo
mínimo de los tickets, incluidas particiones y una autorización simulada.
**Ningún archivo de entorno se aplica a una base compartida.** Las pruebas SQL
terminan con `ROLLBACK`; las de cliente generan credenciales efímeras en memoria.
El runner genérico no imprime SQL, argumentos ni respuestas de error completas.

Ejemplo del runner genérico:

```powershell
node supabase/tests/run_rrhh_pglite.mjs supabase/tests/rrhh_kiosco_entorno.sql supabase/migrations/20261015181000_p1_pin_ambiguo_fallo_cerrado.sql supabase/tests/rrhh_p1_pin_ambiguo.prueba.sql
```

Límites: no hay recorrido de navegador, JWT reales ni concurrencia entre
conexiones PostgreSQL. Las pruebas de grants/particiones en el modelo no
certifican el remoto ni el modelo real de roles/RLS de Supabase.

## Remotas, solo Operador después de aprobar y aplicar

`rrhh_p7_remoto.sql` contiene A (catálogo, grants, RLS y particiones) y B
(aserciones posteriores a carreras, usando UUID del manifiesto). B se ejecuta
por separado, después del arnés y de configurar sus GUC en la misma transacción.
`rrhh_p7_concurrencia.mjs` hace las carreras reales sobre transacciones HTTP
independientes y conserva los PIN devueltos solo en memoria. Rechaza ejecución
en CI o sin autorización explícita en su entorno y no forma parte de `test:db`.

Preparación, variables privadas, precondiciones, rollback y recorrido:
[RRHH_PAQUETE_OPERADOR.md](../../docs/RRHH_PAQUETE_OPERADOR.md).

No declarar P7 remoto aprobado porque pase la sección A con el modelo PGlite.
