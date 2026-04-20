import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { jsPDF } from "https://esm.sh/jspdf@2.5.1"
import "https://esm.sh/jspdf-autotable@3.5.25"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ─── Brand palette ────────────────────────────────────────────────────────────
const C = {
  primary:   [15,  23,  42]  as [number, number, number], // slate-900
  secondary: [30,  41,  59]  as [number, number, number], // slate-800
  accent:    [59,  130, 246] as [number, number, number], // blue-500
  danger:    [220, 38,  38]  as [number, number, number], // red-600
  warning:   [217, 119, 6]   as [number, number, number], // amber-600
  success:   [22,  163, 74]  as [number, number, number], // green-600
  muted:     [100, 116, 139] as [number, number, number], // slate-500
  subtle:    [148, 163, 184] as [number, number, number], // slate-400
  light:     [248, 250, 252] as [number, number, number], // slate-50
  altRow:    [241, 245, 249] as [number, number, number], // slate-100
  border:    [226, 232, 240] as [number, number, number], // slate-200
  white:     [255, 255, 255] as [number, number, number],
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function fmtTime(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('es-NI', {
    hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'America/Managua'
  })
}

function fmtDate(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('es-NI', {
    weekday: 'short', day: '2-digit', month: '2-digit', year: '2-digit'
  })
}

function currency(n: number): string {
  return `C$ ${n.toLocaleString('es-NI', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

// ─── Page decorator (header + footer on every page) ──────────────────────────
function buildPageDecorator(
  companyName: string,
  reportTitle: string,
  subtitle: string,
  printDate: string,
  pageWidth: number,
  pageHeight: number,
) {
  return function (data: any) {
    const doc: jsPDF = data.doc
    const pageNum: number = data.pageNumber
    // Total pages not available until render completes; placeholder filled later
    const MARGIN = 14

    // ── Top banner ────────────────────────────────────────────────────────────
    doc.setFillColor(...C.primary)
    doc.rect(0, 0, pageWidth, 26, 'F')

    // Accent stripe at banner bottom
    doc.setFillColor(...C.accent)
    doc.rect(0, 26, pageWidth, 1.5, 'F')

    // Company name (top-left)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.5)
    doc.setTextColor(...C.subtle)
    doc.text('GRUPO CASTILLO TORRES S.A.', MARGIN, 8)

    // System tag (top-right)
    doc.setFontSize(6.5)
    doc.setTextColor(...C.subtle)
    doc.text('GESTOR360 — SISTEMA DE RRHH', pageWidth - MARGIN, 8, { align: 'right' })

    // Report title (bold, white)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(13)
    doc.setTextColor(...C.white)
    doc.text(reportTitle, MARGIN, 20)

    // Subtitle (right side)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(...C.subtle)
    doc.text(subtitle, pageWidth - MARGIN, 20, { align: 'right' })

    // ── Footer ────────────────────────────────────────────────────────────────
    const footerY = pageHeight - 12

    doc.setDrawColor(...C.border)
    doc.setLineWidth(0.3)
    doc.line(MARGIN, footerY - 4, pageWidth - MARGIN, footerY - 4)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6.5)
    doc.setTextColor(...C.muted)

    doc.text('DOCUMENTO CONFIDENCIAL — USO INTERNO', MARGIN, footerY)
    doc.text(`Generado: ${printDate}`, pageWidth / 2, footerY, { align: 'center' })
    doc.text(`Página ${pageNum}`, pageWidth - MARGIN, footerY, { align: 'right' })
  }
}

// ─── Summary bar ─────────────────────────────────────────────────────────────
function drawSummaryBar(
  doc: jsPDF,
  stats: { label: string; value: string; color?: [number, number, number] }[],
  startY: number,
  pageWidth: number,
): number {
  const MARGIN = 14
  const barW   = pageWidth - MARGIN * 2
  const barH   = 20
  const colW   = barW / stats.length

  doc.setFillColor(...C.light)
  doc.setDrawColor(...C.border)
  doc.setLineWidth(0.3)
  doc.rect(MARGIN, startY, barW, barH, 'FD')

  // Dividers between columns
  for (let i = 1; i < stats.length; i++) {
    doc.setDrawColor(...C.border)
    doc.line(MARGIN + i * colW, startY + 3, MARGIN + i * colW, startY + barH - 3)
  }

  stats.forEach(({ label, value, color }, i) => {
    const cx = MARGIN + i * colW + colW / 2

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(...(color ?? C.primary))
    doc.text(value, cx, startY + 9, { align: 'center' })

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6)
    doc.setTextColor(...C.muted)
    doc.text(label.toUpperCase(), cx, startY + 16, { align: 'center' })
  })

  return startY + barH + 4
}

// ─── Signature section ────────────────────────────────────────────────────────
function drawSignatures(doc: jsPDF, startY: number, pageWidth: number): void {
  const positions = [
    { cx: pageWidth * 0.18, label: 'Elaborado por',  name: 'Recursos Humanos'  },
    { cx: pageWidth * 0.50, label: 'Revisado por',   name: 'Gerencia General'  },
    { cx: pageWidth * 0.82, label: 'Autorizado por', name: 'Julio Castillo'    },
  ]

  const lineY = startY + 18

  positions.forEach(({ cx, label, name }) => {
    doc.setDrawColor(...C.secondary)
    doc.setLineWidth(0.5)
    doc.line(cx - 28, lineY, cx + 28, lineY)

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7)
    doc.setTextColor(...C.muted)
    doc.text(label.toUpperCase(), cx, lineY + 5, { align: 'center' })

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(...C.subtle)
    doc.text(name, cx, lineY + 10, { align: 'center' })
  })
}

// ─── Main handler ─────────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { start, end, company_id, branch_id, type = 'attendance' } = await req.json()

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // ── 1. Fetch company info ─────────────────────────────────────────────────
    const { data: companyData } = await supabase
      .from('companies')
      .select('display_name, legal_name')
      .eq('id', company_id)
      .single()

    const companyName = companyData?.legal_name || companyData?.display_name || 'Grupo Castillo Torres S.A.'

    // ── 2. Fetch branch info ──────────────────────────────────────────────────
    let branchName = 'Todas las sucursales'
    if (branch_id && branch_id !== 'all') {
      const { data: branchData } = await supabase
        .from('branches')
        .select('name')
        .eq('id', branch_id)
        .single()
      branchName = branchData?.name ?? branchName
    }

    // ── 3. Fetch attendance data ──────────────────────────────────────────────
    let query = supabase
      .from('consolidated_attendance_view')
      .select('*')
      .gte('attendance_date', start)
      .lte('attendance_date', end)
      .order('attendance_date', { ascending: true })
      .order('full_name',       { ascending: true })

    if (branch_id && branch_id !== 'all') {
      query = query.eq('branch_id', branch_id)
    }

    const { data: records, error: fetchError } = await query
    if (fetchError) throw fetchError

    // ── 4. Integrity check ────────────────────────────────────────────────────
    const issues = (records ?? []).filter((r: any) => r.missing_clock_out)
    if (issues.length > 0) {
      return new Response(
        JSON.stringify({ error: 'Integrity Failure', details: issues }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const rows = records ?? []

    // ── 5. Compute summary stats ──────────────────────────────────────────────
    const totalRecords  = rows.length
    const lateCount     = rows.filter((r: any) => (r.late_minutes || 0) > 0).length
    const punctualCount = totalRecords - lateCount
    const totalHours    = rows.reduce((s: number, r: any) => s + (r.net_hours     || 0), 0)
    const totalLate     = rows.reduce((s: number, r: any) => s + (r.late_minutes  || 0), 0)

    // ── 6. Build PDF ──────────────────────────────────────────────────────────
    const doc        = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const pageWidth  = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()
    const MARGIN     = 14

    const reportTitles: Record<string, string> = {
      attendance: 'Reporte de Asistencia y Puntualidad',
      hours:      'Reporte de Horas Trabajadas',
      incidents:  'Reporte de Tardanzas y Ausencias',
    }
    const reportTitle = reportTitles[type] ?? reportTitles.attendance

    const printDate = new Date().toLocaleDateString('es-NI', {
      day: '2-digit', month: 'long', year: 'numeric', timeZone: 'America/Managua'
    })
    const subtitle = `Período: ${start} al ${end}  |  Sucursal: ${branchName}`

    const pageDecorator = buildPageDecorator(
      companyName, reportTitle, subtitle, printDate, pageWidth, pageHeight
    )

    // ── 6a. Summary bar (first page only, drawn before autoTable) ─────────────
    const summaryStats = [
      { label: 'Total registros',  value: totalRecords.toString() },
      { label: 'Puntuales',        value: punctualCount.toString(), color: C.success },
      { label: 'Con tardanza',     value: lateCount.toString(),     color: C.danger  },
      { label: 'Horas netas',      value: `${totalHours.toFixed(1)} h` },
      { label: 'Min. tardanza',    value: `${totalLate} min`,        color: totalLate > 0 ? C.warning : C.muted },
    ]

    // First page header + summary (autoTable will also call didDrawPage, but for
    // page 1 the table starts below the summary bar so we draw it manually here)
    pageDecorator({ doc, pageNumber: 1 })
    const tableStartY = drawSummaryBar(doc, summaryStats, 30, pageWidth)

    // ── 6b. Attendance table ──────────────────────────────────────────────────
    const tableHeaders = [['Fecha', 'Colaborador', 'Cód.', 'Turno', 'Entrada', 'Salida', 'Tardanza', 'Hrs Netas', 'Observaciones']]

    const tableBody = rows.map((r: any) => {
      const isLate = (r.late_minutes || 0) > 0
      const tardCell = isLate
        ? { content: `${r.late_minutes} min`, styles: { textColor: C.danger, fontStyle: 'bold' } }
        : { content: '—', styles: { textColor: C.success } }

      return [
        fmtDate(r.attendance_date),
        r.full_name        ?? '—',
        r.employee_code    ?? '—',
        (r.shift_name      ?? '—').toUpperCase(),
        fmtTime(r.clock_in),
        fmtTime(r.clock_out),
        tardCell,
        { content: (r.net_hours || 0).toFixed(2), styles: { halign: 'center' } },
        r.observations     ?? '',
      ]
    });

    // @ts-ignore: jspdf-autotable extends prototype
    doc.autoTable({
      startY: tableStartY,
      head: tableHeaders,
      body: tableBody,
      theme: 'plain',
      margin: { top: 32, right: MARGIN, bottom: 22, left: MARGIN },

      headStyles: {
        fillColor:   C.secondary,
        textColor:   C.subtle,
        fontStyle:   'bold',
        fontSize:    7,
        cellPadding: { top: 4, right: 3, bottom: 4, left: 3 },
        lineWidth:   0,
      },

      bodyStyles: {
        fontSize:    7.5,
        cellPadding: { top: 3.5, right: 3, bottom: 3.5, left: 3 },
        textColor:   C.primary,
        lineColor:   C.border,
        lineWidth:   0.2,
      },

      alternateRowStyles: {
        fillColor: C.altRow,
      },

      footStyles: {
        fillColor:   C.primary,
        textColor:   C.white,
        fontStyle:   'bold',
        fontSize:    7.5,
        cellPadding: { top: 5, right: 3, bottom: 5, left: 3 },
      },

      columnStyles: {
        0: { cellWidth: 22 },                          // Fecha
        1: { cellWidth: 'auto' },                      // Colaborador
        2: { cellWidth: 14, halign: 'center' },        // Cód.
        3: { cellWidth: 20 },                          // Turno
        4: { cellWidth: 18, halign: 'center' },        // Entrada
        5: { cellWidth: 18, halign: 'center' },        // Salida
        6: { cellWidth: 20, halign: 'center' },        // Tardanza
        7: { cellWidth: 18, halign: 'center' },        // Hrs Netas
        8: { cellWidth: 'auto' },                      // Observaciones
      },

      // Row for totals
      foot: [[
        { content: `TOTALES — ${totalRecords} registros`, colSpan: 6, styles: { halign: 'right' } },
        { content: `${totalLate} min` },
        { content: totalHours.toFixed(2) },
        '',
      ]],

      didDrawPage: (data: any) => {
        // Skip page 1 — already drawn manually above
        if (data.pageNumber > 1) {
          pageDecorator(data)
          // Summary bar is only on page 1
        }
      },
    })

    // ── 6c. Signature section (after table) ───────────────────────────────────
    const finalY = (doc as any).lastAutoTable.finalY ?? 200
    const spaceNeeded = 45 // height for signatures

    // Add new page if signatures don't fit
    if (finalY + spaceNeeded > pageHeight - 20) {
      doc.addPage()
      pageDecorator({ doc, pageNumber: (doc as any).internal.pages.length - 1 })
      drawSignatures(doc, 35, pageWidth)
    } else {
      drawSignatures(doc, finalY + 6, pageWidth)
    }

    // ── 7. Return PDF ─────────────────────────────────────────────────────────
    const pdfOutput = doc.output('arraybuffer')

    return new Response(pdfOutput, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="Reporte_Gestor360_${start}_${end}.pdf"`,
      },
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
