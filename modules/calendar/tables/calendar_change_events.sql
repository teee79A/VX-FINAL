select
  'calendar.schedule.proposed' as event_type,
  now() at time zone 'utc' as happened_at_utc,
  'operator proposal accepted as request-only event' as details;
