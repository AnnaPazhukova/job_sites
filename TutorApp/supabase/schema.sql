-- TutorSpace data storage: one key/value row per app data slice per user.
-- Run this once in the Supabase SQL Editor (Project → SQL Editor → New query).

create table if not exists public.app_kv (
  user_id uuid not null references auth.users (id) on delete cascade,
  key text not null,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);

alter table public.app_kv enable row level security;

create policy "read own data" on public.app_kv
  for select using (auth.uid() = user_id);

create policy "write own data" on public.app_kv
  for insert with check (auth.uid() = user_id);

create policy "update own data" on public.app_kv
  for update using (auth.uid() = user_id);

create policy "delete own data" on public.app_kv
  for delete using (auth.uid() = user_id);
