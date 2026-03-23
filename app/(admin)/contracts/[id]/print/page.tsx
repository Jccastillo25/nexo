import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { PrintButton } from './print-button'

/**
 * Sanitiza HTML básico de templates — elimina scripts y atributos
 * de eventos para prevenir XSS. Para producción considerar DOMPurify
 * server-side o una librería dedicada como sanitize-html.
 */
function sanitizeTemplateHtml(html: string): string {
  return html
    // Eliminar tags <script> y su contenido
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    // Eliminar atributos de eventos inline (onclick, onerror, etc.)
    .replace(/\s+on\w+\s*=\s*["'][^"']*["']/gi, '')
    .replace(/\s+on\w+\s*=\s*[^\s>]+/gi, '')
    // Eliminar href javascript:
    .replace(/href\s*=\s*["']javascript:[^"']*["']/gi, 'href="#"')
    // Eliminar tags <iframe>
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    // Eliminar tags <object>
    .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
}

export default async function PrintContractPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  // 1. Fetch contract with employee and shift details
  const { data: contract } = await supabase
    .from('contracts')
    .select(`
      *,
      employees (*),
      shifts (*)
    `)
    .eq('id', id)
    .single()

  if (!contract) notFound()

  // 2. Fetch the current active template (or first one for now)
  const { data: template } = await supabase
    .from('contract_templates')
    .select('*')
    .limit(1)
    .single()

  if (!template) {
    return (
      <div className="p-20 text-center space-y-4">
        <p className="text-slate-500 font-medium">No hay plantillas de contrato configuradas.</p>
        <Link href="/contracts/templates" className="text-sm font-bold text-slate-900 underline">Ir a Plantillas</Link>
      </div>
    )
  }

  // 3. Simple variable substitution
  let content = template.content
  const replacements: Record<string, string> = {
    '{{full_name}}': `${contract.employees.first_name} ${contract.employees.last_name}`,
    '{{salary}}': `$${contract.salary?.toLocaleString()}`,
    '{{shift_name}}': contract.shifts?.name || 'N/A',
    '{{shift_start}}': contract.shifts?.start_time || 'N/A',
    '{{contract_type}}': contract.contract_type || 'N/A',
    '{{start_date}}': new Date(contract.start_date).toLocaleDateString(),
    '{{employee_number}}': contract.employees.employee_number || 'Pendiente'
  }

  Object.entries(replacements).forEach(([key, value]) => {
    // Escapar el valor para prevenir inyección de variables anidadas
    const safeValue = value.replace(/\{\{|\}\}/g, '')
    content = content.replace(new RegExp(key.replace(/[{}]/g, '\\$&'), 'g'), safeValue)
  })

  // 4. Sanitizar el HTML resultante antes de renderizarlo
  const sanitizedContent = sanitizeTemplateHtml(content)

  return (
    <div className="min-h-screen bg-slate-100 py-12 px-4 flex flex-col items-center gap-8 print:bg-white print:py-0 print:px-0">
      {/* Controls - Hidden when printing */}
      <div className="flex w-full max-w-[210mm] justify-between items-center print:hidden">
        <Link href={`/contracts/${id}/edit`} className="text-sm font-bold text-slate-600 hover:text-slate-900 transition">
          ← Volver a Edición
        </Link>
        <PrintButton id={id} />
      </div>

      {/* A4 Document Container */}
      <div className="w-full max-w-[210mm] min-h-[297mm] bg-white shadow-2xl p-[25mm] font-serif text-slate-900 leading-relaxed print:shadow-none print:max-w-none print:min-h-0 print:p-[15mm]">
        <div className="flex justify-between items-start mb-12">
          <div className="space-y-1">
             <h1 className="text-2xl font-bold uppercase tracking-tighter">Contrato de Trabajo</h1>
             <p className="text-xs text-slate-500 font-sans font-bold uppercase tracking-widest">Documento Legal — Gestor360</p>
          </div>
          <div className="text-right font-sans text-[10px] text-slate-400 font-bold uppercase">
             ID: {contract.id.substring(0,8)}...
          </div>
        </div>

        {/* Contenido sanitizado del template */}
        <div 
          className="prose prose-slate max-w-none whitespace-pre-wrap text-[12pt]"
          dangerouslySetInnerHTML={{ __html: sanitizedContent }}
        />

        {/* Signature Area */}
        <div className="mt-24 grid grid-cols-2 gap-20">
          <div className="border-t border-slate-900 pt-4 text-center">
            <p className="text-xs font-bold uppercase">Firma del Colaborador</p>
            <p className="mt-1 text-sm">{contract.employees.first_name} {contract.employees.last_name}</p>
          </div>
          <div className="border-t border-slate-900 pt-4 text-center">
            <p className="text-xs font-bold uppercase">Firma del Empleador</p>
            <p className="mt-1 text-sm font-bold uppercase">GESTOR360 S.A.</p>
          </div>
        </div>
      </div>
      
      <p className="text-xs text-slate-400 font-medium mb-12 print:hidden uppercase tracking-widest">Fin del documento</p>
    </div>
  )
}
