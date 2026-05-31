select
  'rag.answer.generated' as event_type,
  now() at time zone 'utc' as happened_at_utc,
  'rag query processed in bounded module lane' as details;
