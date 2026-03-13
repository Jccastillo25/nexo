import Link from 'next/link'
import { ShiftForm } from './shift-form'

export default function NewShiftPage() {
  return (
    <section className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/schedules"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-500 shadow-sm ring-1 ring-slate-200 transition hover:bg-slate-50 hover:text-slate-900"
        >
          ←
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Nuevo turno</h1>
          <p className="text-sm text-slate-500">Configura un nuevo horario de operación.</p>
        </div>
      </div>

      <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-8">
        <ShiftForm />
      </div>
    </section>
  )
}
