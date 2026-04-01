'use client'

import React, { createContext, useContext, useState, useEffect } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { User } from '@supabase/supabase-js'

interface Company {
  id: string
  name: string
  slug: string
}

interface GlobalContextType {
  user: User | null
  companyId: string | null
  setCompanyId: (id: string) => void
  companies: Company[]
  setCompanies: (companies: Company[]) => void
  isLoading: boolean
}

const GlobalContext = createContext<GlobalContextType | undefined>(undefined)

export function GlobalProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [companyId, setCompanyIdState] = useState<string | null>(null)
  const [companies, setCompanies] = useState<Company[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const supabase = createClient()
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  // BroadcastChannel para sincronizar Logouts masivos (Kill-Switch)
  useEffect(() => {
    const channel = new BroadcastChannel('gestor360_auth')
    
    channel.onmessage = (event) => {
      if (event.data === 'FORCE_LOGOUT') {
        console.warn('Kill-Switch detectado. Cerrando sesión en esta pestaña...')
        supabase.auth.signOut().then(() => {
          window.location.href = '/login?reason=deactivated'
        })
      }
    }

    return () => channel.close()
  }, [])

  // Suscripción Realtime para Kill-Switch
  useEffect(() => {
    let subscription: any

    const setupAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      const currentUser = session?.user ?? null
      setUser(currentUser)

      if (currentUser) {
        // Escuchar cambios en el perfil del usuario (columna is_active)
        subscription = supabase
          .channel(`profile:${currentUser.id}`)
          .on(
            'postgres_changes',
            {
              event: 'UPDATE',
              schema: 'public',
              table: 'profiles',
              filter: `id=eq.${currentUser.id}`,
            },
            (payload) => {
              if (payload.new.is_active === false) {
                console.error('ALERTA DE SEGURIDAD: Tu cuenta ha sido desactivada.')
                const channel = new BroadcastChannel('gestor360_auth')
                channel.postMessage('FORCE_LOGOUT')
                supabase.auth.signOut().then(() => {
                  window.location.href = '/login?reason=deactivated'
                })
              }
            }
          )
          .subscribe()
      }
    }

    setupAuth()

    return () => {
      if (subscription) supabase.removeChannel(subscription)
    }
  }, [])

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
    <GlobalContext.Provider value={{ user, companyId, setCompanyId, companies, setCompanies, isLoading }}>
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
