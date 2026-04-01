'use client'

import React, { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Search, UserCheck, X } from 'lucide-react'

interface Employee {
  id: string
  first_name: string
  last_name: string
  employee_code: string
  is_active: boolean
  company_id: string
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

  // Cargar empleado seleccionado inicialmente
  useEffect(() => {
    if (selectedEmployeeId) {
      supabase
        .from('employees')
        .select('id, first_name, last_name, employee_code, is_active, company_id')
        .eq('id', selectedEmployeeId)
        .single()
        .then(({ data }) => {
          if (data) setSelected(data as Employee)
        })
    }
  }, [selectedEmployeeId])

  // Búsqueda reactiva
  useEffect(() => {
    if (searchTerm.length < 2) {
      setEmployees([])
      return
    }

    const timer = setTimeout(async () => {
      setIsSearching(true)
      const { data } = await supabase
        .from('employees')
        .select('id, first_name, last_name, employee_code, is_active, company_id')
        .eq('company_id', companyId)
        .or(`first_name.ilike.%${searchTerm}%,last_name.ilike.%${searchTerm}%,employee_code.ilike.%${searchTerm}%`)
        .limit(5)
      
      if (data) setEmployees(data as Employee[])
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
      <div className="flex items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-2xl ring-1 ring-slate-100 transition-all hover:bg-white">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-xl ${selected.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
            <UserCheck size={20} />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-900">{selected.first_name} {selected.last_name}</p>
            <p className="text-[10px] font-medium text-slate-500 uppercase tracking-widest">{selected.employee_code} • {selected.is_active ? 'Activo' : 'Baja (Kill-Switch)'}</p>
          </div>
        </div>
        <button 
          onClick={handleClear}
          className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-400 transition-colors"
        >
          <X size={18} />
        </button>
      </div>
    )
  }

  return (
    <div className="relative">
      <div className="relative group">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-slate-900 transition-colors" />
        <input
          type="text"
          placeholder="Buscar empleado por nombre o código..."
          className="w-full pl-11 pr-6 py-3 bg-white border border-slate-200 focus:border-slate-900 focus:ring-4 focus:ring-slate-900/5 rounded-2xl text-sm transition-all"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        {isSearching && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2">
            <div className="animate-spin h-4 w-4 border-2 border-slate-200 border-t-slate-900 rounded-full" />
          </div>
        )}
      </div>

      {employees.length > 0 && (
        <div className="absolute z-50 w-full mt-2 bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden backdrop-blur-xl bg-white/95">
          {employees.map(emp => (
            <button
              key={emp.id}
              onClick={() => handleSelect(emp)}
              className="w-full flex items-center gap-3 p-3 hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0 text-left"
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${emp.is_active ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                {emp.first_name[0]}{emp.last_name[0]}
              </div>
              <div className="flex-1">
                <p className="text-xs font-bold text-slate-900">{emp.first_name} {emp.last_name}</p>
                <p className="text-[10px] text-slate-500 uppercase tracking-widest">{emp.employee_code}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
