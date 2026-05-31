select 'healthy' as status, 'rag module retrieval and ask lanes active' as reason
union all
select 'degraded', 'rag retrieval returned empty context'
union all
select 'failed', 'rag policy validation failed';
