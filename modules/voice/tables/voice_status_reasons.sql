select 'healthy' as status, 'voice routing and synthesis request path active' as reason
union all
select 'degraded', 'voice profile unavailable for selected lane'
union all
select 'failed', 'voice policy or validation failure';
