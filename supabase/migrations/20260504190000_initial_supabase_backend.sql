create extension if not exists "pgcrypto";

create schema if not exists private;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  role text not null default 'user' check (role in ('user', 'admin')),
  subscription_tier text not null default 'free',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.games (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  genre text,
  dimension text check (dimension in ('2D', '3D')),
  difficulty text,
  game_json jsonb not null,
  html_string text,
  asset_manifest jsonb not null default '[]'::jsonb,
  thumbnail_url text,
  prompt text,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.prompt_history (
  id uuid primary key default gen_random_uuid(),
  game_id uuid references public.games(id) on delete set null,
  user_id uuid not null references auth.users(id) on delete cascade,
  prompt text not null,
  mcq_questions jsonb,
  mcq_answers jsonb,
  model text,
  duration_ms integer,
  action_type text not null check (action_type in ('mcq', 'create', 'edit')),
  created_at timestamptz not null default now()
);

create table if not exists public.token_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  game_id uuid references public.games(id) on delete set null,
  amount integer not null,
  action_type text not null check (action_type in ('grant', 'create', 'edit', 'refund', 'adjust')),
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  game_id uuid references public.games(id) on delete set null,
  event_type text not null,
  generation_time_ms integer,
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists games_user_updated_idx on public.games(user_id, updated_at desc);
create index if not exists prompt_history_user_created_idx on public.prompt_history(user_id, created_at desc);
create index if not exists token_ledger_user_created_idx on public.token_ledger(user_id, created_at desc);
create index if not exists analytics_events_created_idx on public.analytics_events(created_at desc);

create or replace function private.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
before update on public.profiles
for each row execute function private.touch_updated_at();

drop trigger if exists games_touch_updated_at on public.games;
create trigger games_touch_updated_at
before update on public.games
for each row execute function private.touch_updated_at();

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(coalesce(new.email, ''), '@', 1))
  )
  on conflict (id) do nothing;

  insert into public.token_ledger (user_id, amount, action_type, reason)
  values (new.id, 100, 'grant', 'initial free token grant');

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function private.handle_new_user();

create or replace function public.get_token_balance()
returns table (
  user_id uuid,
  tokens_remaining integer,
  tokens_total integer,
  subscription text
)
language sql
stable
set search_path = public
as $$
  select
    p.id as user_id,
    greatest(coalesce(sum(t.amount), 0), 0)::integer as tokens_remaining,
    coalesce(sum(t.amount) filter (where t.amount > 0), 0)::integer as tokens_total,
    p.subscription_tier as subscription
  from public.profiles p
  left join public.token_ledger t on t.user_id = p.id
  where p.id = (select auth.uid())
  group by p.id, p.subscription_tier;
$$;

alter table public.profiles enable row level security;
alter table public.games enable row level security;
alter table public.prompt_history enable row level security;
alter table public.token_ledger enable row level security;
alter table public.analytics_events enable row level security;

drop policy if exists "Users can read their profile" on public.profiles;
create policy "Users can read their profile"
on public.profiles for select
to authenticated
using ((select auth.uid()) = id);

drop policy if exists "Users can read their games" on public.games;
create policy "Users can read their games"
on public.games for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can create their games" on public.games;
create policy "Users can create their games"
on public.games for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their games" on public.games;
create policy "Users can update their games"
on public.games for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their games" on public.games;
create policy "Users can delete their games"
on public.games for delete
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can read their prompt history" on public.prompt_history;
create policy "Users can read their prompt history"
on public.prompt_history for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can create their prompt history" on public.prompt_history;
create policy "Users can create their prompt history"
on public.prompt_history for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can read their token ledger" on public.token_ledger;
create policy "Users can read their token ledger"
on public.token_ledger for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users and admins can read analytics" on public.analytics_events;
create policy "Users and admins can read analytics"
on public.analytics_events for select
to authenticated
using (
  (select auth.uid()) = user_id
  or ((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin'
);

drop policy if exists "Users can create their analytics events" on public.analytics_events;
create policy "Users can create their analytics events"
on public.analytics_events for insert
to authenticated
with check ((select auth.uid()) = user_id);

insert into storage.buckets (id, name, public)
values
  ('game-assets', 'game-assets', true),
  ('game-exports', 'game-exports', false),
  ('thumbnails', 'thumbnails', true)
on conflict (id) do nothing;

drop policy if exists "Users can read their storage objects" on storage.objects;
create policy "Users can read their storage objects"
on storage.objects for select
to authenticated
using (
  bucket_id in ('game-assets', 'game-exports', 'thumbnails')
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "Users can upload their storage objects" on storage.objects;
create policy "Users can upload their storage objects"
on storage.objects for insert
to authenticated
with check (
  bucket_id in ('game-assets', 'game-exports', 'thumbnails')
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "Users can update their storage objects" on storage.objects;
create policy "Users can update their storage objects"
on storage.objects for update
to authenticated
using (
  bucket_id in ('game-assets', 'game-exports', 'thumbnails')
  and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
  bucket_id in ('game-assets', 'game-exports', 'thumbnails')
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "Users can delete their storage objects" on storage.objects;
create policy "Users can delete their storage objects"
on storage.objects for delete
to authenticated
using (
  bucket_id in ('game-assets', 'game-exports', 'thumbnails')
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
