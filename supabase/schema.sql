-- Colabourhood Phase 1 database schema
-- Run this in Supabase SQL Editor for the `colabourhood` project.

create extension if not exists "pgcrypto";

create type public.verification_status as enum (
  'unverified',
  'pending',
  'verified',
  'rejected'
);

create type public.project_type as enum (
  'location_based',
  'neighbourhood_wide'
);

create type public.project_status as enum (
  'proposed',
  'gathering_support',
  'planning',
  'active',
  'completed',
  'paused',
  'removed'
);

create type public.project_contribution_type as enum (
  'support',
  'help',
  'organise',
  'materials',
  'funding'
);

create type public.project_message_type as enum (
  'comment',
  'update'
);

create table public.neighbourhoods (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  city text not null default 'Limerick',
  country text not null default 'Ireland',
  centre_lat numeric(9,6),
  centre_lng numeric(9,6),
  boundary_geojson jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint neighbourhoods_name_city_country_unique unique (name, city, country)
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  neighbourhood_id uuid references public.neighbourhoods(id),
  verification_status public.verification_status not null default 'unverified',
  is_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  neighbourhood_id uuid not null references public.neighbourhoods(id) on delete restrict,
  created_by uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  summary text not null,
  description text not null,
  project_type public.project_type not null,
  status public.project_status not null default 'proposed',
  location_lat numeric(9,6),
  location_lng numeric(9,6),
  location_label text,
  funding_target numeric(12,2),
  is_hidden boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint projects_location_matches_type check (
    (
      project_type = 'location_based'
      and location_lat is not null
      and location_lng is not null
    )
    or
    (
      project_type = 'neighbourhood_wide'
      and location_lat is null
      and location_lng is null
    )
  )
);

create table public.project_contributions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  contribution_type public.project_contribution_type not null,
  pledge_amount numeric(12,2),
  note text,
  is_public boolean not null default true,
  created_at timestamptz not null default now(),
  constraint project_contributions_unique unique (project_id, user_id, contribution_type),
  constraint project_contributions_funding_amount check (
    contribution_type <> 'funding'
    or pledge_amount is not null
  )
);

create table public.project_messages (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  message_type public.project_message_type not null default 'comment',
  body text not null,
  is_hidden boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.project_media (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  uploaded_by uuid not null references public.profiles(id) on delete cascade,
  storage_path text not null,
  caption text,
  is_hidden boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.residency_verification_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  neighbourhood_id uuid not null references public.neighbourhoods(id) on delete restrict,
  status public.verification_status not null default 'pending',
  method text not null default 'manual_review',
  reviewer_notes text,
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create index neighbourhoods_city_idx on public.neighbourhoods (city);
create index profiles_neighbourhood_id_idx on public.profiles (neighbourhood_id);
create index profiles_verification_status_idx on public.profiles (verification_status);
create index projects_neighbourhood_status_idx on public.projects (neighbourhood_id, status);
create index projects_created_by_idx on public.projects (created_by);
create index project_contributions_project_id_idx on public.project_contributions (project_id);
create index project_contributions_user_id_idx on public.project_contributions (user_id);
create index project_messages_project_id_created_at_idx on public.project_messages (project_id, created_at desc);
create index project_messages_user_id_idx on public.project_messages (user_id);
create index project_media_project_id_idx on public.project_media (project_id);
create index residency_verification_requests_user_id_idx on public.residency_verification_requests (user_id);
create index residency_verification_requests_neighbourhood_id_idx on public.residency_verification_requests (neighbourhood_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger neighbourhoods_set_updated_at
before update on public.neighbourhoods
for each row execute function public.set_updated_at();

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger projects_set_updated_at
before update on public.projects
for each row execute function public.set_updated_at();

create trigger project_messages_set_updated_at
before update on public.project_messages
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, neighbourhood_id)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)),
    nullif(new.raw_user_meta_data ->> 'neighbourhood_id', '')::uuid
  );
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

alter table public.neighbourhoods enable row level security;
alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.project_contributions enable row level security;
alter table public.project_messages enable row level security;
alter table public.project_media enable row level security;
alter table public.residency_verification_requests enable row level security;

create policy "Anyone can view active neighbourhoods"
on public.neighbourhoods for select
using (is_active = true);

create policy "Users can view public profile basics"
on public.profiles for select
using (true);

create policy "Users can update their own profile"
on public.profiles for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

create policy "Anyone can view visible projects"
on public.projects for select
using (is_hidden = false and status <> 'removed');

create policy "Authenticated users can create projects"
on public.projects for insert
to authenticated
with check ((select auth.uid()) = created_by);

create policy "Project creators can update their own projects"
on public.projects for update
to authenticated
using ((select auth.uid()) = created_by)
with check ((select auth.uid()) = created_by);

create policy "Anyone can view public contributions"
on public.project_contributions for select
using (is_public = true);

create policy "Users can view their own contributions"
on public.project_contributions for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Authenticated users can add contributions"
on public.project_contributions for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can update their own contributions"
on public.project_contributions for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Anyone can view visible project messages"
on public.project_messages for select
using (is_hidden = false);

create policy "Authenticated users can add project messages"
on public.project_messages for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can update their own project messages"
on public.project_messages for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Anyone can view visible project media"
on public.project_media for select
using (is_hidden = false);

create policy "Authenticated users can add project media"
on public.project_media for insert
to authenticated
with check ((select auth.uid()) = uploaded_by);

create policy "Users can view their own verification requests"
on public.residency_verification_requests for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can create their own verification requests"
on public.residency_verification_requests for insert
to authenticated
with check ((select auth.uid()) = user_id);
