select 'healthy' as status, 'module initialized and policy gates loaded' as reason
union all
select 'degraded', 'storage gateway unavailable'
union all
select 'failed', 'policy or validation failure';
