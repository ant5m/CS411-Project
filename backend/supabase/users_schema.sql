-- Create users table to store API keys
create table if not exists public.users (
  id uuid references auth.users(id) on delete cascade primary key,
  email text not null,
  openai_api_key text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Enable RLS
alter table public.users enable row level security;

-- Policy: users can only read/write their own row
create policy "Users can manage their own data"
  on public.users
  for all
  using (auth.uid() = id)
  with check (auth.uid() = id);
