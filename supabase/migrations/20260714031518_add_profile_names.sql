alter table public.profiles add column first_name text;
alter table public.profiles add column last_name text;

update public.profiles p
set first_name = c.first_name, last_name = c.last_name
from (
  select distinct on (student_id) student_id, first_name, last_name
  from public.consultations
  order by student_id, created_at desc
) c
where p.id = c.student_id and p.first_name is null;

update public.profiles set first_name = 'Unknown', last_name = 'Unknown' where first_name is null;

alter table public.profiles alter column first_name set not null;
alter table public.profiles alter column last_name set not null;
alter table public.profiles add constraint profiles_first_name_check check (length(trim(first_name)) > 0);
alter table public.profiles add constraint profiles_last_name_check check (length(trim(last_name)) > 0);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, role, first_name, last_name)
  values (
    new.id,
    'student',
    coalesce(new.raw_user_meta_data->>'first_name', 'Unknown'),
    coalesce(new.raw_user_meta_data->>'last_name', 'Unknown')
  );
  return new;
end;
$$;
