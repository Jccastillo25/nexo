'use client'

import { useState, useEffect } from 'react'
import { AdminSidebar } from './admin-sidebar'
import { AdminTopbar } from './admin-topbar'
import { GlobalProvider, useGlobalContext } from '@/context/GlobalContext'

interface AdminShellClientProps {
  companyName: string
  userName: string
  userRole: string
  logoUrl: string | null
  companies: { id: string, name: string, slug: string }[]
  children: React.ReactNode
}

function AdminShellContent({
  companyName,
  userName,
  userRole,
  logoUrl,
  companies,
  children,
}: AdminShellClientProps) {
  const { setCompanies } = useGlobalContext()
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)

  // Sync companies to global context
  useEffect(() => {
    setCompanies(companies)
  }, [companies, setCompanies])

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-app)' }}>

      {/* ── Desktop sidebar ── */}
      <div
        className="fixed inset-y-0 left-0 z-30 hidden lg:block sidebar-transition border-r"
        style={{
          width: sidebarOpen ? 'var(--sidebar-width)' : 'var(--sidebar-collapsed-width)',
          borderColor: 'var(--border-soft)',
          overflow: 'hidden',
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
          />
        </div>
      </div>

      {/* ── Mobile overlay ── */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 z-40 sidebar-overlay lg:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* ── Mobile sidebar ── */}
      <div
        className="fixed inset-y-0 left-0 z-50 lg:hidden sidebar-transition border-r"
        style={{
          width: 'var(--sidebar-width)',
          borderColor: 'var(--border-soft)',
          transform: mobileSidebarOpen ? 'translateX(0)' : 'translateX(-100%)',
          boxShadow: mobileSidebarOpen ? 'var(--shadow-overlay)' : 'none',
        }}
      >
        <AdminSidebar
          companyName={companyName}
          userName={userName}
          userRole={userRole}
          logoUrl={logoUrl}
          onClose={() => setMobileSidebarOpen(false)}
        />
      </div>

      {/* ── Main content area ── */}
      <div
        className={`flex min-h-screen flex-col w-full transition-all duration-300 ease-in-out ${sidebarOpen ? 'lg:pl-[280px]' : 'lg:pl-[80px]'}`}
      >
        <AdminTopbar
          sidebarOpen={sidebarOpen}
          onToggleSidebar={() => setSidebarOpen((prev) => !prev)}
          onMobileMenuOpen={() => setMobileSidebarOpen(true)}
          userName={userName}
          userRole={userRole}
          companyName={companyName}
          logoUrl={logoUrl}
          companies={companies}
        />
        <main className="flex-1 p-4 md:p-6 transition-all duration-300">
          <div className="w-full">{children}</div>
        </main>
      </div>
    </div>
  )
}

export function AdminShellClient(props: AdminShellClientProps) {
  return (
    <GlobalProvider>
      <AdminShellContent {...props} />
    </GlobalProvider>
  )
}
