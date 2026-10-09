begin;

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check
  check (role in ('normal', 'wholesale', 'staff', 'admin'));

create or replace function public.is_backoffice()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role in ('admin', 'staff')
  );
$$;
revoke all on function public.is_backoffice() from public;
grant execute on function public.is_backoffice() to authenticated;

-- Staff access intentionally does not receive direct table policies. Every
-- staff operation goes through a server route that checks the role, uses the
-- service key, and redacts customer contact/location data before responding.
-- Existing admin-only RLS therefore remains an additional bypass barrier.

commit;

notify pgrst, 'reload schema';
