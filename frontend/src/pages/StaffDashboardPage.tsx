import { useEffect, useMemo, useState } from 'react'
import * as staff from '../services/staff'
import TenancyPage from './TenancyPage'
import type { Building, Photo, Room, RoomForm, StaffUser, Status } from '../types/staff'
import { formatStaffPeso as peso, roomToForm as toForm, staffRoomSize as size, titleCase as title } from '../utils/property'

const statuses: Status[] = ['unverified', 'available', 'reserved', 'occupied', 'maintenance']

function StaffDashboardPage() {
  const [user, setUser] = useState<StaffUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [buildings, setBuildings] = useState<Building[]>([])
  const [rooms, setRooms] = useState<Room[]>([])
  const [selected, setSelected] = useState<Room | null>(null)
  const [form, setForm] = useState<RoomForm | null>(null)
  const [buildingFilter, setBuildingFilter] = useState('all')
  const [floorFilter, setFloorFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => { staff.getSession().then(x => setUser(x.user)).catch(() => {}).finally(() => setLoading(false)) }, [])
  useEffect(() => {
    if (!user) return
    Promise.all([staff.getBuildings(), staff.getRooms()]).then(([b, r]) => { setBuildings(b); setRooms(r) }).catch(e => setError(e.message))
  }, [user])
  const filtered = useMemo(() => rooms.filter(r => (buildingFilter === 'all' || String(r.building_id) === buildingFilter) && (floorFilter === 'all' || String(r.floor) === floorFilter) && (statusFilter === 'all' || r.status === statusFilter)), [rooms, buildingFilter, floorFilter, statusFilter])
  const open = (r: Room) => { setSelected(r); setForm(toForm(r)); setError(''); setNotice('') }
  const refresh = async (id: number) => { const r = await staff.getRoom(id); setRooms(old => old.map(x => x.id === id ? r : x)); setSelected(r); setForm(toForm(r)) }
  const signIn = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setBusy(true)
    try { const x = await staff.signIn(email, password); setUser(x.user); setPassword('') }
    catch (e) { setError((e as Error).message) } finally { setBusy(false) }
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

  if (loading) return <main className="grid min-h-screen place-items-center">Loading dashboardâ€¦</main>
  return <main className="min-h-screen bg-[#f5f7fb] text-[#0B1F3A]">
    <header className="border-b border-slate-200 bg-white"><div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4"><div className="flex items-center gap-3"><img src="/brand-mark.svg" alt="Guillermo Apartment logo" className="h-11 w-11"/><div><strong>Guillermo Apartment</strong><div className="text-xs text-slate-500">Family staff portal</div></div></div>{user && <div className="flex items-center gap-3 text-sm"><span className="hidden sm:inline">{user.name}</span><button onClick={signOut} className="rounded-lg border border-slate-300 px-4 py-2">Sign out</button></div>}</div></header>
    {!user ? <div className="mx-auto grid max-w-6xl gap-10 px-5 py-16 md:grid-cols-2 md:items-center md:py-28"><div><p className="text-sm font-bold uppercase tracking-widest text-[#44739f]">Staff dashboard</p><h1 className="mt-4 text-4xl font-bold md:text-5xl">Manage Guillermo Apartment</h1><p className="mt-5 text-lg text-slate-600">Two buildings and 18 rooms in Brgy. Lingunan, Valenzuela City.</p></div><form onSubmit={signIn} className="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm"><h2 className="text-2xl font-bold">Staff sign in</h2><p className="mt-1 text-sm text-slate-500">Authorized family staff only</p><label className="mt-7 block text-sm font-medium">Email<input type="email" required autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} className="field"/></label><label className="mt-4 block text-sm font-medium">Password<input type="password" required autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} className="field"/></label>{error && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}<button disabled={busy} className="mt-6 w-full rounded-lg bg-[#0B1F3A] px-5 py-3 font-semibold text-white disabled:opacity-50">{busy ? 'Signing inâ€¦' : 'Sign in'}</button></form></div> : <div className="mx-auto max-w-7xl px-5 py-8 md:py-11"><p className="text-xs font-bold uppercase tracking-widest text-[#44739f]">Brgy. Lingunan Â· Valenzuela City</p><h1 className="mt-2 text-3xl font-bold md:text-4xl">Buildings & rooms</h1><nav aria-label="Staff sections" className="mt-5 flex flex-wrap gap-2 text-sm font-semibold"><a href="#rooms" className="rounded-lg border border-slate-300 bg-white px-4 py-3">Buildings & rooms</a><a href="#tenancy" className="rounded-lg border border-slate-300 bg-white px-4 py-3">Tenants & contracts</a></nav><p className="mt-2 text-slate-600">Occupancy starts unverified until family staff confirm it.</p>{error && !selected && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-red-700">{error}</p>}
      <section aria-label="Buildings" className="mt-8 grid gap-4 md:grid-cols-2">{buildings.map(b => <article key={b.id} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><div className="flex justify-between gap-3"><div><h2 className="text-xl font-bold">{b.name}</h2><p className="text-sm text-slate-500">{b.address}</p></div><span className="h-fit rounded-full bg-[#eaf1f8] px-3 py-1 text-sm font-semibold">{b.rooms_count} rooms</span></div><p className="mt-5 text-sm text-slate-600">{b.description}</p><p className="mt-5 border-t border-slate-100 pt-4 text-sm"><strong>{Number(b.lot_area_sqm)} sqm lot area</strong> Â· {b.amenities.join(' Â· ')}</p></article>)}</section>
      <section id="rooms" className="mt-9"><div className="mb-5 flex flex-wrap items-end justify-between gap-4"><div><h2 className="text-2xl font-bold">Room directory</h2><p className="text-sm text-slate-500">{filtered.length} of {rooms.length} rooms</p></div><div className="flex flex-wrap gap-2"><label className="text-xs font-medium">Building<select aria-label="Filter by building" value={buildingFilter} onChange={e => setBuildingFilter(e.target.value)} className="field"><option value="all">All buildings</option>{buildings.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></label><label className="text-xs font-medium">Floor<select aria-label="Filter by floor" value={floorFilter} onChange={e => setFloorFilter(e.target.value)} className="field"><option value="all">All floors</option><option value="1">First floor</option><option value="2">Second floor</option></select></label><label className="text-xs font-medium">Status<select aria-label="Filter by status" value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="field"><option value="all">All statuses</option>{statuses.map(s => <option key={s} value={s}>{title(s)}</option>)}</select></label></div></div>{filtered.length ? <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{filtered.map(r => <button key={r.id} onClick={() => open(r)} className="rounded-xl border border-slate-200 bg-white p-5 text-left shadow-sm hover:border-[#44739f] focus-visible:outline-2 focus-visible:outline-[#44739f]"><div className="flex items-start justify-between gap-2"><div><p className="text-xs font-semibold uppercase text-slate-500">{r.building.name}</p><h3 className="mt-1 text-xl font-bold">Room {r.code}</h3></div><span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800">{title(r.status)}</span></div><p className="mt-4 text-sm text-slate-600">{r.floor === 1 ? 'First' : 'Second'} floor{r.side ? ` Â· ${r.side} side` : ''} Â· {size(r)}</p><p className="mt-3 font-bold">{peso(r.monthly_rent)} <span className="text-sm font-normal text-slate-500">/ month</span></p><p className="mt-4 text-sm font-semibold text-[#315d87]">View details â†’</p></button>)}</div> : <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center text-slate-500">No rooms match these filters.</div>}</section><div id="tenancy"><TenancyPage rooms={rooms}/></div></div>}
    {selected && form && <div className="fixed inset-0 z-20 flex items-end justify-center bg-[#07182b]/60 md:items-center md:p-5"><section role="dialog" aria-modal="true" aria-label={`Room ${selected.code} details`} className="max-h-[94vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl bg-white p-6 shadow-xl md:rounded-2xl md:p-8"><div className="flex justify-between"><div><p className="text-sm text-slate-500">{selected.building.name}</p><h2 className="text-2xl font-bold">Room {selected.code}</h2></div><button onClick={() => { setSelected(null); setError(''); setNotice('') }} aria-label="Close details" className="rounded-lg p-2 text-xl">Ã—</button></div><div className="mt-5"><h3 className="font-semibold">Photos</h3>{selected.photos.length ? <div className="mt-3 grid grid-cols-2 gap-3">{selected.photos.map(p => <div key={p.id}><img src={p.url} alt={p.original_name} className="aspect-[4/3] w-full rounded-lg border object-cover"/><div className="mt-2 flex items-center justify-between gap-2 text-xs"><span>{p.is_public ? 'Publicly approved' : 'Private'}</span><button type="button" disabled={busy} onClick={() => setPhotoVisibility(p)} className="rounded border border-slate-300 px-2 py-1 font-semibold disabled:opacity-50">{p.is_public ? 'Remove approval' : 'Approve for website'}</button></div></div>)}</div> : <div className="mt-3 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500">No room photos have been added yet.</div>}<label className="mt-3 inline-flex cursor-pointer rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold">Upload photo<input type="file" accept="image/jpeg,image/png,image/webp" onChange={upload} disabled={busy} className="sr-only"/></label><p className="mt-1 text-xs text-slate-500">JPEG, PNG, or WebP Â· 5 MB maximum. Uploads remain private until approved.</p></div><form onSubmit={save} className="mt-7 border-t border-slate-200 pt-6"><h3 className="mb-4 font-semibold">Room information</h3><div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-medium">Floor<select value={form.floor} onChange={e => setForm({ ...form, floor: e.target.value })} className="field"><option value="1">First floor</option><option value="2">Second floor</option></select></label><label className="text-sm font-medium">Side<select value={form.side} onChange={e => setForm({ ...form, side: e.target.value })} disabled={selected.building.name === 'Building 2'} className="field disabled:bg-slate-100"><option value="">Not applicable</option><option value="right">Right</option><option value="left">Left</option></select></label><label className="text-sm font-medium">Minimum size (sqm)<input type="number" min="0.01" step="0.01" required value={form.size_min_sqm} onChange={e => setForm({ ...form, size_min_sqm: e.target.value })} className="field"/></label><label className="text-sm font-medium">Maximum size (sqm)<input type="number" min="0.01" step="0.01" required value={form.size_max_sqm} onChange={e => setForm({ ...form, size_max_sqm: e.target.value })} className="field"/></label><label className="text-sm font-medium">Monthly rent (â‚±)<input type="number" min="0" step="0.01" required value={form.monthly_rent} onChange={e => setForm({ ...form, monthly_rent: e.target.value })} className="field"/></label><label className="text-sm font-medium">Status<select value={form.status} onChange={e => setForm({ ...form, status: e.target.value as Status })} className="field">{statuses.map(s => <option key={s} value={s}>{title(s)}</option>)}</select></label></div><label className="mt-4 block text-sm font-medium">Amenities (comma separated)<input value={form.amenities} onChange={e => setForm({ ...form, amenities: e.target.value })} className="field"/></label><label className="mt-4 block text-sm font-medium">Description<textarea rows={3} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="field"/></label>{error && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}{notice && <p role="status" className="mt-4 rounded-lg bg-green-50 p-3 text-sm text-green-800">{notice}</p>}<div className="mt-5 flex justify-end"><button disabled={busy} className="rounded-lg bg-[#0B1F3A] px-5 py-3 font-semibold text-white disabled:opacity-50">{busy ? 'Savingâ€¦' : 'Save changes'}</button></div></form></section></div>}
  </main>
}

export default StaffDashboardPage
