-- Remove the second reception (Bokaro, 2 May). Patna reception remains.
delete from public.events
where location ilike '%bokaro%'
   or date = timestamptz '2026-05-02 20:00:00+05:30';
