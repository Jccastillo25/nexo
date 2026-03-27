/**
 * page.tsx - Global Planning (Planilla Maestra)
 *
 * Página que integra el sistema de planificación global de turnos.
 * Carga datos de shift_templates, job_positions y global_schedules.
 */

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ScheduleGrid from '../_components/ScheduleGrid'

export const metadata = {
  title: 'Planilla Maestra | Gestor360',
  description: 'Planificación global de turnos por puesto y día de la semana',
}

export default async function GlobalPlanningPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined }
}) {
  const supabase = await createClient()

  // Obtener la compañía del usuario autenticado
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  const { data: companyData, error: companyError } = await supabase
    .from('employees')
    .select('company_id')
    .eq('user_id', user.id)
    .single()

  if (companyError || !companyData?.company_id) {
    redirect('/login')
  }

  const companyId = companyData.company_id

  // Cargar plantillas de turnos
  const { data: templates, error: templatesError } = await supabase
    .from('shift_templates')
    .select('id, name, start_time, end_time, color_code, is_active')
    .eq('company_id', companyId)
    .eq('is_active', true)
    .order('name')

  if (templatesError) {
    console.error('Error loading templates:', templatesError)
  }

  // Cargar puestos de trabajo
  const { data: positions, error: positionsError } = await supabase
    .from('job_positions')
    .select('id, name')
    .eq('company_id', companyId)
    .eq('is_active', true)
    .order('name')

  if (positionsError) {
    console.error('Error loading positions:', positionsError)
  }

  return (
    <section className="space-y-6">
      <ScheduleGrid
        companyId={companyId}
        positions={positions || []}
        shiftTemplates={templates || []}
      />
    </section>
  )
}
