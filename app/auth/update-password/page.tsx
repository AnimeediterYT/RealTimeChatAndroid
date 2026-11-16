'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL && (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '')
  : null

export default function UpdatePasswordPage() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('Checking your recovery link…')

  useEffect(() => {
    let active = true
    const check = async () => {
      if (!supabase) { setMessage('Authentication is not configured.'); return }
      const { data, error } = await supabase.auth.getSession()
      if (!active) return
      setReady(!error && !!data.session)
      setMessage(error || !data.session ? 'This recovery link is invalid or has expired. Request a new password reset.' : 'Choose a new password with at least 8 characters.')
    }
    void check()
    return () => { active = false }
  }, [])

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!supabase || password.length < 8 || password !== confirm || busy) return
    setBusy(true); setMessage('')
    const { error } = await supabase.auth.updateUser({ password })
    setBusy(false)
    if (error) setMessage('Could not update the password. Request a new reset link and try again.')
    else { setMessage('Password updated. Redirecting to Bubble Chat…'); window.setTimeout(() => window.location.replace('/'), 800) }
  }

  return <main className="bubble-app grid min-h-dvh place-items-center p-6"><form onSubmit={submit} className="bubble-panel w-full max-w-md"><h1 className="text-2xl font-semibold">Set a new password</h1><p role="status" className="mt-2 text-sm text-slate-300">{message}</p>{ready && <><label className="bubble-label mt-5">New password<input required minLength={8} type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className="bubble-input mt-1" /></label><label className="bubble-label mt-3">Confirm password<input required minLength={8} type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className="bubble-input mt-1" /></label>{password && confirm && password !== confirm && <p className="mt-2 text-sm text-rose-300">Passwords do not match.</p>}<button disabled={busy || password.length < 8 || password !== confirm} className="bubble-primary-button mt-5 w-full">{busy ? 'Updating…' : 'Update password'}</button></>}<a href="/" className="mt-5 inline-block text-sm text-[#b9baff]">Return to Bubble Chat</a></form></main>
}
