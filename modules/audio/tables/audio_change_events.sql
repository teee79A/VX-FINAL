select
  'audio.transcribed' as event_type,
  now() at time zone 'utc' as happened_at_utc,
  'audio chunk transcribed through bounded request path' as details;
