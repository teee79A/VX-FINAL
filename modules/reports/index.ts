import { ReportsModule } from "./reports.module.js";

export async function createReportsModule(): Promise<ReportsModule> {
  const module = new ReportsModule();
  await module.init();
  return module;
}
