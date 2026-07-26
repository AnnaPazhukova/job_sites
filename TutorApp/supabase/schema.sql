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

-- Student portal: NOT backed by a Supabase Auth account. A student's
-- "login" is simply possessing an unguessable access-link code (created by
-- the tutor, shown as a URL) — visiting the link grants portal access
-- directly, no signup/sign-in step. Security rests entirely on the code
-- being long and random (see secureToken() on the client) and on these
-- SECURITY DEFINER functions only ever returning the slice of the tutor's
-- data matching that one code's student_id — the tutor's app_kv rows stay
-- owned/RLS-scoped to the tutor as before, and are never exposed wholesale.
--
-- Superseded objects from the old auth-account-based design, dropped
-- first so re-running this script on a database that had it cleans up
-- fully instead of leaving orphaned tables/functions:
drop function if exists public.claim_student_invite(text);
drop function if exists public.student_get_data(text);
drop function if exists public.student_send_message(text);
drop function if exists public.student_send_message(text, jsonb);
drop function if exists public.student_mark_homework_done(text);
drop table if exists public.student_accounts;

create table if not exists public.student_invites (
  code text primary key,
  tutor_id uuid not null references auth.users (id) on delete cascade,
  student_id text not null,
  created_at timestamptz not null default now()
);

alter table public.student_invites drop column if exists used;

alter table public.student_invites enable row level security;

drop policy if exists "tutor manages own invites" on public.student_invites;
create policy "tutor manages own invites" on public.student_invites
  for all using (auth.uid() = tutor_id) with check (auth.uid() = tutor_id);

-- Returns just the link code's own slice of a given data key ('students',
-- 'lessons', 'homework', 'messages', or 'linked-notes'), read from the
-- linked tutor's app_kv row. Anything not matching the student's id is
-- filtered out inside this function, before it ever leaves the database.
-- Callable by anon (no session) since the code itself is the credential.
create or replace function public.portal_get_data(p_code text, p_key text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tutor uuid;
  v_student text;
  v_value jsonb;
  v_filtered jsonb;
begin
  select tutor_id, student_id into v_tutor, v_student
  from public.student_invites where code = p_code;

  if v_tutor is null then
    raise exception 'Ссылка недействительна';
  end if;

  -- Notes referenced by the student's own homework: read both slices and
  -- keep only methodology notes whose id shows up as a noteId on one of
  -- this student's homework items. The rest of the methodology library
  -- (the tutor's other lesson notes) never leaves the database.
  if p_key = 'linked-notes' then
    declare
      v_hw jsonb;
      v_note_ids text[];
    begin
      select value into v_hw from public.app_kv where user_id = v_tutor and key = 'homework';
      select coalesce(array_agg(distinct elem->>'noteId'), array[]::text[]) into v_note_ids
      from jsonb_array_elements(coalesce(v_hw, '[]'::jsonb)) elem
      where elem->>'studentId' = v_student and elem->>'noteId' is not null;

      select value into v_value from public.app_kv where user_id = v_tutor and key = 'methodology-notes';
      select coalesce(jsonb_agg(elem), '[]'::jsonb) into v_filtered
      from jsonb_array_elements(coalesce(v_value, '[]'::jsonb)) elem
      where elem->>'id' = any(v_note_ids);

      return v_filtered;
    end;
  end if;

  select value into v_value from public.app_kv where user_id = v_tutor and key = p_key;
  if v_value is null then
    return '[]'::jsonb;
  end if;

  if p_key in ('lessons', 'homework') then
    select coalesce(jsonb_agg(elem), '[]'::jsonb) into v_filtered
    from jsonb_array_elements(v_value) elem
    where elem->>'studentId' = v_student;
  elsif p_key = 'students' then
    select coalesce(jsonb_agg(elem), '[]'::jsonb) into v_filtered
    from jsonb_array_elements(v_value) elem
    where elem->>'id' = v_student;
  elsif p_key = 'messages' then
    v_filtered := coalesce(v_value->v_student, '[]'::jsonb);
  else
    v_filtered := '[]'::jsonb;
  end if;

  return v_filtered;
end;
$$;

grant execute on function public.portal_get_data(text, text) to anon, authenticated;

-- Appends a "from: student" chat message (optionally with file
-- attachments already uploaded to Storage) into the tutor's messages blob,
-- under the link code's own student id only.
create or replace function public.portal_send_message(p_code text, p_text text, p_attachments jsonb default '[]'::jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tutor uuid;
  v_student text;
  v_value jsonb;
  v_thread jsonb;
  v_message jsonb;
begin
  select tutor_id, student_id into v_tutor, v_student
  from public.student_invites where code = p_code;

  if v_tutor is null then
    raise exception 'Ссылка недействительна';
  end if;
  if coalesce(trim(p_text), '') = '' and jsonb_array_length(coalesce(p_attachments, '[]'::jsonb)) = 0 then
    raise exception 'Пустое сообщение';
  end if;

  select value into v_value from public.app_kv where user_id = v_tutor and key = 'messages';
  v_value := coalesce(v_value, '{}'::jsonb);
  v_thread := coalesce(v_value->v_student, '[]'::jsonb);

  v_message := jsonb_build_object(
    'id', gen_random_uuid()::text,
    'from', 'student',
    'text', coalesce(p_text, ''),
    'at', (extract(epoch from now()) * 1000)::bigint
  );
  if jsonb_array_length(coalesce(p_attachments, '[]'::jsonb)) > 0 then
    v_message := v_message || jsonb_build_object('attachments', p_attachments);
  end if;

  v_value := jsonb_set(v_value, array[v_student], v_thread || jsonb_build_array(v_message), true);

  insert into public.app_kv (user_id, key, value, updated_at)
  values (v_tutor, 'messages', v_value, now())
  on conflict (user_id, key) do update set value = excluded.value, updated_at = excluded.updated_at;
end;
$$;

grant execute on function public.portal_send_message(text, text, jsonb) to anon, authenticated;

-- Marks one of the link code's own homework items as done.
create or replace function public.portal_mark_homework_done(p_code text, p_homework_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tutor uuid;
  v_student text;
  v_value jsonb;
  v_next jsonb;
begin
  select tutor_id, student_id into v_tutor, v_student
  from public.student_invites where code = p_code;

  if v_tutor is null then
    raise exception 'Ссылка недействительна';
  end if;

  select value into v_value from public.app_kv where user_id = v_tutor and key = 'homework';
  if v_value is null then
    return;
  end if;

  select coalesce(jsonb_agg(
    case
      when elem->>'id' = p_homework_id and elem->>'studentId' = v_student
      then jsonb_set(elem, '{status}', '"done"')
      else elem
    end
  ), '[]'::jsonb) into v_next
  from jsonb_array_elements(v_value) elem;

  update public.app_kv set value = v_next, updated_at = now() where user_id = v_tutor and key = 'homework';
end;
$$;

grant execute on function public.portal_mark_homework_done(text, text) to anon, authenticated;
