import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function TemplatesPage() {
  const supabase = await createClient()

  const { data: templates } = await supabase
    .from('contract_templates')
    .select('*')
    .order('created_at', { ascending: false })

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between gap-4 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Plantillas de Contrato</h1>
          <p className="text-sm text-slate-500">Define el contenido legal con variables como {"{{nombre_empleado}}"}.</p>
        </div>
        <Link
          href="/contracts/templates/new"
          className="shrink-0 rounded-2xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
        >
          + Nueva Plantilla
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {templates?.map((template) => (
          <div key={template.id} className="group relative rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 transition hover:ring-slate-300">
            <h3 className="font-bold text-slate-900">{template.title}</h3>
            <p className="mt-2 text-xs text-slate-500 line-clamp-3 leading-relaxed">
              {template.content.replace(/<[^>]*>/g, '')}
            </p>
            <div className="mt-6 flex items-center gap-2">
               <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500 uppercase">
                 v1.0
               </span>
            </div>
          </div>
        ))}

        {(!templates || templates.length === 0) && (
          <div className="sm:col-span-2 lg:col-span-3 rounded-3xl border-2 border-dashed border-slate-200 p-12 text-center text-slate-400">
            No hay plantillas creadas todavía.
          </div>
        )}
      </div>

      <div className="rounded-2xl bg-slate-900 p-6 text-white shadow-xl">
        <h4 className="text-sm font-bold uppercase tracking-wider text-slate-400">Variables Disponibles</h4>
        <div className="mt-4 flex flex-wrap gap-2">
          {['{{full_name}}', '{{salary}}', '{{shift_name}}', '{{shift_start}}', '{{contract_type}}'].map(v => (
            <code key={v} className="rounded-lg bg-white/10 px-2 py-1 text-xs font-mono text-slate-200">
              {v}
            </code>
          ))}
        </div>
      </div>
    </section>
  )
}
