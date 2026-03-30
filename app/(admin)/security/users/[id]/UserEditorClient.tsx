'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { PermissionsMatrix } from '@/components/ui/PermissionsMatrix'
import { UserLinker } from '@/components/ui/UserLinker'
import { DirtyStateGuard } from '@/components/ui/DirtyStateGuard'
import { ArrowLeft, Save, ShieldAlert, Zap } from 'lucide-react'
import { toast } from 'sonner'

interface UserEditorClientProps {
  profile: any
  initialPermissions: any
  companyId: string
  isOwner: boolean
}

export function UserEditorClient({ profile, initialPermissions, companyId, isOwner }: UserEditorClientProps) {
  const router = useRouter()
  const supabase = createClient()
  
  const [permissions, setPermissions] = useState<Record<string, boolean>>(initialPermissions || {})
  const [linkedEmployeeId, setLinkedEmployeeId] = useState<string | null>(profile.linked_employee_id)
  const [isSaving, setIsSaving] = useState(false)
  const [isDirty, setIsDirty] = useState(false)

  const handlePermissionChange = (id: string, value: boolean) => {
    setPermissions(prev => ({ ...prev, [id]: value }))
    setIsDirty(true)
  }

  const handleEmployeeToggle = (id: string | null) => {
    setLinkedEmployeeId(id)
    setIsDirty(true)
  }

  const saveChanges = async () => {
    setIsSaving(true)
    try {
      // 1. Actualizar vinculo de empleado en profile
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ linked_employee_id: linkedEmployeeId })
        .eq('id', profile.id)

      if (profileError) throw profileError

      // 2. Actualizar o Insertar permisos
      const { error: permsError } = await supabase
        .from('user_permissions')
        .upsert({
          profile_id: profile.id,
          company_id: companyId,
          ...permissions,
          updated_at: new Date().toISOString()
        }, { onConflict: 'profile_id, company_id' })

      if (permsError) throw permsError

      toast.success('Permisos y vinculación actualizados correctamente.')
      setIsDirty(false)
    } catch (err: any) {
      toast.error('Error al guardar: ' + err.message)
    } finally {
      setIsSaving(false)
    }
  }

  const handleImpersonate = async () => {
    // Lógica futura de suplantación
    toast.info('Iniciando sesión como ' + profile.full_name)
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
      <DirtyStateGuard 
        show={isDirty} 
        onConfirm={() => { setIsDirty(false); router.push('/security'); }}
        onCancel={() => setIsDirty(false)} 
      />
      
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => router.back()}
            className="p-2 hover:bg-slate-100 rounded-full transition-colors"
          >
            <ArrowLeft className="h-6 w-6 text-slate-500" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{profile.full_name || profile.email}</h1>
            <p className="text-sm text-slate-500">Configuración de seguridad y acceso granular</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {isOwner && profile.id !== (profile.own_id) && (
            <button
              onClick={handleImpersonate}
              className="px-4 py-2 bg-amber-50 text-amber-700 text-sm font-bold rounded-2xl hover:bg-amber-100 transition-colors flex items-center gap-2"
            >
              <Zap className="h-4 w-4" />
              Suplantar
            </button>
          )}
          <button
            onClick={saveChanges}
            disabled={!isDirty || isSaving}
            className="px-6 py-2 bg-slate-900 text-white text-sm font-bold rounded-2xl hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2 shadow-lg shadow-slate-900/20"
          >
            <Save className="h-4 w-4" />
            {isSaving ? 'Guardando...' : 'Guardar Cambios'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Lado Izquierdo: Configuración General */}
        <div className="lg:col-span-1 space-y-6">
          <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <div className="flex items-center gap-2 mb-4">
              <ShieldAlert className="h-5 w-5 text-slate-900" />
              <h2 className="text-sm font-bold text-slate-900">Entidad Dual</h2>
            </div>
            <p className="text-xs text-slate-500 mb-4">
              Vincula este usuario a un empleado para habilitar el filtrado del 'Monitor 360' y el Kill-Switch automático.
            </p>
            <UserLinker 
              companyId={companyId} 
              selectedEmployeeId={linkedEmployeeId}
              onSelect={handleEmployeeToggle}
            />
          </div>

          <div className="rounded-3xl bg-slate-50 p-6 border border-slate-200">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">Información de Perfil</h3>
            <div className="space-y-3">
              <div>
                <p className="text-[10px] text-slate-400">EMAIL</p>
                <p className="text-sm font-medium">{profile.email}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-400">ID DE USUARIO</p>
                <p className="text-[10px] font-mono text-slate-500 break-all">{profile.id}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Lado Derecho: Matriz de Permisos */}
        <div className="lg:col-span-2">
          <div className="bg-slate-50/50 rounded-[40px] p-2 ring-1 ring-slate-200/50">
            <PermissionsMatrix 
              values={permissions}
              onChange={handlePermissionChange}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
