import { createClient } from '@/lib/supabase/server'
import { getGlobalPlanningData } from '../../../actions/schedules'
import TemplateCatalog from '../_components/TemplateCatalog'
import { Lock } from 'lucide-react'
import Link from 'next/link'

export const metadata = {
  title: 'Catálogo de Turnos | Gestor360',
  description: 'Administración visual de patrones y plantillas de turnos',
}

export default async function TemplatesPage() {
  const supabase = await createClient()

  // 1. Obtener usuario auth
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return <AccessDeniedMessage message="No se pudo verificar la sesión." />

  // 2. Extraer company_id
  let companyId = user.user_metadata?.company_id
  if (!companyId) {
    const { data: employeeData } = await supabase
      .from('employees')
      .select('company_id')
      .eq('user_id', user.id)
      .single()
    companyId = employeeData?.company_id
  }

  if (!companyId) return <AccessDeniedMessage message="Empresa no asociada." />

  // 3. Verificación de Rol
  const { data: membershipData } = await supabase
    .from('company_memberships')
    .select('role, is_active')
    .eq('company_id', companyId)
    .eq('user_id', user.id)
    .single()

  if (!membershipData || !membershipData.is_active || !['owner', 'admin'].includes(membershipData.role)) {
    return <AccessDeniedMessage message="No tiene permisos para administrar el catálogo." />
  }

  // 4. Cargar plantillas
  const result = await getGlobalPlanningData(companyId)
  if ('error' in result) return <AccessDeniedMessage message="Error al cargar datos." />

  const { templates } = result.data

  return (
    <section className="space-y-6">
      <TemplateCatalog 
        companyId={companyId} 
        initialTemplates={templates || []} 
      />
    </section>
  )
}

function AccessDeniedMessage({ message }: { message: string }) {
  return (
    <div className="flex h-[400px] flex-col items-center justify-center rounded-3xl border-2 border-dashed border-slate-200 bg-slate-50 p-12 text-center">
      <Lock size={32} className="text-red-600 mb-4" />
      <h2 className="text-xl font-bold text-slate-900">Acceso Denegado</h2>
      <p className="text-sm text-slate-500 mb-8">{message}</p>
      <Link href="/dashboard" className="rounded-2xl bg-slate-900 px-6 py-3 text-sm font-bold text-white transition hover:bg-slate-800">
        Volver al Panel
      </Link>
    </div>
  )
}
