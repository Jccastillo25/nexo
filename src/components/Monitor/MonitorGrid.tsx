'use client'

import React, { useMemo } from 'react'
import { EmployeeCard } from './EmployeeCard'
import { useAttendanceRealtime } from '@/hooks/useAttendanceRealtime'
import { Loader2, Users } from 'lucide-react'

interface Props {
  companyId: string
  onOpenActionDrawer: (employee: any) => void
}

interface HierarchyNode {
  employee: any
  children: HierarchyNode[]
}

export const MonitorGrid = ({ companyId, onOpenActionDrawer }: Props) => {
  const { employees, isLoading } = useAttendanceRealtime(companyId)

  // Build hierarchy
  const hierarchy = useMemo(() => {
    if (!employees.length) return []

    const nodesMap: Record<string, HierarchyNode> = {}
    const roots: HierarchyNode[] = []

    // 1. Create nodes
    employees.forEach((emp) => {
      nodesMap[emp.id] = { employee: emp, children: [] }
    })

    // 2. Link children to parents
    employees.forEach((emp) => {
      const parentJobId = emp.job_positions?.parent_id
      // Find a supervisor who has this job_position_id as their job_position.id
      // NOTE: The blueprint says parent_id is in job_positions.
      // So we group by job_position hierarchy.
      
      // Let's find the "parent" in terms of job position
      const parentNode = employees.find(e => e.job_position_id === parentJobId)
      
      if (parentNode && nodesMap[parentNode.id]) {
        nodesMap[parentNode.id].children.push(nodesMap[emp.id])
      } else if (!parentJobId || !parentNode) {
        // If no parent or parent not found in current list, it's a root
        // But wait, many employees might share the same job position.
        // For simplicity in V1, we'll group by Job Position Hierarchy if parent_id is set.
        roots.push(nodesMap[emp.id])
      }
    })

    // Filter out nodes that were linked as children from the roots list if they were added twice
    // (This logic needs to be robust for multiple employees in same position)
    const linkedIds = new Set<string>()
    Object.values(nodesMap).forEach(node => {
      node.children.forEach(child => linkedIds.add(child.employee.id))
    })

    return roots.filter(root => !linkedIds.has(root.employee.id))
  }, [employees])

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center app-surface">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    )
  }

  if (employees.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center app-surface p-12">
        <Users size={48} className="text-slate-600" />
        <p className="mt-4 text-sm font-medium text-slate-400">No hay empleados activos en esta empresa.</p>
      </div>
    )
  }

  const renderNode = (node: HierarchyNode, depth: number = 0) => {
    return (
      <div key={node.employee.id} className="relative space-y-4">
        {/* Hierarchical Line */}
        {depth > 0 && (
          <div 
            className="absolute -left-6 top-10 bottom-0 w-px bg-gradient-to-b from-blue-500/30 to-transparent" 
            style={{ left: `-${20}px` }}
          />
        )}
        
        <div style={{ marginLeft: `${depth * 32}px` }} className="relative">
          <EmployeeCard 
            employee={node.employee} 
            onOpenDrawer={onOpenActionDrawer} 
          />
        </div>
        
        {node.children.length > 0 && (
          <div className="space-y-4">
            {node.children.map((child) => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-8 app-surface p-8">
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-3">
          <div className="h-8 w-1 bg-blue-500 rounded-full shadow-[0_0_10px_rgba(59,130,246,0.5)]" />
          <h2 className="text-sm font-black uppercase tracking-[0.3em] text-white">
            Jerarquía de Personal
          </h2>
        </div>
        <span className="flex items-center gap-2 rounded-xl bg-blue-500/10 px-4 py-2 border border-blue-500/20 shadow-lg shadow-blue-500/10 text-[10px] font-black uppercase tracking-widest text-blue-400">
          {employees.length} EN VIVO
        </span>
      </div>
      
      <div className="space-y-6">
        {hierarchy.map((root) => renderNode(root))}
      </div>
    </div>
  )
}
