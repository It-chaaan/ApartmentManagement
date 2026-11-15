import { useEffect, useState, type FormEvent } from 'react'
import * as api from '../../services/staff'
import type { Room, UtilityEmailImport } from '../../types/staff'
import { formatStaffPeso as peso, titleCase } from '../../utils/property'

const today = () => new Date().toLocaleDateString('en-CA')
const initialForm = () => ({ room_id: '', kind: 'electricity', period_month: today().slice(0, 7), due_on: '', amount: '', sender_address: '', message_id: '', received_on: today(), account_reference: '', notes: '' })

export default function UtilityEmailImportsPanel({ rooms, onApproved }: { rooms: Room[]; onApproved: () => Promise<void> }) {
  const [imports, setImports] = useState<UtilityEmailImport[]>([])
  const [form, setForm] = useState(initialForm)
  const [file, setFile] = useState<File | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [rejectId, setRejectId] = useState<number | null>(null)
  const [reason, setReason] = useState('')

  useEffect(() => { api.getUtilityEmailImports().then(setImports).catch(e => setError((e as Error).message)) }, [])
  const refresh = async () => setImports(await api.getUtilityEmailImports())
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!file) return
    if (file.type !== 'application/pdf' || file.size > 10 * 1024 * 1024) { setError('Choose a PDF up to 10 MB.'); return }
    setBusy(true); setError(''); setNotice('')
    try {
      const data = new FormData()
      Object.entries(form).forEach(([key, value]) => { if (value) data.append(key, value) })
      data.append('file', file)
      const imported = await api.importUtilityEmailSample(data)
      await refresh()
      setShowForm(false); setForm(initialForm()); setFile(null)
      setNotice(imported.status === 'exception' ? 'Sample saved as an exception for review.' : 'Sample saved for staff review. No bill has been posted.')
    } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }
  const approve = async (id: number) => {
    setBusy(true); setError(''); setNotice('')
    try { await api.approveUtilityEmailImport(id); await refresh(); await onApproved(); setNotice('Reviewed sample posted as a utility bill.') }
    catch (e) { setError((e as Error).message); await refresh() } finally { setBusy(false) }
  }
  const reject = async (event: FormEvent) => {
    event.preventDefault(); if (!rejectId) return
    setBusy(true); setError(''); setNotice('')
    try { await api.rejectUtilityEmailImport(rejectId, reason); await refresh(); setRejectId(null); setReason(''); setNotice('Sample rejected with a reason.') }
    catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }
  const visible = imports.filter(item => rooms.some(room => room.id === item.room_id))

  return <details className="mt-5 rounded-xl border border-[#dedede] bg-white p-4 sm:p-5">
    <summary className="cursor-pointer text-sm font-semibold focus-visible:outline-2 focus-visible:outline-[#0B1F3A]">Email bill samples and review queue {visible.some(item => item.status === 'pending' || item.status === 'exception') ? `· ${visible.filter(item => item.status === 'pending' || item.status === 'exception').length} to review` : ''}</summary>
    <p className="mt-3 text-xs text-[#595959]">Upload a PDF saved from a utility email and enter its details. The sender address is a staff transcription, not a verified email source. No charge is posted until staff approves the sample.</p>
    {error && <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {notice && <p role="status" className="mt-3 rounded-lg bg-green-50 p-3 text-sm text-green-800">{notice}</p>}
    <button type="button" onClick={() => setShowForm(value => !value)} className="mt-4 min-h-11 rounded-lg border border-[#d5d5d5] px-4 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-[#0B1F3A]">{showForm ? 'Close import form' : 'Import sample PDF'}</button>
    {showForm && <form onSubmit={submit} className="mt-4 grid gap-3 rounded-xl border border-[#dedede] p-4 sm:grid-cols-2" aria-label="Import utility email sample">
      <label className="text-sm">Room<select required className="field" value={form.room_id} onChange={e => setForm({ ...form, room_id: e.target.value })}><option value="">Choose room</option>{rooms.map(room => <option key={room.id} value={room.id}>{room.building.name} · Room {room.code}</option>)}</select></label>
      <label className="text-sm">Utility<select className="field" value={form.kind} onChange={e => setForm({ ...form, kind: e.target.value })}><option value="electricity">Electricity</option><option value="water">Water</option></select></label>
      <label className="text-sm">Billing month<input required type="month" className="field" value={form.period_month} onChange={e => setForm({ ...form, period_month: e.target.value })} /></label>
      <label className="text-sm">Due date<input required type="date" className="field" value={form.due_on} onChange={e => setForm({ ...form, due_on: e.target.value })} /></label>
      <label className="text-sm">Amount (₱)<input required type="number" min="0.01" step="0.01" className="field" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} /></label>
      <label className="text-sm">Received date<input required type="date" className="field" value={form.received_on} onChange={e => setForm({ ...form, received_on: e.target.value })} /></label>
      <label className="text-sm">Sender shown in email<input required type="email" className="field" value={form.sender_address} onChange={e => setForm({ ...form, sender_address: e.target.value })} /></label>
      <label className="text-sm">Email message ID, if known<input className="field" maxLength={255} value={form.message_id} onChange={e => setForm({ ...form, message_id: e.target.value })} /></label>
      <label className="text-sm">Account reference<input className="field" maxLength={120} value={form.account_reference} onChange={e => setForm({ ...form, account_reference: e.target.value })} /></label>
      <label className="text-sm">Bill PDF<input required type="file" accept="application/pdf" className="field" onChange={e => setFile(e.target.files?.[0] ?? null)} /></label>
      <label className="text-sm sm:col-span-2">Notes<textarea className="field" maxLength={2000} rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></label>
      <button disabled={busy} className="min-h-11 rounded-lg bg-[#111] px-4 text-sm font-semibold text-white disabled:opacity-50 sm:col-span-2 sm:w-fit">Save for review</button>
    </form>}
    <div className="mt-5 space-y-3">{visible.length ? visible.map(item => <div key={item.id} className="rounded-xl border border-[#dedede] p-4 text-sm">
      <div className="flex flex-wrap items-start justify-between gap-2"><div><strong>{item.room.building} · Room {item.room.code} · {titleCase(item.kind)}</strong><p className="mt-1 text-[#595959]">{item.period_month} · {peso(item.amount)} · due {item.due_on}</p></div><span className="rounded-full border px-3 py-1 text-xs font-semibold">{titleCase(item.status)}</span></div>
      <p className="mt-2 break-words text-xs text-[#595959]">Reported sender: {item.sender_address} · received {item.received_on} · imported by {item.imported_by}</p>
      {item.exception_reason && <p className="mt-2 rounded-lg bg-amber-50 p-2 text-xs">{item.exception_reason}</p>}
      {item.review_reason && <p className="mt-2 text-xs">Rejected by {item.reviewed_by}: {item.review_reason}</p>}
      <div className="mt-3 flex flex-wrap items-center gap-2"><a href={`/api/utility-email-imports/${item.id}/file`} className="inline-flex min-h-11 items-center rounded-lg border border-[#d5d5d5] px-3 font-semibold underline">Review {item.file_name}</a>{item.status === 'pending' && <button type="button" disabled={busy} onClick={() => void approve(item.id)} className="min-h-11 rounded-lg bg-[#111] px-3 font-semibold text-white disabled:opacity-50">Approve and post bill</button>}{(item.status === 'pending' || item.status === 'exception') && <button type="button" disabled={busy} onClick={() => { setRejectId(item.id); setReason('') }} className="min-h-11 rounded-lg border border-[#d5d5d5] px-3 font-semibold disabled:opacity-50">Reject</button>}</div>
      {rejectId === item.id && <form onSubmit={reject} className="mt-3"><label className="text-sm font-semibold">Reason for rejection<textarea required minLength={3} maxLength={2000} rows={2} className="field" value={reason} onChange={e => setReason(e.target.value)} /></label><button disabled={busy} className="mt-2 min-h-11 rounded-lg border border-[#d5d5d5] px-3 font-semibold">Save rejection</button></form>}
    </div>) : <p className="rounded-lg border border-dashed border-[#d5d5d5] p-5 text-sm text-[#595959]">No email bill samples imported for these rooms.</p>}</div>
  </details>
}
