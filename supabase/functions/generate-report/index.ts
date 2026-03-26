import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { jsPDF } from "https://esm.sh/jspdf@2.5.1"
import "https://esm.sh/jspdf-autotable@3.5.25"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { start, end, company_id, branch_id } = await req.json()
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 1. Fetch Consolidated Data using the Master Query logic
    // We use a query similar to the view I drafted
    let query = supabase
      .from('consolidated_attendance_view')
      .select('*')
      .gte('attendance_date', start)
      .lte('attendance_date', end)

    if (branch_id && branch_id !== 'all') {
      query = query.eq('branch_id', branch_id)
    }

    const { data: records, error: fetchError } = await query
    if (fetchError) throw fetchError

    // 2. Integrity Check (Backend Validation)
    // Even if the frontend caught it, we double check here
    const issues = records.filter(r => r.missing_clock_out)
    if (issues.length > 0) {
      return new Response(
        JSON.stringify({ error: 'Integrity Failure', details: issues }), 
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 3. Create PDF
    const doc = new jsPDF()
    
    // Header
    doc.setFont("inter", "bold")
    doc.setFontSize(18)
    doc.text("Grupo Castillo Torres S.A.", 105, 20, { align: "center" })
    doc.setFontSize(14)
    doc.text("Reporte de Asistencia y Puntualidad", 105, 30, { align: "center" })
    doc.setFontSize(10)
    doc.setFont("inter", "normal")
    doc.text(`Periodo: ${start} al ${end}`, 105, 38, { align: "center" })

    // Table Data
    const tableHeaders = [
      ["Fecha", "Colaborador", "Turno", "Entrada", "Salida", "Tardanza (Min)", "Horas Netas", "Observaciones"]
    ]

    const tableRows = records.map(r => {
      const inTime = r.clock_in ? new Date(r.clock_in).toLocaleTimeString('es-NI', { hour: '2-digit', minute: '2-digit', hour12: true }) : '---'
      const outTime = r.clock_out ? new Date(r.clock_out).toLocaleTimeString('es-NI', { hour: '2-digit', minute: '2-digit', hour12: true }) : '---'
      
      return [
        r.attendance_date,
        r.full_name,
        r.shift_name,
        inTime,
        outTime,
        r.late_minutes > 0 ? { content: `${r.late_minutes} min`, styles: { fontStyle: 'bold', textColor: [200, 0, 0] } } : "0",
        r.net_hours.toFixed(2),
        r.observations
      ]
    })

    // @ts-ignore: jspdf-autotable is added to jsPDF prototype
    doc.autoTable({
      startY: 45,
      head: tableHeaders,
      body: tableRows,
      theme: 'striped',
      headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontSize: 8 },
      bodyStyles: { fontSize: 8 },
      alternateRowStyles: { fillColor: [247, 250, 252] },
      margin: { top: 45 },
    })

    // Footer Signatures
    const finalY = (doc as any).lastAutoTable.finalY + 30
    const pageWidth = doc.internal.pageSize.getWidth()
    
    doc.line(20, finalY, 70, finalY)
    doc.text("Elaborado por (RRHH)", 45, finalY + 5, { align: "center" })

    doc.line(pageWidth/2 - 25, finalY, pageWidth/2 + 25, finalY)
    doc.text("Revisado por (Gerencia)", pageWidth/2, finalY + 5, { align: "center" })

    doc.line(pageWidth - 70, finalY, pageWidth - 20, finalY)
    doc.text("Autorizado - Julio Castillo", pageWidth - 45, finalY + 5, { align: "center" })

    // Return PDF as ArrayBuffer
    const pdfOutput = doc.output('arraybuffer')
    
    return new Response(pdfOutput, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/pdf',
      },
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
