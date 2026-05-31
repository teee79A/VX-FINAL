select 'healthy' as status, 'reports module summary and export lane active' as reason
union all
select 'degraded', 'report inputs incomplete'
union all
select 'failed', 'report policy validation failed';
