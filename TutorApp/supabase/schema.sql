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

-- File attachments (homework, methodology lessons): one public bucket,
-- files stored under a per-user folder (<user_id>/...), writable only by
-- their owner. Public read keeps download links simple (no signed URLs to
-- refresh); nothing sensitive should be uploaded here.
insert into storage.buckets (id, name, public)
values ('attachments', 'attachments', true)
on conflict (id) do nothing;

create policy "read attachments" on storage.objects
  for select using (bucket_id = 'attachments');

create policy "upload own attachments" on storage.objects
  for insert with check (bucket_id = 'attachments' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "delete own attachments" on storage.objects
  for delete using (bucket_id = 'attachments' and (storage.foldername(name))[1] = auth.uid()::text);
