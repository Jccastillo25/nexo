'use client'

import React, { createContext, useContext, useState, useEffect } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'

interface GlobalContextType {
  companyId: string | null
  setCompanyId: (id: string) => void
  isLoading: boolean
}

const GlobalContext = createContext<GlobalContextType | undefined>(undefined)

export function GlobalProvider({ children }: { children: React.ReactNode }) {
  const [companyId, setCompanyIdState] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  // Initialize from search params or localStorage
  useEffect(() => {
    const paramId = searchParams.get('company_id')
    const storedId = localStorage.getItem('last_company_id')
    
    if (paramId) {
      setCompanyIdState(paramId)
      localStorage.setItem('last_company_id', paramId)
    } else if (storedId && storedId !== 'all') {
      setCompanyIdState(storedId)
      
      // Sync URL with stored ID to ensure server components get the context
      const params = new URLSearchParams(searchParams.toString())
      params.set('company_id', storedId)
      router.replace(`${pathname}?${params.toString()}`, { scroll: false })
    }
    setIsLoading(false)
  }, [searchParams])

  const setCompanyId = (id: string) => {
    setCompanyIdState(id)
    localStorage.setItem('last_company_id', id)
    
    // Sync URL params
    const params = new URLSearchParams(searchParams.toString())
    if (id === 'all') {
      params.delete('company_id')
    } else {
      params.set('company_id', id)
    }
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <GlobalContext.Provider value={{ companyId, setCompanyId, isLoading }}>
      {children}
    </GlobalContext.Provider>
  )
}

export function useGlobalContext() {
  const context = useContext(GlobalContext)
  if (context === undefined) {
    throw new Error('useGlobalContext must be used within a GlobalProvider')
  }
  return context
}
