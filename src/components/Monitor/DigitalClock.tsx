'use client'

import React, { useState, useEffect } from 'react'

export const DigitalClock = ({ className = '' }: { className?: string }) => {
  const [time, setTime] = useState(new Date())

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  return (
    <div className={`font-mono ${className}`}>
      {time.toLocaleTimeString('es-NI', { 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit',
        hour12: true 
      })}
    </div>
  )
}
