-- Starter Limerick neighbourhoods for Colabourhood Phase 1.
-- Run after schema.sql.

insert into public.neighbourhoods (name, city, country, centre_lat, centre_lng)
values
  ('Ballinacurra Gardens', 'Limerick', 'Ireland', 52.646900, -8.641900),
  ('Corbally', 'Limerick', 'Ireland', 52.674900, -8.603300),
  ('Castletroy', 'Limerick', 'Ireland', 52.666000, -8.553000),
  ('Dooradoyle', 'Limerick', 'Ireland', 52.637600, -8.645900),
  ('Raheen', 'Limerick', 'Ireland', 52.633200, -8.664000),
  ('City Centre', 'Limerick', 'Ireland', 52.663800, -8.626700),
  ('Thomondgate', 'Limerick', 'Ireland', 52.672500, -8.634200),
  ('Annacotty', 'Limerick', 'Ireland', 52.667700, -8.531400)
on conflict (name, city, country) do update
set
  centre_lat = excluded.centre_lat,
  centre_lng = excluded.centre_lng,
  is_active = true,
  updated_at = now();
