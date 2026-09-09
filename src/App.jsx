import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import Auth from './Auth.jsx'
import FormSheet from './form-sheet.jsx'

export default function App() {
  const [session, setSession] = useState(null)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    // Is someone already logged in from last time?
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setChecking(false)
    })

    // Watch for logging in and out while the app is open.
    const { data: listener } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  if (checking) return null
  if (!session) return <Auth />

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => supabase.auth.signOut()}
        style={{
          position: 'fixed', top: 14, right: 14, zIndex: 50,
          fontFamily: "'Barlow Condensed', sans-serif", fontSize: 15,
          fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.05em',
          padding: '5px 12px', background: '#141C26', color: '#F6F7F3',
          border: 0, cursor: 'pointer',
        }}
      >
        Log out
      </button>
      <FormSheet />
    </div>
  )
}
