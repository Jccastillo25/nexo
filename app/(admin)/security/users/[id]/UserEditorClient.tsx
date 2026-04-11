'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { PermissionsMatrix, ROLE_PERMISSION_PRESETS } from '@/components/ui/PermissionsMatrix'
import { UserLinker } from '@/components/ui/UserLinker'
import { DirtyStateGuard } from '@/components/ui/DirtyStateGuard'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { useGlobalContext } from '@/context/GlobalContext'
import { ArrowLeft, Save, ShieldAlert, Eye, EyeOff, Lock, ShieldCheck, Star, ChevronDown } from 'lucide-react'
import { toast } from 'sonner'

type RoleKey = 'owner' | 'admin' | 'rrhh' | 'supervisor' | 'viewer'

const ROLE_OPTIONS: { value: RoleKey; label: string; description: string; color: string }[] = [
  { value: 'owner',      label: 'Propietario',         description: 'Acceso total + configuración del sistema', color: 'text-amber-400 bg-amber-500/10 border-amber-500/30' },
  { value: 'admin',      label: 'Administrador',        description: 'Gestión completa excepto sistema',         color: 'text-blue-400 bg-blue-500/10 border-blue-500/30' },
  { value: 'rrhh',       label: 'Gestor RRHH',          description: 'Empleados, contratos y asistencia',        color: 'text-purple-400 bg-purple-500/10 border-purple-500/30' },
  { value: 'supervisor', label: 'Supervisor Operativo', description: 'Monitor, kioskos y correcciones',          color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' },
  { value: 'viewer',     label: 'Visor de Reportes',    description: 'Solo lectura en reportes y dashboard',     color: 'text-slate-400 bg-slate-500/10 border-slate-500/30' },
]

interface UserEditorClientProps {
  profile: any
  initialPermissions: any
  initialRole: RoleKey
  initialCompanyIds: string[]
  companyId: string
  isOwner: boolean
}

export function UserEditorClient({ profile, initialPermissions, initialRole, initialCompanyIds, companyId, isOwner }: UserEditorClientProps) {
  const router = useRouter()
  const supabase = createClient()
  const { companies } = useGlobalContext()

  const [role, setRole] = useState<RoleKey>(initialRole)
  const [permissions, setPermissions] = useState<Record<string, boolean>>(initialPermissions || {})
  const [linkedEmployeeId, setLinkedEmployeeId] = useState<string | null>(profile.linked_employee_id)
  const [fullName, setFullName] = useState<string>(profile.full_name || '')
  const [position, setPosition] = useState<string>(profile.position || '')
  const [password, setPassword] = useState<string>('')
  const [showPassword, setShowPassword] = useState(false)
  const [selectedCompanyIds, setSelectedCompanyIds] = useState<string[]>(initialCompanyIds)
  const [primaryCompanyId, setPrimaryCompanyId] = useState<string | null>(profile.company_id)
  const [isSaving, setIsSaving] = useState(false)
  const [isDirty, setIsDirty] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [showExitModal, setShowExitModal] = useState(false)
  const [pendingPath, setPendingPath] = useState<string | null>(null)
  const [showRoleDropdown, setShowRoleDropdown] = useState(false)

  React.useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [isDirty])

  const handleBack = () => {
    if (isDirty) {
      setPendingPath('/security')
      setShowExitModal(true)
    } else {
      router.push('/security')
    }
  }

  const currentCompanyName = companies.find(c => c.id === companyId)?.name || 'la organización'
  const selectedRoleOption = ROLE_OPTIONS.find(r => r.value === role)!

  const handleRoleChange = (newRole: RoleKey) => {
    setRole(newRole)
    setShowRoleDropdown(false)
    setIsDirty(true)
  }

  const handlePermissionChange = (id: string, value: boolean) => {
    setPermissions(prev => ({ ...prev, [id]: value }))
    setIsDirty(true)
  }

  const handleApplyPreset = (preset: Record<string, boolean>) => {
    setPermissions(preset)
    setIsDirty(true)
  }

  const handleEmployeeToggle = (emp: any | null) => {
    if (emp) {
      const activeContract = emp.contracts?.find((c: any) => c.status === 'active')
      const jobTitle = activeContract?.job_positions?.name || ''

      setLinkedEmployeeId(emp.id)
      setFullName(`${emp.first_name} ${emp.last_name}`)
      if (emp.email && emp.email !== profile.email) {
        toast.info('El email en RRHH difiere del email de acceso actual.', {
          description: `RRHH: ${emp.email} | Acceso: ${profile.email}`
        })
      }
      setPosition(jobTitle)

      if (activeContract) {
        setSelectedCompanyIds(prev => prev.includes(activeContract.company_id) ? prev : [...prev, activeContract.company_id])
        setPrimaryCompanyId(activeContract.company_id)
      } else {
        toast.error('No se encontró un contrato activo para este empleado.')
      }
    } else {
      setLinkedEmployeeId(null)
      setFullName(profile.full_name || '')
      setPosition(profile.position || '')
      setPrimaryCompanyId(profile.company_id)
    }
    setIsDirty(true)
  }

  const toggleCompany = (id: string) => {
    setSelectedCompanyIds(prev => {
      const isSelected = prev.includes(id)
      const next = isSelected ? prev.filter(c => c !== id) : [...prev, id]
      if (isSelected && primaryCompanyId === id) {
        setPrimaryCompanyId(next.length > 0 ? next[0] : null)
      }
      return next
    })
    setIsDirty(true)
  }

  const handleSetPrimary = (e: React.MouseEvent, id: string) => {
    e.preventDefault()
    e.stopPropagation()
    if (!!linkedEmployeeId) return
    setPrimaryCompanyId(id)
    setIsDirty(true)
  }

  const saveChanges = async () => {
    setShowConfirm(false)
    setIsSaving(true)
    const toastId = toast.loading('Guardando cambios...')

    try {
      // 1. Actualizar perfil
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          linked_employee_id: linkedEmployeeId,
          full_name: fullName,
          position: position,
          company_id: primaryCompanyId
        })
        .eq('id', profile.id)

      if (profileError) throw profileError

      // 2. Actualizar / crear rol en la membresía principal
      const { error: roleError } = await supabase
        .from('company_memberships')
        .upsert(
          { user_id: profile.id, company_id: companyId, role, is_active: true },
          { onConflict: 'user_id, company_id' }
        )

      if (roleError) throw roleError

      // 3. Sincronizar membresías multi-empresa
      const toAdd = selectedCompanyIds.filter(id => !initialCompanyIds.includes(id))
      const toRemove = initialCompanyIds.filter(id => !selectedCompanyIds.includes(id))

      if (toRemove.length > 0) {
        await supabase.from('company_memberships').delete()
          .eq('user_id', profile.id).in('company_id', toRemove)
      }

      if (toAdd.length > 0) {
        await supabase.from('company_memberships').insert(
          toAdd.map(cId => ({ user_id: profile.id, company_id: cId, role: 'viewer' }))
        )
      }

      // 4. Actualizar permisos granulares
      const { error: permsError } = await supabase
        .from('user_permissions')
        .upsert({
          profile_id: profile.id,
          company_id: companyId,
          ...permissions,
          updated_at: new Date().toISOString()
        }, { onConflict: 'profile_id, company_id' })

      if (permsError) throw permsError

      // 5. Reset de contraseña si se completó el campo
      if (password) {
        const { data: pwData, error: pwError } = await supabase.functions.invoke('update-user-password', {
          body: { target_user_id: profile.id, password, company_id: companyId }
        })
        if (pwError) {
          let serverMessage = pwError.message
          try {
            const body = await (pwError as any).context?.json?.()
            if (body?.error) serverMessage = body.error
          } catch {}
          throw new Error(serverMessage)
        }
        if (pwData?.error) throw new Error(pwData.error)
        setPassword('')
      }

      toast.success(`Cambios aplicados exitosamente en ${currentCompanyName}`, { id: toastId })
      setIsDirty(false)
    } catch (err: any) {
      toast.error('Error al guardar: ' + err.message, { id: toastId })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in zoom-in-95 duration-700 pb-20">
      <DirtyStateGuard
        show={showExitModal}
        onConfirm={() => {
          setIsDirty(false)
          setShowExitModal(false)
          router.push(pendingPath || '/security')
        }}
        onCancel={() => setShowExitModal(false)}
      />

      <ConfirmDialog
        isOpen={showConfirm}
        title="Confirmar Actualización"
        description={`¿Guardar cambios para ${fullName || 'el usuario'} con rol ${selectedRoleOption.label} en ${selectedCompanyIds.length} empresa(s)?`}
        confirmLabel="PROCEDER CON EL GUARDADO"
        cancelLabel="REVISAR DE NUEVO"
        variant="info"
        onConfirm={saveChanges}
        onCancel={() => setShowConfirm(false)}
      />

      {/* Header */}
      <div className="flex items-center justify-between bg-slate-900/40 backdrop-blur-3xl p-10 rounded-[50px] border border-white/10 shadow-[0_32px_64px_-12px_rgba(0,0,0,0.5)]">
        <div className="flex items-center gap-8">
          <button
            onClick={handleBack}
            className="p-4 bg-white/5 hover:bg-white/10 rounded-3xl transition-all border border-white/5 group"
          >
            <ArrowLeft className="h-6 w-6 text-white group-hover:-translate-x-1 transition-transform" />
          </button>
          <div>
            <h1 className="text-4xl font-black text-white tracking-tight leading-none">
              {fullName || profile.email}
              <span className="block mt-3 text-xs font-black uppercase tracking-[0.4em] text-white/20">Administración de Accesos</span>
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <button
            type="button"
            onClick={() => setShowConfirm(true)}
            disabled={!isDirty || isSaving || selectedCompanyIds.length === 0 || !primaryCompanyId}
            className="px-10 py-5 bg-white text-slate-900 text-xs font-black tracking-[0.2em] rounded-[25px] hover:scale-105 active:scale-95 disabled:opacity-10 disabled:grayscale transition-all flex items-center gap-4 shadow-[0_20px_40px_rgba(255,255,255,0.1)]"
          >
            <Save className="h-4 w-4" />
            {isSaving ? 'GUARDANDO...' : 'GUARDAR CAMBIOS'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Columna izquierda (4/12) */}
        <div className="lg:col-span-4 space-y-6">

          {/* Bloque 1: Selector de Rol */}
          <div className="rounded-[40px] bg-slate-900/50 p-10 border border-white/10 backdrop-blur-3xl shadow-2xl relative overflow-hidden">
            <h3 className="text-[9px] font-black uppercase tracking-[0.4em] text-white/40 mb-8">Rol del Sistema</h3>

            <div className="relative">
              <button
                type="button"
                onClick={() => setShowRoleDropdown(!showRoleDropdown)}
                className={`w-full flex items-center justify-between p-5 rounded-2xl border transition-all ${selectedRoleOption.color}`}
              >
                <div className="flex flex-col items-start gap-1">
                  <span className="text-sm font-black uppercase tracking-widest">{selectedRoleOption.label}</span>
                  <span className="text-[10px] font-medium opacity-70">{selectedRoleOption.description}</span>
                </div>
                <ChevronDown className={`h-4 w-4 transition-transform ${showRoleDropdown ? 'rotate-180' : ''}`} />
              </button>

              {showRoleDropdown && (
                <div className="absolute top-full mt-2 left-0 right-0 z-50 rounded-2xl bg-slate-900 border border-white/10 shadow-2xl overflow-hidden">
                  {ROLE_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => handleRoleChange(opt.value)}
                      className={`w-full flex flex-col items-start gap-1 px-5 py-4 text-left transition-colors hover:bg-white/5 border-b border-white/5 last:border-0 ${
                        role === opt.value ? 'bg-white/5' : ''
                      }`}
                    >
                      <span className={`text-xs font-black uppercase tracking-widest ${opt.color.split(' ')[0]}`}>{opt.label}</span>
                      <span className="text-[10px] text-white/40 font-medium">{opt.description}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <p className="mt-4 text-[9px] text-white/30 font-medium leading-relaxed">
              Cambiar el rol actualiza la membresía. Los permisos granulares se pueden ajustar independientemente.
            </p>
          </div>

          {/* Bloque 2: Entidad Dual SSOT */}
          <div className="rounded-[40px] bg-slate-900/50 p-10 border border-white/10 backdrop-blur-3xl shadow-2xl relative overflow-hidden group">
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-white/5 rounded-full blur-3xl group-hover:bg-white/10 transition-colors" />
            <h2 className="text-[10px] font-black text-white uppercase tracking-[0.3em] mb-6">Entidad Dual (SSOT)</h2>
            <p className="text-xs leading-relaxed text-white/50 mb-8 font-medium">
              Vincular a un empleado sincroniza nombre y cargo. <span className="text-white/80">La verdad vive en RRHH.</span>
            </p>
            <div className="relative z-10">
              <UserLinker
                companyId={companyId}
                selectedEmployeeId={linkedEmployeeId}
                onSelect={(emp) => handleEmployeeToggle(emp)}
              />
            </div>
          </div>

          {/* Bloque 3: Metadatos */}
          <div className="rounded-[40px] bg-slate-900/30 p-10 border border-white/10 backdrop-blur-xl shadow-inner relative overflow-hidden">
            <h3 className="text-[9px] font-black uppercase tracking-[0.4em] text-white/40 mb-10">Metadatos e Identidad</h3>

            <div className="space-y-8">
              <div>
                <label className="text-[10px] font-black text-white mb-4 block tracking-[0.2em] uppercase">Email de Identidad (Login)</label>
                <div className="relative">
                  <input
                    type="email"
                    value={profile.email}
                    disabled
                    className="w-full text-sm font-bold rounded-2xl border bg-white/5 border-white/5 text-white/40 cursor-not-allowed italic opacity-50 grayscale px-5 py-4 outline-none"
                  />
                  <ShieldAlert className="absolute right-5 top-1/2 -translate-y-1/2 h-4 w-4 text-white/10" />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black text-white mb-4 block tracking-[0.2em] uppercase">Nombre Legal *</label>
                <div className="relative">
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => { setFullName(e.target.value); setIsDirty(true) }}
                    disabled={!!linkedEmployeeId && !isOwner}
                    className={`w-full text-sm font-bold rounded-2xl border transition-all outline-none px-5 py-4 ${
                      (!!linkedEmployeeId && !isOwner)
                        ? 'bg-white/5 border-white/5 text-white/40 cursor-not-allowed italic opacity-50 grayscale'
                        : 'bg-white/10 border-white/10 text-white focus:border-white/40 focus:ring-4 focus:ring-white/5'
                    }`}
                    placeholder="Nombre del usuario"
                  />
                  {!!linkedEmployeeId && <ShieldAlert className="absolute right-5 top-1/2 -translate-y-1/2 h-4 w-4 text-white/10" />}
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black text-white mb-4 block tracking-[0.2em] uppercase">Cargo Corporativo</label>
                <div className="relative">
                  <input
                    type="text"
                    value={position}
                    onChange={(e) => { setPosition(e.target.value); setIsDirty(true) }}
                    disabled={!!linkedEmployeeId && !isOwner}
                    className={`w-full text-sm font-bold rounded-2xl border transition-all outline-none px-5 py-4 ${
                      (!!linkedEmployeeId && !isOwner)
                        ? 'bg-white/5 border-white/5 text-white/40 cursor-not-allowed italic opacity-50 grayscale'
                        : 'bg-white/10 border-white/10 text-white focus:border-white/40 focus:ring-4 focus:ring-white/5'
                    }`}
                    placeholder="Ej: Administrador Externo"
                  />
                  {!!linkedEmployeeId && <ShieldAlert className="absolute right-5 top-1/2 -translate-y-1/2 h-4 w-4 text-white/10" />}
                </div>
              </div>

              {/* Reset contraseña */}
              <div className="pt-8 border-t border-white/5 space-y-6">
                <div className="flex items-center gap-3 mb-2">
                  <Lock className="h-3 w-3 text-white/30" />
                  <h4 className="text-[9px] font-black uppercase tracking-[0.3em] text-white/40">Reseteo de Credenciales</h4>
                </div>
                <div>
                  <label className="text-[10px] font-black text-white mb-4 block tracking-[0.2em] uppercase">Nueva Contraseña</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => { setPassword(e.target.value); setIsDirty(true) }}
                      className="w-full text-sm font-bold rounded-2xl border bg-white/5 border-white/10 text-white focus:border-white/40 focus:ring-4 focus:ring-white/5 px-5 py-4 transition-all outline-none pr-14"
                      placeholder="Dejar vacío para mantener"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 p-2 hover:bg-white/10 rounded-xl transition-colors text-white/40 hover:text-white"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <p className="mt-4 text-[9px] text-white/20 italic">
                    {password ? 'La nueva clave se guardará como un Hash irreversible.' : 'Contraseña establecida (Cifrada)'}
                  </p>
                </div>
              </div>

              <div className="pt-8 border-t border-white/5">
                <div className="flex justify-between items-center mb-2">
                  <p className="text-[8px] font-black text-white/20 uppercase tracking-[0.2em]">User UUID</p>
                  <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-500 text-[7px] font-black rounded uppercase">Verificado</span>
                </div>
                <p className="text-[10px] font-mono text-white/30 break-all select-all hover:text-white transition-colors cursor-pointer">
                  {profile.id}
                </p>
              </div>
            </div>
          </div>

          {/* Bloque 4: Empresas */}
          <div className="rounded-[40px] bg-slate-900/30 p-10 border border-white/10 backdrop-blur-xl shadow-inner relative overflow-hidden">
            <h3 className="text-[9px] font-black uppercase tracking-[0.4em] text-white mb-10">Empresas Autorizadas</h3>

            <div className="grid grid-cols-1 gap-4">
              {companies.map(co => {
                const isSelected = selectedCompanyIds.includes(co.id)
                const isPrimary = primaryCompanyId === co.id
                const isReadOnly = !!linkedEmployeeId

                return (
                  <div key={co.id} className="relative group/item">
                    <label
                      className={`flex items-center justify-between p-5 rounded-2xl border transition-all cursor-pointer group ${
                        isSelected
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-white'
                          : 'bg-white/5 border-white/5 text-white/40 hover:bg-white/10'
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                          isSelected ? 'bg-emerald-500 border-emerald-500' : 'bg-transparent border-white/20 group-hover:border-white/40'
                        }`}>
                          {isSelected && <ShieldCheck className="h-3 w-3 text-slate-950" />}
                        </div>
                        <span className="text-xs font-bold uppercase tracking-widest">{co.name}</span>
                      </div>

                      <div className="flex items-center gap-3">
                        {isSelected && (
                          <button
                            type="button"
                            onClick={(e) => handleSetPrimary(e, co.id)}
                            disabled={isReadOnly && !isPrimary}
                            className={`p-2 rounded-xl transition-all ${
                              isPrimary
                                ? 'bg-amber-500 text-slate-950 shadow-[0_0_15px_rgba(245,158,11,0.4)]'
                                : isReadOnly
                                  ? 'opacity-0 cursor-default'
                                  : 'bg-white/5 text-white/20 hover:bg-white/20 hover:text-white'
                            }`}
                            title={isPrimary ? 'Empresa Principal' : 'Marcar como Principal'}
                          >
                            <Star className={`h-3 w-3 ${isPrimary ? 'fill-current' : ''}`} />
                          </button>
                        )}

                        <input
                          type="checkbox"
                          className="hidden"
                          checked={isSelected}
                          onChange={() => toggleCompany(co.id)}
                        />

                        {linkedEmployeeId && isSelected && isPrimary && (
                          <span className="text-[8px] font-black px-2 py-0.5 bg-emerald-500 text-slate-950 rounded uppercase">SSOT</span>
                        )}
                      </div>
                    </label>
                  </div>
                )
              })}
            </div>

            {selectedCompanyIds.length === 0 && (
              <p className="mt-6 text-[10px] text-red-400 font-bold uppercase tracking-widest animate-pulse">
                Debes seleccionar al menos una empresa
              </p>
            )}
          </div>

          {!!linkedEmployeeId && (
            <div className="p-6 bg-emerald-500/10 border border-emerald-500/20 rounded-3xl animate-in fade-in slide-in-from-bottom-4 duration-1000">
              <div className="flex items-center gap-4">
                <div className="p-2 bg-emerald-500 rounded-xl">
                  <ShieldCheck className="h-4 w-4 text-slate-950" />
                </div>
                <div>
                  <p className="text-[10px] font-black text-white uppercase tracking-widest">Identidad Vinculada</p>
                  <p className="text-[9px] text-emerald-500/60 font-bold uppercase tracking-widest">Sincronización SSOT Activa</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Columna derecha: Matriz de Permisos (8/12) */}
        <div className="lg:col-span-8">
          <div className="p-1 bg-white/5 rounded-[50px] border border-white/5 backdrop-blur-3xl shadow-2xl relative">
            <div className="absolute top-8 left-10 z-10 pointer-events-none">
              <span className="text-[9px] font-black text-white uppercase tracking-[0.5em]">Matriz de Accesos Granulares</span>
            </div>
            <PermissionsMatrix
              values={permissions}
              onChange={handlePermissionChange}
              onApplyPreset={handleApplyPreset}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
