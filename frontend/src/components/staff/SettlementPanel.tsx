import { useEffect, useMemo, useState } from 'react'
import * as api from '../../services/staff'
import type { Contract, ContractAdjustment, Inspection, Ledger } from '../../types/staff'
import { formatStaffPeso as peso, titleCase } from '../../utils/property'

const today = () => new Date().toLocaleDateString('en-CA')
const kinds = [
  ['rent_refund', 'Rent overpayment refund'],
  ['advance_refund', 'Unused advance refund'],
  ['deposit_deduction', 'Damage deduction from deposit'],
  ['deposit_refund', 'Remaining deposit refund'],
] as const
type Kind = ContractAdjustment['kind']

export default function SettlementPanel({ contract, ledger, onChanged }: { contract: Contract; ledger: Ledger; onChanged: () => Promise<void> }) {
  const [inspections, setInspections] = useState<Inspection[]>([])
  const [kind, setKind] = useState<Kind>('rent_refund')
  const [amount, setAmount] = useState('')
  const [occurredOn, setOccurredOn] = useState(today())
  const [method, setMethod] = useState('cash')
  const [reference, setReference] = useState('')
  const [reason, setReason] = useState('')
  const [inspectionId, setInspectionId] = useState('')
  const [voidId, setVoidId] = useState<number | null>(null)
  const [voidReason, setVoidReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => { api.getInspections(contract.room_id).then(setInspections).catch(() => setInspections([])) }, [contract.room_id])
  const evidence = useMemo(() => inspections.filter(item => item.contract_id === contract.id && item.type === 'move_out' && item.items.some(part => part.condition === 'needs_repair') && item.photos.length > 0), [inspections, contract.id])
  const available = kind === 'rent_refund' ? ledger.rent_credit : kind === 'advance_refund' ? ledger.advance_refundable : ledger.deposit_refundable
  const canRecord = Number(available) > 0 && (kind !== 'deposit_deduction' || evidence.length > 0)

  const save = async (event: React.FormEvent) => {
    event.preventDefault(); if (busy) return
    setBusy(true); setError(''); setNotice('')
    try {
      await api.addContractAdjustment(contract.id, { kind, amount, occurred_on: occurredOn, method: kind === 'deposit_deduction' ? null : method, reference: reference || null, reason, inspection_id: kind === 'deposit_deduction' ? Number(inspectionId) : null })
      await onChanged(); setAmount(''); setReason(''); setReference(''); setInspectionId(''); setNotice(kind === 'deposit_deduction' ? 'Damage deduction approved and recorded.' : 'Issued refund recorded.')
    } catch (failure) { setError((failure as Error).message) } finally { setBusy(false) }
  }
  const voidAdjustment = async (event: React.FormEvent) => {
    event.preventDefault(); if (!voidId || busy) return
    setBusy(true); setError(''); setNotice('')
    try { await api.voidContractAdjustment(contract.id, voidId, voidReason); await onChanged(); setVoidId(null); setVoidReason(''); setNotice('Adjustment voided; history retained.') }
    catch (failure) { setError((failure as Error).message) } finally { setBusy(false) }
  }

  return <section aria-label="Contract settlement" className="rounded-xl border border-[#ddd] bg-white p-4 sm:p-5">
    <h3 className="font-semibold">Refunds and deposit deductions</h3>
    <p className="mt-1 text-xs text-[#595959]">Record refunds only after paying the tenant. Deposit deductions require a move-out checklist with a repair item and private photo.</p>
    <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3"><div>Rent overpayment<strong className="block">{peso(ledger.rent_credit)}</strong></div><div>Unused advance<strong className="block">{peso(ledger.advance_refundable)}</strong></div><div>Deposit available<strong className="block">{peso(ledger.deposit_refundable)}</strong></div></dl>
    <p className="mt-2 text-xs text-[#595959]">Deposit deductions recorded: {peso(ledger.deposit_deducted)}. Unused advance and deposit become refundable after tenancy end; advance first covers unpaid final-month rent.</p>
    {error && <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {notice && <p role="status" className="mt-3 rounded-lg bg-green-50 p-3 text-sm text-green-800">{notice}</p>}
    <form onSubmit={save} className="mt-4 grid gap-3 border-t border-[#eee] pt-4 sm:grid-cols-2">
      <label className="text-sm font-semibold">Action<select className="field" value={kind} onChange={event => { setKind(event.target.value as Kind); setAmount('') }}>{kinds.filter(([value]) => value === 'rent_refund' || contract.status === 'ended').map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label className="text-sm font-semibold">Amount (₱)<input required type="number" min="0.01" max={available} step="0.01" className="field" value={amount} onChange={event => setAmount(event.target.value)} /></label>
      <label className="text-sm font-semibold">Date<input required type="date" className="field" value={occurredOn} onChange={event => setOccurredOn(event.target.value)} /></label>
      {kind !== 'deposit_deduction' && <label className="text-sm font-semibold">Refund method<select className="field" value={method} onChange={event => setMethod(event.target.value)}><option value="cash">Cash</option><option value="bank_transfer">Bank transfer</option><option value="gcash">GCash</option><option value="other">Other</option></select></label>}
      {kind === 'deposit_deduction' ? <label className="text-sm font-semibold sm:col-span-2">Move-out evidence<select required className="field" value={inspectionId} onChange={event => setInspectionId(event.target.value)}><option value="">Choose checklist</option>{evidence.map(item => <option key={item.id} value={item.id}>{item.inspected_on} · {item.items.filter(part => part.condition === 'needs_repair').map(part => titleCase(part.area)).join(', ')}</option>)}</select></label> : <label className="text-sm font-semibold">Payment reference<input className="field" maxLength={120} value={reference} onChange={event => setReference(event.target.value)} /></label>}
      <label className="text-sm font-semibold sm:col-span-2">Reason or damage description<textarea required minLength={3} maxLength={2000} rows={2} className="field" value={reason} onChange={event => setReason(event.target.value)} /></label>
      <div className="sm:col-span-2"><button disabled={busy || !canRecord} className="min-h-11 rounded-lg bg-[#111] px-4 text-sm font-semibold text-white disabled:opacity-50">{kind === 'deposit_deduction' ? 'Approve deduction' : 'Record issued refund'}</button>{kind === 'deposit_deduction' && !evidence.length && <p className="mt-2 text-xs text-[#595959]">Add a move-out checklist and private repair photo first.</p>}</div>
    </form>
    <h4 className="mt-6 font-semibold">Settlement history</h4>
    {ledger.adjustments.length ? <ul className="mt-2 divide-y text-sm">{ledger.adjustments.map(item => <li key={item.id} className="py-3"><div className="flex flex-wrap items-center justify-between gap-2"><strong>{titleCase(item.kind)} · {peso(item.amount)}</strong>{!item.voided_at && <button type="button" onClick={() => { setVoidId(item.id); setVoidReason('') }} className="min-h-10 font-semibold text-[#0B1F3A] underline">Correct entry</button>}</div><p className="text-[#595959]">{item.occurred_on} · Approved by {item.approver.name}{item.inspection_id ? ` · Checklist #${item.inspection_id}` : ''}</p><p className="break-words">{item.reason}</p>{item.voided_at && <p className="text-[#595959]">Voided by {item.voider?.name ?? 'staff'}: {item.void_reason}</p>}</li>)}</ul> : <p className="mt-2 text-sm text-[#595959]">No settlement entries recorded.</p>}
    {voidId && <form onSubmit={voidAdjustment} className="mt-3 rounded-lg border border-[#ddd] p-3"><label className="text-sm font-semibold">Reason for voiding adjustment #{voidId}<textarea required minLength={3} maxLength={2000} rows={2} className="field" value={voidReason} onChange={event => setVoidReason(event.target.value)} /></label><div className="mt-3 flex gap-2"><button disabled={busy} className="min-h-11 rounded-lg bg-[#111] px-4 text-sm font-semibold text-white disabled:opacity-50">Void entry</button><button type="button" onClick={() => setVoidId(null)} className="min-h-11 rounded-lg border border-[#ddd] px-4 text-sm">Cancel</button></div></form>}
  </section>
}
