select
  'recall' as action_name,
  false as direct_execution_allowed
union all
select
  'append',
  false;
