select
  'list_events' as action_name,
  false as direct_execution_allowed
union all
select
  'propose_schedule',
  false;
