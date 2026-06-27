-- Adds editable project-page content for live Supabase projects:
-- action plan items, needs, and photo uploads.

create table if not exists public.project_action_items (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  owner_label text,
  target_label text,
  status text not null default 'pending',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint project_action_items_status_check check (status in ('pending', 'active', 'complete'))
);

create table if not exists public.project_needs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  detail text,
  need_type text not null default 'help',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint project_needs_type_check check (need_type in ('help', 'skills', 'tools', 'materials', 'funding', 'knowledge', 'other'))
);

alter table public.project_media
add column if not exists media_type text not null default 'image',
add column if not exists sort_order integer not null default 0;

create index if not exists project_action_items_project_id_idx on public.project_action_items (project_id, sort_order);
create index if not exists project_action_items_created_by_idx on public.project_action_items (created_by);
create index if not exists project_needs_project_id_idx on public.project_needs (project_id, sort_order);
create index if not exists project_needs_created_by_idx on public.project_needs (created_by);

drop trigger if exists project_action_items_set_updated_at on public.project_action_items;
create trigger project_action_items_set_updated_at
before update on public.project_action_items
for each row execute function public.set_updated_at();

drop trigger if exists project_needs_set_updated_at on public.project_needs;
create trigger project_needs_set_updated_at
before update on public.project_needs
for each row execute function public.set_updated_at();

alter table public.project_action_items enable row level security;
alter table public.project_needs enable row level security;

drop policy if exists "Anyone can view project action items" on public.project_action_items;
create policy "Anyone can view project action items"
on public.project_action_items for select
using (true);

drop policy if exists "Project creators can add action items" on public.project_action_items;
create policy "Project creators can add action items"
on public.project_action_items for insert
to authenticated
with check (
  (select auth.uid()) = created_by
  and exists (
    select 1 from public.projects
    where projects.id = project_action_items.project_id
    and projects.created_by = (select auth.uid())
  )
);

drop policy if exists "Project creators can update action items" on public.project_action_items;
create policy "Project creators can update action items"
on public.project_action_items for update
to authenticated
using (
  exists (
    select 1 from public.projects
    where projects.id = project_action_items.project_id
    and projects.created_by = (select auth.uid())
  )
)
with check (
  exists (
    select 1 from public.projects
    where projects.id = project_action_items.project_id
    and projects.created_by = (select auth.uid())
  )
);

drop policy if exists "Project creators can delete action items" on public.project_action_items;
create policy "Project creators can delete action items"
on public.project_action_items for delete
to authenticated
using (
  exists (
    select 1 from public.projects
    where projects.id = project_action_items.project_id
    and projects.created_by = (select auth.uid())
  )
);

drop policy if exists "Anyone can view project needs" on public.project_needs;
create policy "Anyone can view project needs"
on public.project_needs for select
using (true);

drop policy if exists "Project creators can add needs" on public.project_needs;
create policy "Project creators can add needs"
on public.project_needs for insert
to authenticated
with check (
  (select auth.uid()) = created_by
  and exists (
    select 1 from public.projects
    where projects.id = project_needs.project_id
    and projects.created_by = (select auth.uid())
  )
);

drop policy if exists "Project creators can update needs" on public.project_needs;
create policy "Project creators can update needs"
on public.project_needs for update
to authenticated
using (
  exists (
    select 1 from public.projects
    where projects.id = project_needs.project_id
    and projects.created_by = (select auth.uid())
  )
)
with check (
  exists (
    select 1 from public.projects
    where projects.id = project_needs.project_id
    and projects.created_by = (select auth.uid())
  )
);

drop policy if exists "Project creators can delete needs" on public.project_needs;
create policy "Project creators can delete needs"
on public.project_needs for delete
to authenticated
using (
  exists (
    select 1 from public.projects
    where projects.id = project_needs.project_id
    and projects.created_by = (select auth.uid())
  )
);

drop policy if exists "Project creators can update their project media" on public.project_media;
create policy "Project creators can update their project media"
on public.project_media for update
to authenticated
using (
  exists (
    select 1 from public.projects
    where projects.id = project_media.project_id
    and projects.created_by = (select auth.uid())
  )
)
with check (
  exists (
    select 1 from public.projects
    where projects.id = project_media.project_id
    and projects.created_by = (select auth.uid())
  )
);

drop policy if exists "Project creators can delete their project media" on public.project_media;
create policy "Project creators can delete their project media"
on public.project_media for delete
to authenticated
using (
  exists (
    select 1 from public.projects
    where projects.id = project_media.project_id
    and projects.created_by = (select auth.uid())
  )
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'project-media',
  'project-media',
  true,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update
set
  public = true,
  file_size_limit = 10485760,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

drop policy if exists "Project media is publicly readable" on storage.objects;
create policy "Project media is publicly readable"
on storage.objects for select
using (bucket_id = 'project-media');

drop policy if exists "Authenticated users can upload project media" on storage.objects;
create policy "Authenticated users can upload project media"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'project-media'
  and owner_id = (select auth.uid())::text
);

drop policy if exists "Uploaders can update project media objects" on storage.objects;
create policy "Uploaders can update project media objects"
on storage.objects for update
to authenticated
using (
  bucket_id = 'project-media'
  and owner_id = (select auth.uid())::text
)
with check (
  bucket_id = 'project-media'
  and owner_id = (select auth.uid())::text
);

drop policy if exists "Uploaders can delete project media objects" on storage.objects;
create policy "Uploaders can delete project media objects"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'project-media'
  and owner_id = (select auth.uid())::text
);
