import { useState } from 'react'
import * as api from '../../services/staff'
import type { UtilityBill } from '../../types/staff'
import { formatStaffPeso as peso } from '../../utils/property'

const today = () => new Date().toLocaleDateString('en-CA')

export default function UtilityRefundPanel({ bill, onChanged }: { bill: UtilityBill; onChanged: () => Promise<void> }) {
  const [amount, setAmount] = useState('')
  const [refundedOn, setRefundedOn] = useState(today())
  const [method, setMethod] = useState('cash')
  const [reference, setReference] = useState('')
  const [reason, setReason] = useState('')
  const [voidId, setVoidId] = useState<number | null>(null)
  const [voidReason, setVoidReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const record = async (event: React.FormEvent) => {
    event.preventDefault(); if (busy) return
    setBusy(true); setError(''); setNotice('')
    try { await api.addUtilityRefund(bill.id, { amount, refunded_on: refundedOn, method, reference: reference || null, reason }); await onChanged(); setAmount(''); setReference(''); setReason(''); setNotice('Issued refund recorded.') }
    catch (failure) { setError((failure as Error).message) } finally { setBusy(false) }
  }
  const voidRefund = async (event: React.FormEvent) => {
    event.preventDefault(); if (!voidId || busy) return
    setBusy(true); setError(''); setNotice('')
    try { await api.voidUtilityRefund(bill.id, voidId, voidReason); await onChanged(); setVoidId(null); setVoidReason(''); setNotice('Refund entry voided; history retained.') }
    catch (failure) { setError((failure as Error).message) } finally { setBusy(false) }
  }

  return <section aria-label="Utility overpayment refunds" className="mt-5 border-t border-[#e0e0e0] pt-4"><h4 className="font-semibold">Overpayment refunds</h4><p className="mt-1 text-sm">Credit available: <strong>{peso(bill.credit_available)}</strong> · Refunded: {peso(bill.refunded_amount)}</p><p className="mt-1 text-xs text-[#595959]">Record a refund after the tenant has actually received it.</p>
    {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}{notice && <p role="status" className="mt-3 text-sm text-green-800">{notice}</p>}
    {Number(bill.credit_available) > 0 && <form onSubmit={record} className="mt-3 grid gap-3 rounded-lg border border-[#ddd] p-3 sm:grid-cols-2"><label className="text-sm font-semibold">Amount (₱)<input required type="number" min="0.01" max={bill.credit_available} step="0.01" className="field" value={amount} onChange={event => setAmount(event.target.value)} /></label><label className="text-sm font-semibold">Refund date<input required type="date" className="field" value={refundedOn} onChange={event => setRefundedOn(event.target.value)} /></label><label className="text-sm font-semibold">Method<select className="field" value={method} onChange={event => setMethod(event.target.value)}><option value="cash">Cash</option><option value="bank_transfer">Bank transfer</option><option value="gcash">GCash</option><option value="other">Other</option></select></label><label className="text-sm font-semibold">Reference<input className="field" maxLength={120} value={reference} onChange={event => setReference(event.target.value)} /></label><label className="text-sm font-semibold sm:col-span-2">Reason<textarea required minLength={3} maxLength={2000} rows={2} className="field" value={reason} onChange={event => setReason(event.target.value)} /></label><button disabled={busy} className="min-h-11 rounded-lg bg-[#111] px-4 text-sm font-semibold text-white disabled:opacity-50 sm:col-span-2 sm:justify-self-start">Record issued refund</button></form>}
    {bill.refunds.length > 0 && <ul className="mt-3 divide-y text-sm">{bill.refunds.map(item => <li key={item.id} className="py-3"><div className="flex flex-wrap items-center justify-between gap-2"><strong>{peso(item.amount)} · {item.refunded_on}</strong>{!item.voided_at && <button type="button" onClick={() => { setVoidId(item.id); setVoidReason('') }} className="min-h-10 font-semibold text-[#0B1F3A] underline">Correct entry</button>}</div><p className="text-[#595959]">Approved by {item.approver.name} · {item.method}{item.reference ? ` · ${item.reference}` : ''}</p><p>{item.reason}</p>{item.voided_at && <p className="text-[#595959]">Voided by {item.voider?.name ?? 'staff'}: {item.void_reason}</p>}</li>)}</ul>}
    {voidId && <form onSubmit={voidRefund} className="mt-3 rounded-lg border border-[#ddd] p-3"><label className="text-sm font-semibold">Reason for voiding refund #{voidId}<textarea required minLength={3} maxLength={2000} rows={2} className="field" value={voidReason} onChange={event => setVoidReason(event.target.value)} /></label><div className="mt-3 flex gap-2"><button disabled={busy} className="min-h-11 rounded-lg bg-[#111] px-4 text-sm font-semibold text-white disabled:opacity-50">Void entry</button><button type="button" onClick={() => setVoidId(null)} className="min-h-11 rounded-lg border border-[#ddd] px-4 text-sm">Cancel</button></div></form>}
  </section>
}
