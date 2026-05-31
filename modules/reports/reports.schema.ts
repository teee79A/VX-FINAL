export const ReportsSchema = {
  operations: ["lane_summary", "export_status"] as const,
  exportFormats: ["json", "md"] as const
};
