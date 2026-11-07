import { useEffect, useState } from 'react'
import * as api from '../../services/staff'
import type { Contract } from '../../types/staff'

type Fields = {
  gentleman_name: string; lady_name: string; valid_id: string; id_place_issued: string; id_date_issued: string
  electric_account_no: string; water_deposit: string; electric_deposit: string; tenant_phone: string
}
const emptyFields = (contract: Contract): Fields => ({
  gentleman_name: '', lady_name: '', valid_id: '', id_place_issued: '', id_date_issued: '',
  electric_account_no: '', water_deposit: '', electric_deposit: '', tenant_phone: contract.tenant.phone || '',
  ...(contract.pdf_fields ?? {}),
})

export default function ContractDocumentPanel({ contract, isOwner, onChanged, onOpenChecklist }: { contract: Contract; isOwner: boolean; onChanged: () => Promise<void>; onOpenChecklist: (roomId: number) => void }) {
  const [template, setTemplate] = useState<{ id: number; original_name: string } | null>(null)
  const [hasInspection, setHasInspection] = useState(false)
  const [fields, setFields] = useState<Fields>(() => emptyFields(contract))
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    Promise.all([api.getContractTemplate(), api.getInspections(contract.room_id)])
      .then(([latest, inspections]) => { setTemplate(latest); setHasInspection(inspections.some(item => item.type === 'move_in' && item.contract_id === contract.id)) })
      .catch(cause => setError((cause as Error).message))
      .finally(() => setLoading(false))
  }, [contract.id, contract.room_id])

  const upload = async (file?: File) => {
    if (!file) return
    if (file.type !== 'application/pdf' || file.size > 10 * 1024 * 1024) { setError('Choose a four-page PDF up to 10 MB.'); return }
    setBusy(true); setError(''); setNotice('')
    try { const latest = await api.uploadContractTemplate(file); setTemplate(latest); setNotice('Contract template saved privately.') }
    catch (cause) { setError((cause as Error).message) } finally { setBusy(false) }
  }
  const generate = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setError(''); setNotice('')
    try { await api.generateContractPdf(contract.id, fields); await onChanged(); setNotice('PDF generated. Open it under Contract files.') }
    catch (cause) { setError((cause as Error).message) } finally { setBusy(false) }
  }
  const field = (key: keyof Fields, label: string, required = false) => <label className="min-w-0 text-sm">{label}<input required={required} className="field" maxLength={100} value={fields[key]} onChange={event => setFields(old => ({ ...old, [key]: event.target.value }))} /></label>

  return <div className="mt-6 border-t border-[#e0e0e0] pt-5">
    <h4 className="font-semibold">Generate contract PDF</h4>
    {loading ? <p role="status" className="mt-2 text-sm text-[#595959]">Checking template and checklist…</p> : <>
      {error && <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {notice && <p role="status" className="mt-3 rounded-lg bg-green-50 p-3 text-sm text-green-800">{notice}</p>}
      <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
        <span>{template ? `Template: ${template.original_name}` : 'No template uploaded'}</span>
        {isOwner && <label className="inline-flex min-h-11 cursor-pointer items-center rounded-lg border border-[#d5d5d5] px-3 font-semibold focus-within:outline-2 focus-within:outline-[#0B1F3A]">{template ? 'Replace template' : 'Upload template'}<input className="sr-only" type="file" accept="application/pdf" disabled={busy} onChange={event => { void upload(event.target.files?.[0]); event.target.value = '' }} /></label>}
      </div>
      {!hasInspection && <div className="mt-3 flex flex-wrap items-center gap-3 text-sm"><span>Move-in checklist needed for this contract.</span><button type="button" onClick={() => onOpenChecklist(contract.room_id)} className="min-h-11 rounded-lg border border-[#d5d5d5] px-3 font-semibold">Open checklists</button></div>}
      {template && hasInspection && <details className="mt-4 rounded-lg border border-[#e0e0e0] p-4"><summary className="cursor-pointer font-semibold">Fill contract blanks</summary><form onSubmit={generate} className="mt-4">
        <p className="text-xs text-[#595959]">Enter one or both signers. One must match the tenant profile: {contract.tenant.full_name}. Names follow the Ginoong and Ginang/Bb lines in the original agreement.</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">{field('gentleman_name', 'Ginoong signer')}{field('lady_name', 'Ginang/Bb signer')}{field('valid_id', 'Valid ID')}{field('id_place_issued', 'ID place issued')}{field('id_date_issued', 'ID date issued')}{field('electric_account_no', 'Electricity CAN number')}{field('water_deposit', 'Additional water deposit')}{field('electric_deposit', 'Additional electricity deposit')}{field('tenant_phone', 'Tenant phone')}</div>
        <p className="mt-3 text-xs text-[#595959]">Room, rent, deposit, advance, due day, term, and checklist come from the saved records. Signature lines remain open for signing.</p>
        <button disabled={busy || (!fields.gentleman_name.trim() && !fields.lady_name.trim())} className="mt-4 min-h-11 rounded-lg bg-[#111] px-4 text-sm font-semibold text-white disabled:opacity-50">{busy ? 'Generating…' : 'Generate PDF'}</button>
      </form></details>}
    </>}
  </div>
}
