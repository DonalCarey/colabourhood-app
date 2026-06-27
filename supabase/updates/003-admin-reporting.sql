-- Basic reporting and admin moderation for Colabourhood.

create or replace function public.is_admin(user_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select coalesce(
    (select profiles.is_admin from public.profiles where profiles.id = user_id),
    false
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select public.is_admin((select auth.uid()));
$$;

create table if not exists public.content_reports (
  id uuid primary key default gen_random_uuid(),
  target_type text not null,
  target_id uuid not null,
  project_id uuid references public.projects(id) on delete cascade,
  reported_by uuid not null references public.profiles(id) on delete cascade,
  reason text not null,
  details text,
  status text not null default 'open',
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint content_reports_target_type_check check (target_type in ('project', 'message', 'media', 'profile')),
  constraint content_reports_reason_check check (reason in ('inappropriate', 'private_information', 'spam_duplicate', 'unsafe', 'abuse', 'other')),
  constraint content_reports_status_check check (status in ('open', 'reviewing', 'resolved', 'dismissed'))
);

create index if not exists content_reports_status_created_at_idx on public.content_reports (status, created_at desc);
create index if not exists content_reports_project_id_idx on public.content_reports (project_id);
create index if not exists content_reports_reported_by_idx on public.content_reports (reported_by);
create index if not exists content_reports_target_idx on public.content_reports (target_type, target_id);

drop trigger if exists content_reports_set_updated_at on public.content_reports;
create trigger content_reports_set_updated_at
before update on public.content_reports
for each row execute function public.set_updated_at();

alter table public.content_reports enable row level security;

drop policy if exists "Users can create content reports" on public.content_reports;
create policy "Users can create content reports"
on public.content_reports for insert
to authenticated
with check ((select auth.uid()) = reported_by);

drop policy if exists "Users can view their own content reports" on public.content_reports;
create policy "Users can view their own content reports"
on public.content_reports for select
to authenticated
using ((select auth.uid()) = reported_by or public.is_admin());

drop policy if exists "Admins can update content reports" on public.content_reports;
create policy "Admins can update content reports"
on public.content_reports for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Admins can moderate projects" on public.projects;
create policy "Admins can moderate projects"
on public.projects for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Admins can moderate project messages" on public.project_messages;
create policy "Admins can moderate project messages"
on public.project_messages for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Admins can moderate project media" on public.project_media;
create policy "Admins can moderate project media"
on public.project_media for update
to authenticated
using (public.is_admin())
with check (public.is_admin());
