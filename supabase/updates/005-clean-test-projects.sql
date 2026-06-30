-- Hide obvious live test projects from the pilot map while keeping records for audit.
-- Run this after the first four update files have been applied.

with pilot as (
  select id
  from public.neighbourhoods
  where city = 'Limerick'
    and country = 'Ireland'
    and name in (
      'Ballinacurra Gardens',
      'Ballinacurra Gardens, Oakview Drive, Greenfields & Roundwood Estate'
    )
)
update public.projects
set
  is_hidden = true,
  status = 'removed',
  updated_at = now()
where neighbourhood_id in (select id from pilot)
  and (
    id in (
      '76e8f8b8-1e71-436c-add1-ce678816cb94',
      'fea9ce30-e8c8-4fcd-afdf-f8cc1d08bc15'
    )
    or
    lower(title) in ('test', 'garden tidy')
    or lower(title) like '%test project%'
    or lower(summary) like '%this is a test%'
    or lower(description) like '%this is a test%'
    or lower(description) like '%cut the garden grass%'
  );
