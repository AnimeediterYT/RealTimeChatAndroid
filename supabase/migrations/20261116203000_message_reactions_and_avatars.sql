create table if not exists public.chat_message_reactions (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.chat_messages(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  emoji text not null check (emoji in ('👍','❤️','😂','😮','😢','🎉','🔥','💜','👏','✨')),
  created_at timestamptz not null default now(),
  unique (message_id, user_id, emoji)
);
create index if not exists chat_message_reactions_message_idx on public.chat_message_reactions(message_id);
alter table public.chat_message_reactions enable row level security;
drop policy if exists chat_reactions_select_room_members on public.chat_message_reactions;
create policy chat_reactions_select_room_members on public.chat_message_reactions
for select to authenticated using (
  exists (select 1 from public.chat_messages m join public.room_memberships rm on rm.room_id=m.room_id
    where m.id=chat_message_reactions.message_id and rm.user_id=(select auth.uid()))
);
drop policy if exists chat_reactions_insert_self on public.chat_message_reactions;
create policy chat_reactions_insert_self on public.chat_message_reactions
for insert to authenticated with check (
  user_id=(select auth.uid()) and exists (
    select 1 from public.chat_messages m join public.room_memberships rm on rm.room_id=m.room_id
    where m.id=chat_message_reactions.message_id and rm.user_id=(select auth.uid()))
);
drop policy if exists chat_reactions_delete_self on public.chat_message_reactions;
create policy chat_reactions_delete_self on public.chat_message_reactions
for delete to authenticated using (user_id=(select auth.uid()));
grant select,insert,delete on public.chat_message_reactions to authenticated;

create table if not exists public.private_message_reactions (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.private_messages(id) on delete cascade,
  conversation_id uuid not null references public.private_conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  emoji text not null check (emoji in ('👍','❤️','😂','😮','😢','🎉','🔥','💜','👏','✨')),
  created_at timestamptz not null default now(),
  unique (message_id,user_id,emoji)
);
create index if not exists private_message_reactions_conversation_idx on public.private_message_reactions(conversation_id);
alter table public.private_message_reactions enable row level security;
drop policy if exists private_reactions_select_member on public.private_message_reactions;
create policy private_reactions_select_member on public.private_message_reactions
for select to authenticated using (private.is_conversation_member(conversation_id));
drop policy if exists private_reactions_insert_self on public.private_message_reactions;
create policy private_reactions_insert_self on public.private_message_reactions
for insert to authenticated with check (
  user_id=(select auth.uid()) and private.is_conversation_member(conversation_id)
  and exists (select 1 from public.private_messages m where m.id=private_message_reactions.message_id and m.conversation_id=private_message_reactions.conversation_id)
);
drop policy if exists private_reactions_delete_self on public.private_message_reactions;
create policy private_reactions_delete_self on public.private_message_reactions
for delete to authenticated using (user_id=(select auth.uid()) and private.is_conversation_member(conversation_id));
grant select,insert,delete on public.private_message_reactions to authenticated;

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='chat_message_reactions') then
    alter publication supabase_realtime add table public.chat_message_reactions;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='private_message_reactions') then
    alter publication supabase_realtime add table public.private_message_reactions;
  end if;
end $$;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('avatars','avatars',true,2097152,array['image/png','image/jpeg','image/webp'])
on conflict (id) do update set public=true,file_size_limit=2097152,allowed_mime_types=array['image/png','image/jpeg','image/webp'];
drop policy if exists avatar_public_read on storage.objects;
create policy avatar_public_read on storage.objects for select to public using (bucket_id='avatars');
drop policy if exists avatar_insert_own_folder on storage.objects;
create policy avatar_insert_own_folder on storage.objects for insert to authenticated
with check (bucket_id='avatars' and (storage.foldername(name))[1]=(select auth.uid())::text);
drop policy if exists avatar_update_own_folder on storage.objects;
create policy avatar_update_own_folder on storage.objects for update to authenticated
using (bucket_id='avatars' and (storage.foldername(name))[1]=(select auth.uid())::text)
with check (bucket_id='avatars' and (storage.foldername(name))[1]=(select auth.uid())::text);
drop policy if exists avatar_delete_own_folder on storage.objects;
create policy avatar_delete_own_folder on storage.objects for delete to authenticated
using (bucket_id='avatars' and (storage.foldername(name))[1]=(select auth.uid())::text);
