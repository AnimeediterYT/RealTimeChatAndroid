do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='room_memberships') then
    alter publication supabase_realtime add table public.room_memberships;
  end if;
end $$;