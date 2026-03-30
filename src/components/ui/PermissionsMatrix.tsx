'use client'

import React, { useState } from 'react'
import { Search } from 'lucide-react'

interface Permission {
  id: string
  label: string
  description: string
  domain: 'Talento' | 'Turnos' | 'Asistencia' | 'Nómina' | 'Sistema'
}

const ALL_PERMISSIONS: Permission[] = [
  { id: 'can_view_employees', label: 'Ver Empleados', description: 'Permite listar los empleados de la empresa.', domain: 'Talento' },
  { id: 'can_manage_employees', label: 'Gestionar Empleados', description: 'Crear, editar y dar de baja empleados.', domain: 'Talento' },
  { id: 'can_view_contracts', label: 'Ver Contratos', description: 'Acceso a la información contractual.', domain: 'Talento' },
  { id: 'can_manage_contracts', label: 'Gestionar Contratos', description: 'Firmar y modificar contratos temporales.', domain: 'Talento' },
  
  { id: 'can_view_shift_templates', label: 'Ver Plantillas', description: 'Visualizar turnos maestros.', domain: 'Turnos' },
  { id: 'can_manage_shift_templates', label: 'Gestionar Plantillas', description: 'Crear y editar la matriz de 7 días.', domain: 'Turnos' },
  { id: 'can_manage_schedules', label: 'Planificar Horarios', description: 'Asignaciones masivas de turnos.', domain: 'Turnos' },
  
  { id: 'can_view_attendance', label: 'Ver Asistencia', description: 'Monitor en tiempo real de marcaciones.', domain: 'Asistencia' },
  { id: 'can_manage_attendance', label: 'Gestionar Asistencia', description: 'Corregir marcaciones manuales.', domain: 'Asistencia' },
  { id: 'can_approve_corrections', label: 'Aprobar Correcciones', description: 'Validar solicitudes de empleados.', domain: 'Asistencia' },
  { id: 'can_manage_leaves', label: 'Gestionar Permisos', description: 'Aprobar vacaciones y ausencias.', domain: 'Asistencia' },
  
  { id: 'can_view_payroll', label: 'Ver Nómina', description: 'Acceso a reportes de horas y días.', domain: 'Nómina' },
  { id: 'can_manage_payroll', label: 'Gestionar Nómina', description: 'Cierre de periodos y exportación.', domain: 'Nómina' },
  { id: 'can_view_salary', label: 'Ver Salarios', description: 'Acceso a montos monetarios (Sensible).', domain: 'Nómina' },
  
  { id: 'can_manage_users', label: 'Gestionar Usuarios', description: 'Administrar accesos al sistema.', domain: 'Sistema' },
  { id: 'can_manage_roles', label: 'Gestionar Roles', description: 'Configuración global de permisos.', domain: 'Sistema' },
  { id: 'can_view_audit_logs', label: 'Ver Auditoría', description: 'Trazabilidad completa de acciones.', domain: 'Sistema' },
  { id: 'can_impersonate', label: 'Suplantar (Impersonate)', description: 'Botón de pánico/soporte para Owner.', domain: 'Sistema' },
]

interface PermissionsMatrixProps {
  values: Record<string, boolean>
  onChange: (id: string, value: boolean) => void
}

export function PermissionsMatrix({ values, onChange }: PermissionsMatrixProps) {
  const [searchTerm, setSearchTerm] = useState('')

  const filteredPermissions = ALL_PERMISSIONS.filter(p => 
    p.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.domain.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.description.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const domains: Array<Permission['domain']> = ['Talento', 'Turnos', 'Asistencia', 'Nómina', 'Sistema']

  return (
    <div className="space-y-6">
      {/* Selector de búsqueda */}
      <div className="relative group">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-slate-900 transition-colors" />
        <input
          type="text"
          placeholder="Buscar permiso (ej. 'Nómina', 'Editar'...)"
          className="w-full pl-12 pr-6 py-3.5 bg-slate-50 border-none ring-1 ring-slate-200 focus:ring-2 focus:ring-slate-900 rounded-2xl text-sm transition-all"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="grid gap-8 grid-cols-1 md:grid-cols-2">
        {domains.map(domain => {
          const domainPerms = filteredPermissions.filter(p => p.domain === domain)
          if (domainPerms.length === 0) return null

          return (
            <div key={domain} className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 backdrop-blur-xl bg-white/70">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold uppercase tracking-widest text-slate-400">{domain}</h3>
                <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded-full font-semibold text-slate-600">
                  {domainPerms.length} activos
                </span>
              </div>
              
              <div className="space-y-4">
                {domainPerms.map(perm => (
                  <div key={perm.id} className="flex items-start justify-between gap-4 p-2 -mx-2 rounded-xl hover:bg-slate-50/50 transition-colors group">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-900 leading-none">{perm.label}</p>
                      <p className="mt-1 text-xs text-slate-500 line-clamp-1 group-hover:line-clamp-none transition-all">
                        {perm.description}
                      </p>
                    </div>
                    
                    <button
                      type="button"
                      onClick={() => onChange(perm.id, !values[perm.id])}
                      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2 ${
                        values[perm.id] ? 'bg-slate-900' : 'bg-slate-200'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          values[perm.id] ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
      
      {filteredPermissions.length === 0 && (
        <div className="py-12 text-center">
          <p className="text-sm text-slate-400">No se encontraron permisos que coincidan con la búsqueda.</p>
        </div>
      )}
    </div>
  )
}
