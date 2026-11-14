import { useEffect, useMemo, useState } from 'react'
import * as api from '../services/staff'
import type { Contract, Room, Tenant } from '../types/staff'
import ContractSigningPanel from '../components/staff/ContractSigningPanel'
import ContractDocumentPanel from '../components/staff/ContractDocumentPanel'
import { formatStaffPeso as peso } from '../utils/property'

const today = () => new Date().toLocaleDateString('en-CA')
const yearAfter = (date: string) => { const d = new Date(`${date}T12:00:00`); d.setFullYear(d.getFullYear() + 1); return d.toLocaleDateString('en-CA') }
const blankTenant = { full_name: '', phone: '', email: '', contact_address: '', emergency_name: '', emergency_phone: '', emergency_relationship: '' }

export default function TenancyPage({ rooms, buildingId, focusContractId, onOpenPayment, onOpenChecklist, isOwner }: { rooms: Room[]; buildingId: string; focusContractId: number | null; onOpenPayment: (id: number) => void; onOpenChecklist: (roomId: number) => void; isOwner: boolean }) {
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [contracts, setContracts] = useState<Contract[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [selectedTenant, setSelectedTenant] = useState<number | null>(null)
  const [selectedContract, setSelectedContract] = useState<number | null>(focusContractId)
  const [tenantForm, setTenantForm] = useState(blankTenant)
  const [contractForm, setContractForm] = useState({ tenant_id: '', room_id: '', previous_contract_id: '', signed_on: today(), starts_on: today(), ends_on: yearAfter(today()), monthly_rent: '', due_day: '1', advance_amount: '', deposit_amount: '' })
  const [endForm, setEndForm] = useState({ ended_on: today(), end_review_note: '' })
  const [view, setView] = useState<'tenants' | 'contracts' | 'history'>(focusContractId ? 'contracts' : 'tenants')
  const [showTenantForm, setShowTenantForm] = useState(false)
  const [showContractForm, setShowContractForm] = useState(false)
  const [query, setQuery] = useState('')
  const load = async () => {
    try { const [t, c] = await Promise.all([api.getTenants(), api.getContracts()]); setTenants(t); setContracts(c); setError('') }
    catch (e) { setError((e as Error).message) } finally { setLoading(false) }
  }
  useEffect(() => {
    Promise.all([api.getTenants(), api.getContracts()])
      .then(([t, c]) => { setTenants(t); setContracts(c) })
      .catch(e => setError((e as Error).message))
      .finally(() => setLoading(false))
  }, [])
  const scopedContracts = useMemo(() => contracts.filter(c => rooms.some(r => r.id === c.room_id)), [contracts, rooms])
  const visibleContracts = useMemo(() => scopedContracts.filter(c => `${c.id} ${c.tenant.full_name} ${c.room.building.name} ${c.room.code} ${c.status}`.toLowerCase().includes(query.trim().toLowerCase())), [scopedContracts, query])
  const visibleTenants = useMemo(() => (buildingId === 'all' ? tenants : tenants.filter(t => !t.contracts.length || scopedContracts.some(c => c.tenant_id === t.id))).filter(t => `${t.full_name} ${t.phone ?? ''} ${t.email ?? ''}`.toLowerCase().includes(query.trim().toLowerCase())), [tenants, scopedContracts, buildingId, query])
  const tenant = visibleTenants.find(t => t.id === selectedTenant) ?? visibleTenants[0]
  const contract = visibleContracts.find(c => c.id === selectedContract) ?? visibleContracts[0]
  const tenantContracts = useMemo(() => scopedContracts.filter(c => c.tenant_id === tenant?.id), [scopedContracts, tenant?.id])
  const pastContracts = useMemo(() => visibleContracts.filter(c => c.status === 'ended' || c.status === 'renewed'), [visibleContracts])
  const run = async (action: () => Promise<unknown>, success: string) => {
    setBusy(true); setError(''); setNotice('')
    try { await action(); await load(); setNotice(success) } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }
  const editTenant = (t?: Tenant) => {
    setSelectedTenant(t?.id ?? null)
    setTenantForm(t ? Object.fromEntries(Object.keys(blankTenant).map(key => [key, (t as unknown as Record<string, string | null>)[key] ?? ''])) as typeof blankTenant : blankTenant)
    setShowTenantForm(true); setError(''); setNotice('')
  }
  const beginContract = (t?: Tenant, prior?: Contract) => {
    const room = rooms.find(r => r.id === prior?.room_id)
    const start = prior ? prior.ends_on : today()
    const monthlyRent = prior?.monthly_rent ?? room?.monthly_rent ?? ''
    setContractForm({ tenant_id: String(t?.id ?? prior?.tenant_id ?? ''), room_id: String(prior?.room_id ?? ''), previous_contract_id: String(prior?.id ?? ''), signed_on: today(), starts_on: start, ends_on: yearAfter(start), monthly_rent: monthlyRent, due_day: String(prior?.due_day ?? 1), advance_amount: monthlyRent, deposit_amount: monthlyRent })
    setShowContractForm(true); setError(''); setNotice('')
  }
  return <section className="staff-tenancy min-w-0" aria-label="Tenants and contracts">
    <div className="overflow-hidden rounded-2xl border border-[#dedede] bg-white">
      <div className="flex flex-col gap-4 border-b border-[#dedede] p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div role="group" aria-label="Tenancy views" className="inline-flex w-full gap-1 rounded-xl bg-[#f3f3f3] p-1 sm:w-auto">
          {(['tenants', 'contracts', 'history'] as const).map(item => <button
            key={item}
            type="button"
            aria-pressed={view === item}
            onClick={() => { setView(item); setError(''); setNotice('') }}
            className={`min-h-11 flex-1 rounded-lg px-4 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0B1F3A] sm:flex-none ${view === item ? 'bg-[#111] text-white shadow-sm' : 'text-[#444] hover:bg-white'}`}
          >{item[0].toUpperCase() + item.slice(1)}</button>)}
        </div>
        {view === 'tenants' && <button type="button" onClick={() => editTenant()} className="min-h-11 rounded-lg bg-[#111] px-4 text-sm font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0B1F3A]">Add tenant</button>}
        {view === 'contracts' && <button type="button" onClick={() => beginContract()} disabled={!tenants.length} className="min-h-11 rounded-lg bg-[#111] px-4 text-sm font-semibold text-white disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0B1F3A]">New contract</button>}
      </div>

      <div className="p-4 sm:p-5">
        {error && <p role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        {notice && <p role="status" className="mb-4 rounded-lg bg-green-50 p-3 text-sm text-green-800">{notice}</p>}
        <label className="mb-4 block max-w-xl text-sm font-semibold">Find {view === 'tenants' ? 'tenant' : 'contract'}<input type="search" className="field" value={query} onChange={event => setQuery(event.target.value)} placeholder={view === 'tenants' ? 'Name, phone, or email' : 'Tenant, room, status, or contract number'} /></label>
        {loading ? <p role="status" className="py-8 text-sm text-[#595959]">Loading private records…</p> : <>
          {view === 'tenants' && <div className="grid gap-4 lg:grid-cols-[minmax(260px,.8fr)_minmax(0,1.2fr)]">
            <div className="min-w-0 space-y-2" aria-label="Tenant list">
              {visibleTenants.length ? visibleTenants.map(item => <button
                key={item.id}
                type="button"
                aria-pressed={tenant?.id === item.id}
                onClick={() => setSelectedTenant(item.id)}
                className={`block min-h-18 w-full rounded-xl border p-4 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0B1F3A] ${tenant?.id === item.id ? 'border-[#111] bg-[#f8f8f8]' : 'border-[#dedede] hover:bg-[#fafafa]'}`}
              ><strong className="block break-words text-sm">{item.full_name}</strong><span className="mt-1 block text-xs text-[#595959]">{item.phone || 'No phone recorded'}</span></button>) : <p className="rounded-xl border border-dashed border-[#d5d5d5] p-6 text-sm text-[#595959]">No tenants to show.</p>}
            </div>
            <div className="min-w-0 rounded-xl border border-[#dedede] p-4 sm:p-5">
              {tenant ? <>
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#e7e7e7] pb-4">
                  <div><h3 className="break-words text-lg font-bold">{tenant.full_name}</h3><p className="mt-1 break-words text-sm text-[#595959]">{tenant.phone || 'No phone'}{tenant.email ? ` · ${tenant.email}` : ''}</p></div>
                  <button type="button" onClick={() => editTenant(tenant)} className="min-h-10 rounded-lg border border-[#d5d5d5] px-3 text-sm font-semibold hover:bg-[#f7f7f7] focus-visible:outline-2 focus-visible:outline-[#0B1F3A]">Edit tenant</button>
                </div>
                <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2"><div><dt className="text-[#595959]">Address</dt><dd className="mt-1 break-words">{tenant.contact_address || 'Not recorded'}</dd></div><div><dt className="text-[#595959]">Emergency contact</dt><dd className="mt-1 break-words">{tenant.emergency_name || 'Not recorded'}{tenant.emergency_phone ? ` · ${tenant.emergency_phone}` : ''}{tenant.emergency_relationship ? ` · ${tenant.emergency_relationship}` : ''}</dd></div></dl>
                <div className="mt-6 flex flex-wrap items-center justify-between gap-3"><h4 className="font-semibold">Contracts</h4><button type="button" onClick={() => beginContract(tenant)} className="min-h-10 rounded-lg border border-[#d5d5d5] px-3 text-sm font-semibold hover:bg-[#f7f7f7] focus-visible:outline-2 focus-visible:outline-[#0B1F3A]">Create contract</button></div>
                {tenantContracts.length ? <div className="mt-2 space-y-2">{tenantContracts.map(item => <button key={item.id} type="button" onClick={() => { setSelectedContract(item.id); setView('contracts') }} className="block min-h-14 w-full rounded-lg border border-[#e5e5e5] p-3 text-left text-sm hover:bg-[#fafafa] focus-visible:outline-2 focus-visible:outline-[#0B1F3A]"><strong>Room {item.room.code} · {item.room.building.name}</strong><span className="mt-1 block text-xs text-[#595959]">{item.starts_on} to {item.ends_on} · {item.status}</span></button>)}</div> : <p className="mt-2 text-sm text-[#595959]">No contracts recorded.</p>}
              </> : <p className="text-sm text-[#595959]">Add a tenant to begin.</p>}
            </div>
          </div>}

          {view === 'contracts' && <div className="grid gap-4 lg:grid-cols-[minmax(260px,.8fr)_minmax(0,1.2fr)]">
            <div className="min-w-0 space-y-2" aria-label="Contract list">
              {visibleContracts.length ? visibleContracts.map(item => <button
                key={item.id}
                type="button"
                aria-pressed={contract?.id === item.id}
                onClick={() => setSelectedContract(item.id)}
                className={`block min-h-18 w-full rounded-xl border p-4 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0B1F3A] ${contract?.id === item.id ? 'border-[#111] bg-[#f8f8f8]' : 'border-[#dedede] hover:bg-[#fafafa]'}`}
              ><strong className="block break-words text-sm">Room {item.room.code} · {item.tenant.full_name}</strong><span className="mt-1 block text-xs text-[#595959]">{item.room.building.name} · {item.status} · #{item.id}</span></button>) : <p className="rounded-xl border border-dashed border-[#d5d5d5] p-6 text-sm text-[#595959]">No contracts to show.</p>}
            </div>
            <div className="min-w-0 rounded-xl border border-[#dedede] p-4 sm:p-5">
              {contract ? <>
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#e7e7e7] pb-4"><div><h3 className="break-words text-lg font-bold">Room {contract.room.code} · {contract.tenant.full_name}</h3><p className="mt-1 text-sm text-[#595959]">{contract.room.building.name} · Contract #{contract.id} · {contract.status}</p></div><button type="button" onClick={() => onOpenPayment(contract.id)} className="min-h-10 rounded-lg border border-[#d5d5d5] px-3 text-sm font-semibold hover:bg-[#f7f7f7] focus-visible:outline-2 focus-visible:outline-[#0B1F3A]">View payments</button></div>
                <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2"><div><dt className="text-[#595959]">Term</dt><dd>{contract.starts_on} to {contract.ends_on}</dd></div><div><dt className="text-[#595959]">Monthly rent</dt><dd>{peso(contract.monthly_rent)} · due day {contract.due_day}</dd></div><div><dt className="text-[#595959]">Advance / deposit</dt><dd>{peso(contract.advance_amount)} / {peso(contract.deposit_amount)}</dd></div><div><dt className="text-[#595959]">Signing / move-in</dt><dd>{contract.status === 'draft' ? 'Not signed' : contract.signed_on} · {contract.moved_in_on || 'Not moved in'}</dd></div></dl>
                {contract.previous_contract_id && <p className="mt-4 text-sm text-[#595959]">Renewal of contract #{contract.previous_contract_id}</p>}
                {contract.end_review_note && <p className="mt-4 text-sm"><strong>End review:</strong> {contract.end_review_note}</p>}
                <ContractSigningPanel key={`sign-${contract.id}`} contract={contract} onChanged={load} />
                <details className="mt-6 rounded-xl border border-[#dedede] p-4"><summary className="cursor-pointer font-semibold focus-visible:outline-2 focus-visible:outline-[#0B1F3A]">Documents and contract PDF</summary><div className="mt-4"><p className="text-xs text-[#595959]">Private contract files</p>{contract.files.map(file => <a key={file.id} href={`/api/contracts/${contract.id}/files/${file.id}`} className="mt-2 block break-all text-sm font-semibold underline">{file.kind === 'generated' ? 'Generated' : 'Signed'} · {file.original_name} · {new Date(file.created_at).toLocaleDateString()}</a>)}{!contract.files.length && <p className="mt-2 text-sm text-[#595959]">No files yet.</p>}<label className="mt-4 inline-flex min-h-11 cursor-pointer items-center rounded-lg border border-[#d5d5d5] px-3 text-sm font-semibold focus-within:outline-2 focus-within:outline-[#0B1F3A]">Upload signed PDF<input type="file" accept="application/pdf" disabled={busy} className="sr-only" onChange={event => { const file = event.target.files?.[0]; if (file) { if (file.type !== 'application/pdf' || file.size > 10 * 1024 * 1024) setError('Choose a PDF up to 10 MB.'); else void run(() => api.uploadContract(contract.id, file), 'Signed file saved.'); event.target.value = '' } }}/></label><ContractDocumentPanel key={`pdf-${contract.id}`} contract={contract} isOwner={isOwner} onChanged={load} onOpenChecklist={onOpenChecklist} /></div></details>
                {contract.status === 'active' && <div className="mt-6 flex flex-wrap gap-2"><button type="button" onClick={() => beginContract(undefined, contract)} className="min-h-11 rounded-lg border border-[#d5d5d5] px-4 text-sm font-semibold hover:bg-[#f7f7f7] focus-visible:outline-2 focus-visible:outline-[#0B1F3A]">Prepare renewal</button><details className="w-full rounded-xl border border-[#dedede] p-4"><summary className="cursor-pointer font-semibold focus-visible:outline-2 focus-visible:outline-[#0B1F3A]">End tenancy</summary><form className="mt-4" onSubmit={event => { event.preventDefault(); void run(() => api.endTenancy(contract.id, endForm), 'Tenancy ended. Room is unverified until checked.') }}><label className="block text-sm">End date<input required type="date" className="field" value={endForm.ended_on} onChange={event => setEndForm({ ...endForm, ended_on: event.target.value })}/></label><label className="mt-3 block text-sm">Review note<textarea required minLength={3} rows={2} className="field" value={endForm.end_review_note} onChange={event => setEndForm({ ...endForm, end_review_note: event.target.value })}/></label><button disabled={busy} className="mt-4 min-h-11 rounded-lg border border-[#aaa] px-4 text-sm font-semibold disabled:opacity-50">End tenancy</button></form></details></div>}
              </> : <p className="text-sm text-[#595959]">Create a contract to begin.</p>}
            </div>
          </div>}

          {view === 'history' && <div aria-label="Past contracts" className="max-w-4xl">
            {pastContracts.length ? <div className="space-y-2">{pastContracts.map(item => <button key={item.id} type="button" onClick={() => { setSelectedContract(item.id); setView('contracts') }} className="flex min-h-16 w-full flex-wrap items-center justify-between gap-2 rounded-xl border border-[#dedede] p-4 text-left hover:bg-[#fafafa] focus-visible:outline-2 focus-visible:outline-[#0B1F3A]"><span><strong className="block text-sm">Room {item.room.code} · {item.tenant.full_name}</strong><span className="mt-1 block text-xs text-[#595959]">{item.room.building.name} · {item.starts_on} to {item.ended_on || item.ends_on}</span></span><span className="text-xs font-semibold text-[#444]">{item.status === 'renewed' ? 'Renewed' : 'Ended'} →</span></button>)}</div> : <p className="rounded-xl border border-dashed border-[#d5d5d5] p-6 text-sm text-[#595959]">No past contracts to show.</p>}
          </div>}
        </>}
      </div>
    </div>
    {showTenantForm && <div className="fixed inset-0 z-30 flex items-end justify-center bg-[#07182b]/60 sm:items-center sm:p-5"><form onSubmit={e => { e.preventDefault(); void run(async () => { const saved = await api.saveTenant(tenantForm, selectedTenant ?? undefined); setSelectedTenant(saved.id); setShowTenantForm(false); setView('tenants') }, 'Tenant profile saved.') }} className="max-h-[95vh] w-full max-w-xl overflow-y-auto rounded-t-2xl bg-white p-5 sm:rounded-2xl sm:p-7" aria-label="Tenant profile"><div className="flex justify-between gap-3"><h3 className="text-xl font-bold">{selectedTenant ? 'Edit tenant' : 'Add tenant'}</h3><button type="button" onClick={() => setShowTenantForm(false)} aria-label="Close tenant form" className="p-2">×</button></div><div className="mt-4 grid gap-3 sm:grid-cols-2">{([['full_name','Full name'],['phone','Phone'],['email','Email'],['contact_address','Contact address'],['emergency_name','Emergency contact name'],['emergency_phone','Emergency contact phone'],['emergency_relationship','Emergency relationship']] as const).map(([key,label]) => <label key={key} className="min-w-0 text-sm font-medium">{label}<input className="field" type={key === 'email' ? 'email' : 'text'} maxLength={key === 'contact_address' ? 1000 : 200} required={key === 'full_name'} value={tenantForm[key]} onChange={e => setTenantForm({ ...tenantForm, [key]: e.target.value })}/></label>)}</div>{error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}<button disabled={busy} className="mt-5 rounded-lg bg-[#0B1F3A] px-5 py-3 font-semibold text-white disabled:opacity-50">Save profile</button></form></div>}
    {showContractForm && <div className="fixed inset-0 z-30 flex items-end justify-center bg-[#07182b]/60 sm:items-center sm:p-5"><form onSubmit={e => { e.preventDefault(); void run(async () => { const saved = await api.createContract({ ...contractForm, tenant_id: Number(contractForm.tenant_id), room_id: Number(contractForm.room_id), previous_contract_id: contractForm.previous_contract_id ? Number(contractForm.previous_contract_id) : null, due_day: Number(contractForm.due_day) }); setSelectedContract(saved.id); setShowContractForm(false); setView('contracts') }, 'Contract draft saved.') }} className="max-h-[95vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl bg-white p-5 sm:rounded-2xl sm:p-7" aria-label="Contract draft"><div className="flex justify-between gap-3"><div><h3 className="text-xl font-bold">{contractForm.previous_contract_id ? 'Prepare renewal' : 'New contract draft'}</h3><p className="text-sm text-slate-600">One-year dates are suggested. Review every date and amount against the signed agreement before saving.</p></div><button type="button" onClick={() => setShowContractForm(false)} aria-label="Close contract form" className="h-fit p-2">×</button></div><div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="text-sm font-medium">Tenant<select required className="field" disabled={!!contractForm.previous_contract_id} value={contractForm.tenant_id} onChange={e => setContractForm({ ...contractForm, tenant_id: e.target.value })}><option value="">Choose tenant</option>{tenants.map(t => <option key={t.id} value={t.id}>{t.full_name}</option>)}</select></label><label className="text-sm font-medium">Room<select required className="field" disabled={!!contractForm.previous_contract_id} value={contractForm.room_id} onChange={e => { const room = rooms.find(r => String(r.id) === e.target.value); setContractForm({ ...contractForm, room_id: e.target.value, monthly_rent: room?.monthly_rent ?? '', advance_amount: room?.monthly_rent ?? '', deposit_amount: room?.monthly_rent ?? '' }) }}><option value="">Choose room</option>{rooms.map(r => <option key={r.id} value={r.id}>{r.building.name} · Room {r.code} ({r.status})</option>)}</select></label>{([['signed_on','Signing date'],['starts_on','Start date'],['ends_on','End date']] as const).map(([key,label]) => <label key={key} className="text-sm font-medium">{label}<input required type="date" className="field" value={contractForm[key]} onChange={e => setContractForm({ ...contractForm, [key]: e.target.value, ...(key === 'starts_on' ? { ends_on: yearAfter(e.target.value) } : {}) })}/></label>)}<label className="text-sm font-medium">Monthly due day<input required type="number" min="1" max="31" className="field" value={contractForm.due_day} onChange={e => setContractForm({ ...contractForm, due_day: e.target.value })}/></label>{([['monthly_rent','Agreed monthly rent (₱)'],['advance_amount','One-month advance (₱)'],['deposit_amount','One-month deposit (₱)']] as const).map(([key,label]) => <label key={key} className="text-sm font-medium">{label}<input required type="number" min={key === 'monthly_rent' ? '0.01' : '0'} step="0.01" className="field" value={contractForm[key]} onChange={e => setContractForm({ ...contractForm, [key]: e.target.value, ...(key === 'monthly_rent' ? { advance_amount: e.target.value, deposit_amount: e.target.value } : {}) })}/></label>)}</div>{error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}<button disabled={busy} className="mt-5 rounded-lg bg-[#0B1F3A] px-5 py-3 font-semibold text-white disabled:opacity-50">Save draft</button></form></div>}
  </section>
}
