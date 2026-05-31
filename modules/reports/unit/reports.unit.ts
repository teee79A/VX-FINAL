import { ReportsProcessor } from "../processor/reports.processor.js";
import { ReportsInput, ReportsOutput } from "../reports.types.js";

export class ReportsUnit {
  private readonly processor = new ReportsProcessor();

  async run(input: ReportsInput): Promise<ReportsOutput> {
    return this.processor.run(input);
  }
}
