select 'healthy' as status, 'audio module active with transcription request path' as reason
union all
select 'degraded', 'audio ingestion delayed or missing room stream'
union all
select 'failed', 'audio module validation failure';
