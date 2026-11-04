import { useEffect } from 'react'
import PublicApp from './PublicApp'
import StaffApp from './StaffApp'

function App() {
  const isStaff = window.location.pathname === '/staff' || window.location.pathname.startsWith('/staff/')

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

  return isStaff ? <StaffApp /> : <PublicApp />
}

export default App
