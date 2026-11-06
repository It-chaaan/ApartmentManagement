import { useEffect, useState, type ReactNode } from 'react'
import type { Building, StaffUser } from '../../types/staff'

export type StaffSection = 'dashboard' | 'rooms' | 'tenancy' | 'payments' | 'inspections' | 'users'

const sections: { id: StaffSection; label: string; number: string }[] = [
  { id: 'dashboard', label: 'Dashboard', number: '01' },
  { id: 'rooms', label: 'Rooms', number: '02' },
  { id: 'tenancy', label: 'Tenants & contracts', number: '03' },
  { id: 'payments', label: 'Payments & Bills', number: '04' },
  { id: 'inspections', label: 'Checklists', number: '05' },
  { id: 'users', label: 'User Management', number: '06' },
]

type Props = {
  user: StaffUser
  buildings: Building[]
  buildingId: string
  onBuildingChange: (id: string) => void
  section: StaffSection
  onSectionChange: (section: StaffSection) => void
  onSignOut: () => void
  children: ReactNode
}

export default function StaffShell({ user, buildings, buildingId, onBuildingChange, section, onSectionChange, onSignOut, children }: Props) {
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [])

  const chooseSection = (id: StaffSection) => { onSectionChange(id); setMenuOpen(false) }
  const selectedBuilding = buildings.find(b => String(b.id) === buildingId)
  const navigation = (
    <nav aria-label="Staff pages" className="mt-3 space-y-1">
      {sections.filter(item => item.id !== 'users' || user.role === 'owner').map(item => (
        <button
          type="button"
          key={item.id}
          aria-current={item.id === section ? 'page' : undefined}
          onClick={() => chooseSection(item.id)}
          className={`flex min-h-11 w-full items-center gap-3 rounded-lg border-l-2 px-4 py-2 text-left text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0B1F3A] ${item.id === section ? 'border-[#0B1F3A] bg-[#f3f5f7] text-[#111]' : 'border-transparent text-[#595959] hover:bg-[#f7f7f7] hover:text-[#111]'}`}
        >
          <span aria-hidden="true" className={`text-[11px] font-semibold ${item.id === section ? 'text-[#0B1F3A]' : 'text-[#888]'}`}>{item.number}</span>
          {item.label}
        </button>
      ))}
    </nav>
  )

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[240px_minmax(0,1fr)]">
      {menuOpen && <button type="button" aria-label="Close navigation" onClick={() => setMenuOpen(false)} className="fixed inset-0 z-30 bg-black/40 lg:hidden" />}
      <aside id="staff-navigation" className={`fixed inset-y-0 left-0 z-40 w-[min(86vw,280px)] overflow-y-auto border-r border-[#e0e0e0] bg-white px-5 py-6 lg:sticky lg:top-0 lg:z-auto lg:h-screen lg:w-auto ${menuOpen ? 'block' : 'hidden lg:block'}`}>
        <button type="button" onClick={() => chooseSection('dashboard')} className="flex items-center gap-3 rounded-lg text-left focus-visible:outline-2 focus-visible:outline-[#0B1F3A]">
          <img src="/brand-mark.svg" alt="" className="h-10 w-10" />
          <span className="text-sm font-bold leading-tight text-[#111]">Guillermo<br />Apartment</span>
        </button>
        <div className="mt-9 border-t border-[#e0e0e0] pt-5">
          <label htmlFor="building-switcher" className="px-4 text-[11px] font-semibold uppercase tracking-[.14em] text-[#777]">Property</label>
          <div className="relative mt-3">
            <span aria-hidden="true" className="pointer-events-none absolute left-2.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md bg-[#0B1F3A] text-white">
              <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="1.7"><path d="M4 20V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v15M16 9h2a2 2 0 0 1 2 2v9M2 20h20M8 7h1m3 0h1M8 11h1m3 0h1M8 15h1m3 0h1" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </span>
            <select id="building-switcher" value={buildingId} onChange={event => { onBuildingChange(event.target.value); setMenuOpen(false) }} className="min-h-11 w-full appearance-none rounded-lg border border-[#d5d5d5] bg-white py-2 pl-12 pr-8 text-sm font-semibold text-[#111] hover:border-[#0B1F3A] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0B1F3A]">
              {buildings.map(b => <option key={b.id} value={String(b.id)}>{b.name} · {b.rooms_count}</option>)}
              <option value="all">All buildings</option>
            </select>
            <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#111]" stroke="currentColor" strokeWidth="1.8"><path d="m5 7 5 5 5-5" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </div>
        </div>
        <div className="mt-7 border-t border-[#e0e0e0] pt-5">
          <p className="px-4 text-[11px] font-semibold uppercase tracking-[.14em] text-[#777]">Management</p>
          {navigation}
        </div>
      </aside>
      <div className="min-w-0">
        <header className="sticky top-0 z-20 flex min-h-[72px] items-center justify-between gap-3 border-b border-[#e0e0e0] bg-white/95 px-4 backdrop-blur-sm sm:px-7 lg:px-10">
          <div className="flex min-w-0 items-center gap-3">
            <button type="button" aria-label="Open navigation" aria-controls="staff-navigation" aria-expanded={menuOpen} onClick={() => setMenuOpen(true)} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-[#e0e0e0] text-lg lg:hidden">☰</button>
            <div><p className="truncate text-sm font-semibold text-[#111]">{selectedBuilding?.name ?? 'All buildings'}</p><p className="text-xs text-[#777]">{sections.find(item => item.id === section)?.label}</p></div>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden max-w-36 truncate text-[#595959] sm:block">{user.name}</span>
            <button type="button" onClick={onSignOut} className="min-h-11 rounded-lg border border-[#d5d5d5] px-3 font-semibold text-[#111] hover:border-[#111] focus-visible:outline-2 focus-visible:outline-[#0B1F3A] sm:px-4">Sign out</button>
          </div>
        </header>
        <div className="mx-auto max-w-[1500px] px-4 py-7 sm:px-7 lg:px-10 lg:py-10">{children}</div>
      </div>
    </div>
  )
}
