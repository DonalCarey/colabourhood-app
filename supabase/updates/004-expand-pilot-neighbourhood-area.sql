-- Expand the first Colabourhood pilot area to match the residents association footprint.
-- This keeps existing profiles and projects attached to the same neighbourhood row.

update public.neighbourhoods
set
  name = 'Ballinacurra Gardens, Oakview Drive, Greenfields & Roundwood Estate',
  centre_lat = 52.645650,
  centre_lng = -8.634350
where
  name = 'Ballinacurra Gardens'
  and city = 'Limerick'
  and country = 'Ireland';

insert into public.neighbourhoods (name, city, country, centre_lat, centre_lng)
select
  'Ballinacurra Gardens, Oakview Drive, Greenfields & Roundwood Estate',
  'Limerick',
  'Ireland',
  52.645650,
  -8.634350
where not exists (
  select 1
  from public.neighbourhoods
  where
    name = 'Ballinacurra Gardens, Oakview Drive, Greenfields & Roundwood Estate'
    and city = 'Limerick'
    and country = 'Ireland'
);
