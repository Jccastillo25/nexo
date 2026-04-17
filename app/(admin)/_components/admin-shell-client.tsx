'use client'

import { useState, useEffect, useMemo } from 'react'
import { AdminSidebar } from './admin-sidebar'
import { AdminTopbar } from './admin-topbar'
import { GlobalProvider, useGlobalContext } from '@/context/GlobalContext'
import { createClient } from '@/lib/supabase/client'

interface AdminShellClientProps {
  companyName: string
  userName: string
  userRole: string
  logoUrl: string | null
  companies: { id: string; name: string; slug: string }[]
  userPermissions?: Record<string, boolean>
  children: React.ReactNode
}

function AdminShellContent({
  companyName,
  userName,
  userRole,
  logoUrl,
  companies,
  userPermissions = {},
  children,
}: AdminShellClientProps) {
  const { setCompanies, companyId } = useGlobalContext()
  const [sidebarOpen,       setSidebarOpen]       = useState(true)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [monitorAlertCount, setMonitorAlertCount] = useState(0)

  // Sincronizar empresas al contexto global
  useEffect(() => {
    setCompanies(companies)
  }, [companies, setCompanies])

  // Suscripción realtime: cuenta de empleados ausentes/offline para badge del sidebar
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    if (!companyId || companyId === 'all') {
      setMonitorAlertCount(0)
      return
    }

    let cancelled = false

    const fetchCount = async () => {
      const { count } = await supabase
        .from('employees')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .eq('is_active', true)
        .in('current_status', ['absent', 'offline'])

      if (!cancelled) setMonitorAlertCount(count ?? 0)
    }

    fetchCount()

    const channel = supabase
      .channel(`sidebar-monitor-alert-${companyId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'employees', filter: `company_id=eq.${companyId}` },
        () => { if (!cancelled) fetchCount() }
      )
      .subscribe()

    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
  }, [companyId, supabase])

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-app)' }}>

      {/* ── Sidebar desktop ── */}
      <div
        className="fixed inset-y-0 left-0 z-30 hidden lg:block sidebar-transition border-r"
        style={{
          width:       sidebarOpen ? 'var(--sidebar-width)' : 'var(--sidebar-collapsed-width)',
          borderColor: 'var(--border-soft)',
          overflow:    'hidden',
        }}
      >
        <div style={{ width: sidebarOpen ? 'var(--sidebar-width)' : 'var(--sidebar-collapsed-width)' }} className="h-full">
          <AdminSidebar
            companyName={companyName}
            userName={userName}
            userRole={userRole}
            logoUrl={logoUrl}
            collapsed={!sidebarOpen}
            onExpand={() => setSidebarOpen(true)}
            userPermissions={userPermissions}
            monitorAlertCount={monitorAlertCount}
          />
        </div>
      </div>

      {/* ── Overlay mobile ── */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 z-40 sidebar-overlay lg:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* ── Sidebar mobile ── */}
      <div
        className="fixed inset-y-0 left-0 z-50 lg:hidden sidebar-transition border-r"
        style={{
          width:       'var(--sidebar-width)',
          borderColor: 'var(--border-soft)',
          transform:   mobileSidebarOpen ? 'translateX(0)' : 'translateX(-100%)',
          boxShadow:   mobileSidebarOpen ? 'var(--shadow-overlay)' : 'none',
        }}
      >
        <AdminSidebar
          companyName={companyName}
          userName={userName}
          userRole={userRole}
          logoUrl={logoUrl}
          onClose={() => setMobileSidebarOpen(false)}
          userPermissions={userPermissions}
          monitorAlertCount={monitorAlertCount}
        />
      </div>

      {/* ── Área de contenido principal ── */}
      <div
        className={`flex min-h-screen flex-col w-full transition-all duration-300 ease-in-out ${
          sidebarOpen ? 'lg:pl-[280px]' : 'lg:pl-[80px]'
        }`}
      >
        <AdminTopbar
          sidebarOpen={sidebarOpen}
          onToggleSidebar={() => setSidebarOpen(prev => !prev)}
          onMobileMenuOpen={() => setMobileSidebarOpen(true)}
          userName={userName}
          userRole={userRole}
          companyName={companyName}
          logoUrl={logoUrl}
          companies={companies}
        />
        <main className="flex-1 p-4 md:p-6">
          <div className="w-full">{children}</div>
        </main>
      </div>
    </div>
  )
}

export function AdminShellClient(props: AdminShellClientProps) {
  return (
    <GlobalProvider 
      userRole={props.userRole} 
      userPermissions={props.userPermissions}
    >
      <AdminShellContent {...props} />
    </GlobalProvider>
  )
}
