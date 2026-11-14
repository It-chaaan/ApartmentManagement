import { useEffect, useMemo, useState } from 'react'
import * as api from '../services/staff'
import type { Room, UtilityBill } from '../types/staff'
import { formatStaffPeso as peso, titleCase } from '../utils/property'
import UtilityRefundPanel from '../components/staff/UtilityRefundPanel'
import MeterChargesPanel from '../components/staff/MeterChargesPanel'

const today = () => new Date().toLocaleDateString('en-CA')
const blankBill = { room_id: '', kind: 'electricity', period_month: today().slice(0, 7), due_on: '', amount: '', account_reference: '', delivered_on: '', notes: '' }
const blankPayment = () => ({ paid_on: today(), amount: '', method: 'cash', reference: '', notes: '', submission_key: crypto.randomUUID() })
const statusName = (status: UtilityBill['status']) => status === 'no_charge' ? 'No charge' : titleCase(status)

export default function UtilitiesPage({ rooms }: { rooms: Room[] }) {
  const [bills, setBills] = useState<UtilityBill[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(blankBill)
  const [payment, setPayment] = useState(blankPayment)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [voidPaymentId, setVoidPaymentId] = useState<number | null>(null)
  const [voidReason, setVoidReason] = useState('')
  const visible = useMemo(() => bills.filter(b => rooms.some(r => r.id === b.room_id)
    && (statusFilter === 'all' || b.status === statusFilter)
    && `${b.room.building.name} ${b.room.code} ${b.kind} ${b.period_month} ${b.account_reference ?? ''}`.toLowerCase().includes(query.trim().toLowerCase())), [bills, rooms, statusFilter, query])
  const selected = visible.find(b => b.id === selectedId) ?? visible[0] ?? null

  useEffect(() => {
    api.getUtilityBills().then(setBills).catch(e => setError((e as Error).message)).finally(() => setLoading(false))
  }, [])

  const create = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setError(''); setNotice('')
    try {
      const bill = await api.createUtilityBill({ ...form, room_id: Number(form.room_id), delivered_on: form.delivered_on || null, account_reference: form.account_reference || null, notes: form.notes || null })
      setBills(old => [bill, ...old]); setSelectedId(bill.id); setShowForm(false); setForm(blankBill); setNotice('Bill recorded.')
    } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }
  const pay = async (event: React.FormEvent) => {
    event.preventDefault(); if (!selected) return
    setBusy(true); setError(''); setNotice('')
    try {
      const bill = await api.recordUtilityPayment(selected.id, { ...payment, reference: payment.reference || null, notes: payment.notes || null })
      setBills(old => old.map(item => item.id === bill.id ? bill : item)); setPayment(blankPayment()); setNotice('Payment recorded.')
    } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }
  const upload = async (file?: File) => {
    if (!file || !selected) return
    if (file.type !== 'application/pdf' || file.size > 10 * 1024 * 1024) { setError('Choose a PDF up to 10 MB.'); return }
    setBusy(true); setError(''); setNotice('')
    try {
      const bill = await api.uploadUtilityBillFile(selected.id, file)
      setBills(old => old.map(item => item.id === bill.id ? bill : item)); setNotice('Bill PDF saved privately.')
    } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }
  const voidPayment = async (event: React.FormEvent) => {
    event.preventDefault(); if (!selected || !voidPaymentId || busy) return
    setBusy(true); setError(''); setNotice('')
    try { const bill = await api.voidUtilityPayment(selected.id, voidPaymentId, voidReason); setBills(old => old.map(item => item.id === bill.id ? bill : item)); setVoidPaymentId(null); setVoidReason(''); setNotice('Original payment retained as voided. Record the replacement if needed.') }
    catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }

  return <section aria-label="Utility bills" className="min-w-0">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold">Utility bills</h2><button type="button" onClick={() => { setShowForm(true); setError(''); setNotice('') }} disabled={!rooms.length} className="min-h-11 rounded-lg bg-[#111] px-4 text-sm font-semibold text-white disabled:opacity-50">Add bill</button></div>
    {loading && <p role="status" className="mt-5 text-sm text-[#595959]">Loading bills…</p>}
    {error && <p role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {notice && <p role="status" className="mt-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">{notice}</p>}
    <MeterChargesPanel rooms={rooms} onPosted={async () => setBills(await api.getUtilityBills())} />
    <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_160px]"><label className="text-sm font-semibold">Find bill<input type="search" className="field" value={query} onChange={event => setQuery(event.target.value)} placeholder="Room, month, utility, or account" /></label><label className="text-sm font-semibold">Status<select className="field" value={statusFilter} onChange={event => setStatusFilter(event.target.value)}><option value="all">All statuses</option><option value="unpaid">Unpaid</option><option value="partial">Partial</option><option value="overdue">Overdue</option><option value="overpaid">Overpaid</option><option value="paid">Paid</option><option value="no_charge">No charge</option></select></label></div>
    <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(280px,0.9fr)_minmax(0,1.4fr)]">
      <div className="min-w-0 rounded-xl border border-[#e0e0e0] bg-white">
        {visible.length ? visible.map(bill => <button key={bill.id} type="button" onClick={() => { setSelectedId(bill.id); setError(''); setNotice('') }} aria-pressed={selected?.id === bill.id} className={`flex min-h-20 w-full items-center justify-between gap-3 border-b border-[#e0e0e0] px-4 py-3 text-left last:border-b-0 hover:bg-[#fafafa] focus-visible:outline-2 focus-visible:outline-[#0B1F3A] ${selected?.id === bill.id ? 'bg-[#f5f7f9]' : ''}`}><span className="min-w-0"><strong className="block text-sm">{bill.room.building.name} · Room {bill.room.code}</strong><span className="text-xs text-[#595959]">{titleCase(bill.kind)} · {bill.period_month}</span></span><span className="shrink-0 text-right"><strong className="block text-sm">{peso(bill.balance)}</strong><span className="text-xs text-[#595959]">{statusName(bill.status)}</span></span></button>) : !loading && <p className="p-6 text-sm text-[#595959]">{bills.length ? 'No bills match these filters.' : 'No utility bills recorded.'}</p>}
      </div>
      <div className="min-w-0 rounded-xl border border-[#e0e0e0] bg-white p-5">
        {selected ? <>
          <div className="flex flex-wrap justify-between gap-3"><div><h3 className="text-xl font-semibold">{titleCase(selected.kind)} · Room {selected.room.code}</h3><p className="text-sm text-[#595959]">{selected.room.building.name} · {selected.period_month}</p></div><span className="h-fit rounded-full border border-[#d9e2ec] px-3 py-1 text-xs font-semibold">{statusName(selected.status)}</span></div>
          <dl className="mt-5 grid gap-4 border-y border-[#e0e0e0] py-4 text-sm sm:grid-cols-3"><div><dt className="text-[#595959]">Amount</dt><dd className="font-semibold">{peso(selected.amount)}</dd></div><div><dt className="text-[#595959]">Paid</dt><dd className="font-semibold">{peso(selected.paid_amount)}</dd></div><div><dt className="text-[#595959]">Balance</dt><dd className="font-semibold">{peso(selected.balance)}</dd></div></dl>
          <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2"><p><span className="text-[#595959]">Due</span><br />{selected.due_on}</p><p><span className="text-[#595959]">Delivered to room</span><br />{selected.delivered_on || 'Not recorded'}</p>{selected.account_reference && <p><span className="text-[#595959]">Account reference</span><br />{selected.account_reference}</p>}</div>
          {selected.notes && <p className="mt-4 whitespace-pre-wrap text-sm">{selected.notes}</p>}
          <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-[#e0e0e0] pt-4 text-sm">{selected.file_name && !selected.file_needs_review && <a href={`/api/utility-bills/${selected.id}/file`} className="font-semibold text-[#0B1F3A] underline">View {selected.file_name}</a>}{selected.file_needs_review && <p className="w-full rounded-lg bg-amber-50 p-3">The attached PDF shows an earlier amount. Upload a corrected PDF before sharing this bill.</p>}<label className="inline-flex min-h-11 cursor-pointer items-center rounded-lg border border-[#d5d5d5] px-3 font-semibold focus-within:outline-2 focus-within:outline-[#0B1F3A]">{selected.file_name ? 'Replace PDF' : 'Upload PDF'}<input className="sr-only" type="file" accept="application/pdf" disabled={busy} onChange={event => { void upload(event.target.files?.[0]); event.target.value = '' }} /></label></div>
          <div className="mt-6 grid gap-5 lg:grid-cols-2"><div><h4 className="font-semibold">Payment history</h4>{selected.payments.length ? <ul className="mt-2 divide-y text-sm">{selected.payments.map(item => <li key={item.id} className="py-2"><strong>{peso(item.amount)}{item.voided_at ? " · Voided" : ""}</strong> · {item.paid_on}<span className="block text-[#595959]">{titleCase(item.method)}{item.reference ? ` · ${item.reference}` : ''}</span></li>)}</ul> : <p className="mt-2 text-sm text-[#595959]">No payments recorded.</p>}</div>{<form onSubmit={pay}><h4 className="font-semibold">Record payment</h4><div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-1"><label className="text-sm">Date<input required type="date" className="field" value={payment.paid_on} onChange={e => setPayment({ ...payment, paid_on: e.target.value })} /></label><label className="text-sm">Amount (₱)<input required type="number" min="0.01" step="0.01" className="field" value={payment.amount} onChange={e => setPayment({ ...payment, amount: e.target.value })} /></label><label className="text-sm">Method<select className="field" value={payment.method} onChange={e => setPayment({ ...payment, method: e.target.value })}><option value="cash">Cash</option><option value="bank_transfer">Bank transfer</option><option value="gcash">GCash</option><option value="other">Other</option></select></label><label className="text-sm">Reference<input className="field" maxLength={120} value={payment.reference} onChange={e => setPayment({ ...payment, reference: e.target.value })} /></label></div><button disabled={busy} className="mt-4 min-h-11 rounded-lg bg-[#111] px-4 text-sm font-semibold text-white disabled:opacity-50">{busy ? 'Saving…' : 'Save payment'}</button></form>}</div>
          <div className="mt-5 border-t border-[#e0e0e0] pt-4"><h4 className="font-semibold">Correct a payment</h4><p className="mt-1 text-xs text-[#595959]">The original stays in history with a reason and the staff member who voided it.</p>{selected.payments.map(item => <div key={item.id} className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#eee] p-3 text-sm"><div><strong>{peso(item.amount)}{item.voided_at ? " · Voided" : ""}</strong> · {item.paid_on}{item.voided_at && <p className="text-[#595959]">Voided by {item.voider?.name ?? 'staff'}: {item.void_reason}</p>}</div>{!item.voided_at && <button type="button" onClick={() => { setVoidPaymentId(item.id); setVoidReason('') }} className="min-h-11 rounded-lg border border-[#bbb] px-3 font-semibold">Correct entry</button>}</div>)}{voidPaymentId && <form onSubmit={voidPayment} className="mt-3 rounded-lg border border-[#ddd] p-3"><label className="text-sm font-semibold">Reason for voiding payment #{voidPaymentId}<textarea required minLength={3} maxLength={2000} rows={2} className="field" value={voidReason} onChange={event => setVoidReason(event.target.value)} /></label><div className="mt-3 flex gap-2"><button disabled={busy} className="min-h-11 rounded-lg bg-[#111] px-4 text-sm font-semibold text-white disabled:opacity-50">Void payment</button><button type="button" onClick={() => setVoidPaymentId(null)} className="min-h-11 rounded-lg border border-[#ddd] px-4 text-sm">Cancel</button></div></form>}</div>
          <UtilityRefundPanel key={selected.id} bill={selected} onChanged={async () => setBills(await api.getUtilityBills())} />
        </> : <p className="text-sm text-[#595959]">Select a bill to view details and payments.</p>}
      </div>
    </div>
    {showForm && <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/55 sm:items-center sm:p-5"><form onSubmit={create} aria-label="New utility bill" className="max-h-[95vh] w-full max-w-xl overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl sm:p-7"><div className="flex items-center justify-between gap-3"><h3 className="text-xl font-semibold">Add utility bill</h3><button type="button" onClick={() => setShowForm(false)} aria-label="Close bill form" className="min-h-11 rounded-lg px-3 text-xl">×</button></div><div className="mt-4 grid gap-4 sm:grid-cols-2"><label className="text-sm">Room<select required className="field" value={form.room_id} onChange={e => setForm({ ...form, room_id: e.target.value })}><option value="">Select room</option>{rooms.map(room => <option key={room.id} value={room.id}>{room.building.name} · Room {room.code}</option>)}</select></label><label className="text-sm">Utility<select className="field" value={form.kind} onChange={e => setForm({ ...form, kind: e.target.value })}><option value="electricity">Electricity</option><option value="water">Water</option></select></label><label className="text-sm">Billing month<input required type="month" className="field" value={form.period_month} onChange={e => setForm({ ...form, period_month: e.target.value })} /></label><label className="text-sm">Due date<input required type="date" className="field" value={form.due_on} onChange={e => setForm({ ...form, due_on: e.target.value })} /></label><label className="text-sm">Amount (₱)<input required type="number" min="0.01" step="0.01" className="field" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} /></label><label className="text-sm">Delivered to room<input type="date" className="field" value={form.delivered_on} onChange={e => setForm({ ...form, delivered_on: e.target.value })} /></label><label className="text-sm sm:col-span-2">Account reference<input className="field" maxLength={120} value={form.account_reference} onChange={e => setForm({ ...form, account_reference: e.target.value })} /></label><label className="text-sm sm:col-span-2">Notes<textarea className="field" rows={2} maxLength={2000} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></label></div>{error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}<button disabled={busy} className="mt-5 min-h-11 rounded-lg bg-[#111] px-5 text-sm font-semibold text-white disabled:opacity-50">{busy ? 'Saving…' : 'Save bill'}</button></form></div>}
  </section>
}
