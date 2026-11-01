import React, { useState } from 'react'
import Logo from './Logo.jsx'
import { supabase } from './supabaseClient'

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600;700&family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500&display=swap');

.au {
  --paper:#E3E5DF; --card:#F6F7F3; --ink:#141C26; --soft:#5D6873;
  --rule:#C4C7BE; --accent:#1F4FD8; --bad:#AF2E22;
  background:var(--paper); color:var(--ink);
  font-family:'IBM Plex Sans',system-ui,sans-serif;
  min-height:100vh; display:flex; align-items:center; justify-content:center;
  padding:24px;
}
.au *{box-sizing:border-box;}
.au .box{width:100%; max-width:400px;}
.au .logo{
  font-family:'Barlow Condensed',sans-serif; font-weight:700; font-size:44px;
  line-height:.86; text-transform:uppercase; margin:0 0 6px;
}
.au .logo span{color:var(--accent); display:inline-block; transform:skewX(-10deg);}
.au .tagline{
  font-family:'IBM Plex Mono',monospace; font-size:10.5px; letter-spacing:.14em;
  text-transform:uppercase; color:var(--soft); margin:0 0 24px;
  border-bottom:2px solid var(--ink); padding-bottom:14px;
}
.au .panel{background:var(--card); border:1px solid var(--rule); padding:22px;}
.au h2{
  font-family:'Barlow Condensed',sans-serif; font-size:26px; font-weight:700;
  text-transform:uppercase; margin:0 0 18px;
}
.au label{
  display:block; font-family:'IBM Plex Mono',monospace; font-size:10px;
  letter-spacing:.1em; text-transform:uppercase; color:var(--soft); margin-bottom:5px;
}
.au input{
  width:100%; font-family:'IBM Plex Mono',monospace; font-size:15px;
  padding:9px 10px; background:#fff; border:1px solid var(--rule);
  color:var(--ink); margin-bottom:14px;
}
.au input:focus{outline:2px solid var(--accent); outline-offset:-1px;}
.au button.go{
  width:100%; font-family:'Barlow Condensed',sans-serif; font-size:21px;
  font-weight:700; text-transform:uppercase; letter-spacing:.06em;
  padding:11px; background:var(--accent); color:#fff; border:0; cursor:pointer;
}
.au button.go:hover{background:var(--ink);}
.au button.go:disabled{opacity:.5; cursor:wait;}
.au .switch{
  margin-top:16px; font-size:13px; color:var(--soft); text-align:center;
}
.au .switch button{
  background:none; border:0; color:var(--accent); cursor:pointer;
  font-size:13px; text-decoration:underline; padding:0; font-family:inherit;
}
.au .msg{
  font-family:'IBM Plex Mono',monospace; font-size:11.5px; line-height:1.6;
  padding:10px; margin-bottom:14px; border-left:3px solid var(--bad);
  background:#fff; color:var(--bad);
}
.au .msg[data-ok="1"]{border-left-color:#0E6B4F; color:#0E6B4F;}
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
       <Logo width={340} />
        <p className="tagline">Know your game · fix what's costing you</p>

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
            {mode === 'in' ? "No account yet? " : 'Already have one? '}
            <button onClick={() => { setMode(mode === 'in' ? 'up' : 'in'); setMsg(null) }}>
              {mode === 'in' ? 'Sign up' : 'Log in'}
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}
