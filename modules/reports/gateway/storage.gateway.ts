export class ReportsStorageGateway {
  async writeExport(
    _format: "json" | "md",
    _payload: string
  ): Promise<string> {
    return "vxstation.reports.export.latest";
  }
}
