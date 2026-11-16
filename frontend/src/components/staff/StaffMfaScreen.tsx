import { useEffect, useRef, useState, type FormEvent } from 'react'
import * as staff from '../../services/staff'
import type { StaffUser } from '../../types/staff'

type Props = {
  autoSend: boolean
  onVerified: (user: StaffUser) => void
  onCancel: () => void
}

export default function StaffMfaScreen({ autoSend, onVerified, onCancel }: Props) {
  const autoSent = useRef(false)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const sendCode = async () => {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const result = await staff.sendMfaCode()
      setNotice(result.message)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    if (autoSend && !autoSent.current) {
      autoSent.current = true
      void sendCode()
    }
  }, [autoSend])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const result = await staff.verifyMfa(code)
      setCode('')
      onVerified(result.user)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return <main className="flex min-h-screen items-center justify-center bg-[#f6f7f8] px-4 py-8 text-[#111]">
    <section className="w-full max-w-lg rounded-2xl border border-[#dedede] bg-white p-6 shadow-sm sm:p-8" aria-labelledby="mfa-title">
      <div className="flex items-center gap-3"><img src="/brand-mark.svg" alt="" width="40" height="40" /><span className="text-sm font-bold">Guillermo Apartment</span></div>
      <p className="mt-8 text-xs font-semibold uppercase tracking-[.12em] text-[#0B1F3A]">Private staff access</p>
      <h1 id="mfa-title" className="mt-2 text-2xl font-bold">Check your email</h1>
      <p className="mt-3 text-sm text-[#595959]">Enter the six-digit sign-in code sent to your staff email. It expires after five minutes and can be used once.</p>
      <form onSubmit={submit} className="mt-6"><label className="block text-sm font-semibold">Six-digit code<input required type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} className="field" value={code} onChange={event => setCode(event.target.value.replace(/\D/g, ''))} /></label><button disabled={busy || code.length !== 6} type="submit" className="mt-4 min-h-11 rounded-lg bg-[#111] px-5 text-sm font-semibold text-white disabled:opacity-50">{busy ? 'Checking…' : 'Verify code'}</button></form>
      {notice && <p role="status" className="mt-4 text-sm text-[#365b36]">{notice}</p>}
      {error && <p role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <button type="button" disabled={busy} onClick={() => void sendCode()} className="mt-5 min-h-11 text-sm font-semibold text-[#0B1F3A] underline disabled:opacity-50 focus-visible:outline-2">Send a new code</button>
      <button type="button" onClick={onCancel} className="ml-5 mt-5 min-h-11 text-sm font-semibold text-[#595959] underline focus-visible:outline-2">Sign out</button>
    </section>
  </main>
}
