'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL && (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '')
  : null

export default function AuthCallbackPage() {
  const [message, setMessage] = useState('Confirming your account…')

  useEffect(() => {
    let active = true
    const finish = async () => {
      if (!supabase) { setMessage('Authentication is not configured.'); return }
      const code = new URLSearchParams(window.location.search).get('code')
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (error) { if (active) setMessage('This confirmation link is invalid or has expired. Return to Bubble Chat and request a new one.'); return }
      } else {
        const { data, error } = await supabase.auth.getSession()
        if (error || !data.session) { if (active) setMessage('This confirmation link is invalid or has expired. Return to Bubble Chat and request a new one.'); return }
      }
      if (active) {
        setMessage('Your account is confirmed. Redirecting…')
        window.location.replace('/')
      }
    }
    void finish()
    return () => { active = false }
  }, [])

  return <main className="bubble-app grid min-h-dvh place-items-center p-6"><section className="bubble-panel w-full max-w-md text-center"><h1 className="text-2xl font-semibold">Bubble Chat</h1><p role="status" className="mt-3 text-sm text-slate-300">{message}</p><a href="/" className="mt-6 inline-block text-sm text-[#b9baff]">Return to Bubble Chat</a></section></main>
}
