import React, { useState } from 'react'
import Logo from './Logo.jsx'
import { supabase } from './supabaseClient'

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:ital,wght@0,600;0,700;0,800;1,800&family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600&display=swap');

body{background:#07142b;margin:0;}
.au {
  --bg:#07142b; --card:#0f2347; --raise:#163262; --ink:#f2f5fa; --soft:#b4c3de;
  --rule:#26406e; --lime:#c8ff3d; --bad:#ff6b5e; --good:#5ee08a; --on:#06122a;
  background:var(--bg); color:var(--ink);
  font-family:'IBM Plex Sans',system-ui,sans-serif;
  min-height:100vh; display:flex; align-items:center; justify-content:center;
  padding:24px; -webkit-font-smoothing:antialiased;
}
.au *{box-sizing:border-box;}
.au .box{width:100%; max-width:400px;}
.au .brand{display:flex;flex-direction:column;align-items:center;gap:14px;margin-bottom:22px;}
.au .tagline{
  font-family:'IBM Plex Mono',monospace; font-size:12px; letter-spacing:.12em;
  text-transform:uppercase; color:var(--soft); text-align:center;
}
.au .sports{display:flex;gap:6px;justify-content:center;}
.au .sports span{width:34px;height:5px;}
.au .panel{background:var(--card); border:1px solid var(--rule); border-top:3px solid var(--lime); padding:24px;}
.au h2{
  font-family:'Barlow Condensed',sans-serif; font-size:32px; font-weight:800; font-style:italic;
  text-transform:uppercase; margin:0 0 18px;
}
.au label{
  display:block; font-family:'IBM Plex Mono',monospace; font-size:12px; font-weight:500;
  letter-spacing:.08em; text-transform:uppercase; color:var(--soft); margin-bottom:6px;
}
.au input{
  width:100%; font-family:'IBM Plex Mono',monospace; font-size:16px;
  padding:10px 12px; background:var(--bg); border:1px solid var(--rule);
  color:var(--ink); margin-bottom:16px;
}
.au input:focus{outline:2px solid var(--lime); outline-offset:-1px; border-color:var(--lime);}
.au button.go{
  width:100%; font-family:'Barlow Condensed',sans-serif; font-size:23px;
  font-weight:800; font-style:italic; text-transform:uppercase; letter-spacing:.05em;
  padding:12px; background:var(--lime); color:var(--on); border:0; cursor:pointer;
  transition:transform .12s, filter .12s;
}
.au button.go:hover{filter:brightness(1.08); transform:translateY(-1px);}
.au button.go:disabled{opacity:.5; cursor:wait; transform:none;}
.au .switch{margin-top:18px; font-size:14px; color:var(--soft); text-align:center;}
.au .switch button{
  background:none; border:0; color:var(--lime); cursor:pointer; font-weight:600;
  font-size:14px; text-decoration:underline; padding:0; font-family:inherit;
}
.au .msg{
  font-size:14px; line-height:1.5; padding:10px 12px; margin-bottom:16px;
  border-left:4px solid var(--bad); background:var(--bg); color:var(--bad);
}
.au .msg[data-ok="1"]{border-left-color:var(--good); color:var(--good);}
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
          <Logo width={340} />
          <div className="sports" aria-hidden="true">
            <span style={{ background: '#2bd46b' }} />
            <span style={{ background: '#ff8a2a' }} />
            <span style={{ background: '#4aa8ff' }} />
          </div>
          <p className="tagline">Know your game · fix what's costing you</p>
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
