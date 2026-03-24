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
      <div className="flex h-64 items-center justify-center rounded-3xl bg-white shadow-sm ring-1 ring-slate-200">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    )
  }

  if (employees.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-3xl bg-white p-12 shadow-sm ring-1 ring-slate-200">
        <Users size={48} className="text-slate-200" />
        <p className="mt-4 text-sm text-slate-500">No hay empleados activos en esta empresa.</p>
      </div>
    )
  }

  const renderNode = (node: HierarchyNode, depth: number = 0) => {
    return (
      <div key={node.employee.id} className="space-y-4">
        <div style={{ marginLeft: `${depth * 40}px` }}>
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
    <div className="space-y-6">
      <div className="flex items-center justify-between px-2">
        <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400">
          Personal bajo supervisión
        </h2>
        <span className="text-xs font-medium text-slate-400">
          {employees.length} colaboradores
        </span>
      </div>
      
      <div className="space-y-6">
        {hierarchy.map((root) => renderNode(root))}
      </div>
    </div>
  )
}
