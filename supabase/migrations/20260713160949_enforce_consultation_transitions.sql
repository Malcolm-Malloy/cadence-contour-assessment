-- Security hardening: consultations_update_own's WITH CHECK only restricts
-- row ownership (auth.uid() = student_id), not which fields or status
-- transitions are valid. A student calling the Supabase client directly
-- (bypassing PATCH /api/consultations/:id) could otherwise un-cancel their
-- own cancelled booking, mark a future consultation "completed", edit
-- first_name/last_name/reason after the fact, or reschedule into the past
-- -- all business rules the API route enforces but RLS alone did not.
--
-- This mirrors those same rules in a BEFORE UPDATE trigger, so they hold
-- regardless of which client is making the request.
create function public.enforce_consultation_transition()
returns trigger
language plpgsql
as $$
begin
  -- The service_role key (used only by dev/admin scripts, never by the
  -- app itself for updates) bypasses these rules entirely.
  if auth.role() = 'service_role' then
    return new;
  end if;

  if new.student_id is distinct from old.student_id then
    raise exception 'Cannot reassign a consultation to a different student';
  end if;

  -- Set once at booking time; the app never edits these afterwards.
  if new.first_name is distinct from old.first_name
     or new.last_name is distinct from old.last_name
     or new.reason is distinct from old.reason then
    raise exception 'first_name, last_name, and reason cannot be changed after booking';
  end if;

  if new.scheduled_at is distinct from old.scheduled_at then
    if old.status <> 'booked' then
      raise exception 'Only booked consultations can be rescheduled';
    end if;
    if new.scheduled_at <= now() then
      raise exception 'scheduled_at must be in the future';
    end if;
  end if;

  if new.status is distinct from old.status then
    if new.status = 'completed' then
      if old.status <> 'booked' then
        raise exception 'Cannot mark complete from status %', old.status;
      end if;
      if new.scheduled_at > now() then
        raise exception 'Cannot mark a future consultation as completed';
      end if;
    elsif new.status = 'booked' then
      if old.status <> 'completed' then
        raise exception 'Cannot mark incomplete from status %', old.status;
      end if;
    elsif new.status = 'cancelled' then
      if old.status <> 'booked' then
        raise exception 'Cannot cancel from status %', old.status;
      end if;
    end if;
  end if;

  return new;
end;
$$;

create trigger consultations_enforce_transition
  before update on public.consultations
  for each row execute function public.enforce_consultation_transition();
