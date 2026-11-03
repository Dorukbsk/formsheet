import React, { useState } from 'react'
import Logo from './Logo.jsx'
import { supabase } from './supabaseClient'

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Barlow+Condensed:wght@700&display=swap');

body{background:#0b0d10;margin:0;}
.au {
  --bg:#0b0d10; --card:#13161b; --raise:#1a1e25; --rule:#252a32; --rule2:#323844;
  --ink:#eceef1; --soft:#a3abb6; --mute:#6f7782; --lime:#c8ff3d; --bad:#f2545b; --good:#3dd68c;
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
.au .msg[data-ok="1"]{border-color:rgba(61,214,140,.4); background:rgba(61,214,140,.1); color:#a8f0cb;}
`

export default function Auth() {
  const [mode, setMode] = useState('in')      // 'in' = log in, 'up' = sign up
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [msg, setMsg] = useState(null)
  const [busy, setBusy] = useState(false)

  async function submit() {
    setMsg(null)

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
      setMsg({ text: error.message, ok: false })
      return
    }
    if (mode === 'up' && !data.session) {
      setMsg({ text: 'Check your email to confirm your account, then log in.', ok: true })
    }
    // On success App.jsx notices the new session and swaps the screen.
  }

  function onKey(e) {
    if (e.key === 'Enter') submit()
  }

  return (
    <div className="au">
      <style>{CSS}</style>
      <div className="box">
        <div className="brand">
          <Logo width={260} panel={false} dark />
          <p className="tagline">Performance analysis for football, basketball and volleyball.</p>
        </div>

        <div className="panel">
          <h2>{mode === 'in' ? 'Log in' : 'Create account'}</h2>

          {msg && <div className="msg" data-ok={msg.ok ? 1 : 0}>{msg.text}</div>}

          <label htmlFor="au-email">Email</label>
          <input
            id="au-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={onKey}
          />

          <label htmlFor="au-pw">Password</label>
          <input
            id="au-pw"
            type="password"
            autoComplete={mode === 'up' ? 'new-password' : 'current-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={onKey}
          />

          <button className="go" onClick={submit} disabled={busy}>
            {busy ? 'Working…' : mode === 'in' ? 'Log in' : 'Sign up'}
          </button>

          <p className="switch">
            {mode === 'in' ? 'No account yet? ' : 'Already have one? '}
            <button onClick={() => { setMode(mode === 'in' ? 'up' : 'in'); setMsg(null) }}>
              {mode === 'in' ? 'Sign up' : 'Log in'}
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}
