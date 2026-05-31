import { ReportsInput, ReportsOutput } from "../reports.types.js";

export class ReportsProcessor {
  async run(input: ReportsInput): Promise<ReportsOutput> {
    if (input.op === "lane_summary") {
      return {
        lane: input.lane,
        summary: `lane ${input.lane}: operational`
      };
    }

    return {
      format: input.format,
      exported: true,
      evidenceRef: "vxstation.reports.export.latest"
    };
  }
}
