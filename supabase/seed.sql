-- Seed the wedding events.
-- Run once after the schema is in place (Supabase Studio -> SQL Editor).
-- Safe to re-run: existing rows are detected by (name, order_index) and
-- left untouched.

insert into public.events (name, date, location, order_index)
select *
from (values
  ('Tilak',     timestamptz '2026-04-25 15:00:00+05:30', 'Vijaya Grand, Ashiana Nagar, Patna',        0),
  ('Haldi',     timestamptz '2026-04-26 14:00:00+05:30', 'Chanakya Hotel, R Block, Patna',            1),
  ('Sangeet',   timestamptz '2026-04-26 19:30:00+05:30', 'Chanakya Hotel, R Block, Patna',            2),
  ('Wedding',   timestamptz '2026-04-27 21:00:00+05:30', 'Chanakya Hotel, R Block, Patna',            3),
  ('Reception', timestamptz '2026-04-29 20:00:00+05:30', 'Grand Ivory, Biscoman Bhavan, Patna',       4),
  ('Reception', timestamptz '2026-05-02 20:00:00+05:30', 'Bokaro Steel City',                         5)
) as v(name, date, location, order_index)
where not exists (
  select 1 from public.events e
  where e.name = v.name and e.order_index = v.order_index
);
