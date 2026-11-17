'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createClient, type RealtimeChannel, type User } from '@supabase/supabase-js'
import { Bell, Check, CircleUserRound, ChevronDown, ChevronRight, Compass, Copy, Crown, Hash, Home, ImagePlus, LayoutDashboard, MessageCircle, Palette, Plus, Search, Send, Server, Settings, ShieldCheck, ShoppingBag, Sparkles, Store, UserPlus, Users } from 'lucide-react'

type RoomMessage = { id: string; room_id: string; sender_name: string; body: string; reaction?: string | null; created_at: string }
type Profile = { id: string; username: string; display_name: string; bio: string; avatar_url?: string | null }
type FriendRequest = { id: string; sender_id: string; receiver_id: string; status: string; created_at: string }
type Friendship = { id: string; user_a: string; user_b: string }
type PrivateConversation = { id: string; user_a: string; user_b: string }
type PrivateMessage = { id: string; conversation_id: string; sender_id: string; body: string; created_at: string }
type RoomMember = { user_id: string; display_name: string }
type MessageReaction = { id: string; message_id: string; user_id: string; emoji: string; conversation_id?: string }
const CHAT_EMOJIS = ['😀','😂','🥹','😍','🤔','👏','👍','❤️','🔥','🎉','💜','✨'] as const

const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL && (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '')
  : null
const mergeById = <T extends { id: string; created_at?: string }>(a: T[], b: T[]) => Array.from(new Map([...a, ...b].map((item) => [item.id, item])).values()).sort((left, right) => (left.created_at || '').localeCompare(right.created_at || ''))
const roomCode = () => { const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'; const bytes = crypto.getRandomValues(new Uint8Array(6)); return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join('') }

export default function Page() {
  const [user, setUser] = useState<User | null>(null)
  const [authReady, setAuthReady] = useState(!supabase)
  const [authMode, setAuthMode] = useState<'sign-in' | 'sign-up'>('sign-up')
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [displayName, setDisplayName] = useState(''); const [username, setUsername] = useState(''); const [bio, setBio] = useState(''); const [avatarUrl, setAvatarUrl] = useState(''); const [guestName, setGuestName] = useState(''); const [guestMode, setGuestMode] = useState(false); const [authError, setAuthError] = useState(''); const [busy, setBusy] = useState('')
  const [room, setRoom] = useState(''); const [roomInput, setRoomInput] = useState(''); const [roomOpen, setRoomOpen] = useState(false); const [roomText, setRoomText] = useState(''); const [roomMessages, setRoomMessages] = useState<RoomMessage[]>([]); const [roomLoading, setRoomLoading] = useState(false); const [roomError, setRoomError] = useState(''); const [copied, setCopied] = useState(false)
  const [profiles, setProfiles] = useState<Profile[]>([]); const [requests, setRequests] = useState<FriendRequest[]>([]); const [friendships, setFriendships] = useState<Friendship[]>([]); const [search, setSearch] = useState(''); const [socialLoading, setSocialLoading] = useState(false); const [socialError, setSocialError] = useState('')
  const [conversation, setConversation] = useState<PrivateConversation | null>(null); const [conversations, setConversations] = useState<PrivateConversation[]>([]); const [privateMessages, setPrivateMessages] = useState<PrivateMessage[]>([]); const [privateText, setPrivateText] = useState('')
  const [activeView, setActiveView] = useState<'servers' | 'chat' | 'friends' | 'requests' | 'discover' | 'profile' | 'shop' | 'settings'>('servers'); const [roomMembers, setRoomMembers] = useState<RoomMember[]>([])
  const [decoration, setDecoration] = useState('none'); const [roomReactions, setRoomReactions] = useState<MessageReaction[]>([]); const [privateReactions, setPrivateReactions] = useState<MessageReaction[]>([]); const [emojiPicker, setEmojiPicker] = useState<'room' | 'private' | null>(null); const [reactionTarget, setReactionTarget] = useState<{ messageId: string; kind: 'room' | 'private' } | null>(null); const [deviceMode, setDeviceMode] = useState<'mobile' | 'tablet' | 'desktop'>('desktop')
  const roomChannel = useRef<RealtimeChannel | null>(null); const privateChannel = useRef<RealtimeChannel | null>(null)

  useEffect(() => {
    const updateDeviceMode = () => {
      const width = window.innerWidth
      setDeviceMode(width <= 700 ? 'mobile' : width <= 1120 ? 'tablet' : 'desktop')
    }
    updateDeviceMode()
    window.addEventListener('resize', updateDeviceMode, { passive: true })
    return () => window.removeEventListener('resize', updateDeviceMode)
  }, [])

  const loadSocial = useCallback(async (current: User) => {
    if (!supabase) return
    setSocialLoading(true); setSocialError('')
    const [me, req, friends, people, recentConversations] = await Promise.all([
      supabase.from('profiles').select('id,username,display_name,bio,avatar_url').eq('id', current.id).maybeSingle(),
      supabase.from('friend_requests').select('id,sender_id,receiver_id,status,created_at').or(`sender_id.eq.${current.id},receiver_id.eq.${current.id}`).eq('status', 'pending'),
      supabase.from('friendships').select('id,user_a,user_b').or(`user_a.eq.${current.id},user_b.eq.${current.id}`),
      supabase.from('public_profiles').select('id,username,display_name,bio,avatar_url').neq('id', current.id).order('username').limit(200),
      supabase.from('private_conversations').select('id,user_a,user_b').or(`user_a.eq.${current.id},user_b.eq.${current.id}`).order('created_at',{ascending:false}).limit(50),
    ])
    setDisplayName(me.data?.display_name || current.user_metadata?.display_name || '')
    setUsername(me.data?.username || current.user_metadata?.username || '')
    setBio(me.data?.bio || '')
    setAvatarUrl(me.data?.avatar_url || ''); setDecoration(String(current.user_metadata?.profile_decoration || localStorage.getItem('bubble_profile_decoration') || 'none'))
    if (me.error || req.error || friends.error || people.error || recentConversations.error) setSocialError('Could not load your social data. Please retry.')
    setConversations((recentConversations.data||[]) as PrivateConversation[])
    setProfiles((people.data || []) as Profile[]); setRequests((req.data || []) as FriendRequest[]); setFriendships((friends.data || []) as Friendship[]); setSocialLoading(false)
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
    const { data } = supabase.auth.onAuthStateChange((_event, session) => { setUser(session?.user || null); setAuthReady(true); if (session?.user) setDecoration(String(session.user.user_metadata?.profile_decoration || localStorage.getItem('bubble_profile_decoration') || 'none')); if (session?.user && !session.user.is_anonymous) loadSocial(session.user) })
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
    setRoomLoading(true); setRoomError(''); setRoomMessages([]); setRoomReactions([])
    Promise.all([supabase.from('chat_messages').select('id,room_id,sender_name,body,reaction,created_at').eq('room_id', room).order('created_at'), supabase.from('room_memberships').select('user_id,display_name').eq('room_id', room)]).then(async ([messages, members]) => { if (!active) return; if (messages.error) setRoomError('Could not load room messages.'); else { const rows=(messages.data || []) as RoomMessage[]; setRoomMessages(rows); if(rows.length){const {data:reactions}=await supabase.from('chat_message_reactions').select('id,message_id,user_id,emoji').in('message_id',rows.map((m)=>m.id));if(active)setRoomReactions((reactions||[]) as MessageReaction[])} } setRoomMembers((members.data || []) as RoomMember[]); setRoomLoading(false) })
    const channel = supabase.channel(`room:${room}`).on('postgres_changes', { event: '*', schema: 'public', table: 'chat_messages', filter: `room_id=eq.${room}` }, (payload) => setRoomMessages((prev) => payload.eventType === 'DELETE' ? prev.filter((m) => m.id !== (payload.old as RoomMessage).id) : mergeById(prev, [payload.new as RoomMessage]))).on('postgres_changes',{event:'*',schema:'public',table:'chat_message_reactions'},(payload)=>setRoomReactions((prev)=>payload.eventType==='DELETE'?prev.filter((r)=>r.id!==(payload.old as MessageReaction).id):mergeById(prev,[payload.new as MessageReaction]))).on('postgres_changes',{event:'*',schema:'public',table:'room_memberships',filter:`room_id=eq.${room}`},()=>{supabase.from('room_memberships').select('user_id,display_name').eq('room_id',room).then(({data})=>setRoomMembers((data||[]) as RoomMember[]))}).subscribe()
    roomChannel.current = channel
    return () => { active = false; supabase.removeChannel(channel); roomChannel.current = null }
  }, [room])

  useEffect(() => {
    if (!conversation || !supabase) return
    let active = true
    setPrivateMessages([]); setPrivateReactions([])
    supabase.from('private_messages').select('id,conversation_id,sender_id,body,created_at').eq('conversation_id', conversation.id).order('created_at').then(async ({ data }) => { if (active) {const rows=(data||[]) as PrivateMessage[];setPrivateMessages(rows);if(rows.length){const {data:reactions}=await supabase.from('private_message_reactions').select('id,message_id,user_id,emoji,conversation_id').eq('conversation_id',conversation.id);if(active)setPrivateReactions((reactions||[]) as MessageReaction[])}} })
    const channel = supabase.channel(`private:${conversation.id}`).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'private_messages', filter: `conversation_id=eq.${conversation.id}` }, (payload) => setPrivateMessages((prev) => mergeById(prev, [payload.new as PrivateMessage]))).on('postgres_changes',{event:'*',schema:'public',table:'private_message_reactions',filter:`conversation_id=eq.${conversation.id}`},(payload)=>setPrivateReactions((prev)=>payload.eventType==='DELETE'?prev.filter((r)=>r.id!==(payload.old as MessageReaction).id):mergeById(prev,[payload.new as MessageReaction]))).subscribe()
    privateChannel.current = channel
    return () => { active = false; supabase.removeChannel(channel); privateChannel.current = null }
  }, [conversation])

  const friends = useMemo(() => user ? profiles.filter((p) => friendships.some((f) => (f.user_a === user.id && f.user_b === p.id) || (f.user_b === user.id && f.user_a === p.id))) : [], [profiles, friendships, user])
  const toggleReaction = async (messageId: string, emoji: string, kind: 'room' | 'private') => {
    if(!supabase||!user||(kind==='private'&&user.is_anonymous))return
    const current=kind==='room'?roomReactions:privateReactions
    const table=kind==='room'?'chat_message_reactions':'private_message_reactions'
    const existing=current.find((r)=>r.message_id===messageId&&r.user_id===user.id&&r.emoji===emoji)
    if(existing){const {error}=await supabase.from(table).delete().eq('id',existing.id);if(error)setAuthError('Could not remove reaction. Please retry.')}
    else {const payload:Record<string,string>={message_id:messageId,user_id:user.id,emoji};if(kind==='private'&&conversation)payload.conversation_id=conversation.id;const {error}=await supabase.from(table).insert(payload);if(error)setAuthError('Could not add reaction. Please retry.')}
  }
  const appendEmoji = (kind:'room'|'private',emoji:string) => {if(kind==='room')setRoomText((v)=>v+emoji);else setPrivateText((v)=>v+emoji);setEmojiPicker(null)}
  const renderReactions = (messageId:string,kind:'room'|'private') => {
    const source=kind==='room'?roomReactions:privateReactions
    const grouped=Array.from(new Set(source.filter((r)=>r.message_id===messageId).map((r)=>r.emoji)))
    return <div className="message-reactions">{grouped.map((emoji)=>{const matches=source.filter((r)=>r.message_id===messageId&&r.emoji===emoji);return <button key={emoji} className={'reaction-chip '+(matches.some((r)=>r.user_id===user?.id)?'mine':'')} onClick={()=>toggleReaction(messageId,emoji,kind)} aria-label={`${emoji}, ${matches.length} reactions`}>{emoji}<span>{matches.length}</span></button>})}<button className="reaction-add" onClick={()=>{setReactionTarget({messageId,kind});setEmojiPicker(kind)}} aria-label="Add reaction">＋</button></div>
  }
  const renderEmojiPicker = (kind:'room'|'private') => emojiPicker===kind?<div className="emoji-picker" role="group" aria-label={reactionTarget?.kind===kind?'Choose a reaction':'Insert an emoji'}>{CHAT_EMOJIS.map((emoji)=><button type="button" key={emoji} onClick={()=>{if(reactionTarget?.kind===kind){void toggleReaction(reactionTarget.messageId,emoji,kind);setReactionTarget(null);setEmojiPicker(null)}else appendEmoji(kind,emoji)}}>{emoji}</button>)}</div>:null
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
  const sendRequest = async (target: Profile) => { if (!supabase || !user || busy) return; setBusy(target.id); setAuthError(''); const { error } = await supabase.from('friend_requests').insert({ sender_id: user.id, receiver_id: target.id, status: 'pending' }); if (error) setAuthError(error.code === '23505' ? 'A request already exists for this person.' : 'Could not send friend request. Please retry.'); await loadSocial(user); setBusy('') }
  const requestAction = async (name: 'accept_friend_request' | 'reject_friend_request' | 'cancel_friend_request', id: string) => { if (!supabase || !user) return; setBusy(id); const { error } = await supabase.rpc(name, { p_request_id: id }); if (error) setAuthError(error.message); await loadSocial(user); setBusy('') }
  const openPrivate = async (target: Profile) => { if (!supabase) return; setBusy(target.id); const { data, error } = await supabase.rpc('create_private_conversation', { p_other_user_id: target.id }); if (error) setAuthError(error.message); else { const next=data as PrivateConversation;setConversation(next);setConversations((prev)=>[next,...prev.filter((item)=>item.id!==next.id)]);setRoomOpen(false);setActiveView('chat') } setBusy('') }
  const sendPrivate = async () => {
    const body = privateText.trim()
    if (!supabase || !user || !conversation || !body || busy === 'private-send') return
    setBusy('private-send')
    setAuthError('')
    setPrivateText('')
    const { error } = await supabase.from('private_messages').insert({ conversation_id: conversation.id, sender_id: user.id, body })
    if (error) {
      setPrivateText(body)
      setAuthError(error.message || 'Could not send private message. Please retry.')
    } else {
      const { data: latestMessages, error: refreshError } = await supabase.from('private_messages').select('id,conversation_id,sender_id,body,created_at').eq('conversation_id', conversation.id).order('created_at')
      if (!refreshError && latestMessages) setPrivateMessages((prev) => mergeById(prev, latestMessages as PrivateMessage[]))
    }
    setBusy('')
  }
  const selectDecoration = async (next: string) => {
    setDecoration(next)
    localStorage.setItem('bubble_profile_decoration', next)
    if (!user || user.is_anonymous || !supabase) return
    setBusy('decoration')
    const { data, error } = await supabase.auth.updateUser({ data: { profile_decoration: next } })
    if (error) setAuthError('Decoration was selected locally but could not be synced to your account.')
    else if (data.user) setUser(data.user)
    setBusy('')
  }
  const signOut = async () => { await supabase?.auth.signOut(); setUser(null); setConversation(null); setConversations([]); setRoomOpen(false); setRoom(''); setRoomMessages([]); setPrivateMessages([]); setActiveView('servers') }
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
    <main className="discord-shell" data-device={deviceMode}>
      <aside className="server-rail" aria-label="Server navigation">
        <button className={'rail-button rail-home '+(activeView==='servers'?'is-active':'')} title="Server home" onClick={() => setActiveView('servers')}><LayoutDashboard size={21}/></button>
        <span className="rail-separator" />
        {roomOpen&&room&&<button className={'rail-button server-rail-item '+(activeView==='chat'?'is-active':'')} title={'Server '+room} onClick={() => setActiveView('chat')}><span>{room.slice(0,2)}</span></button>}
        <button className="rail-button rail-add" title="Create a server" onClick={createRoom}><Plus size={23}/></button>
        <span className="rail-separator" />
        <button className={'rail-button '+(activeView==='friends'?'is-active':'')} title="Friends" onClick={() => setActiveView('friends')}><Users size={21}/></button>
        <button className={'rail-button '+(activeView==='shop'?'is-active':'')} title="Shop" onClick={() => setActiveView('shop')}><Store size={20}/></button>
        <div className="rail-spacer"/>
        <button className={'rail-button '+(activeView==='settings'?'is-active':'')} title="Settings" onClick={() => setActiveView('settings')}><Settings size={20}/></button>
      </aside>

      <aside className="workspace-sidebar">
        <button className="workspace-switcher" onClick={() => setActiveView('servers')}><span className="workspace-glyph"><Server size={20}/></span><span><strong>Servers</strong><small>Your communities</small></span><ChevronDown size={16}/></button>
        <div className="sidebar-search"><Search size={15}/><input aria-label="Search people" placeholder="Search people" value={search} onChange={(e) => {setSearch(e.target.value);setActiveView('discover')}}/></div>
        <div className="sidebar-section">
          <p className="sidebar-heading">Explore</p>
          <button className={'sidebar-link '+(activeView==='servers'?'selected':'')} onClick={() => setActiveView('servers')}><Server size={18}/> Server home</button>
          <button className={'sidebar-link '+(activeView==='chat'?'selected':'')} onClick={() => setActiveView('chat')}><MessageCircle size={18}/> Messages</button>
          <button className={'sidebar-link '+(activeView==='friends'?'selected':'')} onClick={() => setActiveView('friends')}><Users size={18}/> Friends <span className="sidebar-count">{friends.length}</span></button>
          <button className={'sidebar-link '+(activeView==='requests'?'selected':'')} onClick={() => setActiveView('requests')}><Bell size={18}/> Requests {requests.some((r)=>r.receiver_id===user?.id)&&<span className="request-dot"/>}</button>
          <button className={'sidebar-link '+(activeView==='discover'?'selected':'')} onClick={() => setActiveView('discover')}><Compass size={18}/> Discover</button>
        </div>
        <div className="sidebar-section room-section">
          <div className="sidebar-heading-row"><p className="sidebar-heading">Server channels</p><button aria-label="Create a server" onClick={createRoom}><Plus size={16}/></button></div>
          {roomOpen&&room?<><button className={'sidebar-link '+(activeView==='servers'?'selected':'')} onClick={()=>setActiveView('servers')}><Server size={17}/> {room}</button><p className="sidebar-subheading">TEXT CHANNELS</p><button className={'sidebar-link '+(activeView==='chat'?'selected':'')} onClick={()=>{setConversation(null);setActiveView('chat')}}><Hash size={17}/> general</button></>:<p className="sidebar-empty">Create or join a server to see its channels.</p>}
          <button className="sidebar-create" onClick={createRoom}><Plus size={16}/> Create a room</button>
          <div className="sidebar-join"><input value={roomInput} onChange={(e)=>setRoomInput(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,6))} maxLength={6} placeholder="Room code" aria-label="Room code"/><button onClick={joinRoom}>Join</button></div>
          {user?.is_anonymous&&<label className="guest-name-label">Guest name<input value={guestName} maxLength={24} onChange={(e)=>{setGuestName(e.target.value.slice(0,24));localStorage.setItem('bubble_guest_display_name',e.target.value.slice(0,24))}} placeholder="Your chat name"/></label>}
          {roomError&&<p className="sidebar-error" role="alert">{roomError}</p>}
        </div>
        <div className="sidebar-section dm-section">
          <div className="sidebar-heading-row"><p className="sidebar-heading">Direct messages</p><button aria-label="Find friends" onClick={()=>setActiveView('discover')}><Plus size={16}/></button></div>
          {conversations.map((item)=>{const id=item.user_a===user?.id?item.user_b:item.user_a;const p=profiles.find((person)=>person.id===id);return <button key={item.id} className="dm-link" onClick={()=>{setConversation(item);setRoomOpen(false);setActiveView('chat')}}><span className="avatar-small">{p?.avatar_url?<img src={p.avatar_url} alt=""/>:(p?.display_name||'F').slice(0,1).toUpperCase()}</span><span className="dm-name">{p?.display_name||'Conversation'}</span></button>})}
          {conversations.length===0&&<p className="sidebar-empty">Your private conversations will appear here.</p>}
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
            {activeView==='servers'&&<><Server size={20}/><strong>Servers</strong></>}
            {activeView==='chat'&&<><Hash size={20}/><strong>{roomOpen&&room?'# general':other?.display_name||'Messages'}</strong></>}

          {activeView==='friends'&&<><Users size={20}/><strong>Friends</strong></>}
            {activeView==='requests'&&<><Bell size={20}/><strong>Friend requests</strong></>}
            {activeView==='discover'&&<><Compass size={20}/><strong>Discover people</strong></>}
            {activeView==='profile'&&<><CircleUserRound size={20}/><strong>Profile</strong></>}
            {activeView==='shop'&&<><Store size={20}/><strong>Shop</strong></>}
            {activeView==='settings'&&<><Settings size={20}/><strong>Settings</strong></>}
          </div>
          <div className="header-actions"><span className="header-hint">Bubble Chat</span><button className="header-icon" title="Friends" onClick={()=>setActiveView('friends')}><Users size={18}/></button><button className="header-icon" title="Shop" onClick={()=>setActiveView('shop')}><Store size={18}/></button><button className="header-icon" title="Settings" onClick={()=>setActiveView('settings')}><Settings size={18}/></button></div>
        </header>

        <div className="workspace-content">
          {activeView==='shop'&&<div className="page-stage shop-stage"><div className="page-intro"><div><p className="eyebrow">PROFILE CUSTOMISATION</p><h1>Make your profile yours.</h1><p>Choose a decoration to personalise your Bubble Chat profile. These preview items are free in this preview build.</p></div></div><div className="shop-feature-banner"><div><span className="eyebrow">THE BUBBLE SHOP</span><h2>Small details. Your style.</h2><p>Try a frame, glow or banner accent. Your selected decoration stays on your account.</p></div><span className="shop-banner-mark"><Sparkles size={38}/></span></div><div className="shop-section-heading"><div><h2>Profile decorations</h2><p>Choose one to apply it to your profile.</p></div><span className="shop-free-tag">PREVIEW CATALOG</span></div><div className="decoration-grid">{[{id:'none',name:'Classic',description:'The clean original look',symbol:'○'},{id:'halo',name:'Soft Halo',description:'A subtle violet glow',symbol:'✧'},{id:'orbit',name:'Orbit',description:'A layered profile ring',symbol:'◉'},{id:'spark',name:'Starlight',description:'A little sparkle around you',symbol:'✦'},{id:'wave',name:'Wave Frame',description:'A flowing double border',symbol:'◎'},{id:'crown',name:'Crown',description:'A bright profile accent',symbol:'♛'}].map((item)=><article className={'decoration-card '+(decoration===item.id?'is-selected':'')} key={item.id}><div className={'decoration-preview decoration-'+item.id}><span>{item.symbol}</span><small>{displayName||guestName||'Your profile'}</small></div><div className="decoration-card-copy"><strong>{item.name}</strong><p>{item.description}</p><button className={decoration===item.id?'discord-secondary':'discord-primary'} onClick={()=>selectDecoration(item.id)} disabled={busy==='decoration'}>{decoration===item.id?'Equipped':'Equip'}</button></div></article>)}</div></div>}
          {activeView==='servers'&&<div className="page-stage server-home-stage">
            <div className="server-home-hero"><div className="server-home-icon"><Server size={30}/></div><p className="eyebrow">YOUR COMMUNITIES</p><h1>{roomOpen&&room?'Welcome to your server':'Make a place to belong.'}</h1><p>{roomOpen&&room?'Your server is ready. Open the general channel to start talking, or invite people with your six-character code.':'Create a server for your friends or join one with an invite code. Your servers are the centre of Bubble Chat.'}</p>
              {roomOpen&&room&&<div className="server-code-pill"><span>SERVER INVITE CODE</span><strong>{room}</strong><button className="discord-secondary" onClick={()=>{navigator.clipboard.writeText(window.location.origin+'?room='+room);setCopied(true);window.setTimeout(()=>setCopied(false),1200)}}><Copy size={15}/>{copied?'Copied':'Copy invite'}</button></div>}
              <div className="server-home-actions"><button className="discord-primary" onClick={()=>roomOpen&&room?setActiveView('chat'):createRoom()} disabled={roomLoading}><Plus size={17}/>{roomOpen&&room?'Open # general':roomLoading?'Creating…':'Create a server'}</button><button className="discord-secondary" onClick={()=>{document.getElementById('server-join-code')?.focus()}}><Users size={17}/> Join a server</button></div>
            </div>
            <div className="server-feature-grid"><button className="server-feature-card" onClick={()=>roomOpen&&room?setActiveView('chat'):createRoom()}><span className="server-feature-icon"><Hash size={20}/></span><strong>{roomOpen&&room?'# general':'Text channels'}</strong><p>{roomOpen&&room?'Open your server’s general conversation.':'A shared place for messages, ideas and updates.'}</p><ChevronRight size={18}/></button><button className="server-feature-card" onClick={()=>setActiveView('friends')}><span className="server-feature-icon"><Users size={20}/></span><strong>Invite your people</strong><p>Find friends, send requests and start private conversations.</p><ChevronRight size={18}/></button><button className="server-feature-card" onClick={()=>setActiveView('shop')}><span className="server-feature-icon"><Palette size={20}/></span><strong>Make it yours</strong><p>Browse profile frames and decorations in the Shop.</p><ChevronRight size={18}/></button></div>
            {!roomOpen&&<div className="server-join-panel"><div><strong>Already have a server code?</strong><p>Enter the six-character invite code to join.</p></div><div className="server-join-controls"><input id="server-join-code" value={roomInput} onChange={(e)=>setRoomInput(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,6))} maxLength={6} placeholder="ABC123" aria-label="Server invite code"/><button className="discord-primary" onClick={joinRoom} disabled={roomLoading}>Join server</button></div></div>}
            {roomError&&<p className="inline-error" role="alert">{roomError}</p>}
          </div>}
          {activeView==='chat'&&(
            <div className="chat-stage">
              {roomOpen&&room?<>
                <div className="conversation-banner"><div><p className="eyebrow">ROOM CHANNEL</p><h1><Hash size={24}/> {room}</h1><p>Share the six-character code to invite someone into this room.</p></div><button className="discord-secondary" onClick={()=>{navigator.clipboard.writeText(window.location.origin+'?room='+room);setCopied(true);window.setTimeout(()=>setCopied(false),1200)}}><Copy size={16}/>{copied?'Copied':'Copy invite link'}</button></div>
                <div className="message-feed" aria-live="polite">
                  {roomLoading&&<p className="feed-empty">Loading messages…</p>}
                  {!roomLoading&&roomMessages.length===0&&<div className="feed-empty"><span className="empty-icon"><Hash size={28}/></span><h2>This is the beginning of the room.</h2><p>Send the first message to get the conversation started.</p></div>}
                  {roomMessages.map((m)=><article key={m.id} className="message-row"><div className="message-avatar">{m.sender_name.slice(0,1).toUpperCase()}</div><div className="message-body"><div className="message-meta"><strong>{m.sender_name}</strong><time>{new Date(m.created_at).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</time></div><p>{m.body}</p>{renderReactions(m.id,'room')}</div></article>)}
                </div>
                <form className="message-composer" onSubmit={async(e)=>{e.preventDefault();const body=roomText.trim();if(supabase&&user&&body&&room){setRoomText('');const {error}=await supabase.from('chat_messages').insert({room_id:room,body});if(error){setRoomText(body);setRoomError('Message was not sent. Check room membership and try again.')}}}}><button type="button" className="composer-emoji" aria-label="Insert emoji" onClick={()=>{setReactionTarget(null);setEmojiPicker(emojiPicker==='room'?null:'room')}}>😊</button><input value={roomText} onChange={(e)=>setRoomText(e.target.value)} placeholder={'Message #'+room} aria-label="Room message"/><button disabled={!roomText.trim()} aria-label="Send room message"><Send size={18}/></button>{renderEmojiPicker('room')}</form>
              </>:conversation?<>
                <div className="conversation-banner compact"><div className="profile-heading"><span className="avatar-large">{other?.avatar_url?<img src={other.avatar_url} alt=""/>:(other?.display_name||'?').slice(0,1).toUpperCase()}</span><div><h1>{other?.display_name||'Private conversation'}</h1><p>@{other?.username||'member'} · Private messages</p></div></div><button className="discord-secondary" onClick={()=>setActiveView('friends')}><Users size={16}/> Friends</button></div>
                <div className="message-feed" aria-live="polite">
                  {privateMessages.length===0&&<div className="feed-empty"><span className="empty-icon"><MessageCircle size={28}/></span><h2>This is the beginning of your conversation.</h2><p>Messages are visible to the two conversation members.</p></div>}
                  {privateMessages.map((m)=><article key={m.id} className="message-row"><div className="message-avatar">{m.sender_id===user?.id?(displayName||'Y').slice(0,1).toUpperCase():(other?.display_name||'F').slice(0,1).toUpperCase()}</div><div className="message-body"><div className="message-meta"><strong>{m.sender_id===user?.id?'You':other?.display_name||'Friend'}</strong><time>{new Date(m.created_at).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</time></div><p>{m.body}</p>{renderReactions(m.id,'private')}</div></article>)}
                </div>
                <form className="message-composer" onSubmit={(e)=>{e.preventDefault();sendPrivate()}}><button type="button" className="composer-emoji" aria-label="Insert emoji" onClick={()=>{setReactionTarget(null);setEmojiPicker(emojiPicker==='private'?null:'private')}}>😊</button><input value={privateText} onChange={(e)=>setPrivateText(e.target.value)} placeholder={'Message @'+(other?.username||'friend')} aria-label="Private message"/><button disabled={!privateText.trim()||busy==='private-send'} aria-label="Send private message"><Send size={18}/></button>{renderEmojiPicker('private')}</form>
              </>:<div className="welcome-stage"><div className="welcome-mark"><MessageCircle size={32}/></div><p className="eyebrow">YOUR CHAT WORKSPACE</p><h1>Good conversations start here.</h1><p className="welcome-copy">Open a room with a code or choose a friend from your direct messages. Your conversations stay in reach.</p><div className="welcome-actions"><button className="discord-primary" onClick={createRoom} disabled={roomLoading}><Plus size={17}/>{roomLoading?'Creating…':'Create a room'}</button><button className="discord-secondary" onClick={()=>setActiveView('discover')}><UserPlus size={17}/> Find people</button></div><div className="welcome-code"><input value={roomInput} onChange={(e)=>setRoomInput(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,6))} maxLength={6} placeholder="Enter a room code" aria-label="Enter a room code"/><button onClick={joinRoom}>Join room</button></div>{user?.is_anonymous&&<p className="welcome-note">Guest mode is active. Your chosen display name appears in room messages.</p>}</div>}
            </div>
          )}

          {activeView==='friends'&&<div className="page-stage"><div className="page-intro"><div><p className="eyebrow">YOUR PEOPLE</p><h1>Friends</h1><p>Start a private conversation with someone you have accepted.</p></div><button className="discord-primary" onClick={()=>setActiveView('discover')}><UserPlus size={17}/> Add a friend</button></div>
            {user?.is_anonymous?<div className="notice-panel">Friend features require a registered account. Create an account to use friends and private messages.</div>:<><div className="list-heading">All friends <span>{friends.length}</span></div>{friends.length===0&&<div className="empty-panel"><Users size={30}/><h2>No friends yet</h2><p>Find people by username or display name to send a friend request.</p></div>}<div className="people-list">{friends.map((p)=><div className="person-row" key={p.id}><span className="avatar-large">{p.avatar_url?<img src={p.avatar_url} alt=""/>:p.display_name.slice(0,1).toUpperCase()}</span><div className="person-copy"><strong>{p.display_name}</strong><small>@{p.username}</small></div><button className="discord-secondary" onClick={()=>openPrivate(p)}><MessageCircle size={16}/> Message</button></div>)}</div></>}
          </div>}

          {activeView==='requests'&&<div className="page-stage"><div className="page-intro"><div><p className="eyebrow">SOCIAL</p><h1>Friend requests</h1><p>Accept or decline incoming requests. Cancel requests you sent.</p></div></div>
            {user?.is_anonymous?<div className="notice-panel">Sign in with a registered account to manage friend requests.</div>:<><div className="list-heading">Incoming <span>{requests.filter((r)=>r.receiver_id===user?.id).length}</span></div><div className="people-list">{requests.filter((r)=>r.receiver_id===user?.id).map((r)=>{const p=profiles.find((x)=>x.id===r.sender_id);return <div className="person-row" key={r.id}><span className="avatar-large">{(p?.display_name||'F').slice(0,1).toUpperCase()}</span><div className="person-copy"><strong>{p?.display_name||'Friend request'}</strong><small>@{p?.username||'member'}</small></div><button className="discord-primary" onClick={()=>requestAction('accept_friend_request',r.id)}>Accept</button><button className="discord-danger" onClick={()=>requestAction('reject_friend_request',r.id)}>Decline</button></div>})}</div><div className="list-heading outgoing-heading">Sent <span>{requests.filter((r)=>r.sender_id===user?.id).length}</span></div><div className="people-list">{requests.filter((r)=>r.sender_id===user?.id).map((r)=>{const p=profiles.find((x)=>x.id===r.receiver_id);return <div className="person-row" key={r.id}><span className="avatar-large">{(p?.display_name||'F').slice(0,1).toUpperCase()}</span><div className="person-copy"><strong>{p?.display_name||'Pending request'}</strong><small>@{p?.username||'member'} · Pending</small></div><button className="discord-danger" onClick={()=>requestAction('cancel_friend_request',r.id)}>Cancel</button></div>})}</div>{requests.length===0&&<div className="empty-panel"><Bell size={28}/><h2>No pending requests</h2><p>When someone sends you a request, it will appear here.</p></div>}</>}
          </div>}

          {activeView==='discover'&&<div className="page-stage"><div className="page-intro"><div><p className="eyebrow">FIND YOUR PEOPLE</p><h1>Discover</h1><p>Search public profiles by username or display name.</p></div></div>{user?.is_anonymous?<div className="notice-panel">Sign in with a registered account to send friend requests.</div>:<><div className="discover-search"><Search size={18}/><input value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="Search usernames or display names"/></div>{results.length===0?<div className="empty-panel"><Compass size={30}/><h2>Search for someone</h2><p>Type a name or username to find people and send a request.</p></div>:<div className="people-list">{results.map((p)=><div className="person-row" key={p.id}><span className="avatar-large">{p.avatar_url?<img src={p.avatar_url} alt=""/>:p.display_name.slice(0,1).toUpperCase()}</span><div className="person-copy"><strong>{p.display_name}</strong><small>@{p.username}</small></div><button className="discord-secondary" onClick={()=>sendRequest(p)} disabled={!!busy||friendships.some((f)=>(f.user_a===user?.id&&f.user_b===p.id)||(f.user_b===user?.id&&f.user_a===p.id))||requests.some((r)=>(r.sender_id===user?.id&&r.receiver_id===p.id)||(r.receiver_id===user?.id&&r.sender_id===p.id))}><UserPlus size={16}/>{friends.some((friend)=>friend.id===p.id)?'Friends':requests.some((r)=>(r.sender_id===user?.id&&r.receiver_id===p.id)||(r.receiver_id===user?.id&&r.sender_id===p.id))?'Request pending':'Add friend'}</button></div>)}</div>}</>}</div>}

          {activeView==='profile'&&<div className="page-stage"><div className="page-intro"><div><p className="eyebrow">ACCOUNT</p><h1>Profile and settings</h1><p>Update how people see you across Bubble Chat.</p></div></div>{user?.is_anonymous?<div className="notice-panel">Guest profiles are temporary. Create an account to save a profile photo, username and bio.</div>:<div className="profile-editor"><div className="profile-cover"><Sparkles size={22}/><span>YOUR BUBBLE PROFILE</span></div><div className="profile-edit-body"><div className={'profile-edit-avatar decoration-'+decoration}>{avatarUrl?<img src={avatarUrl} alt="Profile avatar"/>:(displayName||username||'B').slice(0,1).toUpperCase()}</div><label className="discord-secondary upload-control"><ImagePlus size={16}/> Change avatar<input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e)=>uploadAvatar(e.target.files?.[0])}/></label><div className="profile-fields"><label>Display name<input value={displayName} onChange={(e)=>setDisplayName(e.target.value)} maxLength={80}/></label><label>Username<input value={username} onChange={(e)=>setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g,'').slice(0,32))} maxLength={32}/></label><label>About me<textarea value={bio} onChange={(e)=>setBio(e.target.value)} maxLength={240} rows={4}/></label></div><div className="profile-actions"><button className="discord-danger" onClick={signOut}>Sign out</button><button className="discord-primary" onClick={saveProfile} disabled={!!busy}>{busy==='profile'?'Saving…':'Save changes'}</button></div></div></div>}</div>}
          {activeView==='settings'&&<div className="page-stage settings-stage"><div className="page-intro"><div><p className="eyebrow">PREFERENCES</p><h1>Settings</h1><p>Manage your account and Bubble Chat workspace.</p></div></div><div className="settings-group"><p className="settings-group-label">ACCOUNT</p><button className="settings-row" onClick={()=>setActiveView('profile')}><span className="settings-row-icon"><CircleUserRound size={19}/></span><span><strong>Profile customisation</strong><small>Avatar, display name, bio and decoration</small></span><ChevronRight size={18}/></button><button className="settings-row" onClick={()=>setActiveView('friends')}><span className="settings-row-icon"><Users size={19}/></span><span><strong>Friends and requests</strong><small>Manage your connections</small></span><ChevronRight size={18}/></button></div><div className="settings-group"><p className="settings-group-label">PERSONALISATION</p><button className="settings-row" onClick={()=>setActiveView('shop')}><span className="settings-row-icon"><Store size={19}/></span><span><strong>Shop and decorations</strong><small>Browse profile cosmetics</small></span><ChevronRight size={18}/></button><div className="settings-row settings-static"><span className="settings-row-icon"><Palette size={19}/></span><span><strong>Theme</strong><small>Discord-inspired dark palette</small></span><span className="settings-value">Current</span></div></div><div className="settings-group"><p className="settings-group-label">SESSION</p><div className="settings-row settings-static"><span className="settings-row-icon"><ShieldCheck size={19}/></span><span><strong>{user?.is_anonymous?'Guest session':'Signed-in session'}</strong><small>{user?.email||'Your session is stored by Supabase Auth'}</small></span></div><button className="settings-row settings-logout" onClick={signOut}><span className="settings-row-icon"><Settings size={19}/></span><span><strong>Log out</strong><small>Sign out of this device</small></span><ChevronRight size={18}/></button></div></div>}
          {authError&&user&&<p className="inline-error" role="alert">{authError}</p>}
          {socialError&&<p className="inline-error" role="alert">{socialError}</p>}
        </div>
      </section>

      <aside className="details-sidebar">
        {activeView==='chat'&&roomOpen&&room?<><div className="details-heading">Room details</div><div className="room-detail-card"><span className="room-detail-icon"><Hash size={21}/></span><strong>Room {room}</strong><p>Anyone with the code can request to join.</p><button className="discord-secondary" onClick={()=>{navigator.clipboard.writeText(window.location.origin+'?room='+room);setCopied(true);window.setTimeout(()=>setCopied(false),1200)}}><Copy size={15}/>{copied?'Copied':'Copy invite'}</button></div><div className="details-heading">Members <span>{roomMembers.length}</span></div>{roomMembers.map((m)=><div className="member-row" key={m.user_id}><span className="avatar-small">{m.display_name.slice(0,1).toUpperCase()}</span><span>{m.display_name}{m.user_id===user?.id?' (you)':''}</span></div>)}</>:
        activeView==='chat'&&other?<><div className="details-heading">Profile</div><div className="profile-mini"><span className="avatar-profile">{other.avatar_url?<img src={other.avatar_url} alt=""/>:other.display_name.slice(0,1).toUpperCase()}</span><strong>{other.display_name}</strong><small>@{other.username}</small><p>{other.bio||'No bio added yet.'}</p></div></>:
        <><div className="details-heading">Your friends</div>{friends.slice(0,8).map((p)=><button className="member-row member-button" key={p.id} onClick={()=>openPrivate(p)}><span className="avatar-small">{p.display_name.slice(0,1).toUpperCase()}</span><span>{p.display_name}</span></button>)}{friends.length===0&&<p className="details-empty">Friends you accept will appear here.</p>}<div className="details-tip"><ShieldCheck size={18}/><p>Private conversations remain available to their original members after unfriending, unless blocked.</p></div></>}
      </aside>

      <nav className="mobile-nav" aria-label="Main navigation">
        <button className={activeView==='servers'?'active':''} onClick={()=>setActiveView('servers')}><Server size={20}/><span>Servers</span></button>
        <button className={activeView==='chat'?'active':''} onClick={()=>setActiveView('chat')}><MessageCircle size={20}/><span>Messages</span></button>
        <button className={activeView==='friends'||activeView==='requests'?'active':''} onClick={()=>setActiveView('friends')}><Users size={20}/><span>Friends</span></button>
        <button className={activeView==='shop'?'active':''} onClick={()=>setActiveView('shop')}><Store size={20}/><span>Shop</span></button>
        <button className={activeView==='settings'||activeView==='profile'?'active':''} onClick={()=>setActiveView('settings')}><Settings size={20}/><span>Settings</span></button>
      </nav>

      {authReady&&!user&&supabase&&<div className="auth-overlay"><form onSubmit={(e)=>{e.preventDefault();authenticate()}} className="auth-card">
        <div className="auth-brand"><span className="rail-logo">b.</span><div><strong>Bubble Chat</strong><small>Your conversations, connected.</small></div></div>
        {guestMode ? <>
          <div className="auth-heading"><p className="eyebrow">GUEST ACCESS</p><h2>Continue as a guest.</h2><p>Choose a temporary name to enter a room. No account or email is required.</p></div>
          <label className="form-label">Guest display name<input required maxLength={24} value={guestName} onChange={(e)=>setGuestName(e.target.value.slice(0,24))} placeholder="Name shown in rooms" className="form-input"/></label>
          {authError&&<p className="auth-error" role="alert">{authError}</p>}
          <button type="button" disabled={busy==='guest'||busy==='auth'} onClick={async()=>{const name=guestName.trim();if(!name){setAuthError('Choose a guest display name first.');return}setBusy('guest');localStorage.setItem('bubble_guest_display_name',name);const {data,error}=await supabase.auth.signInAnonymously();if(error)setAuthError('Guest access is disabled in Supabase. Enable Authentication → Providers → Anonymous Sign-Ins, then retry.');else{setUser(data.user);const requestedRoom=(new URLSearchParams(window.location.search).get('room')||'').toUpperCase();if(requestedRoom){const {error:joinError}=await supabase.rpc('join_chat_room',{p_room_id:requestedRoom,p_display_name:name});if(joinError)setRoomError('Could not join this room. Check the code and try again.');else{setRoom(requestedRoom);setRoomOpen(true)}}}setBusy('')}} className="discord-primary full-width">{busy==='guest'?'Connecting…':'Start guest session'}</button>
          <button type="button" onClick={()=>{setGuestMode(false);setAuthError('')}} className="auth-switch">Back to account sign up</button>
        </> : <>
          <div className="auth-heading"><p className="eyebrow">{authMode==='sign-up'?'CREATE AN ACCOUNT':'WELCOME BACK'}</p><h2>{authMode==='sign-up'?'Make your space.':'Sign in to Bubble Chat'}</h2><p>Use your email to continue.</p></div>
          {authMode==='sign-up'&&<><label className="form-label">Display name<input required value={displayName} onChange={(e)=>setDisplayName(e.target.value)} placeholder="Your name" className="form-input"/></label><label className="form-label">Username<input required value={username} onChange={(e)=>setUsername(e.target.value)} placeholder="Choose a username" className="form-input"/></label></>}
          <label className="form-label">Email<input required type="email" value={email} onChange={(e)=>setEmail(e.target.value)} placeholder="you@example.com" className="form-input"/></label>
          <label className="form-label">Password<input required minLength={8} type="password" value={password} onChange={(e)=>setPassword(e.target.value)} placeholder="At least 8 characters" className="form-input"/></label>
          {authMode==='sign-in'&&<button type="button" disabled={!!busy} onClick={sendPasswordReset} className="text-button">{busy==='reset'?'Sending reset link…':'Forgot password?'}</button>}
          {authError&&<p className="auth-error" role="alert">{authError}</p>}
          <button disabled={busy==='auth'} className="discord-primary full-width">{busy==='auth'?'Please wait…':authMode==='sign-up'?'Create account':'Sign in'}</button>
          <button type="button" onClick={()=>{setAuthError('');setAuthMode(authMode==='sign-up'?'sign-in':'sign-up')}} className="auth-switch">{authMode==='sign-up'?'Already have an account? Sign in':'New to Bubble Chat? Create an account'}</button>
          <button type="button" disabled={busy==='auth'} onClick={()=>{setGuestMode(true);setAuthError('')}} className="discord-secondary full-width">Continue as guest</button>
        </>}
      </form></div>}
    </main>
  )

}