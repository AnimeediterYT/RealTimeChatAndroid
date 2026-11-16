create or replace function private.is_room_member(p_room_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1 from public.room_memberships m
      where m.room_id = p_room_id
        and m.user_id = (select auth.uid())
    );
$$;
revoke all on function private.is_room_member(text) from public, anon;
grant execute on function private.is_room_member(text) to authenticated;

drop policy if exists room_memberships_select_self on public.room_memberships;
create policy room_memberships_select_room_members
on public.room_memberships for select to authenticated
using (private.is_room_member(room_id));

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='friend_requests') then
    alter publication supabase_realtime add table public.friend_requests;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='friendships') then
    alter publication supabase_realtime add table public.friendships;
  end if;
end $$;
