-- Bubble Chat pre-launch security remediation (test project first)
-- Safe to re-run; preserves existing room, message, friendship and conversation rows.

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

-- Guest names belong to room membership, not profiles.
alter table public.room_memberships add column if not exists display_name text;
update public.room_memberships rm
set display_name = coalesce(
  (select nullif(btrim(p.display_name), '') from public.profiles p where p.id = rm.user_id),
  (select nullif(btrim(cm.sender_name), '') from public.chat_messages cm
   where cm.room_id = rm.room_id and cm.sender_id = rm.user_id
   order by cm.created_at desc limit 1),
  'Guest'
)
where rm.display_name is null or btrim(rm.display_name) = '';
alter table public.room_memberships alter column display_name set not null;
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'room_memberships_display_name_length'
      and conrelid = 'public.room_memberships'::regclass
  ) then
    alter table public.room_memberships
      add constraint room_memberships_display_name_length
      check (char_length(btrim(display_name)) between 1 and 24);
  end if;
end $$;

-- Profile rows are created for registered accounts; anonymous room guests do not get profiles.
create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_username text;
  v_display_name text;
begin
  if coalesce(new.is_anonymous, false) then
    return new;
  end if;

  v_username := lower(regexp_replace(
    coalesce(new.raw_user_meta_data ->> 'username', ''),
    '[^a-zA-Z0-9_]', '', 'g'
  ));
  if char_length(v_username) < 3 or char_length(v_username) > 32 then
    v_username := 'member_' || substr(replace(new.id::text, '-', ''), 1, 8);
  end if;

  v_display_name := left(btrim(coalesce(
    new.raw_user_meta_data ->> 'display_name',
    nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
    'Member'
  )), 80);
  if char_length(v_display_name) < 1 then
    v_display_name := 'Member';
  end if;

  begin
    insert into public.profiles (id, username, display_name, bio)
    values (new.id, v_username, v_display_name, '')
    on conflict (id) do nothing;
  exception when unique_violation then
    insert into public.profiles (id, username, display_name, bio)
    values (
      new.id,
      'member_' || substr(replace(new.id::text, '-', ''), 1, 8),
      v_display_name,
      ''
    )
    on conflict (id) do nothing;
  end;
  return new;
end;
$$;

revoke all on function public.handle_new_user_profile() from public, anon, authenticated;
drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
after insert on auth.users
for each row execute function public.handle_new_user_profile();

-- Existing registered accounts receive a collision-resistant default profile if missing.
insert into public.profiles (id, username, display_name, bio)
select
  u.id,
  'member_' || substr(replace(u.id::text, '-', ''), 1, 8),
  left(btrim(coalesce(
    u.raw_user_meta_data ->> 'display_name',
    nullif(split_part(coalesce(u.email, ''), '@', 1), ''),
    'Member'
  )), 80),
  ''
from auth.users u
where not coalesce(u.is_anonymous, false)
on conflict (id) do nothing;

-- A narrow directory view exposes only fields intended for friend discovery.
drop view if exists public.public_profiles;
create view public.public_profiles
with (security_barrier = true)
as
select p.id, p.username, p.display_name, p.bio, p.avatar_url
from public.profiles p
where coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) = false;

revoke all on public.public_profiles from public, anon;
grant select on public.public_profiles to authenticated;

-- Direct profile-table access is limited to the signed-in user's own profile.
drop policy if exists profiles_select_auth on public.profiles;
drop policy if exists profiles_select_authenticated on public.profiles;
drop policy if exists profiles_select_self on public.profiles;
create policy profiles_select_self
on public.profiles for select to authenticated
using (
  id = (select auth.uid())
  and coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) = false
);

drop policy if exists profiles_insert_self on public.profiles;
create policy profiles_insert_self
on public.profiles for insert to authenticated
with check (
  id = (select auth.uid())
  and coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) = false
);

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self
on public.profiles for update to authenticated
using (
  id = (select auth.uid())
  and coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) = false
)
with check (
  id = (select auth.uid())
  and coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) = false
);

revoke select on table public.profiles from anon, authenticated;
grant select (id, username, display_name, bio, avatar_url) on table public.profiles to authenticated;
grant insert (id, username, display_name, bio, avatar_url) on table public.profiles to authenticated;
grant update (username, display_name, bio, avatar_url) on table public.profiles to authenticated;

-- Private membership helper is kept outside the exposed public API schema.
drop policy if exists private_members_select_member on public.private_conversation_members;
drop policy if exists private_conversations_select_member on public.private_conversations;
drop policy if exists private_messages_insert_member on public.private_messages;
drop policy if exists private_messages_select_member on public.private_messages;

drop function if exists public.private_member(uuid);

create or replace function private.is_conversation_member(p_conversation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select auth.uid()) is not null
    and coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) = false
    and exists (
      select 1
      from public.private_conversation_members m
      where m.conversation_id = p_conversation_id
        and m.user_id = (select auth.uid())
    );
$$;
revoke all on function private.is_conversation_member(uuid) from public, anon;
grant execute on function private.is_conversation_member(uuid) to authenticated;

create policy private_members_select_member
on public.private_conversation_members for select to authenticated
using (private.is_conversation_member(conversation_id));

create policy private_conversations_select_member
on public.private_conversations for select to authenticated
using (private.is_conversation_member(id));

create policy private_messages_select_member
on public.private_messages for select to authenticated
using (private.is_conversation_member(conversation_id));

create policy private_messages_insert_member
on public.private_messages for insert to authenticated
with check (
  sender_id = (select auth.uid())
  and private.is_conversation_member(conversation_id)
);

-- Remove anonymous access from social tables.
drop policy if exists friend_requests_select_participant on public.friend_requests;
create policy friend_requests_select_participant
on public.friend_requests for select to authenticated
using (
  coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) = false
  and ((select auth.uid()) = sender_id or (select auth.uid()) = receiver_id)
);

drop policy if exists friend_requests_insert_sender on public.friend_requests;
create policy friend_requests_insert_sender
on public.friend_requests for insert to authenticated
with check (
  sender_id = (select auth.uid())
  and status = 'pending'
  and coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) = false
  and not exists (
    select 1 from public.friendships f
    where f.user_a = least(friend_requests.sender_id, friend_requests.receiver_id)
      and f.user_b = greatest(friend_requests.sender_id, friend_requests.receiver_id)
  )
);

drop policy if exists friendships_select_member on public.friendships;
create policy friendships_select_member
on public.friendships for select to authenticated
using (
  coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) = false
  and ((select auth.uid()) = user_a or (select auth.uid()) = user_b)
);

drop policy if exists friendships_delete_member on public.friendships;
create policy friendships_delete_member
on public.friendships for delete to authenticated
using (
  coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) = false
  and ((select auth.uid()) = user_a or (select auth.uid()) = user_b)
);

-- Room RPCs accept a display name only for anonymous room guests.
drop function if exists public.create_chat_room(text);
drop function if exists public.join_chat_room(text);

create function public.create_chat_room(p_room_id text, p_display_name text default null)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_code text := upper(p_room_id);
  v_name text;
  v_is_anonymous boolean := coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false);
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if v_code !~ '^[A-Z0-9]{6}$' then raise exception 'Room code must be six characters'; end if;

  if v_is_anonymous then
    v_name := left(btrim(coalesce(p_display_name, '')), 24);
  else
    select left(btrim(coalesce(p.display_name, 'Member')), 24)
      into v_name from public.profiles p where p.id = v_user;
    v_name := coalesce(v_name, 'Member');
  end if;
  if char_length(v_name) < 1 then raise exception 'Enter a guest display name'; end if;

  insert into public.chat_rooms (room_id, created_by) values (v_code, v_user);
  insert into public.room_memberships (room_id, user_id, display_name)
  values (v_code, v_user, v_name);
  return v_code;
end;
$$;

create function public.join_chat_room(p_room_id text, p_display_name text default null)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_code text := upper(p_room_id);
  v_name text;
  v_is_anonymous boolean := coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false);
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if v_code !~ '^[A-Z0-9]{6}$' then raise exception 'Room code must be six characters'; end if;
  if not exists (select 1 from public.chat_rooms r where r.room_id = v_code) then
    raise exception 'Room not found';
  end if;

  if v_is_anonymous then
    v_name := left(btrim(coalesce(p_display_name, '')), 24);
  else
    select left(btrim(coalesce(p.display_name, 'Member')), 24)
      into v_name from public.profiles p where p.id = v_user;
    v_name := coalesce(v_name, 'Member');
  end if;
  if char_length(v_name) < 1 then raise exception 'Enter a guest display name'; end if;

  insert into public.room_memberships (room_id, user_id, display_name)
  values (v_code, v_user, v_name)
  on conflict (room_id, user_id) do update set display_name = excluded.display_name;
  return v_code;
end;
$$;

-- Message identity is derived from the authenticated room membership, never the client payload.
create or replace function public.set_chat_message_sender()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_name text;
begin
  if v_user is null then raise exception 'Authentication required'; end if;

  select m.display_name into v_name
  from public.room_memberships m
  where m.room_id = new.room_id and m.user_id = v_user;

  if v_name is null then
    raise exception 'Join this room before sending messages';
  end if;

  new.sender_id := v_user;
  new.sender_name := v_name;
  return new;
end;
$$;

-- Existing conversations remain accessible to their original participants after unfriending.
create or replace function public.create_private_conversation(p_other_user_id uuid)
returns public.private_conversations
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_a uuid;
  v_b uuid;
  v_conversation public.private_conversations;
begin
  if v_user is null
     or coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false)
     or p_other_user_id is null
     or p_other_user_id = v_user then
    raise exception 'Invalid participant';
  end if;

  v_a := least(v_user, p_other_user_id);
  v_b := greatest(v_user, p_other_user_id);

  select * into v_conversation
  from public.private_conversations
  where user_a = v_a and user_b = v_b;

  if found then
    if not private.is_conversation_member(v_conversation.id) then
      raise exception 'Conversation membership is unavailable';
    end if;
    return v_conversation;
  end if;

  if not exists (
    select 1 from public.friendships f
    where f.user_a = v_a and f.user_b = v_b
  ) then
    raise exception 'Users must be accepted friends to start a new conversation';
  end if;

  insert into public.private_conversations (user_a, user_b)
  values (v_a, v_b)
  on conflict (user_a, user_b) do nothing;

  select * into v_conversation
  from public.private_conversations
  where user_a = v_a and user_b = v_b;

  insert into public.private_conversation_members (conversation_id, user_id)
  values (v_conversation.id, v_a), (v_conversation.id, v_b)
  on conflict do nothing;

  return v_conversation;
end;
$$;

-- Friend-request RPCs are intentionally SECURITY DEFINER, but reject anonymous sessions
-- and authorize the exact sender/recipient before changing a row.
create or replace function public.accept_friend_request(p_request_id uuid)
returns public.friendships
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.friend_requests;
  f public.friendships;
  a uuid;
  b uuid;
begin
  if (select auth.uid()) is null
     or coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) then
    raise exception 'Sign in with an account to accept requests';
  end if;

  select * into r
  from public.friend_requests
  where id = p_request_id
    and receiver_id = (select auth.uid())
    and status = 'pending'
  for update;
  if not found then raise exception 'Friend request is unavailable'; end if;

  a := least(r.sender_id, r.receiver_id);
  b := greatest(r.sender_id, r.receiver_id);
  update public.friend_requests set status = 'accepted', updated_at = now() where id = r.id;
  insert into public.friendships (user_a, user_b) values (a, b)
  on conflict (user_a, user_b) do nothing;
  select * into f from public.friendships where user_a = a and user_b = b;
  return f;
end;
$$;

create or replace function public.cancel_friend_request(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null
     or coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) then
    raise exception 'Sign in with an account to cancel requests';
  end if;

  update public.friend_requests
  set status = 'cancelled', updated_at = now()
  where id = p_request_id
    and sender_id = (select auth.uid())
    and status = 'pending';
  if not found then raise exception 'Friend request is unavailable'; end if;
end;
$$;

create or replace function public.reject_friend_request(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null
     or coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) then
    raise exception 'Sign in with an account to reject requests';
  end if;

  update public.friend_requests
  set status = 'rejected', updated_at = now()
  where id = p_request_id
    and receiver_id = (select auth.uid())
    and status = 'pending';
  if not found then raise exception 'Friend request is unavailable'; end if;
end;
$$;

-- Restrict direct execution of privileged RPCs to authenticated sessions.
revoke all on function public.create_chat_room(text, text) from public, anon;
revoke all on function public.join_chat_room(text, text) from public, anon;
revoke all on function public.create_private_conversation(uuid) from public, anon;
revoke all on function public.accept_friend_request(uuid) from public, anon;
revoke all on function public.cancel_friend_request(uuid) from public, anon;
revoke all on function public.reject_friend_request(uuid) from public, anon;
grant execute on function public.create_chat_room(text, text) to authenticated;
grant execute on function public.join_chat_room(text, text) to authenticated;
grant execute on function public.create_private_conversation(uuid) to authenticated;
grant execute on function public.accept_friend_request(uuid) to authenticated;
grant execute on function public.cancel_friend_request(uuid) to authenticated;
grant execute on function public.reject_friend_request(uuid) to authenticated;

revoke all on function public.set_chat_message_sender() from public, anon, authenticated;
revoke all on function public.normalize_profile_fields() from public, anon, authenticated;

-- Public profile images; writes are restricted to the owner's UUID folder.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists avatars_insert_own on storage.objects;
create policy avatars_insert_own
on storage.objects for insert to authenticated
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) = false
);

drop policy if exists avatars_update_own on storage.objects;
create policy avatars_update_own
on storage.objects for update to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) = false
)
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) = false
);

drop policy if exists avatars_delete_own on storage.objects;
create policy avatars_delete_own
on storage.objects for delete to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) = false
);
