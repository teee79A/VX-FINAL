select 'healthy' as status, 'memory processor online with local append and recall' as reason
union all
select 'degraded', 'memory gateway unavailable'
union all
select 'failed', 'memory policy validation failed';
