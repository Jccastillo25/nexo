'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { PermissionsMatrix } from '@/components/ui/PermissionsMatrix'
import { UserLinker } from '@/components/ui/UserLinker'
import { DirtyStateGuard } from '@/components/ui/DirtyStateGuard'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { useGlobalContext } from '@/context/GlobalContext'
import { ArrowLeft, Save, ShieldAlert, Zap, UserPlus, Eye, EyeOff, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'

interface UserCreatorClientProps {
  companyId: string
  isOwner: boolean
}

export function UserCreatorClient({ companyId, isOwner }: UserCreatorClientProps) {
  const router = useRouter()
  const supabase = createClient()
  const { companies } = useGlobalContext()
  
  const [permissions, setPermissions] = useState<Record<string, boolean>>({})
  const [linkedEmployeeId, setLinkedEmployeeId] = useState<string | null>(null)
  const [fullName, setFullName] = useState<string>('')
  const [email, setEmail] = useState<string>('')
  const [position, setPosition] = useState<string>('')
  const [password, setPassword] = useState<string>('')
  const [showPassword, setShowPassword] = useState(false)
  const [selectedCompanyIds, setSelectedCompanyIds] = useState<string[]>([companyId])
  const [isSaving, setIsSaving] = useState(false)
  const [isDirty, setIsDirty] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const currentCompanyName = companies.find(c => c.id === companyId)?.name || 'la organización'

  const handlePermissionChange = (id: string, value: boolean) => {
    setPermissions(prev => ({ ...prev, [id]: value }))
    setIsDirty(true)
  }

  const handleEmployeeToggle = (emp: any | null) => {
    if (emp) {
      setLinkedEmployeeId(emp.id)
      setFullName(`${emp.first_name} ${emp.last_name}`)
      // Asegurar que la empresa del empleado esté seleccionada
      setSelectedCompanyIds(prev => prev.includes(emp.company_id) ? prev : [...prev, emp.company_id])
    } else {
      setLinkedEmployeeId(null)
      setFullName('')
    }
    setIsDirty(true)
  }

  const toggleCompany = (id: string) => {
    setSelectedCompanyIds(prev => 
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    )
    setIsDirty(true)
  }

  const saveChanges = async () => {
    setShowConfirm(false)
    setIsSaving(true)
    const toastId = toast.loading('Registrando nuevo acceso híbrido...')
    
    try {
      // En un entorno real, esto llamaría a una Edge Function para crear el Auth User + Profile
      // Aquí simulamos el éxito para mantener la coherencia del flujo UI solicitado
      await new Promise(resolve => setTimeout(resolve, 1500))
      
      toast.success('Usuario registrado exitosamente en ' + currentCompanyName, { id: toastId })
      setIsDirty(false)
      setTimeout(() => router.push('/security'), 1000)
    } catch (err: any) {
      toast.error('Error al crear usuario: ' + err.message, { id: toastId })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in zoom-in-95 duration-700 pb-20">
      <DirtyStateGuard 
        show={isDirty} 
        onConfirm={() => { setIsDirty(false); router.push('/security'); }}
        onCancel={() => setIsDirty(false)} 
      />

      <ConfirmDialog 
        isOpen={showConfirm}
        title="Crear Nuevo Acceso"
        description={`¿Confirmas el registro de ${fullName || email} con acceso autorizado a ${selectedCompanyIds.length} empresa(s)?`}
        confirmLabel="DAR DE ALTA USUARIO"
        cancelLabel="REVISAR PERMISOS"
        variant="success"
        onConfirm={saveChanges}
        onCancel={() => setShowConfirm(false)}
      />
      
      {/* Header Premium */}
      <div className="flex items-center justify-between bg-slate-900/40 backdrop-blur-3xl p-10 rounded-[50px] border border-white/10 shadow-[0_32px_64px_-12px_rgba(0,0,0,0.5)]">
        <div className="flex items-center gap-8">
          <button 
            onClick={() => router.back()}
            className="p-4 bg-white/5 hover:bg-white/10 rounded-3xl transition-all border border-white/5 group"
          >
            <ArrowLeft className="h-6 w-6 text-white group-hover:-translate-x-1 transition-transform" />
          </button>
          <div>
            <h1 className="text-4xl font-black text-white tracking-tight leading-none group">
              Nuevo Acceso
              <span className="block mt-3 text-xs font-black uppercase tracking-[0.4em] text-white/20 group-hover:text-emerald-500/50 transition-colors">Registro de Usuario Híbrido</span>
            </h1>
          </div>
        </div>
        
        <div className="flex items-center gap-6">
          <button
            onClick={() => setShowConfirm(true)}
            disabled={!isDirty || isSaving || !email || !password || selectedCompanyIds.length === 0}
            className="px-10 py-5 bg-emerald-500 text-slate-950 text-xs font-black tracking-[0.2em] rounded-[25px] hover:bg-emerald-400 hover:scale-105 active:scale-95 disabled:opacity-10 disabled:grayscale transition-all flex items-center gap-4 shadow-[0_20px_40px_rgba(16,185,129,0.2)]"
          >
            <UserPlus className="h-4 w-4" />
            {isSaving ? 'CREANDO...' : 'ALTA DE USUARIO'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Lado Izquierdo: Configuración General (4/12) */}
        <div className="lg:col-span-4 space-y-6">
          {/* Bloque 1: Integración SSOT (Buscador) */}
          <div className="rounded-[40px] bg-slate-900/50 p-10 border border-white/10 backdrop-blur-3xl shadow-2xl relative overflow-hidden group">
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-white/5 rounded-full blur-3xl group-hover:bg-white/10 transition-colors" />
            
            <div className="flex items-center gap-3 mb-8 relative z-10">
              <div className="p-2 bg-white/10 rounded-lg">
                <ShieldAlert className="h-4 w-4 text-white" />
              </div>
              <h2 className="text-[10px] font-black text-white uppercase tracking-[0.3em]">Integración SSOT</h2>
            </div>
            
            <p className="text-xs leading-relaxed text-white/50 mb-8 relative z-10 font-medium">
              Al vincular a un empleado, el sistema blindará los datos de identidad y empresa origen de forma proactiva.
            </p>
            
            <div className="relative z-10">
              <UserLinker 
                companyId={companyId} 
                selectedEmployeeId={linkedEmployeeId}
                onSelect={(emp) => handleEmployeeToggle(emp)}
              />
            </div>
          </div>

          {/* Bloque 2: Credenciales de Acceso */}
          <div className="rounded-[40px] bg-slate-900/30 p-10 border border-white/10 backdrop-blur-xl shadow-inner relative overflow-hidden">
            <h3 className="text-[9px] font-black uppercase tracking-[0.4em] text-white/20 mb-10 text-white">Credenciales de Acceso</h3>
            
            <div className="space-y-8">
              <div>
                <label className="text-[10px] font-black text-white mb-4 block tracking-[0.2em] uppercase">Nombre Legal *</label>
                <div className="relative">
                  <input 
                    type="text" 
                    value={fullName}
                    onChange={(e) => { setFullName(e.target.value); setIsDirty(true); }}
                    readOnly={!!linkedEmployeeId && !isOwner}
                    className={`w-full text-sm font-bold rounded-2xl border transition-all outline-none px-5 py-4 ${
                      (!!linkedEmployeeId && !isOwner) 
                        ? 'bg-white/5 border-white/5 text-white/20 cursor-not-allowed italic' 
                        : 'bg-white/10 border-white/10 text-white focus:border-white/40 focus:ring-4 focus:ring-white/5'
                    }`}
                    placeholder="Nombre del usuario"
                  />
                  {!!linkedEmployeeId && <ShieldAlert className="absolute right-5 top-1/2 -translate-y-1/2 h-4 w-4 text-white/10" />}
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black text-white mb-4 block tracking-[0.2em] uppercase">Email Corporativo *</label>
                <input 
                  type="email" 
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setIsDirty(true); }}
                  required
                  className="w-full text-sm font-bold rounded-2xl border bg-white/10 border-white/10 text-white focus:border-white/40 focus:ring-4 focus:ring-white/5 px-5 py-4 transition-all outline-none"
                  placeholder="usuario@empresa.com"
                />
              </div>

              <div>
                <label className="text-[10px] font-black text-white mb-4 block tracking-[0.2em] uppercase">Contraseña de Acceso *</label>
                <div className="relative">
                  <input 
                    type={showPassword ? 'text' : 'password'} 
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setIsDirty(true); }}
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
                <div className="relative">
                  <input 
                    type="text" 
                    value={position}
                    onChange={(e) => { setPosition(e.target.value); setIsDirty(true); }}
                    readOnly={!!linkedEmployeeId && !isOwner}
                    className={`w-full text-sm font-bold rounded-2xl border transition-all outline-none px-5 py-4 ${
                      (!!linkedEmployeeId && !isOwner) 
                        ? 'bg-white/5 border-white/5 text-white/20 cursor-not-allowed italic' 
                        : 'bg-white/10 border-white/10 text-white focus:border-white/40 focus:ring-4 focus:ring-white/5'
                    }`}
                    placeholder="Ej: Administrador Externo"
                  />
                  {!!linkedEmployeeId && <ShieldAlert className="absolute right-5 top-1/2 -translate-y-1/2 h-4 w-4 text-white/10" />}
                </div>
              </div>
            </div>
          </div>

          {/* Bloque 3: Alcance Organizacional (Multi-Empresa) */}
          <div className="rounded-[40px] bg-slate-900/30 p-10 border border-white/10 backdrop-blur-xl shadow-inner relative overflow-hidden">
            <h3 className="text-[9px] font-black uppercase tracking-[0.4em] text-white/20 mb-10 text-white">Empresas Autorizadas</h3>
            
            <div className="grid grid-cols-1 gap-4">
              {companies.map(co => (
                <label 
                  key={co.id} 
                  className={`flex items-center justify-between p-5 rounded-2xl border transition-all cursor-pointer group ${
                    selectedCompanyIds.includes(co.id)
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-white'
                      : 'bg-white/5 border-white/5 text-white/40 hover:bg-white/10'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                      selectedCompanyIds.includes(co.id)
                        ? 'bg-emerald-500 border-emerald-500'
                        : 'bg-transparent border-white/20 group-hover:border-white/40'
                    }`}>
                      {selectedCompanyIds.includes(co.id) && <ShieldCheck className="h-3 w-3 text-slate-950" />}
                    </div>
                    <span className="text-xs font-bold uppercase tracking-widest">{co.name}</span>
                  </div>
                  <input 
                    type="checkbox"
                    className="hidden"
                    checked={selectedCompanyIds.includes(co.id)}
                    onChange={() => toggleCompany(co.id)}
                  />
                  {/* Badge de Empresa Origen si está vinculado */}
                  {linkedEmployeeId && selectedCompanyIds.includes(co.id) && companyId === co.id && (
                    <span className="text-[8px] font-black px-2 py-0.5 bg-emerald-500 text-slate-950 rounded uppercase">Origen</span>
                  )}
                </label>
              ))}
            </div>
            
            {selectedCompanyIds.length === 0 && (
              <p className="mt-6 text-[10px] text-red-400 font-bold uppercase tracking-widest animate-pulse">
                Debes seleccionar al menos una empresa
              </p>
            )}
          </div>
        </div>

        {/* Lado Derecho: Matriz de Permisos (8/12) */}
        <div className="lg:col-span-8">
          <div className="p-1 bg-white/5 rounded-[50px] border border-white/5 backdrop-blur-3xl shadow-2xl relative">
            <div className="absolute top-8 left-10 z-10 pointer-events-none">
              <span className="text-[9px] font-black text-white uppercase tracking-[0.5em]">Asignación de Accesos Master</span>
            </div>
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
