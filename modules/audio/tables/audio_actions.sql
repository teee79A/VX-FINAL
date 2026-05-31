select
  'capture_level' as action_name,
  false as direct_execution_allowed
union all
select
  'transcribe_chunk',
  false;
