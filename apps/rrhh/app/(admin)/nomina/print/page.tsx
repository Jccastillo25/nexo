import { createClient } from '@/lib/supabase/server'
import { PrintButton } from './print-button'

interface PrintPageProps {
  searchParams: Promise<{
    type?: string
    start?: string
    end?: string
    branch?: string
    employee?: string
  }>
}

export default async function NominaPrintPage({ searchParams }: PrintPageProps) {
  const params = await searchParams
  const supabase = await createClient()

  const type = params.type || 'planilla'
  const start = params.start || ''
  const end = params.end || ''
  const branchId = params.branch || 'all'
  const employeeId = params.employee || ''

  // ─── Fetch company info ─────────────────────────────────────────────────────
  const { data: profile } = await supabase.auth.getUser()
  const { data: profileData } = await supabase
    .from('profiles')
    .select('company_id, companies(name)')
    .eq('id', profile.user?.id ?? '')
    .single()

  const companyName = (profileData?.companies as any)?.name || 'Gestor360'
  const printDate = new Date().toLocaleDateString('es-NI', { day: '2-digit', month: 'long', year: 'numeric' })

  // ─── Planilla: todos los empleados ──────────────────────────────────────────
  if (type === 'planilla' || type === 'cierre') {
    let attQuery = supabase
      .from('consolidated_attendance_view')
      .select('employee_id, full_name, employee_code, net_hours, late_minutes, attendance_date, branch_id')
      .gte('attendance_date', start)
      .lte('attendance_date', end)

    if (branchId && branchId !== 'all') {
      attQuery = attQuery.eq('branch_id', branchId)
    }

    const { data: attData } = await attQuery

    const { data: contractsData } = await supabase
      .from('contracts')
      .select('employee_id, salary, contract_type')
      .eq('status', 'active')

    const { data: branchData } = branchId !== 'all'
      ? await supabase.from('branches').select('name').eq('id', branchId).single()
      : { data: null }

    const contractMap: Record<string, { salary: number; contract_type: string }> = {}
    contractsData?.forEach((c: any) => {
      contractMap[c.employee_id] = { salary: c.salary || 0, contract_type: c.contract_type || 'N/A' }
    })

    const empMap: Record<string, any> = {}
    attData?.forEach((r: any) => {
      if (!empMap[r.employee_id]) {
        const c = contractMap[r.employee_id] || { salary: 0, contract_type: 'N/A' }
        empMap[r.employee_id] = {
          full_name: r.full_name,
          employee_code: r.employee_code,
          contract_type: c.contract_type,
          salary: c.salary,
          days: 0, hours: 0, late_minutes: 0,
        }
      }
      empMap[r.employee_id].days += 1
      empMap[r.employee_id].hours += r.net_hours || 0
      empMap[r.employee_id].late_minutes += r.late_minutes || 0
    })

    const rows = Object.values(empMap).map((row: any) => {
      const dailyRate = row.salary / 30
      const earned = row.days * dailyRate
      const deduction = (row.late_minutes / 60) * (dailyRate / 8)
      return { ...row, dailyRate, earned, deduction, net: earned - deduction }
    }).sort((a: any, b: any) => a.full_name.localeCompare(b.full_name))

    const totals = rows.reduce((acc: any, r: any) => ({
      days: acc.days + r.days,
      hours: acc.hours + r.hours,
      earned: acc.earned + r.earned,
      deduction: acc.deduction + r.deduction,
      net: acc.net + r.net,
    }), { days: 0, hours: 0, earned: 0, deduction: 0, net: 0 })

    return (
      <PrintLayout
        title="Planilla de Nómina"
        subtitle={`Período: ${start} al ${end}${branchData ? ` — ${(branchData as any).name}` : ''}`}
        companyName={companyName}
        printDate={printDate}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9pt' }}>
          <thead>
            <tr style={{ background: '#1e293b', color: '#94a3b8' }}>
              {['#', 'Empleado', 'Código', 'Tipo', 'Días', 'Horas', 'Salario Base', 'Devengado', 'Deducciones', 'NETO'].map(h => (
                <th key={h} style={{ padding: '8px 10px', textAlign: h === '#' || h === 'Días' || h === 'Horas' ? 'center' : ['Salario Base','Devengado','Deducciones','NETO'].includes(h) ? 'right' : 'left', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '2px solid #334155', fontSize: '7.5pt' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row: any, i: number) => (
              <tr key={i} style={{ borderBottom: '1px solid #e2e8f0', background: i % 2 === 0 ? '#fff' : '#f8fafc' }}>
                <td style={{ padding: '7px 10px', textAlign: 'center', color: '#64748b', fontSize: '8pt' }}>{i + 1}</td>
                <td style={{ padding: '7px 10px', fontWeight: 700 }}>{row.full_name}</td>
                <td style={{ padding: '7px 10px', fontFamily: 'monospace', fontSize: '8pt', color: '#64748b' }}>{row.employee_code}</td>
                <td style={{ padding: '7px 10px', fontSize: '8pt', color: '#64748b', textTransform: 'uppercase' }}>{row.contract_type}</td>
                <td style={{ padding: '7px 10px', textAlign: 'center', fontWeight: 700 }}>{row.days}</td>
                <td style={{ padding: '7px 10px', textAlign: 'center', fontFamily: 'monospace' }}>{row.hours.toFixed(1)}</td>
                <td style={{ padding: '7px 10px', textAlign: 'right', fontFamily: 'monospace' }}>C$ {row.salary.toLocaleString('es-NI', { minimumFractionDigits: 2 })}</td>
                <td style={{ padding: '7px 10px', textAlign: 'right', fontFamily: 'monospace', color: '#16a34a' }}>C$ {row.earned.toLocaleString('es-NI', { minimumFractionDigits: 2 })}</td>
                <td style={{ padding: '7px 10px', textAlign: 'right', fontFamily: 'monospace', color: '#d97706' }}>C$ {row.deduction.toLocaleString('es-NI', { minimumFractionDigits: 2 })}</td>
                <td style={{ padding: '7px 10px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 900, color: '#1d4ed8' }}>C$ {row.net.toLocaleString('es-NI', { minimumFractionDigits: 2 })}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ background: '#1e293b', color: '#fff', fontWeight: 900 }}>
              <td colSpan={4} style={{ padding: '10px', textAlign: 'right', textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '8pt' }}>TOTALES ({rows.length} empleados)</td>
              <td style={{ padding: '10px', textAlign: 'center' }}>{totals.days}</td>
              <td style={{ padding: '10px', textAlign: 'center', fontFamily: 'monospace' }}>{totals.hours.toFixed(1)}</td>
              <td />
              <td style={{ padding: '10px', textAlign: 'right', fontFamily: 'monospace', color: '#4ade80' }}>C$ {totals.earned.toLocaleString('es-NI', { minimumFractionDigits: 2 })}</td>
              <td style={{ padding: '10px', textAlign: 'right', fontFamily: 'monospace', color: '#fbbf24' }}>C$ {totals.deduction.toLocaleString('es-NI', { minimumFractionDigits: 2 })}</td>
              <td style={{ padding: '10px', textAlign: 'right', fontFamily: 'monospace', color: '#60a5fa' }}>C$ {totals.net.toLocaleString('es-NI', { minimumFractionDigits: 2 })}</td>
            </tr>
          </tfoot>
        </table>

        {/* Signature area */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '40px', marginTop: '60px' }}>
          {['Elaborado por', 'Revisado por', 'Autorizado por'].map(label => (
            <div key={label} style={{ textAlign: 'center' }}>
              <div style={{ borderTop: '1.5px solid #1e293b', paddingTop: '8px' }}>
                <p style={{ fontSize: '8pt', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b' }}>{label}</p>
                <p style={{ fontSize: '8pt', color: '#94a3b8', marginTop: '4px' }}>Nombre / Firma</p>
              </div>
            </div>
          ))}
        </div>
      </PrintLayout>
    )
  }

  // ─── Detalle individual ──────────────────────────────────────────────────────
  if (type === 'detalle' && employeeId) {
    const [{ data: attData }, { data: contractData }, { data: empData }] = await Promise.all([
      supabase
        .from('consolidated_attendance_view')
        .select('*')
        .eq('employee_id', employeeId)
        .gte('attendance_date', start)
        .lte('attendance_date', end)
        .order('attendance_date', { ascending: true }),
      supabase.from('contracts').select('salary, contract_type, inss_number').eq('employee_id', employeeId).eq('status', 'active').single(),
      supabase.from('employees').select('first_name, last_name, employee_code').eq('id', employeeId).single(),
    ])

    const fullName = empData ? `${empData.first_name} ${empData.last_name}` : 'Empleado'
    const salary = contractData?.salary || 0
    const dailyRate = salary / 30
    const days = attData?.length || 0
    const totalHours = (attData || []).reduce((s: number, r: any) => s + (r.net_hours || 0), 0)
    const totalLate = (attData || []).reduce((s: number, r: any) => s + (r.late_minutes || 0), 0)
    const earned = days * dailyRate
    const deduction = (totalLate / 60) * (dailyRate / 8)

    return (
      <PrintLayout
        title={`Detalle de Asistencia — ${fullName}`}
        subtitle={`Período: ${start} al ${end} | INSS: ${contractData?.inss_number || 'N/A'}`}
        companyName={companyName}
        printDate={printDate}
      >
        {/* Summary bar */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '24px' }}>
          {[
            { label: 'Días Laborados', value: days.toString() },
            { label: 'Horas Totales', value: `${totalHours.toFixed(2)} hrs` },
            { label: 'Tardanzas', value: `${totalLate} min` },
            { label: 'Neto Estimado', value: `C$ ${(earned - deduction).toLocaleString('es-NI', { minimumFractionDigits: 2 })}` },
          ].map(card => (
            <div key={card.label} style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px', background: '#f8fafc' }}>
              <p style={{ fontSize: '7pt', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b', marginBottom: '4px' }}>{card.label}</p>
              <p style={{ fontSize: '13pt', fontWeight: 900, color: '#1e293b' }}>{card.value}</p>
            </div>
          ))}
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9pt' }}>
          <thead>
            <tr style={{ background: '#1e293b', color: '#94a3b8' }}>
              {['Fecha', 'Entrada', 'Salida', 'Horas Netas', 'Tardanza', 'Turno', 'Observación'].map(h => (
                <th key={h} style={{ padding: '8px 10px', textAlign: ['Horas Netas', 'Tardanza'].includes(h) ? 'center' : 'left', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '2px solid #334155', fontSize: '7.5pt' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(attData || []).map((r: any, i: number) => {
              const clockIn = r.clock_in ? new Date(r.clock_in) : null
              const clockOut = r.clock_out ? new Date(r.clock_out) : null
              const isLate = (r.late_minutes || 0) > 0
              return (
                <tr key={i} style={{ borderBottom: '1px solid #e2e8f0', background: i % 2 === 0 ? '#fff' : '#f8fafc' }}>
                  <td style={{ padding: '7px 10px', fontFamily: 'monospace', fontWeight: 700 }}>
                    {new Date(r.attendance_date).toLocaleDateString('es-NI', { weekday: 'short', day: '2-digit', month: '2-digit' })}
                  </td>
                  <td style={{ padding: '7px 10px', fontFamily: 'monospace' }}>
                    {clockIn ? clockIn.toLocaleTimeString('es-NI', { hour: '2-digit', minute: '2-digit', hour12: true }) : '—'}
                  </td>
                  <td style={{ padding: '7px 10px', fontFamily: 'monospace', color: '#64748b' }}>
                    {clockOut ? clockOut.toLocaleTimeString('es-NI', { hour: '2-digit', minute: '2-digit', hour12: true }) : (r.missing_clock_out ? 'FALTA' : '—')}
                  </td>
                  <td style={{ padding: '7px 10px', textAlign: 'center', fontWeight: 700 }}>{(r.net_hours || 0).toFixed(2)}</td>
                  <td style={{ padding: '7px 10px', textAlign: 'center', color: isLate ? '#d97706' : '#16a34a', fontWeight: 700 }}>{isLate ? `${r.late_minutes} min` : '—'}</td>
                  <td style={{ padding: '7px 10px', fontSize: '8pt', color: '#64748b', textTransform: 'uppercase' }}>{r.shift_name}</td>
                  <td style={{ padding: '7px 10px', fontSize: '8pt', color: '#94a3b8' }}>{r.observations || '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </PrintLayout>
    )
  }

  return (
    <div style={{ padding: '40px', textAlign: 'center', fontFamily: 'sans-serif', color: '#64748b' }}>
      <p>Parámetros insuficientes para generar el documento.</p>
    </div>
  )
}

function PrintLayout({ title, subtitle, companyName, printDate, children }: {
  title: string
  subtitle: string
  companyName: string
  printDate: string
  children: React.ReactNode
}) {
  return (
    <html lang="es">
      <head>
        <meta charSet="utf-8" />
        <title>{title} — Gestor360</title>
        <style>{`
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: 'Segoe UI', Arial, sans-serif; background: #f1f5f9; color: #1e293b; }
          .page { background: #fff; max-width: 297mm; margin: 0 auto; padding: 12mm 14mm; min-height: 210mm; }
          @media print {
            body { background: #fff; }
            .page { box-shadow: none; padding: 10mm 12mm; margin: 0; max-width: none; }
            .no-print { display: none !important; }
          }
          @page { size: A4 landscape; margin: 8mm; }
        `}</style>
      </head>
      <body>
        {/* Toolbar (hidden on print) */}
        <div className="no-print" style={{ background: '#0f172a', padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 10 }}>
          <div>
            <p style={{ color: '#94a3b8', fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Gestor360 — Vista de Impresión</p>
            <p style={{ color: '#fff', fontSize: '14px', fontWeight: 900 }}>{title}</p>
          </div>
          <PrintButton />
        </div>

        <div className="page">
          {/* Document Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', paddingBottom: '16px', borderBottom: '2px solid #1e293b' }}>
            <div>
              <p style={{ fontSize: '8pt', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.15em', color: '#64748b' }}>{companyName}</p>
              <h1 style={{ fontSize: '18pt', fontWeight: 900, marginTop: '4px', letterSpacing: '-0.02em' }}>{title}</h1>
              <p style={{ fontSize: '9pt', color: '#64748b', marginTop: '4px' }}>{subtitle}</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={{ fontSize: '7.5pt', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#94a3b8' }}>Impreso el</p>
              <p style={{ fontSize: '9pt', fontWeight: 700, color: '#1e293b', marginTop: '2px' }}>{printDate}</p>
              <p style={{ fontSize: '7pt', color: '#94a3b8', marginTop: '2px', fontFamily: 'monospace' }}>GESTOR360 © Sistema de RRHH</p>
            </div>
          </div>

          {children}
        </div>
      </body>
    </html>
  )
}
