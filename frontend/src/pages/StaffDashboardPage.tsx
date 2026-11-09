import { useEffect, useMemo, useState } from 'react'
import * as staff from '../services/staff'
import TenancyPage from './TenancyPage'
import StaffSignIn from '../components/staff/StaffSignIn'
import OperationsWorkspace from '../components/staff/OperationsWorkspace'
import StaffShell, { type StaffSection } from '../components/staff/StaffShell'
import UtilitiesPage from './UtilitiesPage'
import StaffUsersPage from './StaffUsersPage'
import type { Building, Photo, Room, RoomForm, StaffUser, Status } from '../types/staff'
import { formatStaffPeso as peso, roomToForm as toForm, staffRoomSize as size, titleCase as title } from '../utils/property'

const statuses: Status[] = ['unverified', 'available', 'reserved', 'occupied', 'maintenance']
const staffSections: StaffSection[] = ['dashboard', 'rooms', 'tenancy', 'payments', 'inspections', 'users']
const sectionTitles: Record<StaffSection, string> = { dashboard: 'Dashboard', rooms: 'Rooms', tenancy: 'Tenants & Contracts', payments: 'Payments & Bills', inspections: 'Checklists', users: 'User Management' }
const currentSection = (): StaffSection => {
  const hash = window.location.hash.slice(1)
  return staffSections.includes(hash as StaffSection) ? hash as StaffSection : 'dashboard'
}

function StaffDashboardPage() {
  const [user, setUser] = useState<StaffUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [sessionNotice, setSessionNotice] = useState('')
  const [buildings, setBuildings] = useState<Building[]>([])
  const [rooms, setRooms] = useState<Room[]>([])
  const [selected, setSelected] = useState<Room | null>(null)
  const [form, setForm] = useState<RoomForm | null>(null)
  const [buildingFilter, setBuildingFilter] = useState('all')
  const [section, setSection] = useState<StaffSection>(currentSection)
  const [paymentTab, setPaymentTab] = useState<'rent' | 'utilities'>('rent')
  const [floorFilter, setFloorFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [roomQuery, setRoomQuery] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [focusRoomId, setFocusRoomId] = useState<number | null>(null)
  const [focusContractId, setFocusContractId] = useState<number | null>(null)

  useEffect(() => {
    const update = () => { setSection(currentSection()); window.scrollTo(0, 0) }
    window.addEventListener('hashchange', update)
    window.addEventListener('popstate', update)
    return () => { window.removeEventListener('hashchange', update); window.removeEventListener('popstate', update) }
  }, [])
  const navigate = (next: StaffSection) => {
    if (next === 'users' && user?.role !== 'owner') return
    if (next === 'payments') setPaymentTab('rent')
    setSection(next)
    window.history.pushState(null, '', `#${next}`)
    window.scrollTo(0, 0)
  }

  useEffect(() => { staff.getSession().then(x => { setUser(x.user); if (x.user.role !== 'owner' && currentSection() === 'users') { window.history.replaceState(null, '', '#dashboard'); setSection('dashboard') } }).catch(e => {
    const message = (e as Error).message
    if (!/unauthenticated|401/i.test(message)) setSessionNotice('Staff services are unavailable. Start the Laravel server on port 8000, then sign in.')
  }).finally(() => setLoading(false)) }, [])
  useEffect(() => {
    if (!user) return
    Promise.all([staff.getBuildings(), staff.getRooms()]).then(([b, r]) => { setBuildings(b); setRooms(r) }).catch(e => setError(e.message))
  }, [user])
  const filtered = useMemo(() => rooms.filter(r => (buildingFilter === 'all' || String(r.building_id) === buildingFilter) && (floorFilter === 'all' || String(r.floor) === floorFilter) && (statusFilter === 'all' || r.status === statusFilter) && (!roomQuery.trim() || `${r.building.name} ${r.code}`.toLowerCase().includes(roomQuery.trim().toLowerCase()))), [rooms, buildingFilter, floorFilter, statusFilter, roomQuery])
  const buildingRooms = useMemo(() => rooms.filter(r => buildingFilter === 'all' || String(r.building_id) === buildingFilter), [rooms, buildingFilter])
  const open = (r: Room) => { setSelected(r); setForm(toForm(r)); setError(''); setNotice('') }
  const refresh = async (id: number) => { const r = await staff.getRoom(id); setRooms(old => old.map(x => x.id === id ? r : x)); setSelected(r); setForm(toForm(r)) }
  const signIn = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setBusy(true)
    try { const x = await staff.signIn(email, password); setUser(x.user); setPassword('') }
    catch (e) {
      const message = (e as Error).message
      setError(/failed to fetch|networkerror|abort|timeout|request failed \(50[0-9]\)/i.test(message)
        ? 'Could not connect to staff services. Check that the Laravel server is running on port 8000 and try again.'
        : message)
    } finally { setBusy(false) }
  }
  const signOut = async () => { try { await staff.signOut(); setUser(null); setRooms([]); setBuildings([]); setSelected(null) } catch (e) { setError((e as Error).message) } }
  const save = async (e: React.FormEvent) => {
    e.preventDefault(); if (!selected || !form) return
    setBusy(true); setError(''); setNotice('')
    try {
      await staff.saveRoom(selected.id, form)
      await refresh(selected.id); setNotice('Room details saved.')
    } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }
  const upload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file || !selected) return
    setError(''); setNotice('')
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) { setError('Choose a JPEG, PNG, or WebP image up to 5 MB.'); e.target.value = ''; return }
    setBusy(true)
    try { await staff.uploadRoomPhoto(selected.id, file); await refresh(selected.id); setNotice('Photo uploaded.') }
    catch (e) { setError((e as Error).message) } finally { setBusy(false); e.target.value = '' }
  }
  const setPhotoVisibility = async (photo: Photo) => {
    if (!selected) return
    setBusy(true); setError(''); setNotice('')
    try {
      await staff.setPhotoVisibility(photo)
      await refresh(selected.id)
      setNotice(photo.is_public ? 'Photo removed from the public website.' : 'Photo approved for the public website.')
    } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }
  const operations = (view: StaffSection) => <OperationsWorkspace view={view} buildingId={buildingFilter} rooms={buildingRooms} roomId={focusRoomId} setRoomId={setFocusRoomId} contractId={focusContractId} setContractId={setFocusContractId} onOpenRoom={open} onViewPayments={() => navigate('payments')} onOpenContract={id => { setFocusContractId(id); navigate('tenancy') }}/>


  if (!user) return <StaffSignIn email={email} password={password} error={error} busy={busy} checking={loading} notice={sessionNotice} onEmailChange={setEmail} onPasswordChange={setPassword} onSubmit={signIn} />
  return <main className="staff-dashboard min-h-screen bg-white text-[#111]">
    <StaffShell user={user} buildings={buildings} buildingId={buildingFilter} onBuildingChange={id => { setBuildingFilter(id); setFloorFilter('all'); setStatusFilter('all'); setRoomQuery(''); setFocusRoomId(null); setFocusContractId(null) }} section={section} onSectionChange={navigate} onSignOut={signOut}>
      <div className="mb-6 border-b border-[#e0e0e0] pb-5"><h1 className="text-3xl font-bold tracking-tight text-[#111] md:text-4xl">{sectionTitles[section]}</h1></div>
      {error && !selected && <p role="alert" className="mb-5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {section === 'dashboard' && operations('dashboard')}
      {section === 'payments' && <section aria-label="Payments and bills" className="min-w-0 rounded-2xl border border-[#dedede] bg-white">
        <div className="border-b border-[#dedede] p-4 sm:p-5"><div role="group" aria-label="Payment views" className="inline-flex w-full gap-1 rounded-xl bg-[#f3f3f3] p-1 sm:w-auto">{([['rent', 'Rent'], ['utilities', 'Utilities']] as const).map(([id, label]) => <button key={id} type="button" aria-pressed={paymentTab === id} onClick={() => setPaymentTab(id)} className={`min-h-11 flex-1 rounded-lg px-4 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0B1F3A] sm:flex-none ${paymentTab === id ? 'bg-[#111] text-white shadow-sm' : 'text-[#444] hover:bg-white'}`}>{label}</button>)}</div></div>
        <div className="min-w-0 p-4 sm:p-5">{paymentTab === 'rent' ? operations('payments') : <UtilitiesPage rooms={buildingRooms} />}</div>
      </section>}
      {section === 'inspections' && operations('inspections')}
      {section === 'users' && user.role === 'owner' && <StaffUsersPage />}
      {section === 'rooms' && <section id="rooms" className="min-w-0 rounded-2xl border border-[#dedede] bg-white">
        <div className="border-b border-[#dedede] p-4 sm:p-5"><p className="text-sm font-semibold">{filtered.length} of {buildingRooms.length} rooms</p></div>
        <div className="p-4 sm:p-5">
        <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(180px,1fr)_repeat(2,minmax(130px,165px))]">
          <label className="text-xs font-semibold text-[#595959]">Search rooms<input type="search" value={roomQuery} onChange={e => setRoomQuery(e.target.value)} placeholder="Building or room code" className="field" /></label>
          <label className="text-xs font-semibold text-[#595959]">Floor<select aria-label="Filter by floor" value={floorFilter} onChange={e => setFloorFilter(e.target.value)} className="field"><option value="all">All floors</option><option value="1">First floor</option><option value="2">Second floor</option></select></label>
          <label className="text-xs font-semibold text-[#595959]">Status<select aria-label="Filter by status" value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="field"><option value="all">All statuses</option>{statuses.map(s => <option key={s} value={s}>{title(s)}</option>)}</select></label>
        </div>
        {filtered.length ? <>
          <div className="hidden overflow-hidden rounded-xl border border-[#e0e0e0] xl:block"><table className="w-full border-collapse text-left text-sm">
            <thead className="bg-[#f7f7f7] text-xs font-semibold uppercase tracking-wide text-[#595959]"><tr><th scope="col" className="px-5 py-4">Room</th><th scope="col" className="px-5 py-4">Floor / side</th><th scope="col" className="px-5 py-4">Size</th><th scope="col" className="px-5 py-4">Monthly rent</th><th scope="col" className="px-5 py-4">Status</th><th scope="col" className="px-5 py-4"><span className="sr-only">Action</span></th></tr></thead>
            <tbody>{filtered.map(r => <tr key={r.id} className="border-t border-[#e8e8e8] hover:bg-[#fafafa]"><th scope="row" className="px-5 py-4"><span className="block font-semibold text-[#111]">Room {r.code}</span><span className="text-xs font-normal text-[#777]">{r.building.name}</span></th><td className="px-5 py-4 text-[#595959]">{r.floor === 1 ? 'First' : 'Second'} floor{r.side ? ' · ' + r.side : ''}</td><td className="px-5 py-4 text-[#595959]">{size(r)}</td><td className="px-5 py-4 font-semibold">{peso(r.monthly_rent)}</td><td className="px-5 py-4"><span className="inline-flex rounded-full border border-[#d9e2ec] bg-[#f5f7f9] px-2.5 py-1 text-xs font-semibold text-[#0B1F3A]">{title(r.status)}</span></td><td className="px-5 py-4 text-right"><button type="button" onClick={() => open(r)} aria-label={'View details for ' + r.building.name + ' Room ' + r.code} className="min-h-11 rounded-lg border border-[#d5d5d5] px-3 font-semibold hover:border-[#111] focus-visible:outline-2 focus-visible:outline-[#0B1F3A]">View details</button></td></tr>)}</tbody>
          </table></div>
          <div className="grid gap-3 xl:hidden">{filtered.map(r => <button key={r.id} type="button" onClick={() => open(r)} className="rounded-xl border border-[#e0e0e0] bg-white p-4 text-left focus-visible:outline-2 focus-visible:outline-[#0B1F3A]"><span className="flex items-start justify-between gap-2"><span><span className="block text-xs text-[#777]">{r.building.name}</span><strong className="block text-lg">Room {r.code}</strong></span><span className="rounded-full border border-[#d9e2ec] bg-[#f5f7f9] px-2.5 py-1 text-xs font-semibold text-[#0B1F3A]">{title(r.status)}</span></span><span className="mt-3 block text-sm text-[#595959]">{r.floor === 1 ? 'First' : 'Second'} floor{r.side ? ' · ' + r.side : ''} · {size(r)}</span><span className="mt-2 flex items-center justify-between gap-2 text-sm"><strong>{peso(r.monthly_rent)} / month</strong><span className="font-semibold text-[#0B1F3A]">Details →</span></span></button>)}</div>
        </> : <div className="rounded-xl border border-dashed border-[#d5d5d5] p-10 text-center text-sm text-[#595959]">No rooms match these filters.</div>}
        </div>
      </section>}
      {section === 'tenancy' && <div id="tenancy"><TenancyPage key={`${buildingFilter}-${focusContractId ?? 'none'}`} buildingId={buildingFilter} rooms={buildingRooms} focusContractId={focusContractId} isOwner={user.role === 'owner'} onOpenPayment={id => { setFocusContractId(id); navigate('payments') }} onOpenChecklist={roomId => { setFocusRoomId(roomId); navigate('inspections') }}/></div>}</StaffShell>
    {selected && form && <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#07182b]/60 md:items-center md:p-5"><section role="dialog" aria-modal="true" aria-label={`Room ${selected.code} details`} className="max-h-[94vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl bg-white p-6 shadow-xl md:rounded-2xl md:p-8"><div className="flex justify-between"><div><p className="text-sm text-slate-500">{selected.building.name}</p><h2 className="text-2xl font-bold">Room {selected.code}</h2></div><button onClick={() => { setSelected(null); setError(''); setNotice('') }} aria-label="Close details" className="rounded-lg p-2 text-xl">×</button></div><button type="button" onClick={() => { setFocusRoomId(selected.id); setSelected(null); navigate('inspections') }} className="mt-5 min-h-11 rounded-lg border border-[#ddd] px-4 text-sm font-semibold">Open checklists</button><div className="mt-5"><h3 className="font-semibold">Photos</h3>{selected.photos.length ? <div className="mt-3 grid grid-cols-2 gap-3">{selected.photos.map(p => <div key={p.id}><img src={p.url} alt={p.original_name} className="aspect-[4/3] w-full rounded-lg border object-cover"/><div className="mt-2 flex items-center justify-between gap-2 text-xs"><span>{p.is_public ? 'Publicly approved' : 'Private'}</span><button type="button" disabled={busy} onClick={() => setPhotoVisibility(p)} className="rounded border border-slate-300 px-2 py-1 font-semibold disabled:opacity-50">{p.is_public ? 'Remove approval' : 'Approve for website'}</button></div></div>)}</div> : <div className="mt-3 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500">No room photos have been added yet.</div>}<label className="mt-3 inline-flex cursor-pointer rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold">Upload photo<input type="file" accept="image/jpeg,image/png,image/webp" onChange={upload} disabled={busy} className="sr-only"/></label><p className="mt-1 text-xs text-slate-500">JPEG, PNG, or WebP · 5 MB maximum. Uploads remain private until approved.</p></div><form onSubmit={save} className="mt-7 border-t border-slate-200 pt-6"><h3 className="mb-4 font-semibold">Room information</h3><div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-medium">Floor<select value={form.floor} onChange={e => setForm({ ...form, floor: e.target.value })} className="field"><option value="1">First floor</option><option value="2">Second floor</option></select></label><label className="text-sm font-medium">Side<select value={form.side} onChange={e => setForm({ ...form, side: e.target.value })} disabled={selected.building.name === 'Building 2'} className="field disabled:bg-slate-100"><option value="">Not applicable</option><option value="right">Right</option><option value="left">Left</option></select></label><label className="text-sm font-medium">Minimum size (sqm)<input type="number" min="0.01" step="0.01" required value={form.size_min_sqm} onChange={e => setForm({ ...form, size_min_sqm: e.target.value })} className="field"/></label><label className="text-sm font-medium">Maximum size (sqm)<input type="number" min="0.01" step="0.01" required value={form.size_max_sqm} onChange={e => setForm({ ...form, size_max_sqm: e.target.value })} className="field"/></label><label className="text-sm font-medium">Monthly rent (₱)<input type="number" min="0" step="0.01" required value={form.monthly_rent} onChange={e => setForm({ ...form, monthly_rent: e.target.value })} className="field"/></label><label className="text-sm font-medium">Status<select value={form.status} onChange={e => setForm({ ...form, status: e.target.value as Status })} className="field">{statuses.map(s => <option key={s} value={s}>{title(s)}</option>)}</select></label></div><label className="mt-4 block text-sm font-medium">Amenities (comma separated)<input value={form.amenities} onChange={e => setForm({ ...form, amenities: e.target.value })} className="field"/></label><label className="mt-4 block text-sm font-medium">Description<textarea rows={3} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="field"/></label>{error && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}{notice && <p role="status" className="mt-4 rounded-lg bg-green-50 p-3 text-sm text-green-800">{notice}</p>}<div className="mt-5 flex justify-end"><button disabled={busy} className="rounded-lg bg-[#0B1F3A] px-5 py-3 font-semibold text-white disabled:opacity-50">{busy ? 'Saving…' : 'Save changes'}</button></div></form></section></div>}
  </main>
}

export default StaffDashboardPage
