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
}