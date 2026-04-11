'use client'

import React, { useState } from 'react'
import { Search, Zap } from 'lucide-react'

interface Permission {
  id: string
  label: string
  description: string
  domain: 'Talento' | 'Turnos' | 'Asistencia' | 'Nómina' | 'Sistema' | 'Centro de Control'
}

export const ALL_PERMISSIONS: Permission[] = [
  // Centro de Control
  { id: 'can_view_kpis_talent',     label: 'KPIs de Talento',       description: 'Altas/Bajas, rotación y cumpleaños.',              domain: 'Centro de Control' },
  { id: 'can_view_kpis_attendance', label: 'KPIs de Asistencia',    description: 'Retrasos y ausencias en tiempo real.',             domain: 'Centro de Control' },
  { id: 'can_view_kpis_financial',  label: 'KPIs Financieros',      description: 'Costos de horas extras y totales.',                domain: 'Centro de Control' },
  { id: 'can_view_kpis_hardware',   label: 'KPIs de Hardware',      description: 'Estado de conexión de Kioskos.',                   domain: 'Centro de Control' },
  { id: 'can_manage_kiosks',        label: 'Gestionar Kioskos',     description: 'Configurar dispositivos, marcas y asignaciones.',  domain: 'Centro de Control' },

  // Talento
  { id: 'can_view_employees',    label: 'Ver Empleados',       description: 'Permite listar los empleados de la empresa.',    domain: 'Talento' },
  { id: 'can_manage_employees',  label: 'Gestionar Empleados', description: 'Crear, editar y dar de baja empleados.',         domain: 'Talento' },
  { id: 'can_view_contracts',    label: 'Ver Contratos',       description: 'Acceso a la información contractual.',           domain: 'Talento' },
  { id: 'can_manage_contracts',  label: 'Gestionar Contratos', description: 'Firmar y modificar contratos temporales.',       domain: 'Talento' },

  // Turnos
  { id: 'can_view_shift_templates',   label: 'Ver Plantillas',        description: 'Visualizar turnos maestros.',                    domain: 'Turnos' },
  { id: 'can_manage_shift_templates', label: 'Gestionar Plantillas',  description: 'Crear y editar la matriz de 7 días.',             domain: 'Turnos' },
  { id: 'can_manage_schedules',       label: 'Planificar Horarios',   description: 'Asignaciones masivas de turnos.',                domain: 'Turnos' },

  // Asistencia
  { id: 'can_view_attendance',     label: 'Ver Asistencia',        description: 'Monitor en tiempo real de marcaciones.',         domain: 'Asistencia' },
  { id: 'can_manage_attendance',   label: 'Gestionar Asistencia',  description: 'Corregir marcaciones manuales.',                 domain: 'Asistencia' },
  { id: 'can_approve_corrections', label: 'Aprobar Correcciones',  description: 'Validar solicitudes de empleados.',              domain: 'Asistencia' },
  { id: 'can_manage_leaves',       label: 'Gestionar Permisos',    description: 'Aprobar vacaciones y ausencias.',                domain: 'Asistencia' },

  // Nómina
  { id: 'can_view_reports',   label: 'Ver Reportes',        description: 'Acceso a reportes de asistencia y productividad.', domain: 'Nómina' },
  { id: 'can_view_payroll',   label: 'Ver Nómina',          description: 'Acceso a reportes de horas y días.',               domain: 'Nómina' },
  { id: 'can_manage_payroll', label: 'Gestionar Nómina',    description: 'Cierre de periodos y exportación.',                domain: 'Nómina' },
  { id: 'can_view_salary',    label: 'Ver Salarios',        description: 'Acceso a montos monetarios (Sensible).',           domain: 'Nómina' },

  // Sistema
  { id: 'can_manage_company',  label: 'Gestionar Organización', description: 'Editar empresa, sucursales y membresías.',        domain: 'Sistema' },
  { id: 'can_manage_settings', label: 'Ajustes del Sistema',    description: 'Configuración global de la plataforma.',          domain: 'Sistema' },
  { id: 'can_manage_users',    label: 'Gestionar Usuarios',     description: 'Administrar accesos al sistema.',                 domain: 'Sistema' },
  { id: 'can_manage_roles',    label: 'Gestionar Roles',        description: 'Configuración global de permisos.',               domain: 'Sistema' },
  { id: 'can_view_audit_logs', label: 'Ver Auditoría',          description: 'Trazabilidad completa de acciones.',              domain: 'Sistema' },
  { id: 'can_impersonate',     label: 'Suplantar (Impersonate)', description: 'Botón de pánico/soporte para Owner.',            domain: 'Sistema' },
]

// Plantillas de permisos por rol — norma oficial de Gestor360
export const ROLE_PERMISSION_PRESETS: Record<string, Record<string, boolean>> = {
  owner: Object.fromEntries(ALL_PERMISSIONS.map(p => [p.id, true])),

  admin: Object.fromEntries(ALL_PERMISSIONS.map(p => [
    p.id,
    !['can_impersonate', 'can_manage_roles'].includes(p.id)
  ])),

  rrhh: Object.fromEntries(ALL_PERMISSIONS.map(p => [
    p.id,
    [
      'can_view_kpis_talent', 'can_view_kpis_attendance',
      'can_view_employees', 'can_manage_employees',
      'can_view_contracts', 'can_manage_contracts',
      'can_view_shift_templates', 'can_manage_schedules',
      'can_view_attendance', 'can_manage_attendance',
      'can_approve_corrections', 'can_manage_leaves',
      'can_view_reports', 'can_view_payroll', 'can_manage_payroll',
    ].includes(p.id)
  ])),

  supervisor: Object.fromEntries(ALL_PERMISSIONS.map(p => [
    p.id,
    [
      'can_view_kpis_talent', 'can_view_kpis_attendance', 'can_view_kpis_hardware',
      'can_view_employees',
      'can_view_shift_templates',
      'can_view_attendance', 'can_manage_attendance', 'can_approve_corrections',
      'can_manage_kiosks',
      'can_view_reports',
    ].includes(p.id)
  ])),

  viewer: Object.fromEntries(ALL_PERMISSIONS.map(p => [
    p.id,
    [
      'can_view_kpis_talent', 'can_view_kpis_attendance',
      'can_view_employees',
      'can_view_attendance',
      'can_view_reports', 'can_view_payroll',
    ].includes(p.id)
  ])),
}

const ROLE_LABELS: Record<string, string> = {
  owner:      'Propietario',
  admin:      'Administrador',
  rrhh:       'RRHH',
  supervisor: 'Supervisor',
  viewer:     'Visor',
}

interface PermissionsMatrixProps {
  values: Record<string, boolean>
  onChange: (id: string, value: boolean) => void
  onApplyPreset?: (preset: Record<string, boolean>) => void
}

export function PermissionsMatrix({ values, onChange, onApplyPreset }: PermissionsMatrixProps) {
  const [searchTerm, setSearchTerm] = useState('')

  const filteredPermissions = ALL_PERMISSIONS.filter(p =>
    p.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.domain.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.description.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const domains: Array<Permission['domain']> = ['Centro de Control', 'Talento', 'Turnos', 'Asistencia', 'Nómina', 'Sistema']

  const activeCount = ALL_PERMISSIONS.filter(p => values[p.id]).length

  return (
    <div className="space-y-6 pt-14 px-8 pb-8">

      {/* Plantillas rápidas por Rol */}
      {onApplyPreset && (
        <div className="space-y-3">
          <p className="text-[9px] font-black uppercase tracking-[0.4em] text-white/30 flex items-center gap-2">
            <Zap className="h-3 w-3" />
            Plantilla de Accesos por Rol
          </p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(ROLE_LABELS).map(([role, label]) => (
              <button
                key={role}
                type="button"
                onClick={() => onApplyPreset(ROLE_PERMISSION_PRESETS[role])}
                className="px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl bg-white/5 border border-white/10 text-white/60 hover:bg-white/15 hover:text-white hover:border-white/30 transition-all"
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Buscador */}
      <div className="relative group max-w-2xl mx-auto">
        <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-white transition-colors" />
        <input
          type="text"
          placeholder="Filtrar matriz de accesos (ej. 'Nómina', 'Editar'...)"
          className="w-full pl-14 pr-6 py-4 bg-slate-900/40 backdrop-blur-xl border border-white/10 focus:border-white/30 ring-0 focus:ring-4 focus:ring-white/5 rounded-2xl text-white placeholder:text-slate-500 text-sm transition-all shadow-2xl"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <span className="absolute right-5 top-1/2 -translate-y-1/2 text-[10px] font-black text-white/20">
          {activeCount}/{ALL_PERMISSIONS.length}
        </span>
      </div>

      <div className="grid gap-6 grid-cols-1 md:grid-cols-2">
        {domains.map(domain => {
          const domainPerms = filteredPermissions.filter(p => p.domain === domain)
          if (domainPerms.length === 0) return null

          return (
            <div key={domain} className="rounded-3xl bg-slate-900/50 p-7 border border-white/10 backdrop-blur-3xl shadow-2xl overflow-hidden relative group/card">
              <div className="absolute top-0 right-0 -tr-y-1/2 tr-x-1/2 w-32 h-32 bg-white/5 rounded-full blur-3xl group-hover/card:bg-white/10 transition-colors" />

              <div className="flex items-center justify-between mb-6 relative z-10">
                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-white/40">{domain}</h3>
                <span className="text-[10px] bg-white/10 px-3 py-1 rounded-full font-bold text-white tracking-wider">
                  {domainPerms.length} PERMISOS
                </span>
              </div>

              <div className="space-y-2 relative z-10">
                {domainPerms.map(perm => {
                  const isActive = values[perm.id]
                  return (
                    <div
                      key={perm.id}
                      onClick={() => onChange(perm.id, !isActive)}
                      className={`flex items-start justify-between gap-4 p-3 rounded-2xl transition-all cursor-pointer border ${
                        isActive
                          ? 'bg-white/10 border-white/20 shadow-lg'
                          : 'bg-transparent border-transparent hover:bg-white/5'
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-bold tracking-tight transition-colors ${isActive ? 'text-white' : 'text-white/90'}`}>
                          {perm.label}
                        </p>
                        <p className={`mt-1 text-xs leading-relaxed transition-colors ${isActive ? 'text-white/70' : 'text-white/50'}`}>
                          {perm.description}
                        </p>
                      </div>

                      <div
                        className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border-2 border-transparent transition-all duration-300 ease-in-out ${
                          isActive ? 'bg-white' : 'bg-white/10'
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full shadow-xl ring-0 transition duration-300 ease-in-out ${
                            isActive ? 'translate-x-5 bg-slate-900' : 'translate-x-0 bg-white/40'
                          }`}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {filteredPermissions.length === 0 && (
        <div className="py-20 text-center bg-slate-900/20 rounded-3xl border border-white/5 backdrop-blur-md">
          <Search className="h-10 w-10 text-white/10 mx-auto mb-4" />
          <p className="text-sm font-medium text-white/40">No se encontraron permisos para <span className="text-white">"{searchTerm}"</span></p>
        </div>
      )}
    </div>
  )
}
