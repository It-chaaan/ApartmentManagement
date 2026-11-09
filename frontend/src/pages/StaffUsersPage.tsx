import { useEffect, useState } from 'react'
import * as api from '../services/staff'
import type { StaffAccount } from '../types/staff'

export default function StaffUsersPage() {
  const [accounts, setAccounts] = useState<StaffAccount[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [createForm, setCreateForm] = useState({ name: '', email: '', password: '', password_confirmation: '' })
  const [editForm, setEditForm] = useState({ name: '', email: '', password: '', password_confirmation: '' })
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const selected = accounts.find(account => account.id === selectedId) ?? null

  useEffect(() => {
    api.getStaffAccounts().then(items => {
      setAccounts(items)
      if (items[0]) {
        setSelectedId(items[0].id)
        setEditForm({ name: items[0].name, email: items[0].email, password: '', password_confirmation: '' })
      }
    }).catch(e => setError((e as Error).message)).finally(() => setLoading(false))
  }, [])
  const select = (account: StaffAccount) => {
    setSelectedId(account.id); setEditForm({ name: account.name, email: account.email, password: '', password_confirmation: '' }); setError(''); setNotice('')
  }
  const create = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setError(''); setNotice('')
    try {
      const created = await api.createStaffAccount(createForm)
      const updated = await api.getStaffAccounts(); setAccounts(updated); setShowCreate(false)
      select(created.user)
      setCreateForm({ name: '', email: '', password: '', password_confirmation: '' }); setNotice('Staff account created.')
    } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }
  const save = async (event: React.FormEvent) => {
    event.preventDefault(); if (!selected || selected.role !== 'staff') return
    setBusy(true); setError(''); setNotice('')
    try {
      const values = { name: editForm.name, email: editForm.email, ...(editForm.password ? { password: editForm.password, password_confirmation: editForm.password_confirmation } : {}) }
      const account = await api.updateStaffAccount(selected.id, values)
      setAccounts(old => old.map(item => item.id === account.id ? account : item)); setEditForm(old => ({ ...old, password: '', password_confirmation: '' })); setNotice('Staff account updated.')
    } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }
  const toggle = async () => {
    if (!selected || selected.role !== 'staff') return
    setBusy(true); setError(''); setNotice('')
    try {
      const account = await api.updateStaffAccount(selected.id, { is_active: !selected.is_active })
      setAccounts(old => old.map(item => item.id === account.id ? account : item)); setNotice(account.is_active ? 'Staff access enabled.' : 'Staff access disabled.')
    } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }

  return <section aria-label="User management" className="min-w-0 rounded-2xl border border-[#dedede] bg-white">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#dedede] p-4 sm:p-5"><h2 className="text-lg font-semibold">Staff accounts</h2><button type="button" onClick={() => { setShowCreate(true); setError(''); setNotice('') }} className="min-h-11 rounded-lg bg-[#111] px-4 text-sm font-semibold text-white">Add staff</button></div>
    <div className="p-4 sm:p-5">
    {loading && <p role="status" className="mt-5 text-sm text-[#595959]">Loading accounts…</p>}
    {error && !showCreate && <p role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {notice && <p role="status" className="mt-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">{notice}</p>}
    <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(250px,0.9fr)_minmax(0,1.2fr)]">
      <div className="min-w-0 rounded-xl border border-[#e0e0e0] bg-white">{accounts.map(account => <button key={account.id} type="button" onClick={() => select(account)} aria-pressed={selected?.id === account.id} className={`flex min-h-18 w-full items-center justify-between gap-3 border-b border-[#e0e0e0] px-4 py-3 text-left last:border-b-0 hover:bg-[#fafafa] focus-visible:outline-2 focus-visible:outline-[#0B1F3A] ${selected?.id === account.id ? 'bg-[#f5f7f9]' : ''}`}><span className="min-w-0"><strong className="block truncate text-sm">{account.name}</strong><span className="block truncate text-xs text-[#595959]">{account.email}</span></span><span className="shrink-0 text-xs font-semibold">{account.role === 'owner' ? 'Owner' : account.is_active ? 'Active' : 'Disabled'}</span></button>)}{!accounts.length && !loading && <p className="p-6 text-sm text-[#595959]">No accounts found.</p>}</div>
      <div className="min-w-0 rounded-xl border border-[#e0e0e0] bg-white p-5">{selected ? selected.role === 'owner' ? <><h3 className="text-xl font-semibold">{selected.name}</h3><p className="mt-1 text-sm text-[#595959]">Owner · {selected.email}</p></> : <><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-xl font-semibold">{selected.name}</h3><p className="text-sm text-[#595959]">Staff · {selected.is_active ? 'Active' : 'Disabled'}</p></div><button type="button" disabled={busy} onClick={() => void toggle()} className="min-h-11 rounded-lg border border-[#d5d5d5] px-3 text-sm font-semibold disabled:opacity-50">{selected.is_active ? 'Disable access' : 'Enable access'}</button></div><form onSubmit={save} className="mt-5 grid gap-4 border-t border-[#e0e0e0] pt-5 sm:grid-cols-2"><label className="text-sm">Name<input required className="field" maxLength={120} value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} /></label><label className="text-sm">Email<input required type="email" className="field" maxLength={255} value={editForm.email} onChange={e => setEditForm({ ...editForm, email: e.target.value })} /></label><label className="text-sm">New password<input type="password" minLength={12} autoComplete="new-password" className="field" value={editForm.password} onChange={e => setEditForm({ ...editForm, password: e.target.value })} /></label><label className="text-sm">Confirm password<input type="password" minLength={12} autoComplete="new-password" className="field" value={editForm.password_confirmation} onChange={e => setEditForm({ ...editForm, password_confirmation: e.target.value })} /></label><button disabled={busy} className="min-h-11 w-fit rounded-lg bg-[#111] px-4 text-sm font-semibold text-white disabled:opacity-50">{busy ? 'Saving…' : 'Save changes'}</button></form></> : <p className="text-sm text-[#595959]">Select an account to view details.</p>}</div>
    </div>
    </div>
    {showCreate && <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/55 sm:items-center sm:p-5"><form onSubmit={create} aria-label="Add staff account" className="max-h-[95vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl sm:p-7"><div className="flex items-center justify-between gap-3"><h3 className="text-xl font-semibold">Add staff</h3><button type="button" onClick={() => { setShowCreate(false); setError('') }} aria-label="Close staff form" className="min-h-11 rounded-lg px-3 text-xl">×</button></div><div className="mt-4 grid gap-4 sm:grid-cols-2"><label className="text-sm sm:col-span-2">Name<input required className="field" maxLength={120} value={createForm.name} onChange={e => setCreateForm({ ...createForm, name: e.target.value })} /></label><label className="text-sm sm:col-span-2">Email<input required type="email" className="field" maxLength={255} value={createForm.email} onChange={e => setCreateForm({ ...createForm, email: e.target.value })} /></label><label className="text-sm">Password<input required type="password" minLength={12} autoComplete="new-password" className="field" value={createForm.password} onChange={e => setCreateForm({ ...createForm, password: e.target.value })} /></label><label className="text-sm">Confirm password<input required type="password" minLength={12} autoComplete="new-password" className="field" value={createForm.password_confirmation} onChange={e => setCreateForm({ ...createForm, password_confirmation: e.target.value })} /></label></div>{error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}<button disabled={busy} className="mt-5 min-h-11 rounded-lg bg-[#111] px-5 text-sm font-semibold text-white disabled:opacity-50">{busy ? 'Creating…' : 'Create staff account'}</button></form></div>}
  </section>
}
