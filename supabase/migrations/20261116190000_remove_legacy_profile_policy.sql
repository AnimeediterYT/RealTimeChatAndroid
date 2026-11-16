-- Remove the legacy broad profile-read policy left by the original schema.
drop policy if exists profiles_select_auth on public.profiles;
drop policy if exists profiles_select_authenticated on public.profiles;

-- Confirm profile visibility is either self-only or registered-user directory access.
drop policy if exists profiles_select_directory on public.profiles;
create policy profiles_select_directory
on public.profiles for select to authenticated
using (
  coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) = false
);
