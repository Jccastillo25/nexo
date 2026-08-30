'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { PermissionsMatrix, ROLE_PERMISSION_PRESETS } from '@/components/ui/PermissionsMatrix'
import { UserLinker } from '@/components/ui/UserLinker'
import { DirtyStateGuard } from '@/components/ui/DirtyStateGuard'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { useGlobalContext } from '@/context/GlobalContext'
import { ArrowLeft, UserPlus, Eye, EyeOff, ShieldCheck, Star, ChevronDown } from 'lucide-react'
import { toast } from 'sonner'

interface UserCreatorClientProps {
  companyId: string
  isOwner: boolean
}

type RoleKey = 'owner' | 'admin' | 'rrhh' | 'supervisor' | 'viewer'

const ROLE_OPTIONS: { value: RoleKey; label: string; description: string; color: string }[] = [
  { value: 'owner',      label: 'Propietario',       description: 'Acceso total + configuración del sistema', color: 'text-amber-400 bg-amber-500/10 border-amber-500/30' },
  { value: 'admin',      label: 'Administrador',      description: 'Gestión completa excepto sistema',         color: 'text-blue-400 bg-blue-500/10 border-blue-500/30' },
  { value: 'rrhh',       label: 'Gestor RRHH',        description: 'Empleados, contratos y asistencia',        color: 'text-purple-400 bg-purple-500/10 border-purple-500/30' },
  { value: 'supervisor', label: 'Supervisor Operativo', description: 'Monitor, kioskos y correcciones',        color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' },
  { value: 'viewer',     label: 'Visor de Reportes',  description: 'Solo lectura en reportes y dashboard',     color: 'text-slate-400 bg-slate-500/10 border-slate-500/30' },
]

export function UserCreatorClient({ companyId, isOwner }: UserCreatorClientProps) {
  const router = useRouter()
  const supabase = createClient()
  const { companies } = useGlobalContext()

  const [role, setRole] = useState<RoleKey>('admin')
  const [permissions, setPermissions] = useState<Record<string, boolean>>(ROLE_PERMISSION_PRESETS['admin'])
  const [linkedEmployeeId, setLinkedEmployeeId] = useState<string | null>(null)
  const [fullName, setFullName] = useState<string>('')
  const [email, setEmail] = useState<string>('')
  const [position, setPosition] = useState<string>('')
  const [password, setPassword] = useState<string>('')
  const [showPassword, setShowPassword] = useState(false)
  const [selectedCompanyIds, setSelectedCompanyIds] = useState<string[]>([companyId])
  const [primaryCompanyId, setPrimaryCompanyId] = useState<string | null>(companyId)
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
    setPermissions(ROLE_PERMISSION_PRESETS[newRole])
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
      setEmail(emp.email || '')
      setPosition(jobTitle)

      if (!emp.email) {
        toast.warning('El empleado no tiene un correo corporativo registrado en RRHH.', {
          description: 'Deberá ingresarlo manualmente si es un usuario externo, pero el SSOT quedará incompleto.'
        })
      }

      if (activeContract) {
        setSelectedCompanyIds(prev => prev.includes(activeContract.company_id) ? prev : [...prev, activeContract.company_id])
        setPrimaryCompanyId(activeContract.company_id)
      } else {
        toast.error('No se encontró un contrato activo para este empleado.', {
          description: 'La Empresa Principal no se pudo automatizar.'
        })
      }
    } else {
      setLinkedEmployeeId(null)
      setFullName('')
      setEmail('')
      setPosition('')
      setPrimaryCompanyId(companyId)
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
    const toastId = toast.loading('Registrando nuevo acceso híbrido...')

    try {
      const companiesPayload = selectedCompanyIds.map(cId => ({
        company_id: cId,
        role: cId === primaryCompanyId ? role : 'viewer',
      }))

      const { data, error } = await supabase.functions.invoke('create-user', {
        body: {
          email,
          password,
          full_name: fullName,
          position,
          company_id: primaryCompanyId || companyId,
          linked_employee_id: linkedEmployeeId,
          companies: companiesPayload,
          permissions,
        },
      })

      if (error) {
        let serverMessage = error.message
        try {
          const body = await (error as any).context?.json?.()
          if (body?.error) serverMessage = body.error
        } catch {}
        throw new Error(serverMessage)
      }
      if (data?.error) throw new Error(data.error)

      toast.success('Usuario registrado exitosamente en ' + currentCompanyName, { id: toastId })
      setIsDirty(false)
      setTimeout(() => router.push('/security'), 1000)
    } catch (err: any) {
      toast.error('Error al crear usuario: ' + err.message, { id: toastId, duration: 8000 })
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
        title="Crear Nuevo Acceso"
        description={`¿Confirmas el registro de ${fullName || email} como ${selectedRoleOption.label} con acceso a ${selectedCompanyIds.length} empresa(s)?`}
        confirmLabel="DAR DE ALTA USUARIO"
        cancelLabel="REVISAR PERMISOS"
        variant="success"
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
              Nuevo Acceso
              <span className="block mt-3 text-xs font-black uppercase tracking-[0.4em] text-white/20">Registro de Usuario</span>
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <button
            onClick={() => setShowConfirm(true)}
            disabled={!isDirty || isSaving || !email || !password || selectedCompanyIds.length === 0 || !primaryCompanyId}
            className="px-10 py-5 bg-emerald-500 text-slate-950 text-xs font-black tracking-[0.2em] rounded-[25px] hover:bg-emerald-400 hover:scale-105 active:scale-95 disabled:opacity-10 disabled:grayscale transition-all flex items-center gap-4 shadow-[0_20px_40px_rgba(16,185,129,0.2)]"
          >
            <UserPlus className="h-4 w-4" />
            {isSaving ? 'CREANDO...' : 'ALTA DE USUARIO'}
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
              El rol define el nivel de acceso base. Los permisos granulares en la matriz pueden ajustarse individualmente.
            </p>
          </div>

          {/* Bloque 2: Integración SSOT */}
          <div className="rounded-[40px] bg-slate-900/50 p-10 border border-white/10 backdrop-blur-3xl shadow-2xl relative group z-20">
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-white/5 rounded-full blur-3xl group-hover:bg-white/10 transition-colors pointer-events-none" />
            <h2 className="text-[10px] font-black text-white uppercase tracking-[0.3em] mb-6">Integración SSOT</h2>
            <p className="text-xs leading-relaxed text-white/50 mb-8 font-medium">
              Al vincular a un empleado, el sistema blindará los datos de identidad y empresa de forma automática.
            </p>
            <div className="relative z-10">
              <UserLinker
                companyId={companyId}
                selectedEmployeeId={linkedEmployeeId}
                onSelect={(emp) => handleEmployeeToggle(emp)}
              />
            </div>
          </div>

          {/* Bloque 3: Credenciales */}
          <div className="rounded-[40px] bg-slate-900/30 p-10 border border-white/10 backdrop-blur-xl shadow-inner relative overflow-hidden">
            <h3 className="text-[9px] font-black uppercase tracking-[0.4em] text-white mb-10">Credenciales de Acceso</h3>

            <div className="space-y-8">
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
                        ? 'bg-white/5 border-white/5 text-white/60 cursor-not-allowed'
                        : 'bg-white/10 border-white/10 text-white focus:border-white/40 focus:ring-4 focus:ring-white/5'
                    }`}
                    placeholder="Nombre del usuario"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black text-white mb-4 block tracking-[0.2em] uppercase">Email Corporativo *</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setIsDirty(true) }}
                  required
                  disabled={!!linkedEmployeeId && !isOwner}
                  className={`w-full text-sm font-bold rounded-2xl border transition-all outline-none px-5 py-4 ${
                    (!!linkedEmployeeId && !isOwner)
                      ? 'bg-white/5 border-white/5 text-white/60 cursor-not-allowed'
                      : 'bg-white/10 border-white/10 text-white focus:border-white/40 focus:ring-4 focus:ring-white/5'
                  }`}
                  placeholder="usuario@empresa.com"
                />
              </div>

              <div>
                <label className="text-[10px] font-black text-white mb-4 block tracking-[0.2em] uppercase">Contraseña de Acceso *</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setIsDirty(true) }}
                    required
                    className="w-full text-sm font-bold rounded-2xl border bg-white/10 border-white/10 text-white focus:border-white/40 focus:ring-4 focus:ring-white/5 px-5 py-4 transition-all outline-none pr-14"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 p-2 hover:bg-white/10 rounded-xl transition-colors text-white/40 hover:text-white"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black text-white mb-4 block tracking-[0.2em] uppercase">Cargo Corporativo</label>
                <input
                  type="text"
                  value={position}
                  onChange={(e) => { setPosition(e.target.value); setIsDirty(true) }}
                  disabled={!!linkedEmployeeId && !isOwner}
                  className={`w-full text-sm font-bold rounded-2xl border transition-all outline-none px-5 py-4 ${
                    (!!linkedEmployeeId && !isOwner)
                      ? 'bg-white/5 border-white/5 text-white/60 cursor-not-allowed'
                      : 'bg-white/10 border-white/10 text-white focus:border-white/40 focus:ring-4 focus:ring-white/5'
                  }`}
                  placeholder="Ej: Administrador Externo"
                />
              </div>
            </div>
          </div>

          {/* Bloque 4: Empresas Autorizadas */}
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
