import { useState } from 'react'
import type { FormEvent } from 'react'
import './staff-sign-in.css'

type StaffSignInProps = {
  email: string
  password: string
  error: string
  busy: boolean
  checking: boolean
  notice: string
  onEmailChange: (value: string) => void
  onPasswordChange: (value: string) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}

function StaffSignIn({ email, password, error, busy, checking, notice, onEmailChange, onPasswordChange, onSubmit }: StaffSignInProps) {
  const [showPassword, setShowPassword] = useState(false)

  return <div className="staff-auth-page">
    <div className="staff-auth-card">
      <section className="staff-auth-form-panel" aria-labelledby="staff-auth-title">
        <a className="staff-auth-brand" href="/" aria-label="Guillermo Apartment home">
          <img src="/brand-mark.svg" alt="" width="42" height="42" />
          <span>Guillermo<br/>Apartment</span>
        </a>

        <div className="staff-auth-content">
          <p className="staff-auth-eyebrow">PRIVATE STAFF ACCESS</p>
          <h1 id="staff-auth-title">Welcome back<span>.</span></h1>
          <p className="staff-auth-intro">Sign in to manage Guillermo Apartment.</p>

          {checking && <p className="staff-auth-status" role="status"><span className="staff-auth-spinner" aria-hidden="true"/> Checking staff session…</p>}
          {notice && !checking && <p className="staff-auth-status" role="status">{notice}</p>}
          <form onSubmit={onSubmit} className="staff-auth-form">
            <label htmlFor="staff-email">Email address</label>
            <input id="staff-email" type="email" required autoComplete="username" value={email} onChange={event => onEmailChange(event.target.value)} placeholder="you@example.com" />

            <label htmlFor="staff-password">Password</label>
            <div className="staff-auth-password">
              <input id="staff-password" type={showPassword ? 'text' : 'password'} required autoComplete="current-password" value={password} onChange={event => onPasswordChange(event.target.value)} placeholder="Enter your password" />
              <button type="button" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword}>{showPassword ? 'Hide' : 'Show'}</button>
            </div>

            {error && <p role="alert" className="staff-auth-error">{error}</p>}
            <button className="staff-auth-submit" disabled={busy || checking} type="submit">{busy ? 'Signing in…' : 'Sign in'}</button>
          </form>

          <p className="staff-auth-note">For authorized family staff only.</p>
        </div>

        <a className="staff-auth-back" href="/">← Back to website</a>
      </section>

      <aside className="staff-auth-visual" aria-label="Guillermo Apartment property photograph">
        <img
          src="/property/01-exterior-1080.jpg"
          srcSet="/property/01-exterior-480.jpg 480w, /property/01-exterior-800.jpg 800w, /property/01-exterior-1080.jpg 1080w"
          sizes="(max-width: 800px) 100vw, 50vw"
          alt="Exterior of Guillermo Apartment with motorcycle parking"
          fetchPriority="high"
        />
        <div className="staff-auth-photo-label"><span>GUILLERMO APARTMENT</span><strong>Two buildings.<br/>One place to manage them.</strong><small>Brgy. Lingunan · Valenzuela City</small></div>
      </aside>
    </div>
  </div>
}

export default StaffSignIn
