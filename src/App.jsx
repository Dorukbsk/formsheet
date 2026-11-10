import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import Auth from './Auth.jsx'
import FormSheet from './form-sheet.jsx'

const RECOVERY_KEY = 'athletix-recovery'
function readFlag() { try { return sessionStorage.getItem(RECOVERY_KEY) === '1' } catch { return false } }
function writeFlag(on) { try { if (on) sessionStorage.setItem(RECOVERY_KEY, '1'); else sessionStorage.removeItem(RECOVERY_KEY) } catch { /* blocked */ } }

// Log out and clear what this app saved on the device (match tags, last scores), for shared tablets.
async function signOut() {
  try {
    Object.keys(localStorage).filter((k) => k.startsWith('athletix:')).forEach((k) => localStorage.removeItem(k))
  } catch { /* storage blocked */ }
  await supabase.auth.signOut()
}

export default function App() {
  const [session, setSession] = useState(null)
  const [checking, setChecking] = useState(true)
  const [recovery, setRecovery] = useState(readFlag)

  useEffect(() => {
    // Is someone already logged in from last time?
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setChecking(false)
    }).catch(() => setChecking(false))

    // Watch for logging in and out while the app is open.
    const { data: listener } = supabase.auth.onAuthStateChange((event, s) => {
      // Opened from a "reset your password" email: ask for the new password first,
      // and keep asking even if the page is reloaded.
      if (event === 'PASSWORD_RECOVERY') { writeFlag(true); setRecovery(true) }
      if (event === 'SIGNED_OUT') { writeFlag(false); setRecovery(false) }
      setSession(s)
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  if (checking) {
    return (
      <div style={{ minHeight: '100vh', background: '#0b0d10', color: '#8a929d', display: 'flex', alignItems: 'center',
        justifyContent: 'center', fontFamily: 'Inter, system-ui, sans-serif', fontSize: 15 }}>
        Loading…
      </div>
    )
  }
  if (recovery && session) return <Auth recovery onRecovered={() => { writeFlag(false); setRecovery(false) }} />
  if (!session) return <Auth />

  return <FormSheet onSignOut={signOut} />
}
