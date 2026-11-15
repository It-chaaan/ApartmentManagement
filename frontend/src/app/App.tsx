import { useEffect } from 'react'
import PublicHomePage from '../pages/PublicHomePage'
import StaffDashboardPage from '../pages/StaffDashboardPage'
import TenantPortalPage from '../pages/TenantPortalPage'
import { usePageMotion } from '../hooks/usePageMotion'

function App() {
  const isStaff = import.meta.env.MODE !== 'public' && (window.location.pathname === '/staff' || window.location.pathname.startsWith('/staff/'))
  const isTenant = import.meta.env.MODE !== 'public' && (window.location.pathname === '/tenant' || window.location.pathname.startsWith('/tenant/'))
  usePageMotion()

  useEffect(() => {
    document.title = isStaff ? 'Staff dashboard | Guillermo Apartment' : isTenant ? 'Tenant portal | Guillermo Apartment' : 'Guillermo Apartment | Rooms in Lingunan, Valenzuela City'
    const description = document.querySelector('meta[name="description"]')
    description?.setAttribute('content', isStaff
      ? 'Private property management for authorized Guillermo Apartment staff.'
      : isTenant ? 'Private tenancy records for invited Guillermo Apartment tenants.'
        : 'Explore Guillermo Apartment in Brgy. Lingunan, Valenzuela City: two buildings, furnished rooms, individual utilities, and motorcycle parking.')
    if (isStaff || isTenant) {
      const robots = document.createElement('meta')
      robots.name = 'robots'
      robots.content = 'noindex, nofollow'
      document.head.appendChild(robots)
      return () => { robots.remove() }
    }
  }, [isStaff, isTenant])

  return <>
    {import.meta.env.VITE_DEMO_MODE === '1' && <div role="note" aria-label="Demo mode" className="bg-[#0B1F3A] px-4 py-2 text-center text-sm font-semibold text-white">DEMO MODE · Sample records and availability only</div>}
    {isStaff ? <StaffDashboardPage /> : isTenant ? <TenantPortalPage /> : <PublicHomePage />}
  </>
}

export default App
