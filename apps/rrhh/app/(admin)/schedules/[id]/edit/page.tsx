import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { ShiftForm } from '../../new/shift-form'

export default async function EditShiftPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: shift } = await supabase
    .from('shifts')
    .select('*')
    .eq('id', id)
    .single()

  if (!shift) {
    notFound()
  }

  return (
    <section className="space-y-6">
      <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <h1 className="text-2xl font-bold text-slate-900">Editar Turno</h1>
        <p className="mt-2 text-sm text-slate-500">
          Modifica los detalles del turno "{shift.name}".
        </p>
      </div>

      <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <ShiftForm initialData={shift} id={id} />
      </div>
    </section>
  )
}
