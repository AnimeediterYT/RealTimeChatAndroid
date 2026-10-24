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
const mergeById = <T extends { id: string }>(a: T[], b: T[]) => Array.from(new Map([...a, ...b].map((item) => [item.id, item])).values())
const roomCode = () => Math.random().toString(36).slice(2, 8).toUpperCase()

export default function Page() {
  const [user, setUser] = useState<User | null>(null)
  const [authReady, setAuthReady] = useState(!supabase)
  const [authMode, setAuthMode] = useState<'sign-in' | 'sign-up'>('sign-up')
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [displayName, setDisplayName] = useState(''); const [username, setUsername] = useState(''); const [bio, setBio] = useState(''); const [authError, setAuthError] = useState(''); const [busy, setBusy] = useState('')
  const [room, setRoom] = useState(''); const [roomOpen, setRoomOpen] = useState(false); const [roomText, setRoomText] = useState(''); const [roomMessages, setRoomMessages] = useState<RoomMessage[]>([]); const [copied, setCopied] = useState(false)
  const [profiles, setProfiles] = useState<Profile[]>([]); const [requests, setRequests] = useState<FriendRequest[]>([]); const [friendships, setFriendships] = useState<Friendship[]>([]); const [search, setSearch] = useState('')
  const [conversation, setConversation] = useState<PrivateConversation | null>(null); const [privateMessages, setPrivateMessages] = useState<PrivateMessage[]>([]); const [privateText, setPrivateText] = useState('')
  const roomChannel = useRef<RealtimeChannel | null>(null); const privateChannel = useRef<RealtimeChannel | null>(null)

  const loadSocial = useCallback(async (current: User) => {
    if (!supabase) return
    const [me, req, friends, people] = await Promise.all([
      supabase.from('profiles').select('id,username,display_name,bio,avatar_url').eq('id', current.id).maybeSingle(),
      supabase.from('friend_requests').select('id,sender_id,receiver_id,status,created_at').or(`sender_id.eq.${current.id},receiver_id.eq.${current.id}`).eq('status', 'pending'),
      supabase.from('friendships').select('id,user_a,user_b').or(`user_a.eq.${current.id},user_b.eq.${current.id}`),
      supabase.from('profiles').select('id,username,display_name,bio,avatar_url').neq('id', current.id).order('username').limit(200),
    ])
    setDisplayName(me.data?.display_name || current.user_metadata?.display_name || '')
    setUsername(me.data?.username || current.user_metadata?.username || '')
    setBio(me.data?.bio || '')
    setProfiles((people.data || []) as Profile[]); setRequests((req.data || []) as FriendRequest[]); setFriendships((friends.data || []) as Friendship[])
  }, [])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search); setRoom(params.get('room')?.toUpperCase() || '')
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => { setUser(data.session?.user || null); setAuthReady(true); if (data.session?.user) loadSocial(data.session.user) })
    const { data } = supabase.auth.onAuthStateChange((_event, session) => { setUser(session?.user || null); setAuthReady(true); if (session?.user) loadSocial(session.user) })
    return () => data.subscription.unsubscribe()
  }, [loadSocial])

  useEffect(() => {
    if (!room || !supabase) return
    let active = true
    supabase.from('chat_messages').select('id,room_id,sender_name,body,reaction,created_at').eq('room_id', room).order('created_at').then(({ data }) => { if (active) setRoomMessages((data || []) as RoomMessage[]) })
    const channel = supabase.channel(`room:${room}`).on('postgres_changes', { event: '*', schema: 'public', table: 'chat_messages', filter: `room_id=eq.${room}` }, (payload) => setRoomMessages((prev) => payload.eventType === 'DELETE' ? prev.filter((m) => m.id !== (payload.old as RoomMessage).id) : mergeById(prev, [payload.new as RoomMessage]))).subscribe()
    roomChannel.current = channel
    return () => { active = false; supabase.removeChannel(channel); roomChannel.current = null }
  }, [room])

  useEffect(() => {
    if (!conversation || !supabase) return
    supabase.from('private_messages').select('id,conversation_id,sender_id,body,created_at').eq('conversation_id', conversation.id).order('created_at').then(({ data }) => setPrivateMessages((data || []) as PrivateMessage[]))
    const channel = supabase.channel(`private:${conversation.id}`).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'private_messages', filter: `conversation_id=eq.${conversation.id}` }, (payload) => setPrivateMessages((prev) => mergeById(prev, [payload.new as PrivateMessage]))).subscribe()
    privateChannel.current = channel
    return () => { supabase.removeChannel(channel); privateChannel.current = null }
  }, [conversation])

  const friends = useMemo(() => profiles.filter((p) => friendships.some((f) => f.user_a === p.id || f.user_b === p.id)), [profiles, friendships])
  const results = useMemo(() => { const q = search.trim().toLowerCase(); return q ? profiles.filter((p) => p.username.toLowerCase().includes(q) || p.display_name.toLowerCase().includes(q)).slice(0, 8) : [] }, [profiles, search])
  const otherId = conversation && user ? (conversation.user_a === user.id ? conversation.user_b : conversation.user_a) : ''
  const other = profiles.find((p) => p.id === otherId)

  const authenticate = async () => {
    if (!supabase) return; setBusy('auth'); setAuthError('')
    const result = authMode === 'sign-up' ? await supabase.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL || `${window.location.origin}/auth/callback`, data: { display_name: displayName.trim(), username: username.trim().toLowerCase() } } }) : await supabase.auth.signInWithPassword({ email: email.trim(), password })
    if (result.error) setAuthError(result.error.message.includes('Invalid') ? 'Invalid email or password.' : result.error.message)
    else if (authMode === 'sign-up' && !result.data.session) setAuthError('Check your email to confirm your account, then sign in.')
    setBusy('')
  }
  const saveProfile = async () => { if (!supabase || !user) return; setBusy('profile'); const { error } = await supabase.from('profiles').upsert({ id: user.id, username: username.trim().toLowerCase(), display_name: displayName.trim(), bio: bio.trim() }); if (error) setAuthError(error.message); else await loadSocial(user); setBusy('') }
  const sendRequest = async (target: Profile) => { if (!supabase || !user) return; setBusy(target.id); const { error } = await supabase.from('friend_requests').insert({ sender_id: user.id, receiver_id: target.id, status: 'pending' }); if (error) setAuthError(error.message); await loadSocial(user); setBusy('') }
  const requestAction = async (name: 'accept_friend_request' | 'reject_friend_request', id: string) => { if (!supabase || !user) return; setBusy(id); const { error } = await supabase.rpc(name, { p_request_id: id }); if (error) setAuthError(error.message); await loadSocial(user); setBusy('') }
  const openPrivate = async (target: Profile) => { if (!supabase) return; setBusy(target.id); const { data, error } = await supabase.rpc('create_private_conversation', { p_other_user_id: target.id }); if (error) setAuthError(error.message); else setConversation(data as PrivateConversation); setBusy('') }
  const sendPrivate = async () => { const body = privateText.trim(); if (!supabase || !user || !conversation || !body) return; setPrivateText(''); const { error } = await supabase.from('private_messages').insert({ conversation_id: conversation.id, sender_id: user.id, body }); if (error) setAuthError(error.message) }
  const signOut = async () => { await supabase?.auth.signOut(); setUser(null); setConversation(null) }
  const joinRoom = () => { const next = room.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8); if (next) { setRoom(next); window.history.replaceState({}, '', `?room=${next}`); setRoomOpen(true) } }

  return <main className="min-h-screen bg-[#020817] text-slate-100"><div className="mx-auto flex min-h-screen max-w-6xl flex-col px-5 py-6 sm:px-10 lg:px-16"><header className="flex items-center justify-between"><div className="flex items-center gap-3"><div className="bubble-gradient grid size-10 place-items-center rounded-2xl"><MessageCircle /></div><span className="text-lg font-semibold">Bubble <span className="text-cyan-300">Chat</span></span></div>{user && <button onClick={signOut} className="text-xs text-slate-400">Sign out</button>}</header>
    <section className="flex flex-1 flex-col justify-center py-10"><div className="max-w-2xl"><div className="mb-5 inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-300"><span className="size-2 rounded-full bg-emerald-400" /> Private rooms. Real-time messages.</div><h1 className="text-5xl font-semibold leading-[1.04] tracking-[-0.06em] sm:text-7xl">Chat anytime,<br /><span className="bubble-text">anywhere.</span></h1><p className="mt-7 max-w-lg text-base leading-7 text-slate-300">Create a room, find friends, and keep private conversations live across your devices.</p><div className="mt-9 flex flex-col gap-3 sm:flex-row"><button onClick={() => { const next = roomCode(); setRoom(next); setRoomOpen(true); window.history.replaceState({}, '', `?room=${next}`) }} className="rounded-xl bg-white px-5 py-3.5 text-sm font-semibold text-slate-900">Create a new room <ArrowUp className="ml-2 inline rotate-45" size={16} /></button><div className="flex overflow-hidden rounded-xl border border-slate-700 bg-slate-800"><input aria-label="Room code" value={room} onChange={(e) => setRoom(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing && e.keyCode !== 229) joinRoom() }} placeholder="Enter room code" className="w-36 bg-transparent px-4 text-sm outline-none" /><button onClick={joinRoom} className="border-l border-slate-700 px-4 text-sm font-semibold">Join</button></div></div></div></section>
    {user && <section className="grid gap-4 pb-8 lg:grid-cols-3"><div className="rounded-3xl border border-slate-800 bg-slate-900 p-5"><div className="mb-4 flex items-center justify-between"><h2 className="font-semibold">Your profile</h2><button onClick={saveProfile} className="text-xs text-cyan-300">{busy === 'profile' ? 'Saving...' : 'Save'}</button></div><input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="username" className="mb-2 w-full rounded-xl bg-slate-800 px-3 py-2 text-sm" /><input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="display name" className="mb-2 w-full rounded-xl bg-slate-800 px-3 py-2 text-sm" /><textarea value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Short bio" className="h-20 w-full resize-none rounded-xl bg-slate-800 px-3 py-2 text-sm" /></div><div className="rounded-3xl border border-slate-800 bg-slate-900 p-5"><h2 className="mb-3 font-semibold">Find friends</h2><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search username" className="mb-3 w-full rounded-xl bg-slate-800 px-3 py-2 text-sm" />{results.map((p) => <div key={p.id} className="flex items-center justify-between border-b border-slate-800 py-2 text-sm"><span>{p.display_name} <span className="text-slate-500">@{p.username}</span></span><button disabled={!!busy} onClick={() => sendRequest(p)} aria-label={`Add ${p.display_name}`} className="text-cyan-300"><UserPlus size={17} /></button></div>)}<h3 className="mt-4 text-xs uppercase tracking-widest text-slate-500">Requests</h3>{requests.filter((r) => r.receiver_id === user.id).map((r) => <div key={r.id} className="flex items-center justify-between py-2 text-sm"><span>{profiles.find((p) => p.id === r.sender_id)?.display_name || 'Friend request'}</span><span className="flex gap-2"><button onClick={() => requestAction('accept_friend_request', r.id)} className="text-emerald-300">Accept</button><button onClick={() => requestAction('reject_friend_request', r.id)} className="text-rose-300">Reject</button></span></div>)}</div><div className="rounded-3xl border border-slate-800 bg-slate-900 p-5"><h2 className="mb-3 font-semibold">Friends</h2>{friends.length === 0 && <p className="text-sm text-slate-500">Accept a request to start a private chat.</p>}{friends.map((p) => <button key={p.id} onClick={() => openPrivate(p)} className="flex w-full items-center justify-between border-b border-slate-800 py-3 text-left text-sm"><span>{p.display_name}<span className="ml-2 text-slate-500">@{p.username}</span></span><Send size={16} className="text-cyan-300" /></button>)}</div></section>}
    <footer className="flex items-center justify-between border-t border-slate-800 py-5 text-xs text-slate-500"><span>Small bubble. Big connection.</span><span className="hidden sm:block">Persistent Supabase messaging</span></footer></div>
    {authReady && !user && supabase && <div className="fixed inset-0 z-30 grid place-items-center bg-slate-950/80 p-5 backdrop-blur-sm"><form onSubmit={(e) => { e.preventDefault(); authenticate() }} className="w-full max-w-sm rounded-3xl border border-cyan-400/20 bg-slate-900 p-7"><div className="mb-5 grid size-12 place-items-center rounded-2xl bg-slate-800 text-cyan-300"><Users /></div><h2 className="text-2xl font-semibold">{authMode === 'sign-up' ? 'Create your account' : 'Welcome back'}</h2>{authMode === 'sign-up' && <><input required value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Display name" className="mt-5 w-full rounded-xl bg-slate-800 px-4 py-3" /><input required value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Username" className="mt-3 w-full rounded-xl bg-slate-800 px-4 py-3" /></>}<input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className="mt-3 w-full rounded-xl bg-slate-800 px-4 py-3" /><input required minLength={6} type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" className="mt-3 w-full rounded-xl bg-slate-800 px-4 py-3" />{authError && <p role="alert" className="mt-3 text-sm text-rose-300">{authError}</p>}<button disabled={busy === 'auth'} className="mt-4 w-full rounded-xl bg-cyan-400 py-3 font-semibold text-slate-950">{busy === 'auth' ? 'Working...' : authMode === 'sign-up' ? 'Create account' : 'Sign in'}</button><button type="button" onClick={() => setAuthMode(authMode === 'sign-up' ? 'sign-in' : 'sign-up')} className="mt-4 w-full text-sm text-slate-400">{authMode === 'sign-up' ? 'Already have an account? Sign in' : 'Need an account? Sign up'}</button></form></div>}
    {roomOpen && room && <div className="fixed bottom-5 right-5 z-20 w-[calc(100vw-2.5rem)] max-w-[390px] overflow-hidden rounded-3xl border border-slate-700 bg-slate-900 shadow-2xl"><div className="flex items-center justify-between border-b border-slate-800 px-5 py-4"><div><div className="font-semibold">Room {room}</div><div className="text-xs text-slate-500">Live room chat</div></div><div className="flex gap-2"><button aria-label="Copy room link" onClick={() => { navigator.clipboard.writeText(`${window.location.origin}?room=${room}`); setCopied(true); setTimeout(() => setCopied(false), 1200) }}>{copied ? <Check size={16} /> : <Copy size={16} />}</button><button aria-label="Close chat" onClick={() => setRoomOpen(false)}><X size={16} /></button></div></div><div className="flex h-72 flex-col gap-2 overflow-y-auto bg-slate-950/30 p-4">{roomMessages.map((m) => <div key={m.id} className="rounded-xl bg-slate-800 px-3 py-2 text-sm"><div className="mb-1 text-[10px] text-cyan-300">{m.sender_name}</div>{m.body}</div>)}</div><form onSubmit={(e) => { e.preventDefault(); const body = roomText.trim(); if (supabase && user && body) { setRoomText(''); supabase.from('chat_messages').insert({ room_id: room, sender_name: displayName || 'Member', body }) } }} className="flex gap-2 border-t border-slate-800 p-3"><input value={roomText} onChange={(e) => setRoomText(e.target.value)} placeholder="Message room..." className="min-w-0 flex-1 rounded-xl bg-slate-800 px-3 py-2 text-sm" /><button className="text-cyan-300"><Send size={17} /></button></form></div>}
    {conversation && <div className="fixed bottom-5 left-5 z-20 w-[calc(100vw-2.5rem)] max-w-[390px] overflow-hidden rounded-3xl border border-cyan-400/30 bg-slate-900 shadow-2xl"><div className="flex items-center justify-between border-b border-slate-800 px-5 py-4"><div><div className="font-semibold">{other?.display_name || 'Private chat'}</div><div className="text-xs text-slate-500">Private realtime conversation</div></div><button aria-label="Close private chat" onClick={() => setConversation(null)}><X size={16} /></button></div><div className="flex h-64 flex-col gap-2 overflow-y-auto p-4">{privateMessages.map((m) => <div key={m.id} className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${m.sender_id === user?.id ? 'ml-auto bg-cyan-400 text-slate-950' : 'bg-slate-800'}`}>{m.body}</div>)}</div><form onSubmit={(e) => { e.preventDefault(); sendPrivate() }} className="flex gap-2 border-t border-slate-800 p-3"><input value={privateText} onChange={(e) => setPrivateText(e.target.value)} placeholder="Private message..." className="min-w-0 flex-1 rounded-xl bg-slate-800 px-3 py-2 text-sm" /><button className="text-cyan-300"><Send size={17} /></button></form></div>}
  </main>
}
