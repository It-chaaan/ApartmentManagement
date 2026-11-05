import { useEffect, useMemo, useState } from 'react'
import * as api from '../../services/staff'
import type { Contract, DashboardSummary, Inspection, InspectionItem, Ledger, Room } from '../../types/staff'
import { formatStaffPeso as peso, titleCase } from '../../utils/property'

const areas = ['paint', 'doors', 'cabinets', 'lights', 'sink', 'bathroom_fixtures', 'tiles', 'windows'] as const
const emptyItems = (): InspectionItem[] => areas.map(area => ({ area, condition: 'not_checked', notes: '' }))
const today = () => new Date().toLocaleDateString('en-CA')

export default function OperationsWorkspace({ rooms, roomId, setRoomId, contractId, setContractId, onOpenRoom, onOpenContract }: {
  rooms: Room[]; roomId: number | null; setRoomId: (id: number | null) => void; contractId: number | null; setContractId: (id: number | null) => void
  onOpenRoom: (room: Room) => void; onOpenContract: (id: number) => void
}) {
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [contracts, setContracts] = useState<Contract[]>([])
  const [ledgers, setLedgers] = useState<Record<string, Ledger>>({})
  const [inspections, setInspections] = useState<Inspection[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [payment, setPayment] = useState({ kind: 'rent', period_month: '', paid_on: today(), amount: '', method: 'cash', reference: '', notes: '', submission_key: crypto.randomUUID() })
  const [inspection, setInspection] = useState({ type: 'routine', inspected_on: today(), contract_id: '', notes: '', items: emptyItems() })

  const reload = async () => {
    const [dashboard, contractsResult, ledgerResult] = await Promise.all([api.getDashboard(), api.getContracts(), api.getLedgers()])
    setSummary(dashboard); setContracts(contractsResult); setLedgers(ledgerResult)
  }
  useEffect(() => {
    Promise.all([api.getDashboard(), api.getContracts(), api.getLedgers()])
      .then(([dashboard, contractsResult, ledgerResult]) => { setSummary(dashboard); setContracts(contractsResult); setLedgers(ledgerResult) })
      .catch(e => setError((e as Error).message)).finally(() => setLoading(false))
  }, [])
  useEffect(() => {
    if (!roomId) return
    api.getInspections(roomId).then(setInspections).catch(e => setError((e as Error).message))
  }, [roomId])
  const room = rooms.find(r => r.id === roomId)
  const contract = contracts.find(c => c.id === contractId)
  const ledger = contractId ? ledgers[String(contractId)] : undefined
  const roomContracts = useMemo(() => contracts.filter(c => c.room_id === roomId), [contracts, roomId])
  const updateItem = (index: number, change: Partial<InspectionItem>) => setInspection(old => ({ ...old, items: old.items.map((item, i) => i === index ? { ...item, ...change } : item) }))
  const pay = async (event: React.FormEvent) => {
    event.preventDefault(); if (!contractId || busy) return
    setBusy(true); setError(''); setNotice('')
    try {
      await api.recordPayment(contractId, { ...payment, period_month: payment.kind === 'rent' ? payment.period_month : null })
      await reload(); setPayment({ kind: 'rent', period_month: '', paid_on: today(), amount: '', method: 'cash', reference: '', notes: '', submission_key: crypto.randomUUID() })
      setNotice('Payment recorded. The ledger has been updated.')
    } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }
  const inspect = async (event: React.FormEvent) => {
    event.preventDefault(); if (!roomId || busy) return
    setBusy(true); setError(''); setNotice('')
    try {
      await api.createInspection(roomId, { ...inspection, contract_id: inspection.contract_id ? Number(inspection.contract_id) : null })
      setInspections(await api.getInspections(roomId))
      setInspection({ type: 'routine', inspected_on: today(), contract_id: '', notes: '', items: emptyItems() })
      setNotice('Inspection checklist saved.')
    } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }
  const uploadPhoto = async (inspectionId: number, file?: File) => {
    if (!file || !roomId) return
    setBusy(true); setError(''); setNotice('')
    try { await api.uploadInspectionPhoto(inspectionId, file); setInspections(await api.getInspections(roomId)); setNotice('Private inspection photo saved.') }
    catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }

  return <div className="space-y-10">
    <section id="overview" aria-label="Staff overview" className="scroll-mt-6">
      <div className="flex flex-wrap items-end justify-between gap-2"><div><p className="text-xs font-bold uppercase tracking-widest text-[#0B1F3A]">Today’s work</p><h2 className="mt-1 text-2xl font-bold text-[#111]">Dashboard</h2></div><button type="button" onClick={() => { setLoading(true); reload().catch(e => setError((e as Error).message)).finally(() => setLoading(false)) }} className="min-h-11 rounded-lg border border-[#ddd] px-4 text-sm font-semibold">Refresh</button></div>
      {loading && <p role="status" className="mt-4 text-sm">Loading staff records…</p>}
      {error && <p role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {notice && <p role="status" className="mt-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">{notice}</p>}
      {summary && <><div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">{[
        ['Rooms', summary.room_count], ['Unverified', summary.statuses.unverified ?? 0],
        ['Active tenancies', summary.active_tenancies], ['Rent due', peso(String(summary.rent_due))],
      ].map(([label, value]) => <div key={label} className="rounded-xl border border-[#ddd] bg-white p-4"><p className="text-sm text-[#595959]">{label}</p><strong className="mt-1 block text-2xl text-[#111]">{value}</strong></div>)}</div>
        <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_1.5fr]"><div className="rounded-xl border border-[#ddd] bg-white p-4"><h3 className="font-semibold">Room status</h3><div className="mt-3 grid grid-cols-2 gap-2 text-sm">{(['available', 'reserved', 'occupied', 'maintenance'] as const).map(status => <div key={status}><span className="text-[#595959]">{titleCase(status)}</span><strong className="ml-2">{summary.statuses[status] ?? 0}</strong></div>)}</div></div><div className="rounded-xl border border-[#ddd] bg-white p-4"><h3 className="font-semibold">Rent due and next 30 days</h3>{summary.upcoming.length ? <ul className="mt-2 max-h-64 divide-y overflow-y-auto text-sm">{summary.upcoming.map(item => <li key={`${item.contract_id}-${item.period_month}`} className="flex flex-wrap items-center justify-between gap-2 py-2"><div><strong>{item.room}</strong><span className="ml-2 text-[#595959]">{item.tenant} · {item.due_on}</span></div><button type="button" onClick={() => { setContractId(item.contract_id); document.getElementById('payments')?.scrollIntoView({ behavior: 'smooth' }) }} className="min-h-10 font-semibold text-[#0B1F3A] underline">{peso(item.balance)} balance</button></li>)}</ul> : <p className="mt-2 text-sm text-[#595959]">No unpaid rent due in the next 30 days.</p>}</div></div></>}
    </section>

    <section id="payments" aria-label="Rent ledger" className="scroll-mt-6 border-t border-[#ddd] pt-8"><h2 className="text-2xl font-bold text-[#111]">Payments</h2><p className="mt-1 text-sm text-[#595959]">Manual entries only. Each rent payment is assigned to one month; advance and deposit remain separate.</p><label className="mt-4 block max-w-xl text-sm font-semibold">Contract<select className="field" value={contractId ?? ''} onChange={e => { setContractId(e.target.value ? Number(e.target.value) : null); setError(''); setNotice('') }}><option value="">Choose a contract</option>{contracts.map(c => <option key={c.id} value={c.id}>#{c.id} · {c.room.building.name} · Room {c.room.code} · {c.tenant.full_name}</option>)}</select></label>
      {contract && ledger && <div className="mt-4 grid gap-4 xl:grid-cols-[1.15fr_1fr]"><div className="min-w-0 rounded-xl border border-[#ddd] bg-white p-4 sm:p-5"><div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="font-bold">{contract.room.building.name} · Room {contract.room.code}</h3><p className="text-sm text-[#595959]">{contract.tenant.full_name} · Contract #{contract.id} · {contract.status}</p></div><button type="button" onClick={() => onOpenContract(contract.id)} className="min-h-10 text-sm font-semibold text-[#0B1F3A] underline">View contract</button></div><div className="mt-4 grid grid-cols-3 gap-2 border-y border-[#eee] py-3 text-sm"><div>Rent due<strong className="block">{peso(ledger.due_balance)}</strong></div><div>Advance paid<strong className="block">{peso(ledger.advance_paid)}</strong></div><div>Deposit paid<strong className="block">{peso(ledger.deposit_paid)}</strong></div></div><h4 className="mt-5 font-semibold">Monthly rent</h4><div className="mt-2 max-h-80 overflow-y-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b text-[#595959]"><th className="py-2">Month / due</th><th className="py-2 text-right">Due</th><th className="py-2 text-right">Paid</th><th className="py-2 text-right">Balance</th></tr></thead><tbody>{ledger.installments.map(row => <tr key={row.period_month} className="border-b last:border-0"><th className="py-2 font-medium">{row.period_month}<span className="block text-xs text-[#595959]">{row.due_on}</span></th><td className="py-2 text-right">{peso(row.amount)}</td><td className="py-2 text-right">{peso(row.paid)}</td><td className="py-2 text-right font-semibold">{peso(row.balance)}</td></tr>)}</tbody></table></div></div>
        <div className="min-w-0 space-y-4"><form onSubmit={pay} className="rounded-xl border border-[#ddd] bg-white p-4 sm:p-5"><h3 className="font-semibold">Record payment</h3><div className="mt-3 grid gap-3 sm:grid-cols-2"><label className="text-sm">Type<select className="field" value={payment.kind} onChange={e => setPayment({ ...payment, kind: e.target.value, period_month: '', amount: '', submission_key: crypto.randomUUID() })}><option value="rent">Monthly rent</option><option value="advance">Advance</option><option value="deposit">Deposit</option></select></label>{payment.kind === 'rent' && <label className="text-sm">Rent month<select required className="field" value={payment.period_month} onChange={e => setPayment({ ...payment, period_month: e.target.value, amount: '', submission_key: crypto.randomUUID() })}><option value="">Choose month</option>{ledger.installments.filter(i => Number(i.balance) > 0).map(i => <option key={i.period_month} value={i.period_month}>{i.period_month} · {peso(i.balance)} left</option>)}</select></label>}<label className="text-sm">Payment date<input required className="field" type="date" value={payment.paid_on} onChange={e => setPayment({ ...payment, paid_on: e.target.value, submission_key: crypto.randomUUID() })}/></label><label className="text-sm">Amount (₱)<input required className="field" type="number" min="0.01" step="0.01" value={payment.amount} onChange={e => setPayment({ ...payment, amount: e.target.value, submission_key: crypto.randomUUID() })}/></label><label className="text-sm">Method<select className="field" value={payment.method} onChange={e => setPayment({ ...payment, method: e.target.value, submission_key: crypto.randomUUID() })}><option value="cash">Cash</option><option value="bank_transfer">Bank transfer</option><option value="gcash">GCash</option><option value="other">Other</option></select></label><label className="text-sm sm:col-span-2">Reference<input className="field" maxLength={120} value={payment.reference} onChange={e => setPayment({ ...payment, reference: e.target.value, submission_key: crypto.randomUUID() })}/></label><label className="text-sm sm:col-span-2">Notes<textarea className="field" rows={2} maxLength={2000} value={payment.notes} onChange={e => setPayment({ ...payment, notes: e.target.value, submission_key: crypto.randomUUID() })}/></label></div><button disabled={busy || contract.status === 'draft'} className="mt-4 min-h-11 rounded-lg bg-[#111] px-5 text-sm font-semibold text-white disabled:opacity-50">{busy ? 'Saving…' : 'Record payment'}</button>{contract.status === 'draft' && <p className="mt-2 text-xs text-[#595959]">Start the tenancy before recording payments.</p>}</form><div className="rounded-xl border border-[#ddd] bg-white p-4 sm:p-5"><h3 className="font-semibold">Payment history</h3>{ledger.payments.length ? <ul className="mt-2 divide-y text-sm">{ledger.payments.map(p => <li key={p.id} className="py-2"><div className="flex justify-between gap-2"><strong>{titleCase(p.kind)}{p.period_month ? ` · ${p.period_month.slice(0, 7)}` : ''}</strong><strong>{peso(p.amount)}</strong></div><p className="text-[#595959]">{p.paid_on} · {titleCase(p.method)}{p.reference ? ` · ${p.reference}` : ''}</p>{p.notes && <p className="break-words">{p.notes}</p>}<p className="text-xs text-[#595959]">Recorded by {p.recorder?.name ?? 'Legacy record'}</p></li>)}</ul> : <p className="mt-2 text-sm text-[#595959]">No payments recorded.</p>}</div></div></div>}
    </section>

    <section id="inspections" aria-label="Unit checklists" className="scroll-mt-6 border-t border-[#ddd] pt-8"><h2 className="text-2xl font-bold text-[#111]">Unit checklists</h2><p className="mt-1 text-sm text-[#595959]">Repeat a move-in, routine, or move-out check whenever needed. Photos stay private.</p><label className="mt-4 block max-w-xl text-sm font-semibold">Room<select className="field" value={roomId ?? ''} onChange={e => { setRoomId(e.target.value ? Number(e.target.value) : null); setInspections([]); setError(''); setNotice('') }}><option value="">Choose a room</option>{rooms.map(r => <option key={r.id} value={r.id}>{r.building.name} · Room {r.code} · {titleCase(r.status)}</option>)}</select></label>
      {room && <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_1fr]"><form onSubmit={inspect} className="min-w-0 rounded-xl border border-[#ddd] bg-white p-4 sm:p-5"><div className="flex flex-wrap justify-between gap-2"><h3 className="font-bold">New checklist · {room.building.name} · Room {room.code}</h3><button type="button" onClick={() => onOpenRoom(room)} className="min-h-10 text-sm font-semibold text-[#0B1F3A] underline">Room photos & details</button></div><div className="mt-3 grid gap-3 sm:grid-cols-2"><label className="text-sm">Inspection type<select className="field" value={inspection.type} onChange={e => setInspection({ ...inspection, type: e.target.value })}><option value="move_in">Move-in</option><option value="routine">Routine</option><option value="move_out">Move-out</option></select></label><label className="text-sm">Inspection date<input required className="field" type="date" value={inspection.inspected_on} onChange={e => setInspection({ ...inspection, inspected_on: e.target.value })}/></label><label className="text-sm sm:col-span-2">Related contract (optional)<select className="field" value={inspection.contract_id} onChange={e => setInspection({ ...inspection, contract_id: e.target.value })}><option value="">No contract linked</option>{roomContracts.map(c => <option key={c.id} value={c.id}>#{c.id} · {c.tenant.full_name} · {c.status}</option>)}</select></label></div><div className="mt-5 space-y-2"><h4 className="font-semibold">Condition by area</h4>{inspection.items.map((item, index) => <div key={item.area} className="grid gap-2 border-t border-[#eee] py-2 sm:grid-cols-[120px_130px_1fr] sm:items-center"><strong className="text-sm">{titleCase(item.area)}</strong><label className="text-xs">Condition<select className="field" value={item.condition} onChange={e => updateItem(index, { condition: e.target.value as InspectionItem['condition'] })}><option value="not_checked">Not checked</option><option value="good">Good</option><option value="needs_repair">Needs repair</option></select></label><label className="text-xs">Note<input className="field" maxLength={1000} value={item.notes ?? ''} onChange={e => updateItem(index, { notes: e.target.value })}/></label></div>)}</div><label className="mt-3 block text-sm">General notes<textarea className="field" rows={2} maxLength={3000} value={inspection.notes} onChange={e => setInspection({ ...inspection, notes: e.target.value })}/></label><button disabled={busy} className="mt-4 min-h-11 rounded-lg bg-[#111] px-5 text-sm font-semibold text-white disabled:opacity-50">{busy ? 'Saving…' : 'Save checklist'}</button></form>
        <div className="min-w-0 rounded-xl border border-[#ddd] bg-white p-4 sm:p-5"><h3 className="font-bold">Inspection history</h3>{inspections.length ? <div className="mt-3 space-y-3">{inspections.map(i => <article key={i.id} className="rounded-lg border border-[#ddd] p-3"><h4 className="font-semibold">{titleCase(i.type)} · {i.inspected_on}</h4><p className="text-xs text-[#595959]">{i.inspector.name}{i.contract_id ? ` · Contract #${i.contract_id}` : ''}</p>{i.notes && <p className="mt-2 break-words text-sm">{i.notes}</p>}<ul className="mt-2 grid gap-1 text-sm sm:grid-cols-2">{i.items.map(item => <li key={item.area}><strong>{titleCase(item.area)}:</strong> {titleCase(item.condition)}{item.notes ? ` · ${item.notes}` : ''}</li>)}</ul><div className="mt-3 flex flex-wrap gap-2">{i.photos.map(p => <a key={p.id} href={`/api/inspections/${i.id}/photos/${p.id}`} target="_blank" rel="noreferrer" className="text-sm font-semibold text-[#0B1F3A] underline">{p.original_name}</a>)}</div><label className="mt-3 inline-flex min-h-11 cursor-pointer items-center rounded-lg border border-[#ddd] px-3 text-sm font-semibold">Add private photo<input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={e => { void uploadPhoto(i.id, e.target.files?.[0]); e.target.value = '' }}/></label></article>)}</div> : <p className="mt-2 text-sm text-[#595959]">No inspections recorded for this room.</p>}</div></div>}
    </section>
  </div>
}
