import { useEffect, useState, type FormEvent } from 'react'
import * as tenant from '../services/tenant'
import { formatStaffPeso as peso, titleCase } from '../utils/property'

export default function TenantPortalPage() {
  const activationToken = new URLSearchParams(window.location.search).get('token')
  const [session, setSession] = useState<tenant.TenantSession | null>(null)
  const [contracts, setContracts] = useState<tenant.TenantContract[]>([])
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    tenant.getTenantSession().then(setSession).catch(() => {}).finally(() => setLoading(false))
  }, [])
  useEffect(() => { if (session) tenant.getTenantContracts().then(setContracts).catch(e => setError((e as Error).message)) }, [session])
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError(''); setBusy(true)
    try {
      if (activationToken && password !== confirmPassword) { setError('Passwords must match.'); return }
      const next = activationToken ? await tenant.activateTenant(activationToken, password) : await tenant.signInTenant(email, password)
      setSession(next); setPassword(''); setConfirmPassword('')
      if (activationToken) window.history.replaceState(null, '', '/tenant')
    } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }
  const signOut = async () => {
    setError('')
    try { await tenant.signOutTenant(); setSession(null); setContracts([]) } catch (e) { setError((e as Error).message) }
  }

  return <main className="min-h-screen bg-[#f6f7f8] text-[#111]">
    <header className="border-b border-[#dedede] bg-white"><div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-4 sm:px-6"><a href="/" className="flex items-center gap-3 rounded-lg focus-visible:outline-2 focus-visible:outline-[#0B1F3A]"><img src="/brand-mark.svg" alt="" className="h-10 w-10" /><span className="text-sm font-bold leading-tight">Guillermo<br />Apartment</span></a>{session && <button type="button" onClick={() => void signOut()} className="min-h-11 rounded-lg border border-[#d5d5d5] px-4 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-[#0B1F3A]">Sign out</button>}</div></header>
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
      <p className="text-xs font-semibold uppercase tracking-[.12em] text-[#0B1F3A]">Private tenant access</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Your tenancy</h1>
      {loading && <p role="status" className="mt-6 text-sm text-[#595959]">Checking your session…</p>}
      {error && <p role="alert" className="mt-6 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {!loading && !session && <section className="mt-7 max-w-lg rounded-2xl border border-[#dedede] bg-white p-5 sm:p-7"><h2 className="text-xl font-semibold">{activationToken ? 'Set your password' : 'Tenant sign in'}</h2><p className="mt-2 text-sm text-[#595959]">{activationToken ? 'Use the invitation sent to your email. This link works once and expires after 24 hours.' : 'Use the email address invited by staff. For account recovery, ask property staff to send a new invitation.'}</p><form onSubmit={submit} className="mt-5 space-y-4">{!activationToken && <label className="block text-sm font-semibold">Email<input required type="email" autoComplete="username" className="field" value={email} onChange={e => setEmail(e.target.value)} /></label>}<label className="block text-sm font-semibold">Password<input required type="password" minLength={activationToken ? 12 : undefined} autoComplete={activationToken ? 'new-password' : 'current-password'} className="field" value={password} onChange={e => setPassword(e.target.value)} /></label>{activationToken && <label className="block text-sm font-semibold">Confirm password<input required type="password" minLength={12} autoComplete="new-password" className="field" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} /></label>}<button disabled={busy} className="min-h-11 rounded-lg bg-[#111] px-5 text-sm font-semibold text-white disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0B1F3A]">{busy ? 'Please wait…' : activationToken ? 'Activate account' : 'Sign in'}</button></form></section>}
      {session && <><p className="mt-4 text-sm text-[#595959]">Signed in as {session.user.name} · {session.user.email}</p><p className="mt-3 text-sm text-[#595959]">This view shows your signed contract terms and recorded tenancy payments. Ask staff for contract files, utility bill copies, or a payment correction.</p><div className="mt-7 space-y-4">{contracts.length ? contracts.map(contract => <section key={contract.id} className="rounded-2xl border border-[#dedede] bg-white p-5 sm:p-7"><div className="flex flex-wrap justify-between gap-3"><div><h2 className="text-xl font-semibold">{contract.room.building} · Room {contract.room.code}</h2><p className="mt-1 text-sm text-[#595959]">Contract #{contract.id} · {titleCase(contract.status)}</p></div></div><dl className="mt-5 grid gap-4 border-y border-[#e5e5e5] py-5 text-sm sm:grid-cols-2"><div><dt className="text-[#595959]">Term</dt><dd className="font-semibold">{contract.starts_on} to {contract.ends_on}</dd></div><div><dt className="text-[#595959]">Monthly rent</dt><dd className="font-semibold">{peso(contract.monthly_rent)}</dd></div><div><dt className="text-[#595959]">Advance</dt><dd className="font-semibold">{peso(contract.advance_amount)}</dd></div><div><dt className="text-[#595959]">Deposit</dt><dd className="font-semibold">{peso(contract.deposit_amount)}</dd></div></dl><h3 className="mt-5 font-semibold">Recorded payments</h3>{contract.payments.length ? <ul className="mt-2 divide-y divide-[#e5e5e5]">{contract.payments.map((payment, index) => <li key={`${payment.kind}-${payment.paid_on}-${index}`} className="flex flex-wrap justify-between gap-2 py-3 text-sm"><span>{titleCase(payment.kind)}{payment.period_month ? ` · ${payment.period_month}` : ''}<span className="block text-xs text-[#595959]">{payment.paid_on}</span></span><strong>{peso(payment.amount)}</strong></li>)}</ul> : <p className="mt-2 text-sm text-[#595959]">No payments recorded for this contract.</p>}</section>) : <p className="rounded-xl border border-dashed border-[#d5d5d5] bg-white p-6 text-sm text-[#595959]">No signed tenancy is available for this account. Contact property staff.</p>}</div></>}
    </div>
  </main>
}
