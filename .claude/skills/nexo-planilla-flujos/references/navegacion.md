# Navegación: de AG Planilla a Nexo

## 1. Qué se lleva de AG y qué no (plan 20 §1.2, §1.3, §6)

| Grupo de AG | En Nexo | Nota |
|---|---|---|
| Compañía (departamentos, cargos) | Ya existe en RRHH (Contratación → Catálogos) | No se duplica |
| Compañía → Catálogos (ingresos, deducciones, provisiones, incentivos, subsidios) | Configuración → Conceptos | Un solo catálogo con tipo |
| Tipo colaborador, Inatec | Régimen por contrato; INATEC es parámetro | — |
| Planillas → Plantillas | Configuración → Tipos de planilla | — |
| Planillas → Planillas, Aguinaldo, colillas, carga masiva | Nómina → Planillas (filtro por tipo), Novedades, Colillas | Aguinaldo es un tipo de planilla |
| Adelanto salarial | Préstamos y adelantos | — |
| Contrataciones → Contrato, Empleado | Ya existen en RRHH | El régimen se ve en la ficha del contrato |
| Ingresos fijos, deducciones fijas | Novedades recurrentes (propuesta) o concepto fijo por contrato | Decidir en PL4 |
| Deducciones embargo, préstamos bancarios, adelantos, programa de ahorro | Préstamos y embargos | Programa de ahorro: "Pronto" |
| Días descansados, días de vacaciones | Prestaciones → Vacaciones | Con saldo calculado |
| Liquidaciones | Prestaciones → Liquidaciones | Con simulador |
| Subsidios | "Pronto" (decisión 4) | — |
| Contabilidad (catálogo, centros de costo, proyectos) | ERP de Nexo (plan 18, R2) | Fuera de este módulo |
| Informes (más de 50) | Análisis: primero los que se usan | Ver §3 |
| Informes → Impuesto (DGI-VET, INSS novedades, INATEC) | Declaraciones | — |
| Configuración → Cuotas INSS, Tabla IR, Coeficientes, Constantes | Configuración → Parámetros de ley, Tabla de IR | Con vigencia |
| Configuración → Bancos | "Pronto" (hoy se paga con cheque) | — |
| Configuración → Usuarios, Roles, Bitácora | Panel de Nexo (roles) y auditoría | No se duplica |
| AGP Móvil (feriados, puntos de marcación) | RRHH → Feriados y app Asistencia | Ya existen |
| Respaldo | Supabase | No aplica |

## 2. Árbol propuesto

Iconos tomados de `packages/ui/nexo-icons.tsx` (verificado 2026-10-21). Permiso
de cada ítem entre corchetes (prefijo `rrhh.planillas.` omitido).

### Opción A — app propia "Planilla" (`/rrhh/planilla`, como Asistencia)

Requiere registrar el slug en `core.apps` (el trigger crea `planilla.ver_modulo`),
`lib/planilla-nav.ts` y `lib/permisos-planilla.ts` con el patrón de
`asistencia-nav.ts`/`permisos-asistencia.ts`, y aprobación del usuario.

```
Dashboard                               grid       [planilla.ver]
Nómina                                  cash
  Planillas                             receipt    [planilla.ver]
  Novedades                             upload     [movimientos.ver]
  Colillas                              file       [planilla.ver]
Prestaciones                            calendar
  Vacaciones                            calendar   [vacaciones.ver]
  Liquidaciones                         briefcase  [liquidaciones.ver]
Préstamos y embargos                    price
  Préstamos y adelantos                 price      [prestamos.ver]
  Embargos                              lock       [prestamos.ver]
Declaraciones                           book
  INSS e INATEC                         shield     [declaraciones.generar]
  IR (DGI-VET)                          receipt    [declaraciones.generar]
Análisis                                chart
  Comparativo de períodos               trend-up   [planilla.ver]
  Costo del empleador                   cash       [planilla.ver]
  Pasivo laboral                        chart      [planilla.ver]   (Pronto hasta que exista provisiones)
  Simulador de régimen                  sliders    [regimen.ver]
Configuración                           settings
  Conceptos                             tag        [conceptos.ver]
  Tipos de planilla                     list       [conceptos.ver]
  Régimen por contrato                  briefcase  [regimen.ver]
  Parámetros de ley                     sliders    [parametros.ver]
  Tabla de IR                           ruler      [parametros.ver]
```

Feriados se queda en RRHH → Contratación (el sidebar navega solo dentro de la
app); Parámetros puede enlazarlo como texto.

### Opción B — dentro del menú de RRHH

Se amplía el grupo "Nómina" de `apps/rrhh/src/lib/nav.ts` con los hijos y
nietos anteriores, y se agrega al final un grupo "Configuración" (`settings`)
con Conceptos, Tipos de planilla, Régimen por contrato, Parámetros y Tabla de
IR. Los KPIs de planilla se suman al Dashboard de RRHH.

En las dos opciones: un hijo sin permiso no se lista y un grupo vacío no se
muestra; ocultar no protege la ruta.

## 3. Informes que van primero

Los que la empresa usa según el recorrido de AG (plan 20 §1.3, §6): planilla del
período con detalle por persona, colillas, comparativo con el período anterior,
detalle para cheques, costo del empleador con provisiones, consolidado de
aguinaldo, consolidado de liquidaciones, declaraciones INSS/INATEC y DGI-VET.
El resto de los informes de AG se agrega solo si alguien lo pide.
