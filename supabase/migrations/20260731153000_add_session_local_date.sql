alter table public.sessions
add column if not exists local_date date;
