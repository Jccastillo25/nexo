# Régimen laboral y de servicios profesionales

Decisión del usuario del 2026-10-21 (plan 20 §8.3): "Hay que dejar preparado
para ambas opciones". El régimen va **por contrato y con vigencia**
(`rrhh.contrato_regimen`, plan 20 §7). Nexo no decide cuál corresponde a cada
persona: lo decide el contador o el abogado.

## Qué cambia en el cálculo

| Componente | `laboral` | `servicios_profesionales` |
|---|---|---|
| INSS laboral y patronal | Sí, según `regimen_inss` (integral o IVM) | No (`regimen_inss = 'ninguno'`) |
| INATEC | Sí | No |
| IR | Tabla progresiva de rentas del trabajo | Retención fija con % del contrato, o exento. AG: 0% |
| Vacaciones, aguinaldo, indemnización | Sí, por ley | Configurable por contrato (AG hoy las provisiona y las liquida) |
| Constancia | Colilla de pago | Colilla o recibo de honorarios |

Coherencia que debe validar la RPC (no solo la UI):
- `laboral` ⇒ `regimen_inss in ('integral','ivm')`, `metodo_ir = 'tabla_progresiva'`, prestaciones activas.
- `servicios_profesionales` ⇒ `regimen_inss = 'ninguno'`, `metodo_ir in ('retencion_fija','exento')`; `porcentaje_ir` obligatorio si es retención fija.

## Cambio de régimen

- Solo con `rrhh.planillas.regimen.cambiar` (plantilla `admin`), con fecha efectiva y motivo; queda en `core.audit_log`.
- Cierra la vigencia anterior y abre otra; no rehace el contrato ni toca planillas aprobadas.
- **Propuesta:** la fecha efectiva debe coincidir con el inicio de un período de planilla, para no prorratear un período entre dos regímenes. Si el usuario quiere prorrateo, es una decisión nueva.
- Un contrato nuevo nace con un régimen (no hay contrato sin régimen al calcular). Los 5–6 contratos existentes necesitan su fila inicial: valor a confirmar por el usuario (hoy en AG son "Free-lance").

## Simulador de costo (plan 20 §8.3)

Con los mismos contratos, mostrar el costo mensual en cada régimen:

```
costo_laboral = salario + INSS patronal + INATEC + provisiones
costo_servicios = honorarios + provisiones configuradas (si las tiene)
diferencia = costo_laboral − costo_servicios
```

Ejemplo (tasas del 2026-10-21, sin provisiones): C$11,350 → INSS patronal
21.5% = 2,440.25 + INATEC 2% = 227.00 → **C$2,667.25 más al mes** en laboral
(coincide con "unos C$2,667" del plan 20 §9). El trabajador además recibe
neto menor por INSS laboral (794.50) e IR.

El simulador no guarda nada y usa los parámetros vigentes; si alguno es
"verificar", lo dice en pantalla.

## Aviso, no bloqueo

Condición: contrato en `servicios_profesionales` que tiene jornada asignada
(`rrhh.contrato_jornadas`) o marcas en el kiosco en el período.
Texto: "Revisar régimen con el contador". Descartarlo exige `regimen.cambiar`,
pide motivo y queda auditado. El aviso reaparece si cambia el régimen o la
jornada (propuesta).

## Contexto (sin datos personales)

En AG, los contratos vigentes figuran como "Free-lance" con IR al 0% y sin INSS,
pero con cargos operativos, jornada de 8 horas, provisiones y liquidación por el
art. 45 (plan 20 §5.5). Esos hechos describen una relación laboral; la skill no
lo califica, solo asegura que el sistema muestre el aviso y el costo de cada
opción.
