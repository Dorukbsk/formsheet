import React, { useState } from 'react'
import Logo from './Logo.jsx'
import { supabase } from './supabaseClient'
import { PrivacyNotice } from './Privacy.jsx'

// An expired or already-used email link comes back with an error in the address bar.
function linkError() {
  try {
    const h = new URLSearchParams(window.location.hash.replace(/^#/, ''))
    const q = new URLSearchParams(window.location.search)
    const code = h.get('error_code') || q.get('error_code') || h.get('error') || q.get('error')
    if (!code) return null
    window.history.replaceState(null, '', window.location.pathname)
    return {
      text: /expired/i.test(code) || /expired/i.test(h.get('error_description') || q.get('error_description') || '')
        ? 'That email link has expired or was already used. Ask for a new one below.'
        : "That email link didn't work. Ask for a new one below.",
      ok: false,
    }
  } catch { return null }
}

// Supabase's messages are written for developers; these are for players.
function friendly(message, mode) {
  const m = message || ''
  if (/invalid login credentials/i.test(m)) return 'Wrong email or password.'
  if (/email not confirmed/i.test(m)) return 'Confirm your email first: open the link we sent you, then log in.'
  if (/already registered|already been registered|user already exists/i.test(m)) return 'An account with this email already exists. Log in instead.'
  if (/database error saving new user/i.test(m)) return "We couldn't create your account. If your school only allows school email addresses, sign up with yours."
  if (/rate limit|too many/i.test(m)) return 'Too many attempts. Wait a minute and try again.'
  if (/valid email|invalid email|unable to validate email/i.test(m)) return 'Enter a valid email address.'
  if (/password/i.test(m) && /characters|short|weak/i.test(m)) return 'Choose a longer password (at least 6 characters).'
  if (/fetch|network/i.test(m)) return 'No connection. Check your internet and try again.'
  if (/different from the old password/i.test(m)) return "Choose a password you haven't used before."
  if (/session|jwt|expired/i.test(m)) return 'This reset link has expired. Ask for a new one from the login screen.'
  if (mode === 'new') return "We couldn't save your new password. Try again."
  if (mode === 'reset') return "We couldn't send the reset email. Try again."
  return mode === 'up' ? "We couldn't create your account. Try again." : "We couldn't log you in. Try again."
}

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Barlow+Condensed:wght@700&display=swap');

body{background:#0b0d10;margin:0;}
.au {
  --bg:#0b0d10; --card:#13161b; --raise:#1a1e25; --rule:#252a32; --rule2:#323844;
  --ink:#eceef1; --soft:#a3abb6; --mute:#8a929d; --lime:#c8ff3d; --bad:#f2545b; --good:#3dd68c;
  background:var(--bg); color:var(--ink);
  font-family:'Inter',system-ui,-apple-system,'Segoe UI',sans-serif;
  min-height:100vh; display:flex; align-items:center; justify-content:center;
  padding:max(24px, env(safe-area-inset-top)) 20px 24px; -webkit-font-smoothing:antialiased;
}
.au *{box-sizing:border-box;}
.au .box{width:100%; max-width:400px;}
.au .brand{display:flex;flex-direction:column;align-items:center;gap:12px;margin-bottom:28px;}
.au .tagline{font-size:15px; color:var(--soft); text-align:center; margin:0;}
.au .panel{background:var(--card); border:1px solid var(--rule); border-radius:18px; padding:26px;}
.au h2{font-size:22px; font-weight:700; letter-spacing:-.01em; margin:0 0 20px;}
.au label{display:block; font-size:13px; font-weight:500; color:var(--soft); margin-bottom:6px;}
.au input{
  width:100%; font-family:inherit; font-size:16px; padding:12px 14px; background:var(--bg);
  border:1px solid var(--rule2); border-radius:10px; color:var(--ink); margin-bottom:16px;
}
.au input:focus{outline:none; border-color:var(--lime); box-shadow:0 0 0 3px rgba(200,255,61,.15);}
.au button.go{
  width:100%; font-family:inherit; font-size:16px; font-weight:700; padding:13px;
  background:var(--lime); color:#0b0d10; border:0; border-radius:12px; cursor:pointer; transition:filter .12s;
}
.au button.go:hover{filter:brightness(1.06);}
.au button.go:disabled{opacity:.5; cursor:wait;}
.au .switch{margin-top:18px; font-size:14px; color:var(--soft); text-align:center;}
.au .switch button{
  background:none; border:0; color:var(--ink); cursor:pointer; font-weight:600;
  font-size:14px; text-decoration:underline; padding:0; font-family:inherit;
}
.au .msg{
  font-size:14px; line-height:1.5; padding:11px 14px; margin-bottom:16px; border-radius:10px;
  border:1px solid rgba(242,84,91,.4); background:rgba(242,84,91,.1); color:#ffb3b6;
}
.au .sub{font-size:14px;color:var(--soft);margin:-10px 0 18px;line-height:1.5;}
.au .forgot{margin:-6px 0 16px;text-align:right;}
.au .forgot button{background:none;border:0;color:var(--soft);font-size:13.5px;text-decoration:underline;cursor:pointer;padding:0;font-family:inherit;}
.au .legal{font-size:12.5px;color:var(--mute);text-align:center;margin:14px 0 0;line-height:1.5;}
.au .legal button{background:none;border:0;color:var(--soft);text-decoration:underline;cursor:pointer;font-size:12.5px;padding:0;font-family:inherit;}
.au .pvpanel{max-width:640px;}
.au .back{background:none;border:0;color:var(--soft);font-size:14px;font-weight:600;cursor:pointer;padding:0;margin-bottom:16px;font-family:inherit;}
.au .msg[data-ok="1"]{border-color:rgba(61,214,140,.4); background:rgba(61,214,140,.1); color:#a8f0cb;}
`

export default function Auth({ recovery = false, onRecovered }) {
  // 'in' = log in, 'up' = sign up, 'reset' = forgot password, 'new' = choose a new password (from the email link)
  const [mode, setMode] = useState(recovery ? 'new' : 'in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [msg, setMsg] = useState(linkError)
  const [busy, setBusy] = useState(false)
  const [showPrivacy, setShowPrivacy] = useState(false)

  function go(m) { setMode(m); setMsg(null); setPassword('') }

  async function submit(e) {
    if (e) e.preventDefault()
    setMsg(null)

    if (mode === 'reset') {
      if (!email) { setMsg({ text: 'Enter your email address.', ok: false }); return }
      setBusy(true)
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin })
      setBusy(false)
      if (error) { setMsg({ text: friendly(error.message, mode), ok: false }); return }
      setMsg({ text: "If there's an account for that email, we've sent a link to reset your password.", ok: true })
      return
    }

    if (mode === 'new') {
      if (password.length < 6) { setMsg({ text: 'Password must be at least 6 characters.', ok: false }); return }
      setBusy(true)
      const { error } = await supabase.auth.updateUser({ password })
      setBusy(false)
      if (error) { setMsg({ text: friendly(error.message, mode), ok: false }); return }
      if (onRecovered) onRecovered()
      return
    }

    if (!email || !password) {
      setMsg({ text: 'Fill in both fields.', ok: false })
      return
    }
    if (mode === 'up' && password.length < 6) {
      setMsg({ text: 'Password must be at least 6 characters.', ok: false })
      return
    }

    setBusy(true)
    const { data, error } =
      mode === 'up'
        ? await supabase.auth.signUp({ email, password })
        : await supabase.auth.signInWithPassword({ email, password })
    setBusy(false)

    if (error) {
      setMsg({ text: friendly(error.message, mode), ok: false })
      return
    }
    if (mode === 'up' && !data.session) {
      setMsg({ text: 'Check your email to confirm your account, then log in.', ok: true })
    }
    // On success App.jsx notices the new session and swaps the screen.
  }

  if (showPrivacy) {
    return (
      <div className="au">
        <style>{CSS}</style>
        <div className="box pvpanel">
          <button className="back" onClick={() => setShowPrivacy(false)}>← Back</button>
          <div className="panel"><PrivacyNotice /></div>
        </div>
      </div>
    )
  }

  const title = { in: 'Log in', up: 'Create account', reset: 'Reset your password', new: 'Choose a new password' }[mode]
  const action = { in: 'Log in', up: 'Sign up', reset: 'Send reset link', new: 'Save new password' }[mode]

  return (
    <div className="au">
      <style>{CSS}</style>
      <div className="box">
        <div className="brand">
          <Logo width={260} panel={false} dark />
          <p className="tagline">Performance analysis for football, basketball and volleyball.</p>
        </div>

        <form className="panel" onSubmit={submit} noValidate>
          <h2>{title}</h2>
          {mode === 'reset' && <p className="sub">Enter your email and we'll send you a link to choose a new password.</p>}

          {msg && <div className="msg" role={msg.ok ? 'status' : 'alert'} data-ok={msg.ok ? 1 : 0}>{msg.text}</div>}

          {mode !== 'new' && (
            <>
              <label htmlFor="au-email">Email</label>
              <input id="au-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </>
          )}

          {mode !== 'reset' && (
            <>
              <label htmlFor="au-pw">{mode === 'new' ? 'New password' : 'Password'}</label>
              <input
                id="au-pw"
                type="password"
                autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </>
          )}

          {mode === 'in' && (
            <p className="forgot"><button type="button" onClick={() => go('reset')}>Forgot password?</button></p>
          )}

          <button className="go" type="submit" disabled={busy}>{busy ? 'Working…' : action}</button>

          {mode !== 'new' && (
            <p className="switch">
              {mode === 'in' ? 'No account yet? ' : mode === 'up' ? 'Already have one? ' : 'Remembered it? '}
              <button type="button" onClick={() => go(mode === 'in' ? 'up' : 'in')}>
                {mode === 'in' ? 'Sign up' : 'Log in'}
              </button>
            </p>
          )}
        </form>
        <p className="legal">
          {mode === 'up' ? 'Under 18? Check with a parent or guardian first. ' : ''}
          <button type="button" onClick={() => setShowPrivacy(true)}>Privacy: how we use your data</button>
        </p>
      </div>
    </div>
  )
}
