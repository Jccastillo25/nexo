/**
 * page.tsx - Global Planning (Planilla Maestra)
 *
 * Página que integra el sistema de planificación global de turnos.
 * Carga datos de shift_templates, job_positions y global_schedules.
 */

import { createClient } from '@/lib/supabase/server'
import ScheduleGrid from '../_components/ScheduleGrid'
import { AlertCircle, Lock } from 'lucide-react'
import Link from 'next/link'
import { getGlobalPlanningData } from '../../../actions/schedules'

export const metadata = {
  title: 'Planilla Maestra | Gestor360',
  description: 'Planificación de turnos por empleado y puesto',
}

export default async function GlobalPlanningPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined }
}) {
  const supabase = await createClient()

  // 1. Obtener usuario auth
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return <AccessDeniedMessage message="No se pudo verificar la sesión del usuario." />
  }

  // 2. Extraer company_id de los metadatos (prioridad Admin Senior)
  const metadataCompanyId = user.user_metadata?.company_id

  // 3. Fallback a la tabla de empleados (para usuarios preexistentes o sin metadata)
  let companyId = metadataCompanyId

  if (!companyId) {
    const { data: employeeData } = await supabase
      .from('employees')
      .select('company_id')
      .eq('user_id', user.id)
      .single()
    
    companyId = employeeData?.company_id
  }

  // 4. Validación Final: ¿Existe la empresa y el usuario tiene acceso?
  if (!companyId) {
    return <AccessDeniedMessage message="Su usuario no tiene una empresa válida asociada en el sistema." />
  }

  const { data: companyExists } = await supabase
    .from('companies')
    .select('id')
    .eq('id', companyId)
    .single()

  // 5. Verificación de Membresía y Rol (Autoridad Final)
  const { data: membershipData } = await supabase
    .from('company_memberships')
    .select('role, is_active')
    .eq('company_id', companyId)
    .eq('user_id', user.id)
    .single()

  if (!membershipData || !membershipData.is_active) {
    return <AccessDeniedMessage message="No tiene una membresía activa en esta empresa." />
  }

  const allowedRoles = ['owner', 'admin']
  if (!allowedRoles.includes(membershipData.role)) {
    return <AccessDeniedMessage message={`Su rol [${membershipData.role}] no tiene permisos para editar la Planilla Maestra.`} />
  }

  // Cargar datos de la planilla (Asignaciones y Plantillas)
  const result = await getGlobalPlanningData(companyId)
  
  if ('error' in result) {
    console.error('Error loading planning data:', result.error)
    return <AccessDeniedMessage message="Error al cargar los datos de planificación." />
  }

  const { assignments, templates } = result.data

  return (
    <section className="space-y-6">
      <ScheduleGrid
        companyId={companyId}
        assignments={assignments || []}
        shiftTemplates={templates || []}
      />
    </section>
  )
}

function AccessDeniedMessage({ message }: { message: string }) {
  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center rounded-3xl border-2 border-dashed border-slate-200 bg-slate-50 p-12 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-red-100 text-red-600">
        <Lock size={32} />
      </div>
      <h2 className="mb-2 text-xl font-bold text-slate-900">Acceso Denegado</h2>
      <p className="mb-8 max-w-sm text-sm text-slate-500">{message}</p>
      <div className="flex gap-4">
        <Link 
          href="/dashboard"
          className="rounded-2xl bg-slate-900 px-6 py-3 text-sm font-bold text-white transition hover:bg-slate-800"
        >
          Ir al Panel Principal
        </Link>
        <Link 
          href="mailto:soporte@gestor360.com"
          className="rounded-2xl border-2 border-slate-200 bg-white px-6 py-3 text-sm font-bold text-slate-600 transition hover:bg-slate-50"
        >
          Contactar Soporte
        </Link>
      </div>
    </div>
  )
}
