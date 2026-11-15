'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createClient, type RealtimeChannel, type User } from '@supabase/supabase-js'
import { ArrowUp, Check, Copy, MessageCircle, Send, UserPlus, Users, X } from 'lucide-react'

type RoomMessage = { id: string; room_id: string; sender_name: string; body: string; reaction?: string | null; created_at: string }
type Profile = { id: string; username: string; display_name: string; bio: string; avatar_url?: string | null }
type FriendRequest = { id: string; sender_id: string; receiver_id: string; status: string; created_at: string }
type Friendship = { id: string; user_a: string; user_b: string }
type PrivateConversation = { id: string; user_a: string; user_b: string }
type PrivateMessage = { id: string; conversation_id: string; sender_id: string; body: string; created_at: string }

const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL && (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '')
  : null
const mergeById = <T extends { id: string; created_at?: string }>(a: T[], b: T[]) => Array.from(new Map([...a, ...b].map((item) => [item.id, item])).values()).sort((left, right) => (left.created_at || '').localeCompare(right.created_at || ''))
const roomCode = () => Math.random().toString(36).slice(2, 8).toUpperCase()

export default function Page() {
  const [user, setUser] = useState<User | null>(null)
  const [authReady, setAuthReady] = useState(!supabase)
  const [authMode, setAuthMode] = useState<'sign-in' | 'sign-up'>('sign-up')
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [displayName, setDisplayName] = useState(''); const [username, setUsername] = useState(''); const [bio, setBio] = useState(''); const [authError, setAuthError] = useState(''); const [busy, setBusy] = useState('')
  const [room, setRoom] = useState(''); const [roomInput, setRoomInput] = useState(''); const [roomOpen, setRoomOpen] = useState(false); const [roomText, setRoomText] = useState(''); const [roomMessages, setRoomMessages] = useState<RoomMessage[]>([]); const [roomLoading, setRoomLoading] = useState(false); const [roomError, setRoomError] = useState(''); const [copied, setCopied] = useState(false)
  const [profiles, setProfiles] = useState<Profile[]>([]); const [requests, setRequests] = useState<FriendRequest[]>([]); const [friendships, setFriendships] = useState<Friendship[]>([]); const [search, setSearch] = useState(''); const [socialLoading, setSocialLoading] = useState(false); const [socialError, setSocialError] = useState('')
  const [conversation, setConversation] = useState<PrivateConversation | null>(null); const [privateMessages, setPrivateMessages] = useState<PrivateMessage[]>([]); const [privateText, setPrivateText] = useState('')
  const roomChannel = useRef<RealtimeChannel | null>(null); const privateChannel = useRef<RealtimeChannel | null>(null)

  const loadSocial = useCallback(async (current: User) => {
    if (!supabase) return
    setSocialLoading(true); setSocialError('')
    const [me, req, friends, people] = await Promise.all([
      supabase.from('profiles').select('id,username,display_name,bio,avatar_url').eq('id', current.id).maybeSingle(),
      supabase.from('friend_requests').select('id,sender_id,receiver_id,status,created_at').or(`sender_id.eq.${current.id},receiver_id.eq.${current.id}`).eq('status', 'pending'),
      supabase.from('friendships').select('id,user_a,user_b').or(`user_a.eq.${current.id},user_b.eq.${current.id}`),
      supabase.from('profiles').select('id,username,display_name,bio,avatar_url').neq('id', current.id).order('username').limit(200),
    ])
    setDisplayName(me.data?.display_name || current.user_metadata?.display_name || '')
    setUsername(me.data?.username || current.user_metadata?.username || '')
    setBio(me.data?.bio || '')
    if (me.error || req.error || friends.error || people.error) setSocialError('Could not load your social data. Please retry.')
    setProfiles((people.data || []) as Profile[]); setRequests((req.data || []) as FriendRequest[]); setFriendships((friends.data || []) as Friendship[]); setSocialLoading(false)
  }, [])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search); const requestedRoom = (params.get('room') || '').toUpperCase()
    setRoomInput(requestedRoom)
    if (!supabase) return
    supabase.auth.getSession().then(async ({ data }) => {
      let currentUser = data.session?.user || null
      if (requestedRoom && !currentUser) {
        const guest = await supabase.auth.signInAnonymously()
        if (guest.error) setRoomError('Guest access is disabled in Supabase. Enable Authentication → Providers → Anonymous Sign-Ins, then retry.')
        else currentUser = guest.data.user
      }
      setUser(currentUser); setAuthReady(true)
      if (currentUser && !currentUser.is_anonymous) loadSocial(currentUser)
      if (requestedRoom && currentUser) {
        const { error } = await supabase.rpc('join_chat_room', { p_room_id: requestedRoom })
        if (error) setRoomError('Could not join this room. Check the code and try again.')
        else { setRoom(requestedRoom); setRoomOpen(true) }
      }
    })
    const { data } = supabase.auth.onAuthStateChange((_event, session) => { setUser(session?.user || null); setAuthReady(true); if (session?.user) loadSocial(session.user) })
    return () => data.subscription.unsubscribe()
  }, [loadSocial])

  useEffect(() => {
    if (!room || !supabase) return
    let active = true
    setRoomLoading(true); setRoomError(''); setRoomMessages([])
    supabase.from('chat_messages').select('id,room_id,sender_name,body,reaction,created_at').eq('room_id', room).order('created_at').then(({ data, error }) => { if (!active) return; if (error) setRoomError('Could not load room messages.'); else setRoomMessages((data || []) as RoomMessage[]); setRoomLoading(false) })
    const channel = supabase.channel(`room:${room}`).on('postgres_changes', { event: '*', schema: 'public', table: 'chat_messages', filter: `room_id=eq.${room}` }, (payload) => setRoomMessages((prev) => payload.eventType === 'DELETE' ? prev.filter((m) => m.id !== (payload.old as RoomMessage).id) : mergeById(prev, [payload.new as RoomMessage]))).subscribe()
    roomChannel.current = channel
    return () => { active = false; supabase.removeChannel(channel); roomChannel.current = null }
  }, [room])

  useEffect(() => {
    if (!conversation || !supabase) return
    let active = true
    setPrivateMessages([])
    supabase.from('private_messages').select('id,conversation_id,sender_id,body,created_at').eq('conversation_id', conversation.id).order('created_at').then(({ data }) => { if (active) setPrivateMessages((data || []) as PrivateMessage[]) })
    const channel = supabase.channel(`private:${conversation.id}`).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'private_messages', filter: `conversation_id=eq.${conversation.id}` }, (payload) => setPrivateMessages((prev) => mergeById(prev, [payload.new as PrivateMessage]))).subscribe()
    privateChannel.current = channel
    return () => { active = false; supabase.removeChannel(channel); privateChannel.current = null }
  }, [conversation])

  const friends = useMemo(() => profiles.filter((p) => friendships.some((f) => f.user_a === p.id || f.user_b === p.id)), [profiles, friendships])
  const results = useMemo(() => { const q = search.trim().toLowerCase(); return q ? profiles.filter((p) => p.username.toLowerCase().includes(q) || p.display_name.toLowerCase().includes(q)).slice(0, 8) : [] }, [profiles, search])
  const otherId = conversation && user ? (conversation.user_a === user.id ? conversation.user_b : conversation.user_a) : ''
  const other = profiles.find((p) => p.id === otherId)

  const authenticate = async () => {
    if (!supabase) return; setBusy('auth'); setAuthError('')
    const result = authMode === 'sign-up' ? await supabase.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL || `${window.location.origin}/auth/callback`, data: { display_name: displayName.trim(), username: username.trim().toLowerCase() } } }) : await supabase.auth.signInWithPassword({ email: email.trim(), password })
    if (result.error) {
      const message = result.error.message.toLowerCase()
      setAuthError(message.includes('invalid') || message.includes('credentials') ? 'Invalid email or password.' : result.error.message)
    }
    else if (authMode === 'sign-up' && !result.data.session) setAuthError('Check your email to confirm your account, then sign in.')
    setBusy('')
  }
  const saveProfile = async () => { if (!supabase || !user || busy) return; setBusy('profile'); setAuthError(''); const { error } = await supabase.from('profiles').upsert({ id: user.id, username: username.trim().toLowerCase(), display_name: displayName.trim(), bio: bio.trim() }); if (error) setAuthError(error.code === '23505' ? 'That username is already taken.' : 'Could not save your profile. Please retry.'); else await loadSocial(user); setBusy('') }
  const sendRequest = async (target: Profile) => { if (!supabase || !user || busy) return; setBusy(target.id); setAuthError(''); const { error } = await supabase.from('friend_requests').insert({ sender_id: user.id, receiver_id: target.id, status: 'pending' }); if (error) setAuthError(error.code === '23505' ? 'A request already exists for this person.' : 'Could not send friend request. Please retry.'); await loadSocial(user); setBusy('') }
  const requestAction = async (name: 'accept_friend_request' | 'reject_friend_request' | 'cancel_friend_request', id: string) => { if (!supabase || !user) return; setBusy(id); const { error } = await supabase.rpc(name, { p_request_id: id }); if (error) setAuthError(error.message); await loadSocial(user); setBusy('') }
  const openPrivate = async (target: Profile) => { if (!supabase) return; setBusy(target.id); const { data, error } = await supabase.rpc('create_private_conversation', { p_other_user_id: target.id }); if (error) setAuthError(error.message); else setConversation(data as PrivateConversation); setBusy('') }
  const sendPrivate = async () => {
    const body = privateText.trim()
    if (!supabase || !user || !conversation || !body || busy === 'private-send') return
    setBusy('private-send')
    setPrivateText('')
    const { error } = await supabase.from('private_messages').insert({ conversation_id: conversation.id, sender_id: user.id, body })
    if (error) {
      setPrivateText(body)
      setAuthError('Could not send private message. Please retry.')
    }
    setBusy('')
  }
  const signOut = async () => { await supabase?.auth.signOut(); setUser(null); setConversation(null) }
  const ensureRoomSession = async () => {
    if (!supabase) return false
    const { data } = await supabase.auth.getSession()
    if (data.session) return true
    const guest = await supabase.auth.signInAnonymously()
    if (guest.error || !guest.data.session) { setRoomError('Guest access is unavailable. Please sign in and retry.'); return false }
    setUser(guest.data.user); setAuthReady(true)
    return true
  }
  const createRoom = async () => {
    if (!supabase || roomLoading) return
    setRoomLoading(true); setRoomError('')
    if (!(await ensureRoomSession())) { setRoomLoading(false); return }
    const next = roomCode()
    const { error } = await supabase.rpc('create_chat_room', { p_room_id: next })
    if (error) setRoomError('Could not create a room. Please retry.')
    else { setRoom(next); setRoomInput(next); setRoomOpen(true); window.history.replaceState({}, '', `?room=${next}`) }
    setRoomLoading(false)
  }
  const joinRoom = async () => {
    const next = roomInput.trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
    if (!supabase || !/^[A-Z0-9]{6}$/.test(next) || roomLoading) { setRoomError('Enter a valid six-character room code.'); return }
    setRoomLoading(true); setRoomError('')
    if (!(await ensureRoomSession())) { setRoomLoading(false); return }
    const { error } = await supabase.rpc('join_chat_room', { p_room_id: next })
    if (error) setRoomError('Could not join this room. Check the code and try again.')
    else { setRoom(next); setRoomOpen(true); window.history.replaceState({}, '', `?room=${next}`) }
    setRoomLoading(false)
  }

  return (
    <main className="bubble-app min-h-dvh text-slate-100">
      <div className="mx-auto flex min-h-dvh w-full max-w-[1440px] flex-col px-4 pb-24 pt-4 sm:px-7 sm:pt-6 lg:px-10">
        <header className="flex items-center justify-between border-b border-white/10 pb-4">
          <a href="/" className="flex items-center gap-3" aria-label="Bubble Chat home">
            <span className="bubble-mark grid size-10 place-items-center rounded-[15px] text-lg font-bold text-[#07131f]">b.</span>
            <span className="text-[17px] font-semibold tracking-tight">Bubble <span className="text-[#8de8dc]">Chat</span></span>
          </a>
          <div className="flex items-center gap-3">
            {user && <span className="hidden text-sm text-slate-400 sm:inline">{user.is_anonymous ? 'Guest session' : displayName || user.email}</span>}
            {user && <button onClick={signOut} className="bubble-quiet-button">Sign out</button>}
          </div>
        </header>

        <div className="grid flex-1 gap-7 py-7 lg:grid-cols-[minmax(0,1.4fr)_minmax(300px,.8fr)] lg:gap-10 lg:py-10">
          <section className="flex flex-col justify-center">
            <div className="mb-5 inline-flex w-fit items-center gap-2 rounded-full border border-[#8de8dc]/20 bg-[#8de8dc]/[0.07] px-3 py-1.5 text-xs text-[#a9eee5]">
              <span className="size-1.5 rounded-full bg-[#8de8dc]" />
              Rooms stay in sync across devices
            </div>
            <h1 className="max-w-[760px] text-[clamp(2.7rem,8vw,5.7rem)] font-semibold leading-[.98] tracking-[-.065em]">
              Conversations<br /><span className="bubble-heading-accent">without the noise.</span>
            </h1>
            <p className="mt-5 max-w-xl text-[15px] leading-7 text-slate-400 sm:text-base">
              Start a room with a code. Find people you know. Keep private chats in one place.
            </p>

            <div className="bubble-panel mt-8 max-w-2xl p-4 sm:p-6">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold">Start a conversation</h2>
                  <p className="mt-1 text-xs text-slate-400">Create a room or enter a six-character code.</p>
                </div>
                <span className="bubble-icon-chip"><MessageCircle size={18} /></span>
              </div>
              <button onClick={createRoom} disabled={roomLoading} className="bubble-primary-button w-full sm:w-auto">
                {roomLoading ? 'Creating room…' : 'Create a room'} <ArrowUp className="ml-2 inline rotate-45" size={16} />
              </button>
              <div className="my-4 flex items-center gap-3 text-[11px] text-slate-500"><span className="h-px flex-1 bg-white/10" />OR JOIN AN EXISTING ROOM<span className="h-px flex-1 bg-white/10" /></div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input aria-label="Room code" value={roomInput} onChange={(e) => setRoomInput(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))} onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing && e.keyCode !== 229) joinRoom() }} placeholder="Enter room code" maxLength={6} className="bubble-input min-w-0 flex-1 tracking-[.18em] uppercase placeholder:tracking-normal placeholder:normal-case" />
                <button onClick={joinRoom} disabled={roomLoading} className="bubble-secondary-button">Join room</button>
              </div>
              {roomError && <p role="alert" className="mt-3 text-sm text-rose-300">{roomError}</p>}
            </div>
          </section>

          <aside className="flex flex-col gap-4 lg:justify-center">
            <div className="bubble-side-panel relative overflow-hidden p-5 sm:p-6">
              <div className="relative z-10">
                <span className="text-xs font-medium text-[#9de8df]">BUILT FOR EVERYDAY CHATS</span>
                <h2 className="mt-3 max-w-xs text-2xl font-semibold leading-tight tracking-tight">A room for the moment. A chat that stays.</h2>
                <p className="mt-3 max-w-sm text-sm leading-6 text-slate-400">Share a room link to talk together, or sign in to keep up with friends and private conversations.</p>
              </div>
              <div className="bubble-orbit" aria-hidden="true"><span /><span /><span /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bubble-stat"><MessageCircle size={18} className="text-[#9de8df]" /><p className="mt-4 text-sm font-medium">Room chat</p><p className="mt-1 text-xs leading-5 text-slate-500">Join with a short code.</p></div>
              <div className="bubble-stat"><Users size={18} className="text-[#b9b4ff]" /><p className="mt-4 text-sm font-medium">Private chats</p><p className="mt-1 text-xs leading-5 text-slate-500">Keep conversations close.</p></div>
            </div>
          </aside>
        </div>

        {user && !user.is_anonymous && (
          <section className="border-t border-white/10 pt-7">
            <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
              <div><p className="text-xs text-[#9de8df]">YOUR SPACE</p><h2 className="mt-1 text-2xl font-semibold tracking-tight">People and profile</h2></div>
              <p className="text-xs text-slate-500">Manage your details and open a private chat.</p>
            </div>
            {socialLoading && <p className="bubble-panel mb-4 p-4 text-sm text-slate-400">Loading your profile and friends…</p>}
            {socialError && <p role="alert" className="mb-4 rounded-2xl border border-rose-400/20 bg-rose-950/30 p-4 text-sm text-rose-200">{socialError}</p>}
            <div className="grid gap-4 lg:grid-cols-[.9fr_1.1fr_1fr]">
              <div className="bubble-panel p-5">
                <div className="mb-4 flex items-center justify-between"><h3 className="font-semibold">Your profile</h3><button onClick={saveProfile} disabled={!!busy} className="text-sm font-medium text-[#9de8df]">{busy === 'profile' ? 'Saving…' : 'Save'}</button></div>
                <label className="bubble-label">Username<input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="username" className="bubble-input mt-1" /></label>
                <label className="bubble-label mt-3">Display name<input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Display name" className="bubble-input mt-1" /></label>
                <label className="bubble-label mt-3">About you<textarea value={bio} onChange={(e) => setBio(e.target.value)} placeholder="A short bio" className="bubble-input mt-1 min-h-24 resize-y" /></label>
              </div>

              <div className="bubble-panel p-5">
                <div className="mb-4 flex items-center gap-2"><UserPlus size={18} className="text-[#9de8df]" /><h3 className="font-semibold">Find people</h3></div>
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or username" className="bubble-input mb-3" />
                <div className="space-y-1">
                  {results.map((p) => <div key={p.id} className="flex items-center justify-between gap-3 rounded-xl px-2 py-2.5 hover:bg-white/[0.04]"><div className="min-w-0"><p className="truncate text-sm font-medium">{p.display_name}</p><p className="truncate text-xs text-slate-500">@{p.username}</p></div><button disabled={!!busy} onClick={() => sendRequest(p)} aria-label={`Add ${p.display_name}`} className="bubble-icon-button"><UserPlus size={16} /></button></div>)}
                  {search.trim() && results.length === 0 && <p className="py-3 text-sm text-slate-500">No matching people found.</p>}
                </div>
                <div className="mt-4 border-t border-white/10 pt-4"><h4 className="mb-2 text-xs font-semibold text-slate-400">Incoming requests</h4>
                  {requests.filter((r) => r.receiver_id === user.id).map((r) => <div key={r.id} className="flex items-center justify-between gap-2 border-b border-white/[0.06] py-2 text-sm"><span className="min-w-0 truncate">{profiles.find((p) => p.id === r.sender_id)?.display_name || 'Friend request'}</span><span className="flex shrink-0 gap-3"><button onClick={() => requestAction('accept_friend_request', r.id)} className="text-[#9de8df]">Accept</button><button onClick={() => requestAction('reject_friend_request', r.id)} className="text-rose-300">Decline</button></span></div>)}
                  {requests.filter((r) => r.receiver_id === user.id).length === 0 && <p className="text-xs text-slate-500">No pending requests.</p>}
                </div>
              </div>

              <div className="bubble-panel p-5">
                <div className="mb-4 flex items-center gap-2"><Users size={18} className="text-[#b9b4ff]" /><h3 className="font-semibold">Your friends</h3></div>
                {friends.length === 0 && <p className="text-sm leading-6 text-slate-500">Friends will appear here. Accept a request to start a private chat.</p>}
                {friends.map((p) => <button key={p.id} onClick={() => openPrivate(p)} className="flex w-full items-center justify-between gap-3 border-b border-white/[0.07] py-3 text-left"><span className="min-w-0"><span className="block truncate text-sm font-medium">{p.display_name}</span><span className="block truncate text-xs text-slate-500">@{p.username}</span></span><Send size={16} className="shrink-0 text-[#9de8df]" /></button>)}
              </div>
            </div>
          </section>
        )}

        <footer className="mt-8 flex flex-wrap items-center justify-between gap-2 border-t border-white/10 py-5 text-xs text-slate-500"><span>Bubble Chat</span><span>Rooms and messages stay connected in real time.</span></footer>
      </div>

      {authReady && !user && supabase && (
        <div className="fixed inset-0 z-40 grid place-items-center overflow-y-auto bg-[#050c16]/90 p-4 backdrop-blur-md sm:p-6">
          <form onSubmit={(e) => { e.preventDefault(); authenticate() }} className="bubble-auth-card my-auto grid w-full max-w-3xl overflow-hidden sm:grid-cols-[.85fr_1fr]">
            <div className="bubble-auth-aside hidden flex-col justify-between p-7 sm:flex">
              <span className="flex items-center gap-2 text-sm font-semibold"><span className="bubble-mark grid size-8 place-items-center rounded-xl text-sm text-[#07131f]">b.</span> Bubble Chat</span>
              <div><p className="text-xs text-[#a9eee5]">YOUR CONVERSATIONS, IN ONE PLACE</p><h2 className="mt-3 text-3xl font-semibold leading-tight tracking-tight">Make room for a good chat.</h2><p className="mt-3 text-sm leading-6 text-slate-400">Sign in to find friends and continue private conversations.</p></div>
              <span className="text-xs text-slate-500">Simple rooms. Real people.</span>
            </div>
            <div className="p-6 sm:p-8">
              <div className="mb-6"><p className="text-xs text-[#9de8df]">{authMode === 'sign-up' ? 'CREATE AN ACCOUNT' : 'WELCOME BACK'}</p><h2 className="mt-2 text-2xl font-semibold">{authMode === 'sign-up' ? 'Join Bubble Chat' : 'Sign in'}</h2><p className="mt-1 text-sm text-slate-400">Use your email to continue.</p></div>
              {authMode === 'sign-up' && <><label className="bubble-label">Display name<input required value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Your name" className="bubble-input mt-1" /></label><label className="bubble-label mt-3">Username<input required value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Choose a username" className="bubble-input mt-1" /></label></>}
              <label className="bubble-label mt-3">Email<input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className="bubble-input mt-1" /></label>
              <label className="bubble-label mt-3">Password<input required minLength={6} type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Your password" className="bubble-input mt-1" /></label>
              {authError && <p role="alert" className="mt-3 text-sm text-rose-300">{authError}</p>}
              <button type="button" disabled={busy === 'guest' || busy === 'auth'} onClick={async () => { setBusy('guest'); const { error } = await supabase.auth.signInAnonymously(); if (error) setAuthError('Guest access is disabled in Supabase. Enable Authentication → Providers → Anonymous Sign-Ins, then retry.'); setBusy('') }} className="bubble-secondary-button mt-5 w-full">{busy === 'guest' ? 'Connecting…' : 'Continue as guest'}</button>
              <button disabled={busy === 'auth'} className="bubble-primary-button mt-3 w-full">{busy === 'auth' ? 'Please wait…' : authMode === 'sign-up' ? 'Create account' : 'Sign in'}</button>
              <button type="button" onClick={() => { setAuthError(''); setAuthMode(authMode === 'sign-up' ? 'sign-in' : 'sign-up') }} className="mt-5 w-full text-sm text-slate-400 hover:text-white">{authMode === 'sign-up' ? 'Already have an account? Sign in' : 'New to Bubble Chat? Create an account'}</button>
            </div>
          </form>
        </div>
      )}

      {roomOpen && room && (
        <section aria-label={`Room ${room} chat`} className="bubble-chat-window fixed inset-x-3 bottom-3 z-30 mx-auto flex max-h-[calc(100dvh-1.5rem)] w-auto max-w-[460px] flex-col overflow-hidden sm:inset-x-auto sm:bottom-5 sm:right-5 sm:mx-0 sm:w-[min(460px,calc(100vw-2.5rem))]">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3.5 sm:px-5"><div className="flex min-w-0 items-center gap-3"><span className="bubble-icon-chip"><MessageCircle size={17} /></span><div className="min-w-0"><p className="truncate text-sm font-semibold">Room {room}</p><p className="text-xs text-slate-500">Live room chat</p></div></div><div className="flex gap-1"><button aria-label="Copy room link" className="bubble-icon-button" onClick={() => { navigator.clipboard.writeText(`${window.location.origin}?room=${room}`); setCopied(true); setTimeout(() => setCopied(false), 1200) }}>{copied ? <Check size={16} /> : <Copy size={16} />}</button><button aria-label="Close chat" className="bubble-icon-button" onClick={() => setRoomOpen(false)}><X size={16} /></button></div></div>
          <div className="flex min-h-0 h-[min(55dvh,520px)] flex-col gap-2 overflow-y-auto p-4 sm:h-[min(58dvh,520px)]">{roomLoading && <p className="text-sm text-slate-500">Loading messages…</p>}{roomError && <p role="alert" className="text-sm text-rose-300">{roomError}</p>}{!roomLoading && !roomError && roomMessages.length === 0 && <p className="my-auto text-center text-sm text-slate-500">No messages yet. Start the conversation.</p>}{roomMessages.map((m) => <div key={m.id} className="max-w-[88%] self-start rounded-2xl rounded-bl-md bg-[#1b2c3c] px-3.5 py-2.5 text-sm leading-6"><p className="mb-1 text-[11px] font-medium text-[#9de8df]">{m.sender_name}</p>{m.body}</div>)}</div>
          <form onSubmit={async (e) => { e.preventDefault(); const body = roomText.trim(); if (supabase && user && body) { setRoomText(''); const { error } = await supabase.from('chat_messages').insert({ room_id: room, body }); if (error) setAuthError('Could not send room message. Please retry.') } }} className="flex gap-2 border-t border-white/10 p-3"><input value={roomText} onChange={(e) => setRoomText(e.target.value)} placeholder="Write a message…" aria-label="Room message" className="bubble-input min-w-0 flex-1" /><button aria-label="Send room message" className="bubble-send-button"><Send size={17} /></button></form>
        </section>
      )}

      {conversation && (
        <section aria-label="Private conversation" className={`bubble-chat-window fixed inset-x-3 z-30 mx-auto flex max-h-[calc(100dvh-1.5rem)] w-auto max-w-[460px] flex-col overflow-hidden sm:inset-x-auto sm:bottom-5 sm:left-5 sm:mx-0 sm:w-[min(460px,calc(100vw-2.5rem))] ${roomOpen ? 'bottom-[calc(min(55dvh,520px)+5rem)] sm:bottom-5' : 'bottom-3 sm:bottom-5'}`}>
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3.5 sm:px-5"><div className="flex min-w-0 items-center gap-3"><span className="bubble-icon-chip"><Users size={17} /></span><div className="min-w-0"><p className="truncate text-sm font-semibold">{other?.display_name || 'Private chat'}</p><p className="text-xs text-slate-500">Private conversation</p></div></div><button aria-label="Close private chat" className="bubble-icon-button" onClick={() => setConversation(null)}><X size={16} /></button></div>
          <div className="flex min-h-0 h-[min(48dvh,440px)] flex-col gap-2 overflow-y-auto p-4">{privateMessages.length === 0 && <p className="my-auto text-center text-sm text-slate-500">Start a private conversation.</p>}{privateMessages.map((m) => <div key={m.id} className={`max-w-[86%] rounded-2xl px-3.5 py-2.5 text-sm leading-6 ${m.sender_id === user?.id ? 'ml-auto rounded-br-md bg-[#a8eee3] text-[#0b1a25]' : 'rounded-bl-md bg-[#1b2c3c] text-slate-100'}`}>{m.body}</div>)}</div>
          <form onSubmit={(e) => { e.preventDefault(); sendPrivate() }} className="flex gap-2 border-t border-white/10 p-3"><input value={privateText} onChange={(e) => setPrivateText(e.target.value)} placeholder="Write a private message…" aria-label="Private message" className="bubble-input min-w-0 flex-1" /><button aria-label="Send private message" className="bubble-send-button"><Send size={17} /></button></form>
        </section>
      )}
    </main>
  )
}