alter table public.practices
add column if not exists calendar_start_date timestamp with time zone;

update public.practices as practice
set calendar_start_date = coalesce(
  (
    select min(session.created_at)
    from public.sessions as session
    where session.practice_id = practice.id
      and session.user_id = practice.user_id
      and session.deleted_at is null
  ),
  practice.updated_at
)
where practice.calendar_start_date is null;

alter table public.practices
alter column calendar_start_date set default now();

alter table public.practices
alter column calendar_start_date set not null;
