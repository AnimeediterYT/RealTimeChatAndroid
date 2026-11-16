'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createClient, type RealtimeChannel, type User } from '@supabase/supabase-js'
import { Bell, Check, ChevronDown, Compass, Copy, Hash, Home, ImagePlus, MessageCircle, Plus, Search, Send, Settings, ShieldCheck, Sparkles, UserPlus, Users } from 'lucide-react'

type RoomMessage = { id: string; room_id: string; sender_name: string; body: string; reaction?: string | null; created_at: string }
type Profile = { id: string; username: string; display_name: string; bio: string; avatar_url?: string | null }
type FriendRequest = { id: string; sender_id: string; receiver_id: string; status: string; created_at: string }
type Friendship = { id: string; user_a: string; user_b: string }
type PrivateConversation = { id: string; user_a: string; user_b: string }
type PrivateMessage = { id: string; conversation_id: string; sender_id: string; body: string; created_at: string }
type RoomMember = { user_id: string; display_name: string }

const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL && (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '')
  : null
const mergeById = <T extends { id: string; created_at?: string }>(a: T[], b: T[]) => Array.from(new Map([...a, ...b].map((item) => [item.id, item])).values()).sort((left, right) => (left.created_at || '').localeCompare(right.created_at || ''))
const roomCode = () => { const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'; const bytes = crypto.getRandomValues(new Uint8Array(6)); return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join('') }

export default function Page() {
  const [user, setUser] = useState<User | null>(null)
  const [authReady, setAuthReady] = useState(!supabase)
  const [authMode, setAuthMode] = useState<'sign-in' | 'sign-up'>('sign-up')
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [displayName, setDisplayName] = useState(''); const [username, setUsername] = useState(''); const [bio, setBio] = useState(''); const [avatarUrl, setAvatarUrl] = useState(''); const [guestName, setGuestName] = useState(''); const [authError, setAuthError] = useState(''); const [busy, setBusy] = useState('')
  const [room, setRoom] = useState(''); const [roomInput, setRoomInput] = useState(''); const [roomOpen, setRoomOpen] = useState(false); const [roomText, setRoomText] = useState(''); const [roomMessages, setRoomMessages] = useState<RoomMessage[]>([]); const [roomLoading, setRoomLoading] = useState(false); const [roomError, setRoomError] = useState(''); const [copied, setCopied] = useState(false)
  const [profiles, setProfiles] = useState<Profile[]>([]); const [requests, setRequests] = useState<FriendRequest[]>([]); const [friendships, setFriendships] = useState<Friendship[]>([]); const [search, setSearch] = useState(''); const [socialLoading, setSocialLoading] = useState(false); const [socialError, setSocialError] = useState('')
  const [conversation, setConversation] = useState<PrivateConversation | null>(null); const [privateMessages, setPrivateMessages] = useState<PrivateMessage[]>([]); const [privateText, setPrivateText] = useState('')
  const [activeView, setActiveView] = useState<'chat' | 'friends' | 'requests' | 'discover' | 'profile'>('chat'); const [roomMembers, setRoomMembers] = useState<RoomMember[]>([]); const [testBot, setTestBot] = useState<Profile | null>(null); const [botLoading, setBotLoading] = useState(false)
  const roomChannel = useRef<RealtimeChannel | null>(null); const privateChannel = useRef<RealtimeChannel | null>(null)

  const loadSocial = useCallback(async (current: User) => {
    if (!supabase) return
    setSocialLoading(true); setSocialError('')
    const [me, req, friends, people] = await Promise.all([
      supabase.from('profiles').select('id,username,display_name,bio,avatar_url').eq('id', current.id).maybeSingle(),
      supabase.from('friend_requests').select('id,sender_id,receiver_id,status,created_at').or(`sender_id.eq.${current.id},receiver_id.eq.${current.id}`).eq('status', 'pending'),
      supabase.from('friendships').select('id,user_a,user_b').or(`user_a.eq.${current.id},user_b.eq.${current.id}`),
      supabase.from('public_profiles').select('id,username,display_name,bio,avatar_url').neq('id', current.id).order('username').limit(200),
    ])
    setDisplayName(me.data?.display_name || current.user_metadata?.display_name || '')
    setUsername(me.data?.username || current.user_metadata?.username || '')
    setBio(me.data?.bio || '')
    setAvatarUrl(me.data?.avatar_url || '')
    if (me.error || req.error || friends.error || people.error) setSocialError('Could not load your social data. Please retry.')
    setProfiles((people.data || []) as Profile[]); setTestBot(((people.data || []) as Profile[]).find((p) => p.username === 'bubble_test_bot') || null); setRequests((req.data || []) as FriendRequest[]); setFriendships((friends.data || []) as Friendship[]); setSocialLoading(false)
  }, [])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search); const requestedRoom = (params.get('room') || '').toUpperCase()
    const savedGuestName = localStorage.getItem('bubble_guest_display_name') || ''
    setGuestName(savedGuestName)
    setRoomInput(requestedRoom)
    if (!supabase) return
    supabase.auth.getSession().then(async ({ data }) => {
      let currentUser = data.session?.user || null
      if (requestedRoom && !currentUser) setRoomError('Enter a guest display name, then continue as guest to join this room.')
      setUser(currentUser); setAuthReady(true)
      if (currentUser && !currentUser.is_anonymous) loadSocial(currentUser)
      if (requestedRoom && currentUser) {
        if (currentUser.is_anonymous && !savedGuestName.trim()) setRoomError('Enter a guest display name to join this room.')
        else {
          const { error } = await supabase.rpc('join_chat_room', { p_room_id: requestedRoom, p_display_name: currentUser.is_anonymous ? savedGuestName.trim() : null })
          if (error) setRoomError('Could not join this room. Check the code and try again.')
          else { setRoom(requestedRoom); setRoomOpen(true) }
        }
      }
    })
    const { data } = supabase.auth.onAuthStateChange((_event, session) => { setUser(session?.user || null); setAuthReady(true); if (session?.user && !session.user.is_anonymous) loadSocial(session.user) })
    return () => data.subscription.unsubscribe()
  }, [loadSocial])

  useEffect(() => {
    if (!user || user.is_anonymous || !supabase) return
    const channel = supabase.channel(`social:${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'friend_requests' }, () => loadSocial(user))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'friendships' }, () => loadSocial(user))
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [user, loadSocial])

  useEffect(() => {
    if (!room || !supabase) return
    let active = true
    setRoomLoading(true); setRoomError(''); setRoomMessages([])
    Promise.all([supabase.from('chat_messages').select('id,room_id,sender_name,body,reaction,created_at').eq('room_id', room).order('created_at'), supabase.from('room_memberships').select('user_id,display_name').eq('room_id', room)]).then(([messages, members]) => { if (!active) return; if (messages.error) setRoomError('Could not load room messages.'); else setRoomMessages((messages.data || []) as RoomMessage[]); setRoomMembers((members.data || []) as RoomMember[]); setRoomLoading(false) })
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

  const friends = useMemo(() => user ? profiles.filter((p) => friendships.some((f) => (f.user_a === user.id && f.user_b === p.id) || (f.user_b === user.id && f.user_a === p.id))) : [], [profiles, friendships, user])
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
  const sendPasswordReset = async () => {
    if (!supabase || !email.trim()) { setAuthError('Enter your email address first.'); return }
    setBusy('reset'); setAuthError('')
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/auth/update-password` })
    setAuthError(error ? 'Could not send a password reset email. Check the address and retry.' : 'If an account exists for that email, a password reset link has been sent.')
    setBusy('')
  }
  const saveProfile = async () => { if (!supabase || !user || user.is_anonymous || busy) return; setBusy('profile'); setAuthError(''); const { error } = await supabase.from('profiles').upsert({ id: user.id, username: username.trim().toLowerCase(), display_name: displayName.trim(), bio: bio.trim(), avatar_url: avatarUrl || null }); if (error) setAuthError(error.code === '23505' ? 'That username is already taken.' : 'Could not save your profile. Please retry.'); else await loadSocial(user); setBusy('') }
  const uploadAvatar = async (file?: File) => {
    if (!supabase || !user || user.is_anonymous || !file || busy) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 2 * 1024 * 1024) { setAuthError('Choose a PNG, JPG, or WebP image under 2 MB.'); return }
    setBusy('avatar'); setAuthError('')
    const extension = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
    const path = `${user.id}/${crypto.randomUUID()}.${extension}`
    const { error } = await supabase.storage.from('avatars').upload(path, file, { contentType: file.type, upsert: false })
    if (error) setAuthError('Could not upload your profile photo. Please retry.')
    else { const { data } = supabase.storage.from('avatars').getPublicUrl(path); setAvatarUrl(data.publicUrl); const { error: updateError } = await supabase.from('profiles').update({ avatar_url: data.publicUrl }).eq('id', user.id); if (updateError) setAuthError('Photo uploaded, but profile could not be updated. Save your profile to retry.') }
    setBusy('')
  }
  const sendRequest = async (target: Profile) => { if (!supabase || !user || busy) return; setBusy(target.id); setAuthError(''); const { error } = await supabase.from('friend_requests').insert({ sender_id: user.id, receiver_id: target.id, status: 'pending' }); if (error) setAuthError(error.code === '23505' ? 'A request already exists for this person.' : 'Could not send friend request. Please retry.'); else if (target.username === 'bubble_test_bot') { const { data, error: botError } = await supabase.functions.invoke('friend-test-bot', { body: { action: 'accept-outgoing' } }); if (botError || data?.error) setAuthError(data?.error || 'Your request was sent, but the test bot could not accept it.'); } await loadSocial(user); setBusy('') }
  const requestAction = async (name: 'accept_friend_request' | 'reject_friend_request' | 'cancel_friend_request', id: string) => { if (!supabase || !user) return; setBusy(id); const { error } = await supabase.rpc(name, { p_request_id: id }); if (error) setAuthError(error.message); await loadSocial(user); setBusy('') }
  const openPrivate = async (target: Profile) => { if (!supabase) return; setBusy(target.id); const { data, error } = await supabase.rpc('create_private_conversation', { p_other_user_id: target.id }); if (error) setAuthError(error.message); else { setConversation(data as PrivateConversation); setActiveView('chat') } setBusy('') }
  const sendPrivate = async () => {
    const body = privateText.trim()
    if (!supabase || !user || !conversation || !body || busy === 'private-send') return
    setBusy('private-send')
    setPrivateText('')
    const { error } = await supabase.from('private_messages').insert({ conversation_id: conversation.id, sender_id: user.id, body })
    if (error) {
      setPrivateText(body)
      setAuthError('Could not send private message. Please retry.')
    } else if (testBot && (conversation.user_a === testBot.id || conversation.user_b === testBot.id)) {
      const { error: botError } = await supabase.functions.invoke('friend-test-bot', { body: { action: 'reply', conversation_id: conversation.id } })
      if (botError) setAuthError('Your message was sent, but the test bot could not reply.')
    }
    setBusy('')
  }
  const inviteTestBot = async () => {
    if (!supabase || !user || user.is_anonymous || botLoading) return
    setBotLoading(true); setSocialError('')
    const { data, error } = await supabase.functions.invoke('friend-test-bot', { body: { action: 'invite' } })
    if (error || data?.error) setSocialError(data?.error || 'Could not contact the test bot.')
    else { if (data?.bot) setTestBot(data.bot as Profile); await loadSocial(user); setActiveView(data?.already_friends ? 'friends' : 'requests') }
    setBotLoading(false)
  }
  const signOut = async () => { await supabase?.auth.signOut(); setUser(null); setConversation(null) }
  const ensureRoomSession = async () => {
    if (!supabase) return false
    const name = guestName.trim().slice(0, 24)
    const { data } = await supabase.auth.getSession()
    if (data.session) {
      if (data.session.user.is_anonymous && !name) { setRoomError('Choose a guest display name before joining a room.'); return false }
      if (data.session.user.is_anonymous) localStorage.setItem('bubble_guest_display_name', name)
      return true
    }
    if (!name) { setRoomError('Choose a guest display name before joining a room.'); return false }
    const guest = await supabase.auth.signInAnonymously()
    if (guest.error || !guest.data.session) { setRoomError('Guest access is unavailable. Please sign in and retry.'); return false }
    localStorage.setItem('bubble_guest_display_name', name)
    setUser(guest.data.user); setAuthReady(true)
    return true
  }
  const createRoom = async () => {
    if (!supabase || roomLoading) return
    setRoomLoading(true); setRoomError('')
    if (!(await ensureRoomSession())) { setRoomLoading(false); return }
    const next = roomCode()
    const { data: sessionData } = await supabase.auth.getSession()
    const { error } = await supabase.rpc('create_chat_room', { p_room_id: next, p_display_name: sessionData.session?.user.is_anonymous ? guestName.trim() : null })
    if (error) setRoomError('Could not create a room. Please retry.')
    else { setRoom(next); setRoomInput(next); setRoomOpen(true); window.history.replaceState({}, '', `?room=${next}`) }
    setRoomLoading(false)
  }
  const joinRoom = async () => {
    const next = roomInput.trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
    if (!supabase || !/^[A-Z0-9]{6}$/.test(next) || roomLoading) { setRoomError('Enter a valid six-character room code.'); return }
    setRoomLoading(true); setRoomError('')
    if (!(await ensureRoomSession())) { setRoomLoading(false); return }
    const { data: sessionData } = await supabase.auth.getSession()
    const { error } = await supabase.rpc('join_chat_room', { p_room_id: next, p_display_name: sessionData.session?.user.is_anonymous ? guestName.trim() : null })
    if (error) setRoomError('Could not join this room. Check the code and try again.')
    else { setRoom(next); setRoomOpen(true); window.history.replaceState({}, '', `?room=${next}`) }
    setRoomLoading(false)
  }

  return (
    <main className="discord-shell">
      <aside className="server-rail" aria-label="Workspace navigation">
        <a href="/" className="rail-logo" aria-label="Bubble Chat">b.</a>
        <span className="rail-separator" />
        <button className="rail-button is-active" title="Messages" onClick={() => setActiveView('chat')}><Home size={21}/></button>
        <button className="rail-button" title="Friends" onClick={() => setActiveView('friends')}><Users size={21}/></button>
        <button className="rail-button" title="Discover" onClick={() => setActiveView('discover')}><Compass size={21}/></button>
        <span className="rail-separator" />
        <button className="rail-button rail-add" title="Create room" onClick={createRoom}><Plus size={23}/></button>
        <div className="rail-spacer"/>
        <button className="rail-button" title="Settings" onClick={() => setActiveView('profile')}><Settings size={20}/></button>
      </aside>

      <aside className="workspace-sidebar">
        <button className="workspace-switcher" onClick={() => setActiveView('chat')}><span className="workspace-glyph">b.</span><span><strong>Bubble Hub</strong><small>Your conversations</small></span><ChevronDown size={16}/></button>
        <div className="sidebar-search"><Search size={15}/><input aria-label="Search people" placeholder="Search people" value={search} onChange={(e) => {setSearch(e.target.value);setActiveView('discover')}}/></div>
        <div className="sidebar-section">
          <p className="sidebar-heading">Your space</p>
          <button className={'sidebar-link '+(activeView==='chat'?'selected':'')} onClick={() => setActiveView('chat')}><MessageCircle size={18}/> Messages</button>
          <button className={'sidebar-link '+(activeView==='friends'?'selected':'')} onClick={() => setActiveView('friends')}><Users size={18}/> Friends <span className="sidebar-count">{friends.length}</span></button>
          <button className={'sidebar-link '+(activeView==='requests'?'selected':'')} onClick={() => setActiveView('requests')}><Bell size={18}/> Requests {requests.some((r)=>r.receiver_id===user?.id)&&<span className="request-dot"/>}</button>
          <button className={'sidebar-link '+(activeView==='discover'?'selected':'')} onClick={() => setActiveView('discover')}><Compass size={18}/> Discover</button>
        </div>
        <div className="sidebar-section room-section">
          <div className="sidebar-heading-row"><p className="sidebar-heading">Rooms</p><button aria-label="Create room" onClick={createRoom}><Plus size={16}/></button></div>
          {roomOpen&&room?<button className="sidebar-link selected" onClick={()=>{setConversation(null);setActiveView('chat')}}><Hash size={17}/> Room {room}</button>:<p className="sidebar-empty">No room open</p>}
          <button className="sidebar-create" onClick={createRoom}><Plus size={16}/> Create a room</button>
          <div className="sidebar-join"><input value={roomInput} onChange={(e)=>setRoomInput(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,6))} maxLength={6} placeholder="Room code" aria-label="Room code"/><button onClick={joinRoom}>Join</button></div>
          {user?.is_anonymous&&<label className="guest-name-label">Guest name<input value={guestName} maxLength={24} onChange={(e)=>{setGuestName(e.target.value.slice(0,24));localStorage.setItem('bubble_guest_display_name',e.target.value.slice(0,24))}} placeholder="Your chat name"/></label>}
          {roomError&&<p className="sidebar-error" role="alert">{roomError}</p>}
        </div>
        <div className="sidebar-section dm-section">
          <div className="sidebar-heading-row"><p className="sidebar-heading">Direct messages</p><button aria-label="Find friends" onClick={()=>setActiveView('discover')}><Plus size={16}/></button></div>
          {friends.slice(0,12).map((p)=><button key={p.id} className="dm-link" onClick={()=>openPrivate(p)}><span className="avatar-small">{p.avatar_url?<img src={p.avatar_url} alt=""/>:p.display_name.slice(0,1).toUpperCase()}</span><span className="dm-name">{p.display_name}</span></button>)}
          {friends.length===0&&<p className="sidebar-empty">Accepted friends appear here.</p>}
        </div>
        <div className="account-strip">
          <div className="avatar-small account-avatar">{avatarUrl&&!user?.is_anonymous?<img src={avatarUrl} alt=""/>:(displayName||guestName||'B').slice(0,1).toUpperCase()}</div>
          <div className="account-copy"><strong>{user?.is_anonymous?guestName||'Guest':displayName||user?.email||'Not signed in'}</strong><small>{user?.is_anonymous?'Guest session':user?'@'+(username||'member'):'Sign in to continue'}</small></div>
          <button className="account-settings" title="Profile settings" onClick={()=>setActiveView('profile')}><Settings size={18}/></button>
        </div>
      </aside>

      <section className="workspace-main">
        <header className="workspace-header">
          <div className="header-title">
            {activeView==='chat'&&<><Hash size={20}/><strong>{roomOpen&&room?'Room '+room:other?.display_name||'Messages'}</strong></>}
            {activeView==='friends'&&<><Users size={20}/><strong>Friends</strong></>}
            {activeView==='requests'&&<><Bell size={20}/><strong>Friend requests</strong></>}
            {activeView==='discover'&&<><Compass size={20}/><strong>Discover people</strong></>}
            {activeView==='profile'&&<><Settings size={20}/><strong>Profile and settings</strong></>}
          </div>
          <div className="header-actions"><span className="header-hint">Bubble Chat</span><button className="header-icon" title="Friends" onClick={()=>setActiveView('friends')}><Users size={18}/></button><button className="header-icon" title="Settings" onClick={()=>setActiveView('profile')}><Settings size={18}/></button></div>
        </header>

        <div className="workspace-content">
          {activeView==='chat'&&(
            <div className="chat-stage">
              {roomOpen&&room?<>
                <div className="conversation-banner"><div><p className="eyebrow">ROOM CHANNEL</p><h1><Hash size={24}/> {room}</h1><p>Share the six-character code to invite someone into this room.</p></div><button className="discord-secondary" onClick={()=>{navigator.clipboard.writeText(window.location.origin+'?room='+room);setCopied(true);window.setTimeout(()=>setCopied(false),1200)}}><Copy size={16}/>{copied?'Copied':'Copy invite link'}</button></div>
                <div className="message-feed" aria-live="polite">
                  {roomLoading&&<p className="feed-empty">Loading messages…</p>}
                  {!roomLoading&&roomMessages.length===0&&<div className="feed-empty"><span className="empty-icon"><Hash size={28}/></span><h2>This is the beginning of the room.</h2><p>Send the first message to get the conversation started.</p></div>}
                  {roomMessages.map((m)=><article key={m.id} className="message-row"><div className="message-avatar">{m.sender_name.slice(0,1).toUpperCase()}</div><div className="message-body"><div className="message-meta"><strong>{m.sender_name}</strong><time>{new Date(m.created_at).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</time></div><p>{m.body}</p></div></article>)}
                </div>
                <form className="message-composer" onSubmit={async(e)=>{e.preventDefault();const body=roomText.trim();if(supabase&&user&&body&&room){setRoomText('');const {error}=await supabase.from('chat_messages').insert({room_id:room,body});if(error){setRoomText(body);setRoomError('Message was not sent. Check room membership and try again.')}}}}><input value={roomText} onChange={(e)=>setRoomText(e.target.value)} placeholder={'Message #'+room} aria-label="Room message"/><button disabled={!roomText.trim()} aria-label="Send room message"><Send size={18}/></button></form>
              </>:conversation?<>
                <div className="conversation-banner compact"><div className="profile-heading"><span className="avatar-large">{other?.avatar_url?<img src={other.avatar_url} alt=""/>:(other?.display_name||'?').slice(0,1).toUpperCase()}</span><div><h1>{other?.display_name||'Private conversation'}</h1><p>@{other?.username||'member'} · Private messages</p></div></div><button className="discord-secondary" onClick={()=>setActiveView('friends')}><Users size={16}/> Friends</button></div>
                <div className="message-feed" aria-live="polite">
                  {privateMessages.length===0&&<div className="feed-empty"><span className="empty-icon"><MessageCircle size={28}/></span><h2>This is the beginning of your conversation.</h2><p>Messages are visible to the two conversation members.</p></div>}
                  {privateMessages.map((m)=><article key={m.id} className="message-row"><div className="message-avatar">{m.sender_id===user?.id?(displayName||'Y').slice(0,1).toUpperCase():(other?.display_name||'F').slice(0,1).toUpperCase()}</div><div className="message-body"><div className="message-meta"><strong>{m.sender_id===user?.id?'You':other?.display_name||'Friend'}</strong><time>{new Date(m.created_at).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</time></div><p>{m.body}</p></div></article>)}
                </div>
                <form className="message-composer" onSubmit={(e)=>{e.preventDefault();sendPrivate()}}><input value={privateText} onChange={(e)=>setPrivateText(e.target.value)} placeholder={'Message @'+(other?.username||'friend')} aria-label="Private message"/><button disabled={!privateText.trim()||busy==='private-send'} aria-label="Send private message"><Send size={18}/></button></form>
              </>:<div className="welcome-stage"><div className="welcome-mark"><MessageCircle size={32}/></div><p className="eyebrow">YOUR CHAT WORKSPACE</p><h1>Good conversations start here.</h1><p className="welcome-copy">Open a room with a code or choose a friend from your direct messages. Your conversations stay in reach.</p><div className="welcome-actions"><button className="discord-primary" onClick={createRoom} disabled={roomLoading}><Plus size={17}/>{roomLoading?'Creating…':'Create a room'}</button><button className="discord-secondary" onClick={()=>setActiveView('discover')}><UserPlus size={17}/> Find people</button></div><div className="welcome-code"><input value={roomInput} onChange={(e)=>setRoomInput(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,6))} maxLength={6} placeholder="Enter a room code" aria-label="Enter a room code"/><button onClick={joinRoom}>Join room</button></div>{user?.is_anonymous&&<p className="welcome-note">Guest mode is active. Your chosen display name appears in room messages.</p>}</div>}
            </div>
          )}

          {activeView==='friends'&&<div className="page-stage"><div className="page-intro"><div><p className="eyebrow">YOUR PEOPLE</p><h1>Friends</h1><p>Start a private conversation with someone you have accepted.</p></div><button className="discord-primary" onClick={()=>setActiveView('discover')}><UserPlus size={17}/> Add a friend</button></div>
            {user?.is_anonymous?<div className="notice-panel">Friend features require a registered account. Create an account to use friends and private messages.</div>:<><div className="list-heading">All friends <span>{friends.length}</span></div>{friends.length===0&&<div className="empty-panel"><Users size={30}/><h2>No friends yet</h2><p>Find someone by username or send a request to the test bot.</p><button className="discord-secondary" onClick={inviteTestBot} disabled={botLoading}><ShieldCheck size={16}/>{botLoading?'Adding test bot…':'Add test bot'}</button></div>}<div className="people-list">{friends.map((p)=><div className="person-row" key={p.id}><span className="avatar-large">{p.avatar_url?<img src={p.avatar_url} alt=""/>:p.display_name.slice(0,1).toUpperCase()}</span><div className="person-copy"><strong>{p.display_name}{p.username==='bubble_test_bot'&&<span className="bot-tag">TEST BOT</span>}</strong><small>@{p.username}</small></div><button className="discord-secondary" onClick={()=>openPrivate(p)}><MessageCircle size={16}/> Message</button></div>)}</div><div className="test-bot-panel"><div><span className="bot-mark"><ShieldCheck size={19}/></span><div><strong>Bubble Test Bot</strong><p>Dedicated test account for friend requests and private messages in this preview.</p></div></div><button className="discord-secondary" onClick={inviteTestBot} disabled={botLoading}>{botLoading?'Connecting…':'Send test request'}</button></div></>}
          </div>}

          {activeView==='requests'&&<div className="page-stage"><div className="page-intro"><div><p className="eyebrow">SOCIAL</p><h1>Friend requests</h1><p>Accept or decline incoming requests. Cancel requests you sent.</p></div><button className="discord-secondary" onClick={inviteTestBot} disabled={botLoading}><ShieldCheck size={16}/>{botLoading?'Connecting…':'Test bot'}</button></div>
            {user?.is_anonymous?<div className="notice-panel">Sign in with a registered account to manage friend requests.</div>:<><div className="list-heading">Incoming <span>{requests.filter((r)=>r.receiver_id===user?.id).length}</span></div><div className="people-list">{requests.filter((r)=>r.receiver_id===user?.id).map((r)=>{const p=profiles.find((x)=>x.id===r.sender_id);return <div className="person-row" key={r.id}><span className="avatar-large">{(p?.display_name||'F').slice(0,1).toUpperCase()}</span><div className="person-copy"><strong>{p?.display_name||'Friend request'}{p?.username==='bubble_test_bot'&&<span className="bot-tag">TEST BOT</span>}</strong><small>@{p?.username||'member'}</small></div><button className="discord-primary" onClick={()=>requestAction('accept_friend_request',r.id)}>Accept</button><button className="discord-danger" onClick={()=>requestAction('reject_friend_request',r.id)}>Decline</button></div>})}</div><div className="list-heading outgoing-heading">Sent <span>{requests.filter((r)=>r.sender_id===user?.id).length}</span></div><div className="people-list">{requests.filter((r)=>r.sender_id===user?.id).map((r)=>{const p=profiles.find((x)=>x.id===r.receiver_id);return <div className="person-row" key={r.id}><span className="avatar-large">{(p?.display_name||'F').slice(0,1).toUpperCase()}</span><div className="person-copy"><strong>{p?.display_name||'Pending request'}</strong><small>@{p?.username||'member'} · Pending</small></div><button className="discord-danger" onClick={()=>requestAction('cancel_friend_request',r.id)}>Cancel</button></div>})}</div>{requests.length===0&&<div className="empty-panel"><Bell size={28}/><h2>No pending requests</h2><p>Use the test bot to create an incoming request and check the accept flow.</p><button className="discord-primary" onClick={inviteTestBot} disabled={botLoading}>Send test request</button></div>}</>}
          </div>}

          {activeView==='discover'&&<div className="page-stage"><div className="page-intro"><div><p className="eyebrow">FIND YOUR PEOPLE</p><h1>Discover</h1><p>Search public profiles by username or display name.</p></div></div>{user?.is_anonymous?<div className="notice-panel">Sign in with a registered account to send friend requests.</div>:<><div className="discover-search"><Search size={18}/><input value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="Search usernames or display names"/></div>{results.length===0?<div className="empty-panel"><Compass size={30}/><h2>Search for someone</h2><p>Type a name or username to find people. You can also add the test bot.</p><button className="discord-secondary" onClick={inviteTestBot} disabled={botLoading}><ShieldCheck size={16}/>{botLoading?'Connecting…':'Add test bot'}</button></div>:<div className="people-list">{results.map((p)=><div className="person-row" key={p.id}><span className="avatar-large">{p.avatar_url?<img src={p.avatar_url} alt=""/>:p.display_name.slice(0,1).toUpperCase()}</span><div className="person-copy"><strong>{p.display_name}{p.username==='bubble_test_bot'&&<span className="bot-tag">TEST BOT</span>}</strong><small>@{p.username}</small></div><button className="discord-secondary" onClick={()=>sendRequest(p)} disabled={!!busy||friendships.some((f)=>f.user_a===p.id||f.user_b===p.id)}><UserPlus size={16}/> Add friend</button></div>)}</div>}</>}</div>}

          {activeView==='profile'&&<div className="page-stage"><div className="page-intro"><div><p className="eyebrow">ACCOUNT</p><h1>Profile and settings</h1><p>Update how people see you across Bubble Chat.</p></div></div>{user?.is_anonymous?<div className="notice-panel">Guest profiles are temporary. Create an account to save a profile photo, username and bio.</div>:<div className="profile-editor"><div className="profile-cover"><Sparkles size={22}/><span>YOUR BUBBLE PROFILE</span></div><div className="profile-edit-body"><div className="profile-edit-avatar">{avatarUrl?<img src={avatarUrl} alt="Profile avatar"/>:(displayName||username||'B').slice(0,1).toUpperCase()}</div><label className="discord-secondary upload-control"><ImagePlus size={16}/> Change avatar<input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e)=>uploadAvatar(e.target.files?.[0])}/></label><div className="profile-fields"><label>Display name<input value={displayName} onChange={(e)=>setDisplayName(e.target.value)} maxLength={80}/></label><label>Username<input value={username} onChange={(e)=>setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g,'').slice(0,32))} maxLength={32}/></label><label>About me<textarea value={bio} onChange={(e)=>setBio(e.target.value)} maxLength={240} rows={4}/></label></div><div className="profile-actions"><button className="discord-danger" onClick={signOut}>Sign out</button><button className="discord-primary" onClick={saveProfile} disabled={!!busy}>{busy==='profile'?'Saving…':'Save changes'}</button></div></div></div>}</div>}
          {authError&&user&&<p className="inline-error" role="alert">{authError}</p>}
          {socialError&&<p className="inline-error" role="alert">{socialError}</p>}
        </div>
      </section>

      <aside className="details-sidebar">
        {activeView==='chat'&&roomOpen&&room?<><div className="details-heading">Room details</div><div className="room-detail-card"><span className="room-detail-icon"><Hash size={21}/></span><strong>Room {room}</strong><p>Anyone with the code can request to join.</p><button className="discord-secondary" onClick={()=>{navigator.clipboard.writeText(window.location.origin+'?room='+room);setCopied(true);window.setTimeout(()=>setCopied(false),1200)}}><Copy size={15}/>{copied?'Copied':'Copy invite'}</button></div><div className="details-heading">Members <span>{roomMembers.length}</span></div>{roomMembers.map((m)=><div className="member-row" key={m.user_id}><span className="avatar-small">{m.display_name.slice(0,1).toUpperCase()}</span><span>{m.display_name}{m.user_id===user?.id?' (you)':''}</span></div>)}</>:
        activeView==='chat'&&other?<><div className="details-heading">Profile</div><div className="profile-mini"><span className="avatar-profile">{other.avatar_url?<img src={other.avatar_url} alt=""/>:other.display_name.slice(0,1).toUpperCase()}</span><strong>{other.display_name}</strong><small>@{other.username}</small><p>{other.bio||'No bio added yet.'}</p>{other.username==='bubble_test_bot'&&<span className="bot-tag">TEST BOT</span>}</div></>:
        <><div className="details-heading">Your friends</div>{friends.slice(0,8).map((p)=><button className="member-row member-button" key={p.id} onClick={()=>openPrivate(p)}><span className="avatar-small">{p.display_name.slice(0,1).toUpperCase()}</span><span>{p.display_name}</span></button>)}{friends.length===0&&<p className="details-empty">Friends you accept will appear here.</p>}<div className="details-tip"><ShieldCheck size={18}/><p>Private conversations remain available to their original members after unfriending, unless blocked.</p></div></>}
      </aside>

      <nav className="mobile-nav" aria-label="Main navigation">
        <button className={activeView==='chat'?'active':''} onClick={()=>setActiveView('chat')}><MessageCircle size={20}/><span>Chat</span></button>
        <button className={activeView==='friends'?'active':''} onClick={()=>setActiveView('friends')}><Users size={20}/><span>Friends</span></button>
        <button className={activeView==='requests'?'active':''} onClick={()=>setActiveView('requests')}><Bell size={20}/><span>Requests</span></button>
        <button className={activeView==='discover'?'active':''} onClick={()=>setActiveView('discover')}><Compass size={20}/><span>Discover</span></button>
        <button className={activeView==='profile'?'active':''} onClick={()=>setActiveView('profile')}><Settings size={20}/><span>Profile</span></button>
      </nav>

      {authReady&&!user&&supabase&&<div className="auth-overlay"><form onSubmit={(e)=>{e.preventDefault();authenticate()}} className="auth-card">
        <div className="auth-brand"><span className="rail-logo">b.</span><div><strong>Bubble Chat</strong><small>Your conversations, connected.</small></div></div>
        <div className="auth-heading"><p className="eyebrow">{authMode==='sign-up'?'CREATE AN ACCOUNT':'WELCOME BACK'}</p><h2>{authMode==='sign-up'?'Make your space.':'Sign in to Bubble Chat'}</h2><p>Use your email to continue.</p></div>
        {authMode==='sign-up'&&<><label className="form-label">Display name<input required value={displayName} onChange={(e)=>setDisplayName(e.target.value)} placeholder="Your name" className="form-input"/></label><label className="form-label">Username<input required value={username} onChange={(e)=>setUsername(e.target.value)} placeholder="Choose a username" className="form-input"/></label></>}
        <label className="form-label">Email<input required type="email" value={email} onChange={(e)=>setEmail(e.target.value)} placeholder="you@example.com" className="form-input"/></label>
        <label className="form-label">Password<input required minLength={8} type="password" value={password} onChange={(e)=>setPassword(e.target.value)} placeholder="At least 8 characters" className="form-input"/></label>
        {authMode==='sign-in'&&<button type="button" disabled={!!busy} onClick={sendPasswordReset} className="text-button">{busy==='reset'?'Sending reset link…':'Forgot password?'}</button>}
        {authError&&<p className="auth-error" role="alert">{authError}</p>}
        <label className="form-label guest-form">Guest display name<input required maxLength={24} value={guestName} onChange={(e)=>setGuestName(e.target.value.slice(0,24))} placeholder="Name shown in rooms" className="form-input"/></label>
        <button type="button" disabled={busy==='guest'||busy==='auth'} onClick={async()=>{const name=guestName.trim();if(!name){setAuthError('Choose a guest display name first.');return}setBusy('guest');localStorage.setItem('bubble_guest_display_name',name);const {data,error}=await supabase.auth.signInAnonymously();if(error)setAuthError('Guest access is disabled in Supabase. Enable Authentication → Providers → Anonymous Sign-Ins, then retry.');else{setUser(data.user);const requestedRoom=(new URLSearchParams(window.location.search).get('room')||'').toUpperCase();if(requestedRoom){const {error:joinError}=await supabase.rpc('join_chat_room',{p_room_id:requestedRoom,p_display_name:name});if(joinError)setRoomError('Could not join this room. Check the code and try again.');else{setRoom(requestedRoom);setRoomOpen(true)}}}setBusy('')}} className="discord-secondary full-width">{busy==='guest'?'Connecting…':'Continue as guest'}</button>
        <button disabled={busy==='auth'} className="discord-primary full-width">{busy==='auth'?'Please wait…':authMode==='sign-up'?'Create account':'Sign in'}</button>
        <button type="button" onClick={()=>{setAuthError('');setAuthMode(authMode==='sign-up'?'sign-in':'sign-up')}} className="auth-switch">{authMode==='sign-up'?'Already have an account? Sign in':'New to Bubble Chat? Create an account'}</button>
      </form></div>}
    </main>
  )

      <div className="mx-auto flex min-h-dvh w-full max-w-[1440px] flex-col px-4 pb-24 pt-4 sm:px-7 sm:pt-6 lg:px-10">
        <header className="flex items-center justify-between border-b border-white/10 pb-4">
          <a href="/" className="flex items-center gap-3" aria-label="Bubble Chat home">
            <span className="bubble-mark grid size-10 place-items-center rounded-[15px] text-lg font-bold text-[#07131f]">b.</span>
            <span className="text-[17px] font-semibold tracking-tight">Bubble <span className="text-[#a5a6f6]">Chat</span></span>
          </a>
          <div className="flex items-center gap-3">
            {user && <span className="hidden text-sm text-slate-400 sm:inline">{user.is_anonymous ? 'Guest session' : displayName || user.email}</span>}
            {user && <button onClick={signOut} className="bubble-quiet-button">Sign out</button>}
          </div>
        </header>

        <div className="grid flex-1 gap-7 py-7 lg:grid-cols-[minmax(0,1.4fr)_minmax(300px,.8fr)] lg:gap-10 lg:py-10">
          <section className="flex flex-col justify-center">
            <div className="mb-5 inline-flex w-fit items-center gap-2 rounded-full border border-[#5865f2]/25 bg-[#5865f2]/[0.10] px-3 py-1.5 text-xs text-[#c5c6ff]">
              <span className="size-1.5 rounded-full bg-[#5865f2]" />
              Rooms stay in sync across devices
            </div>
            <h1 className="max-w-[760px] text-[clamp(2.7rem,8vw,5.7rem)] font-semibold leading-[.98] tracking-[-.065em]">
              Conversations<br /><span className="bubble-heading-accent">without the noise.</span>
            </h1>
            <p className="mt-5 max-w-xl text-[15px] leading-7 text-slate-400 sm:text-base">
              Start a room with a code. Find people you know. Keep private chats in one place.
            </p>

            <div className="bubble-panel mt-8 max-w-2xl p-4 sm:p-6">
              {user?.is_anonymous && <label className="bubble-label mb-3">Guest display name<input value={guestName} maxLength={24} onChange={(e) => setGuestName(e.target.value.slice(0, 24))} placeholder="Choose the name shown in chat" className="bubble-input mt-1" /></label>}
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
                <span className="text-xs font-medium text-[#b9baff]">BUILT FOR EVERYDAY CHATS</span>
                <h2 className="mt-3 max-w-xs text-2xl font-semibold leading-tight tracking-tight">A room for the moment. A chat that stays.</h2>
                <p className="mt-3 max-w-sm text-sm leading-6 text-slate-400">Share a room link to talk together, or sign in to keep up with friends and private conversations.</p>
              </div>
              <div className="bubble-orbit" aria-hidden="true"><span /><span /><span /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bubble-stat"><MessageCircle size={18} className="text-[#9de8df]" /><p className="mt-4 text-sm font-medium">Room chat</p><p className="mt-1 text-xs leading-5 text-slate-500">Join with a short code.</p></div>
              <div className="bubble-stat"><Users size={18} className="text-[#9b9cf4]" /><p className="mt-4 text-sm font-medium">Private chats</p><p className="mt-1 text-xs leading-5 text-slate-500">Keep conversations close.</p></div>
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
                <div className="mb-4 flex items-center gap-3"><div className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-full border border-white/10 bg-[#273c50] text-lg font-semibold text-[#d7d9ff]">{avatarUrl ? <img src={avatarUrl} alt="Profile avatar" className="h-full w-full object-cover" /> : (displayName || username || 'B').slice(0, 1).toUpperCase()}</div><label className="bubble-secondary-button cursor-pointer"> <ImagePlus size={16} className="mr-2" /> Change photo<input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => uploadAvatar(e.target.files?.[0])} /></label></div>
                <label className="bubble-label">Username<input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="username" className="bubble-input mt-1" /></label>
                <label className="bubble-label mt-3">Display name<input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Display name" className="bubble-input mt-1" /></label>
                <label className="bubble-label mt-3">About you<textarea maxLength={240} value={bio} onChange={(e) => setBio(e.target.value)} placeholder="A short bio" className="bubble-input mt-1 min-h-24 resize-y" /></label>
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
                  <h4 className="mb-2 mt-4 text-xs font-semibold text-slate-400">Sent requests</h4>
                  {requests.filter((r) => r.sender_id === user.id).map((r) => <div key={r.id} className="flex items-center justify-between gap-2 border-b border-white/[0.06] py-2 text-sm"><span className="min-w-0 truncate">{profiles.find((p) => p.id === r.receiver_id)?.display_name || 'Pending request'}</span><button onClick={() => requestAction('cancel_friend_request', r.id)} className="shrink-0 text-xs text-rose-300">Cancel</button></div>)}
                  {requests.filter((r) => r.sender_id === user.id).length === 0 && <p className="text-xs text-slate-500">No sent requests.</p>}
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
              <label className="bubble-label mt-3">Password<input required minLength={8} type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Your password" className="bubble-input mt-1" /></label>
              {authMode === 'sign-in' && <button type="button" disabled={!!busy} onClick={sendPasswordReset} className="mt-3 text-left text-xs text-[#b9baff] hover:text-white">{busy === 'reset' ? 'Sending reset link…' : 'Forgot password?'}</button>}
              {authError && <p role="alert" className="mt-3 text-sm text-rose-300">{authError}</p>}
              <label className="bubble-label mt-4">Guest display name<input required maxLength={24} value={guestName} onChange={(e) => setGuestName(e.target.value.slice(0, 24))} placeholder="Name shown in rooms" className="bubble-input mt-1" /></label>
              <button type="button" disabled={busy === 'guest' || busy === 'auth'} onClick={async () => { const name = guestName.trim(); if (!name) { setAuthError('Choose a guest display name first.'); return } setBusy('guest'); localStorage.setItem('bubble_guest_display_name', name); const { data, error } = await supabase.auth.signInAnonymously(); if (error) setAuthError('Guest access is disabled in Supabase. Enable Authentication → Providers → Anonymous Sign-Ins, then retry.'); else { setUser(data.user); const requestedRoom = (new URLSearchParams(window.location.search).get('room') || '').toUpperCase(); if (requestedRoom) { const { error: joinError } = await supabase.rpc('join_chat_room', { p_room_id: requestedRoom, p_display_name: name }); if (joinError) setRoomError('Could not join this room. Check the code and try again.'); else { setRoom(requestedRoom); setRoomOpen(true) } } } setBusy('') }} className="bubble-secondary-button mt-5 w-full">{busy === 'guest' ? 'Connecting…' : 'Continue as guest'}</button>
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