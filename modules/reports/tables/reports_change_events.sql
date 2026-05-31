select
  'reports.generated' as event_type,
  now() at time zone 'utc' as happened_at_utc,
  'report generated in terminal-safe lane' as details;
