'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { createClient, type RealtimeChannel } from '@supabase/supabase-js'
import { ArrowUp, Check, Copy, Heart, MessageCircle, Moon, Send, Sun, ThumbsUp, Users, X } from 'lucide-react'

type Message = { id: string; room_id: string; sender_name: string; body: string; reaction?: string | null; created_at: string }
type Presence = { name: string; online_at: string }

const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL && (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '')
  : null

function makeRoom() { return Math.random().toString(36).slice(2, 8).toUpperCase() }

export default function Page() {
  const [room, setRoom] = useState('')
  const [name, setName] = useState('')
  const [nameInput, setNameInput] = useState('')
  const [message, setMessage] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const [open, setOpen] = useState(false)
  const [dark, setDark] = useState(false)
  const [copied, setCopied] = useState(false)
  const [typing, setTyping] = useState(false)
  const [friendOnline, setFriendOnline] = useState(false)
  const [drag, setDrag] = useState(false)
  const channelRef = useRef<RealtimeChannel | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    setRoom(params.get('room')?.toUpperCase() || '')
    setName(sessionStorage.getItem('chat-name') || '')
    setDark(sessionStorage.getItem('chat-theme') === 'dark')
  }, [])

  useEffect(() => { document.documentElement.classList.toggle('dark', dark); sessionStorage.setItem('chat-theme', dark ? 'dark' : 'light') }, [dark])

  useEffect(() => {
    if (!room || !supabase) return
    let active = true
    supabase.from('chat_messages').select('id, room_id, sender_name, body, reaction, created_at').eq('room_id', room).order('created_at', { ascending: true }).then(({ data }) => {
      if (!active) return
      setMessages(prev => {
        const merged = new Map<string, Message>()
        for (const item of [...((data as Message[]) || []), ...prev]) merged.set(item.id, item)
        return [...merged.values()].sort((a, b) => a.created_at.localeCompare(b.created_at))
      })
    })
    const channel = supabase.channel(`room:${room}`, { config: { presence: { key: name || 'guest' } } })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `room_id=eq.${room}` }, payload => setMessages(prev => prev.some(m => m.id === payload.new.id) ? prev : [...prev, payload.new as Message]))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'chat_messages', filter: `room_id=eq.${room}` }, payload => setMessages(prev => prev.map(m => m.id === payload.new.id ? payload.new as Message : m)))
      .on('broadcast', { event: 'typing' }, ({ payload }) => { if (payload.name !== name) { setTyping(payload.isTyping); if (payload.isTyping) { setTimeout(() => setTyping(false), 2200) } } })
      .on('presence', { event: 'sync' }, () => { const state = channel.presenceState<Presence>(); setFriendOnline(Object.keys(state).some(key => key !== (name || 'guest'))) })
      .subscribe(async status => { if (status === 'SUBSCRIBED') await channel.track({ name: name || 'guest', online_at: new Date().toISOString() }) })
    channelRef.current = channel
    return () => { active = false; supabase.removeChannel(channel); channelRef.current = null }
  }, [room, name])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, typing])

  const shareUrl = useMemo(() => room ? `${window.location.origin}?room=${room}` : '', [room])
  const saveName = () => { const clean = nameInput.trim().slice(0, 24); if (clean) { setName(clean); sessionStorage.setItem('chat-name', clean) } }
  const createRoom = () => { const next = makeRoom(); setRoom(next); window.history.replaceState({}, '', `?room=${next}`); setOpen(true) }
  const joinRoom = () => { const next = room.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8); if (next) { setRoom(next); window.history.replaceState({}, '', `?room=${next}`); setOpen(true) } }
  const copyLink = async () => { await navigator.clipboard.writeText(shareUrl); setCopied(true); setTimeout(() => setCopied(false), 1600) }
  const broadcastTyping = useCallback((isTyping: boolean) => { channelRef.current?.send({ type: 'broadcast', event: 'typing', payload: { name, isTyping } }); }, [name])
  const sendMessage = async () => { const body = message.trim(); if (!body || !room || !name || !supabase) return; setMessage(''); broadcastTyping(false); const { error } = await supabase.from('chat_messages').insert({ room_id: room, sender_name: name, body }); if (error) console.error('[v0] message send failed', error) }
  const react = async (id: string, value: string) => { setMessages(prev => prev.map(m => m.id === id ? { ...m, reaction: m.reaction === value ? null : value } : m)); if (supabase) await supabase.from('chat_messages').update({ reaction: value }).eq('id', id) }

  return <main className="min-h-screen overflow-hidden bg-[#070b1f] text-slate-100 transition-colors dark:bg-[#070b1f] dark:text-slate-100">
    <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-5 py-6 sm:px-10 lg:px-16">
      <header className="flex items-center justify-between"><div className="flex items-center gap-3"><div className="bubble-gradient grid size-10 place-items-center rounded-2xl text-white shadow-lg shadow-cyan-500/20"><MessageCircle /></div><span className="text-lg font-semibold tracking-tight">dropchat</span></div><button aria-label="Toggle dark mode" onClick={() => setDark(v => !v)} className="rounded-full border border-slate-200 bg-white p-2.5 shadow-sm transition hover:scale-105 dark:border-slate-700 dark:bg-slate-800">{dark ? <Sun size={18} /> : <Moon size={18} />}</button></header>
      <section className="flex flex-1 flex-col justify-center py-14"><div className="max-w-2xl"><div className="mb-5 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-500 shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"><span className="size-2 rounded-full bg-emerald-400" /> No accounts. Just a room.</div><h1 className="text-5xl font-semibold leading-[1.04] tracking-[-0.06em] sm:text-7xl">Private chats,<br /><span className="text-slate-400 dark:text-slate-500">beautifully simple.</span></h1><p className="mt-7 max-w-lg text-base leading-7 text-slate-500 dark:text-slate-400">Create a room, share the link, and start talking. No logins, no noise, no history beyond the conversation you choose to have.</p><div className="mt-9 flex flex-col gap-3 sm:flex-row"><button onClick={createRoom} className="rounded-xl bg-slate-900 px-5 py-3.5 text-sm font-semibold text-white shadow-lg shadow-slate-900/10 transition hover:-translate-y-0.5 dark:bg-white dark:text-slate-900">Create a new room <ArrowUp className="ml-2 inline rotate-45" size={16} /></button><div className="flex overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800"><input aria-label="Room code" value={room} onChange={e => setRoom(e.target.value)} onKeyDown={e => e.key === 'Enter' && joinRoom()} placeholder="Enter room code" className="w-36 bg-transparent px-4 text-sm outline-none placeholder:text-slate-400" /><button onClick={joinRoom} className="border-l border-slate-200 px-4 text-sm font-semibold dark:border-slate-700">Join</button></div></div></div></section>
      <footer className="flex items-center justify-between border-t border-slate-200 py-5 text-xs text-slate-400 dark:border-slate-800"><span>Made for conversations that matter.</span><span className="hidden sm:block">End-to-end room privacy</span></footer>
    </div>
    <AnimatePresence>{!name && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-30 grid place-items-center bg-slate-950/35 p-5 backdrop-blur-sm"><motion.form initial={{ y: 18, scale: .97 }} animate={{ y: 0, scale: 1 }} onSubmit={e => { e.preventDefault(); saveName() }} className="w-full max-w-sm rounded-3xl bg-white p-7 shadow-2xl dark:bg-slate-900"><div className="mb-6 grid size-12 place-items-center rounded-2xl bg-slate-100 dark:bg-slate-800"><Users /></div><h2 className="text-2xl font-semibold tracking-tight">What should we call you?</h2><p className="mt-2 text-sm leading-6 text-slate-500">Your name appears next to messages. No account needed.</p><input autoFocus value={nameInput} onChange={e => setNameInput(e.target.value)} placeholder="Your first name" className="mt-6 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm outline-none ring-slate-300 focus:ring-2 dark:border-slate-700 dark:bg-slate-800" /><button className="mt-3 w-full rounded-xl bg-slate-900 py-3.5 text-sm font-semibold text-white dark:bg-white dark:text-slate-900">Continue</button></motion.form></motion.div>}</AnimatePresence>
    <AnimatePresence>{open && room && <motion.div drag dragMomentum={false} onDragStart={() => setDrag(true)} onDragEnd={() => setDrag(false)} initial={{ opacity: 0, y: 24, scale: .96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 24 }} className="fixed bottom-5 right-5 z-20 flex w-[calc(100vw-2.5rem)] max-w-[390px] flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/15 dark:border-slate-700 dark:bg-slate-900"><div className="flex cursor-grab items-center justify-between border-b border-slate-100 px-5 py-4 active:cursor-grabbing dark:border-slate-800"><div className="flex items-center gap-3"><div className="relative grid size-9 place-items-center rounded-xl bg-slate-100 dark:bg-slate-800"><MessageCircle size={17} /><span className={`absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border-2 border-white dark:border-slate-900 ${friendOnline ? 'bg-emerald-400' : 'bg-slate-300'}`} /></div><div><div className="text-sm font-semibold">Room {room}</div><div className="text-xs text-slate-400">{friendOnline ? 'Friend is online' : 'Waiting for a friend'}</div></div></div><div className="flex items-center gap-1"><button aria-label="Copy room link" onClick={copyLink} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">{copied ? <Check size={16} /> : <Copy size={16} />}</button><button aria-label="Close chat" onClick={() => setOpen(false)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"><X size={16} /></button></div></div><div className="flex h-[340px] flex-col gap-3 overflow-y-auto bg-slate-50/70 p-4 dark:bg-slate-950/20">{messages.length === 0 && <div className="m-auto text-center text-xs leading-5 text-slate-400">Share the room link to start<br />your first conversation.</div>}{messages.map(m => <div key={m.id} className={`group flex flex-col ${m.sender_name === name ? 'items-end' : 'items-start'}`}><span className="mb-1 px-1 text-[10px] font-medium text-slate-400">{m.sender_name}</span><div className={`relative max-w-[82%] rounded-2xl px-3.5 py-2.5 text-sm leading-5 ${m.sender_name === name ? 'rounded-br-md bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'rounded-bl-md border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800'}`}>{m.body}<div className="absolute -bottom-3 left-1/2 hidden -translate-x-1/2 gap-1 rounded-full border border-slate-200 bg-white p-1 shadow-sm group-hover:flex dark:border-slate-700 dark:bg-slate-900"><button aria-label="React thumbs up" onClick={() => react(m.id, 'thumbs')}><ThumbsUp size={12} /></button><button aria-label="React heart" onClick={() => react(m.id, 'heart')}><Heart size={12} /></button></div></div>{m.reaction && <span className="mt-1 rounded-full border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] dark:border-slate-700 dark:bg-slate-800">{m.reaction === 'heart' ? '♥' : '👍'}</span>}</div>)}{typing && <div className="text-xs italic text-slate-400">Someone is typing…</div>}<div ref={bottomRef} /></div><div className="border-t border-slate-100 p-3 dark:border-slate-800"><div className="flex items-center gap-2 rounded-2xl bg-slate-100 px-3 py-1.5 dark:bg-slate-800"><input aria-label="Message" value={message} onChange={e => { setMessage(e.target.value); broadcastTyping(e.target.value.length > 0); if (typingTimer.current) clearTimeout(typingTimer.current); typingTimer.current = setTimeout(() => broadcastTyping(false), 1800) }} onKeyDown={e => { if (e.key === 'Enter' && !e.nativeEvent.isComposing && e.keyCode !== 229) sendMessage() }} placeholder="Write a message…" className="min-w-0 flex-1 bg-transparent py-2 text-sm outline-none placeholder:text-slate-400" /><button aria-label="Send message" onClick={sendMessage} className="grid size-8 shrink-0 place-items-center rounded-xl bg-slate-900 text-white transition hover:scale-105 dark:bg-white dark:text-slate-900"><Send size={14} /></button></div></div></motion.div>}</AnimatePresence>
    {!open && room && <button aria-label="Open chat" onClick={() => setOpen(true)} className="bubble-gradient fixed bottom-5 right-5 z-10 grid size-14 place-items-center rounded-full text-white shadow-xl shadow-cyan-500/30 transition hover:scale-105"><MessageCircle /></button>}
  </main>
}
