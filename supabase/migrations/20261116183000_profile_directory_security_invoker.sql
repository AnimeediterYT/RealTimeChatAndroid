-- Ensure the discovery view uses caller privileges and RLS.
alter view public.public_profiles set (security_invoker = true);
drop policy if exists profiles_select_directory on public.profiles;
create policy profiles_select_directory
on public.profiles for select to authenticated
using (
  coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) = false
);
