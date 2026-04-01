'use client'

import React, { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Search, UserCheck, X } from 'lucide-react'

interface Employee {
  id: string
  first_name: string
  last_name: string
  employee_code: string
  email: string
  national_id: string
  is_active: boolean
  company_id: string
  contracts?: {
    company_id: string
    job_positions: {
      name: string
    }
    status: string
  }[]
}

interface UserLinkerProps {
  companyId: string
  selectedEmployeeId?: string | null
  onSelect: (employee: Employee | null) => void
}

export function UserLinker({ companyId, selectedEmployeeId, onSelect }: UserLinkerProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [employees, setEmployees] = useState<Employee[]>([])
  const [selected, setSelected] = useState<Employee | null>(null)
  const [isSearching, setIsSearching] = useState(false)
  const supabase = createClient()

  const EMPLOYEE_FIELDS = 'id, first_name, last_name, employee_code, email, national_id, is_active, company_id, contracts(company_id, status, job_positions(name))'

  // Cargar empleado seleccionado inicialmente
  useEffect(() => {
    if (selectedEmployeeId) {
      supabase
        .from('employees')
        .select(EMPLOYEE_FIELDS)
        .eq('id', selectedEmployeeId)
        .single()
        .then(({ data }) => {
          if (data) setSelected(data as unknown as Employee)
        })
    }
  }, [selectedEmployeeId])

  // Búsqueda reactiva
  useEffect(() => {
    if (searchTerm.length < 3) {
      setEmployees([])
      return
    }

    const timer = setTimeout(async () => {
      setIsSearching(true)
      const { data } = await supabase
        .from('employees')
        .select(EMPLOYEE_FIELDS)
        .or(`first_name.ilike.%${searchTerm}%,last_name.ilike.%${searchTerm}%,employee_code.ilike.%${searchTerm}%,national_id.ilike.%${searchTerm}%`)
        .limit(5)
      
      if (data) setEmployees(data as unknown as Employee[])
      setIsSearching(false)
    }, 300)

    return () => clearTimeout(timer)
  }, [searchTerm, companyId])

  const handleSelect = (emp: Employee) => {
    setSelected(emp)
    onSelect(emp)
    setSearchTerm('')
    setEmployees([])
  }

  const handleClear = () => {
    setSelected(null)
    onSelect(null)
  }

  if (selected) {
    return (
      <div className="flex items-center justify-between p-4 bg-slate-900 border border-white/10 rounded-2xl ring-1 ring-white/5 transition-all hover:bg-slate-800">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-xl ${selected.is_active ? 'bg-emerald-500 text-slate-950' : 'bg-red-500 text-white'}`}>
            <UserCheck size={20} />
          </div>
          <div>
            <p className="text-sm font-bold text-white">{selected.first_name} {selected.last_name}</p>
            <p className="text-[10px] font-black text-white/40 uppercase tracking-widest">{selected.employee_code} • {selected.is_active ? 'Identidad Vinculada' : 'Baja (Kill-Switch)'}</p>
          </div>
        </div>
        <button 
          onClick={handleClear}
          className="p-1.5 hover:bg-white/10 rounded-lg text-white/20 hover:text-white transition-colors"
        >
          <X size={18} />
        </button>
      </div>
    )
  }

  return (
    <div className="relative">
      <div className="relative group">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30 group-focus-within:text-white transition-colors" />
        <input
          type="text"
          placeholder="Nombre, Cédula o Código..."
          className="w-full pl-11 pr-6 py-3 bg-white/5 border border-white/10 focus:border-white/40 focus:ring-4 focus:ring-white/5 rounded-2xl text-sm text-white transition-all placeholder:text-white/20"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        {isSearching && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2">
            <div className="animate-spin h-4 w-4 border-2 border-white/10 border-t-white rounded-full" />
          </div>
        )}
      </div>

      {employees.length > 0 && (
        <div className="absolute z-[9999] w-full mt-2 bg-slate-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden backdrop-blur-3xl animate-in fade-in slide-in-from-top-2 duration-300">
          {employees.map(emp => {
            const activeContract = emp.contracts?.find(c => c.status === 'active')
            const jobTitle = activeContract?.job_positions?.name || 'Sin cargo asignado'
            
            return (
              <button
                key={emp.id}
                onClick={() => handleSelect(emp)}
                className="w-full flex items-center gap-4 p-4 hover:bg-white/5 transition-all border-b border-white/5 last:border-0 text-left group"
              >
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-xs font-black ${emp.is_active ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
                  {emp.first_name[0]}{emp.last_name[0]}
                </div>
                <div className="flex-1">
                  <p className="text-xs font-black text-white group-hover:text-emerald-400 transition-colors uppercase tracking-widest">{emp.first_name} {emp.last_name}</p>
                  <p className="text-[9px] text-white/30 font-bold uppercase tracking-[0.2em] mt-1">
                    {emp.national_id || 'SIN CÉDULA'} <span className="mx-2 text-white/10">|</span> {jobTitle}
                  </p>
                </div>
                {activeContract && (
                  <div className="px-2 py-1 bg-white/5 rounded-lg border border-white/5">
                    <span className="text-[8px] font-black text-white/20 uppercase">Activo</span>
                  </div>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
