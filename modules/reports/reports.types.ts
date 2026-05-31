export type ReportsInput =
  | { op: "lane_summary"; lane: string }
  | { op: "export_status"; format: "json" | "md" };

export type ReportsOutput =
  | { lane: string; summary: string }
  | { format: "json" | "md"; exported: true; evidenceRef: string };
