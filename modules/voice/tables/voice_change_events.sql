select
  'voice.synthesized' as event_type,
  now() at time zone 'utc' as happened_at_utc,
  'voice synthesis request emitted through command bus path' as details;
