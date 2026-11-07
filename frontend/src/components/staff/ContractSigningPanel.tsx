import { useEffect, useState } from 'react'
import * as api from '../../services/staff'
import type { Contract } from '../../types/staff'
import { formatStaffPeso as peso } from '../../utils/property'

const today = () => new Date().toLocaleDateString('en-CA')

export default function ContractSigningPanel({ contract, onChanged }: { contract: Contract; onChanged: () => Promise<void> }) {
  const [signedOn, setSignedOn] = useState(contract.signed_on || today())
  const [movedInOn, setMovedInOn] = useState(contract.starts_on || today())
  const [method, setMethod] = useState('cash')
  const [reference, setReference] = useState('')
  const [notes, setNotes] = useState('')
  const [receivedFullPayment, setReceivedFullPayment] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [carried, setCarried] = useState<{ advance: number; deposit: number; rent: number } | null>(null)

  useEffect(() => {
    if (!contract.previous_contract_id || contract.status !== 'draft') return
    let current = true
    api.getLedgers().then(ledgers => {
      const previous = ledgers[String(contract.previous_contract_id)]
      if (current && previous) setCarried({
        advance: Number(previous.advance_remaining), deposit: Number(previous.deposit_paid),
        rent: Number(previous.installments.find(item => item.period_month === contract.starts_on.slice(0, 7))?.paid ?? 0),
      })
    }).catch(cause => { if (current) setError((cause as Error).message) })
    return () => { current = false }
  }, [contract.previous_contract_id, contract.starts_on, contract.status])

  const advanceDue = contract.previous_contract_id ? carried && Number(contract.advance_amount) - carried.advance : Number(contract.advance_amount)
  const depositDue = contract.previous_contract_id ? carried && Number(contract.deposit_amount) - carried.deposit : Number(contract.deposit_amount)
  const rentDue = contract.previous_contract_id ? carried && Number(contract.monthly_rent) - carried.rent : Number(contract.monthly_rent)

  const sign = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setError(''); setNotice('')
    try {
      await api.signContract(contract.id, { signed_on: signedOn, received_full_payment: receivedFullPayment, method, reference: reference || null, notes: notes || null })
      await onChanged(); setNotice('Signing and required payments recorded.')
    } catch (cause) { setError((cause as Error).message) } finally { setBusy(false) }
  }
  const moveIn = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setError(''); setNotice('')
    try {
      await api.moveIn(contract.id, { moved_in_on: movedInOn })
      await onChanged(); setNotice('Move-in recorded. Room marked occupied.')
    } catch (cause) { setError((cause as Error).message) } finally { setBusy(false) }
  }

  if (contract.status !== 'draft' && contract.status !== 'signed') return null

  return <div className="mt-6 border-t border-[#e0e0e0] pt-5">
    {error && <p role="alert" className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {notice && <p role="status" className="mb-3 rounded-lg bg-green-50 p-3 text-sm text-green-800">{notice}</p>}
    {contract.status === 'draft' ? <form onSubmit={sign}>
      <h4 className="font-semibold">Record signing</h4>
      <div className="mt-3 grid gap-3 rounded-lg border border-[#e0e0e0] p-4 text-sm sm:grid-cols-3">
        <p>First month’s rent due<br /><strong>{rentDue === null ? 'Loading…' : peso(Math.max(0, rentDue).toFixed(2))}</strong></p>
        <p>Advance due at signing<br /><strong>{advanceDue === null ? 'Loading…' : peso(Math.max(0, advanceDue).toFixed(2))}</strong></p>
        <p>Deposit due at signing<br /><strong>{depositDue === null ? 'Loading…' : peso(Math.max(0, depositDue).toFixed(2))}</strong></p>
      </div>
      {contract.previous_contract_id && <p className="mt-2 text-xs text-[#595959]">The existing advance and deposit carry over. Any increase is collected at signing. Rent already paid for the renewal month is credited.</p>}
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="text-sm">Signing and payment date<input required type="date" className="field" value={signedOn} onChange={event => setSignedOn(event.target.value)} /></label>
        <label className="text-sm">Payment method<select className="field" value={method} onChange={event => setMethod(event.target.value)}><option value="cash">Cash</option><option value="bank_transfer">Bank transfer</option><option value="gcash">GCash</option><option value="other">Other</option></select></label>
        <label className="text-sm">Reference<input className="field" maxLength={120} value={reference} onChange={event => setReference(event.target.value)} /></label>
        <label className="text-sm">Notes<input className="field" maxLength={2000} value={notes} onChange={event => setNotes(event.target.value)} /></label>
      </div>
      <label className="mt-4 flex items-start gap-3 text-sm"><input required type="checkbox" checked={receivedFullPayment} onChange={event => setReceivedFullPayment(event.target.checked)} className="mt-1 h-4 w-4 accent-[#0B1F3A]" /><span>I confirm the full signing payment was received.</span></label>
      <button disabled={busy || (!!contract.previous_contract_id && !carried)} className="mt-4 min-h-11 rounded-lg bg-[#111] px-4 text-sm font-semibold text-white disabled:opacity-50">{busy ? 'Recording…' : 'Confirm signing and payments'}</button>
    </form> : <form onSubmit={moveIn}>
      <h4 className="font-semibold">Record move-in</h4>
      <p className="mt-1 text-sm text-[#595959]">Signing payments are recorded. Keep the occupancy date separate.</p>
      <label className="mt-3 block max-w-xs text-sm">Move-in date<input required type="date" min={contract.signed_on} className="field" value={movedInOn} onChange={event => setMovedInOn(event.target.value)} /></label>
      <button disabled={busy} className="mt-4 min-h-11 rounded-lg bg-[#111] px-4 text-sm font-semibold text-white disabled:opacity-50">{busy ? 'Recording…' : 'Start tenancy'}</button>
    </form>}
  </div>
}
