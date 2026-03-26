create table if not exists public.events (
  id uuid primary key,
  user_id text not null,
  event_type text not null,
  message_char_count integer not null default 0,
  estimated_tokens integer not null default 0,
  session_id uuid not null,
  created_at timestamptz not null default now()
);

create index if not exists events_user_id_created_at_idx
  on public.events (user_id, created_at desc);
