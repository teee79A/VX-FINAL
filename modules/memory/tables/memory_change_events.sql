select
  'memory.item.appended' as event_type,
  now() at time zone 'utc' as happened_at_utc,
  'memory append accepted as request-only operation' as details;
