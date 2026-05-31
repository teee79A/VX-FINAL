select
  'lane_summary' as action_name,
  false as direct_execution_allowed
union all
select
  'export_status',
  false;
