'use client'

import { useState } from 'react'

export function EmployeePinRow({ pin }: { pin: string }) {
  const [isVisible, setIsVisible] = useState(false)

  return (
    <div className="flex items-center gap-3">
      <code className="bg-slate-100 px-2 py-1 rounded font-mono text-indigo-600 font-bold tracking-widest min-w-[3.5rem] text-center">
        {isVisible ? pin : '••••'}
      </code>
      <button
        type="button"
        onClick={() => setIsVisible(!isVisible)}
        className="text-[10px] font-bold uppercase tracking-wider text-blue-600 hover:text-blue-800 transition"
      >
        {isVisible ? 'Ocultar' : 'Ver'}
      </button>
    </div>
  )
}
