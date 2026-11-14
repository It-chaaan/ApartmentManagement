import { useEffect, useMemo, useState } from 'react'
import * as api from '../../services/staff'
import type { Room, UtilityMeterCharge } from '../../types/staff'
import { formatStaffPeso as peso, titleCase } from '../../utils/property'

const today = () => new Date().toLocaleDateString('en-CA')
const emptyForm = () => ({
  room_id: '', kind: 'electricity', period_month: today().slice(0, 7),
  previous_read_on: '', current_read_on: today(), previous_reading: '', current_reading: '',
  rate_per_unit: '', due_on: '',
})
type ReadingForm = ReturnType<typeof emptyForm>

export default function MeterChargesPanel({ rooms, onPosted }: { rooms: Room[]; onPosted: () => Promise<void> }) {
  const [charges, setCharges] = useState<UtilityMeterCharge[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState<ReadingForm>(emptyForm)
  const [reason, setReason] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const visible = useMemo(() => charges.filter(charge => rooms.some(room => room.id === charge.room_id)), [charges, rooms])
  const selected = visible.find(charge => charge.id === selectedId) ?? visible[0] ?? null
  const lockedKey = Boolean(charges.find(charge => charge.id === editingId)?.utility_bill_id)

  useEffect(() => {
    api.getUtilityMeterCharges().then(setCharges).catch(cause => setError((cause as Error).message)).finally(() => setLoading(false))
  }, [])

  const update = (charge: UtilityMeterCharge) => {
    setCharges(old => [charge, ...old.filter(item => item.id !== charge.id)])
    setSelectedId(charge.id)
  }
  const save = async (event: React.FormEvent) => {
    event.preventDefault(); if (busy) return
    setBusy(true); setError(''); setNotice('')
    try {
      const payload = { ...form, room_id: Number(form.room_id) }
      const charge = editingId
        ? await api.correctUtilityMeterCharge(editingId, { ...payload, reason })
        : await api.createUtilityMeterCharge(payload)
      update(charge); setShowForm(false); setEditingId(null); setReason('')
      setNotice(editingId ? 'Reading correction saved for staff approval; earlier values remain in history.' : 'Meter charge saved as a draft for review.')
    } catch (cause) { setError((cause as Error).message) } finally { setBusy(false) }
  }
  const approve = async () => {
    if (!selected || busy) return
    setBusy(true); setError(''); setNotice('')
    try {
      const wasRevision = selected.status === 'revision'
      update(await api.approveUtilityMeterCharge(selected.id))
      await onPosted()
      setNotice(wasRevision ? 'Revised bill approved and updated.' : 'Calculated bill posted. It is now in the utility bills list.')
    } catch (cause) { setError((cause as Error).message) } finally { setBusy(false) }
  }
  const beginCorrection = (charge: UtilityMeterCharge) => {
    setEditingId(charge.id)
    setForm({
      room_id: String(charge.room_id), kind: charge.kind, period_month: charge.period_month,
      previous_read_on: charge.previous_read_on, current_read_on: charge.current_read_on,
      previous_reading: charge.previous_reading, current_reading: charge.current_reading,
      rate_per_unit: charge.rate_per_unit, due_on: charge.due_on,
    })
    setReason(''); setError(''); setNotice(''); setShowForm(true)
  }
  const field = (key: keyof ReadingForm, label: string, type: string, step?: string) =>
    <label className="text-sm font-semibold">{label}<input required disabled={lockedKey && key === 'period_month'} className="field" type={type} step={step} min={type === 'number' ? '0' : undefined} value={form[key]} onChange={event => setForm(old => ({ ...old, [key]: event.target.value }))} /></label>

  return <section aria-label="Meter-based charges" className="mt-5 rounded-xl border border-[#dedede] bg-white p-4 sm:p-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-semibold">Meter-based charges</h3><p className="mt-1 text-xs text-[#595959]">Record both readings and the rate for this period. Review the calculated draft before posting a bill.</p></div><button type="button" onClick={() => { setEditingId(null); setForm(emptyForm()); setShowForm(true); setError(''); setNotice('') }} disabled={!rooms.length} className="min-h-11 rounded-lg border border-[#bbb] px-4 text-sm font-semibold disabled:opacity-50">Record reading</button></div>
    {loading && <p role="status" className="mt-4 text-sm text-[#595959]">Loading meter charges…</p>}
    {error && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {notice && <p role="status" className="mt-4 rounded-lg bg-green-50 p-3 text-sm text-green-800">{notice}</p>}
    {!loading && <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(230px,.8fr)_minmax(0,1.2fr)]"><div className="space-y-2">{visible.length ? visible.map(charge => <button key={charge.id} type="button" onClick={() => setSelectedId(charge.id)} aria-pressed={selected?.id === charge.id} className="min-h-16 w-full rounded-lg border border-[#ddd] p-3 text-left text-sm focus-visible:outline-2 focus-visible:outline-[#0B1F3A]"><strong className="block">{charge.room.building.name} · Room {charge.room.code}</strong><span className="text-[#595959]">{titleCase(charge.kind)} · {charge.period_month} · {charge.status}</span></button>) : <p className="text-sm text-[#595959]">No meter readings recorded. Manual bill entry is still available below.</p>}</div>
      {selected && <div className="min-w-0 rounded-lg border border-[#ddd] p-4 text-sm"><div className="flex flex-wrap justify-between gap-2"><div><h4 className="font-semibold">{titleCase(selected.kind)} · {selected.period_month}</h4><p className="text-[#595959]">{selected.room.building.name} · Room {selected.room.code} · {selected.status}</p></div><strong>{peso(selected.amount)}</strong></div>
        {selected.status === 'revision' && <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm">This revised amount is pending approval. The posted bill keeps its earlier amount until approval.</p>}
        <dl className="mt-3 grid gap-3 sm:grid-cols-2"><div><dt className="text-[#595959]">Previous</dt><dd>{selected.previous_reading} {selected.unit} · {selected.previous_read_on}</dd></div><div><dt className="text-[#595959]">Current</dt><dd>{selected.current_reading} {selected.unit} · {selected.current_read_on}</dd></div><div><dt className="text-[#595959]">Usage</dt><dd>{selected.units_used} {selected.unit}</dd></div><div><dt className="text-[#595959]">Rate</dt><dd>₱{selected.rate_per_unit} per {selected.unit}</dd></div><div><dt className="text-[#595959]">Due</dt><dd>{selected.due_on}</dd></div><div><dt className="text-[#595959]">Approval</dt><dd>{selected.approved_by ?? 'Awaiting staff review'}</dd></div></dl>
        <div className="mt-4 flex flex-wrap gap-2"><button type="button" onClick={() => beginCorrection(selected)} className="min-h-11 rounded-lg border border-[#bbb] px-3 font-semibold">Correct reading or rate</button>{selected.status !== 'posted' && <button type="button" disabled={busy} onClick={() => { void approve() }} className="min-h-11 rounded-lg bg-[#111] px-3 font-semibold text-white disabled:opacity-50">{selected.status === 'revision' ? 'Approve revised bill' : 'Approve and post bill'}</button>}</div>
        {selected.history.length > 0 && <details className="mt-4 border-t border-[#eee] pt-3"><summary className="cursor-pointer font-semibold">Correction history ({selected.history.length})</summary><ul className="mt-2 space-y-3">{selected.history.map((entry, index) => <li key={index} className="rounded-lg bg-[#f7f7f7] p-3"><strong>Earlier: {entry.previous.previous_reading} → {entry.previous.current_reading} {entry.previous.kind === 'electricity' ? 'kWh' : 'm³'} · {peso(entry.previous.amount)}</strong><p className="text-[#595959]">Rate ₱{entry.previous.rate_per_unit} · {entry.previous.period_month.slice(0, 7)}</p><p className="text-[#595959]">{entry.corrected_by.name} · {new Date(entry.corrected_at).toLocaleDateString()}{entry.previous_approval ? ` · Previously approved by ${entry.previous_approval.by}` : ''}</p><p className="break-words">{entry.reason}</p></li>)}</ul></details>}
      </div>}
    </div>}
    {showForm && <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/55 sm:items-center sm:p-5"><form onSubmit={save} aria-label={editingId ? 'Correct meter charge' : 'New meter charge'} className="max-h-[95vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl sm:p-7"><div className="flex items-center justify-between gap-3"><h3 className="text-xl font-semibold">{editingId ? 'Correct meter charge' : 'Record meter reading'}</h3><button type="button" onClick={() => setShowForm(false)} aria-label="Close meter form" className="min-h-11 rounded-lg px-3 text-xl">×</button></div><p className="mt-2 text-sm text-[#595959]">The billing month must match the current reading date. No bill is posted until staff approve the draft.</p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2"><label className="text-sm font-semibold">Room<select required disabled={lockedKey} className="field" value={form.room_id} onChange={event => setForm(old => ({ ...old, room_id: event.target.value }))}><option value="">Select room</option>{rooms.map(room => <option key={room.id} value={room.id}>{room.building.name} · Room {room.code}</option>)}</select></label><label className="text-sm font-semibold">Utility<select disabled={lockedKey} className="field" value={form.kind} onChange={event => setForm(old => ({ ...old, kind: event.target.value }))}><option value="electricity">Electricity (kWh)</option><option value="water">Water (m³)</option></select></label>
      {field('period_month', 'Billing month', 'month')}{field('due_on', 'Due date', 'date')}{field('previous_read_on', 'Previous reading date', 'date')}{field('previous_reading', 'Previous reading', 'number', '0.001')}{field('current_read_on', 'Current reading date', 'date')}{field('current_reading', 'Current reading', 'number', '0.001')}{field('rate_per_unit', form.kind === 'electricity' ? 'Rate per kWh (₱)' : 'Rate per m³ (₱)', 'number', '0.0001')}
      {editingId && <label className="text-sm font-semibold sm:col-span-2">Reason for correction<textarea required minLength={3} maxLength={2000} rows={2} className="field" value={reason} onChange={event => setReason(event.target.value)} /></label>}</div>
      {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}<div className="mt-5 flex flex-wrap gap-2"><button disabled={busy} className="min-h-11 rounded-lg bg-[#111] px-5 text-sm font-semibold text-white disabled:opacity-50">{busy ? 'Saving…' : editingId ? 'Save correction' : 'Save draft'}</button><button type="button" onClick={() => setShowForm(false)} className="min-h-11 rounded-lg border border-[#ddd] px-4 text-sm">Cancel</button></div></form></div>}
  </section>
}
