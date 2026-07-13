-- Security fix: profiles_update_own (in the initial migration) only has a
-- USING clause, not a column-restricting WITH CHECK. RLS is row-level, not
-- column-level, so that policy lets any authenticated user update every
-- column on their own profile row -- including `role`. Verified exploitable
-- directly against the live project: a plain student account, using only
-- the public anon/publishable key and its own session (no service_role key,
-- no app code involved), successfully ran
--   supabase.from('profiles').update({ role: 'admin' }).eq('id', ownId)
-- and became an admin. This trigger closes that gap by rejecting any role
-- change that isn't performed via the service_role key (which is what
-- scripts/promote-admin.mjs uses, and nothing else in this app does).
create function public.prevent_role_self_escalation()
returns trigger
language plpgsql
as $$
begin
  if new.role is distinct from old.role and auth.role() <> 'service_role' then
    raise exception 'Cannot change role directly; role changes must go through an admin-privileged operation';
  end if;
  return new;
end;
$$;

create trigger profiles_prevent_role_escalation
  before update on public.profiles
  for each row execute function public.prevent_role_self_escalation();
