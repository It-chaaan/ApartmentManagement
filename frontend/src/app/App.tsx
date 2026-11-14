import { useEffect } from 'react'
import PublicHomePage from '../pages/PublicHomePage'
import StaffDashboardPage from '../pages/StaffDashboardPage'
import { usePageMotion } from '../hooks/usePageMotion'

function App() {
  const isStaff = import.meta.env.MODE !== 'public' && (window.location.pathname === '/staff' || window.location.pathname.startsWith('/staff/'))
  usePageMotion()

  useEffect(() => {
    document.title = isStaff ? 'Staff dashboard | Guillermo Apartment' : 'Guillermo Apartment | Rooms in Lingunan, Valenzuela City'
    const description = document.querySelector('meta[name="description"]')
    description?.setAttribute('content', isStaff
      ? 'Private property management for authorized Guillermo Apartment staff.'
      : 'Explore Guillermo Apartment in Brgy. Lingunan, Valenzuela City: two buildings, furnished rooms, individual utilities, and motorcycle parking.')
    if (isStaff) {
      const robots = document.createElement('meta')
      robots.name = 'robots'
      robots.content = 'noindex, nofollow'
      document.head.appendChild(robots)
      return () => { robots.remove() }
    }
  }, [isStaff])

  return isStaff ? <StaffDashboardPage /> : <PublicHomePage />
}

export default App
