export class CalendarStorageGateway {
  async listEvents(_fromUtc: string, _toUtc: string): Promise<Array<{ id: string; title: string; atUtc: string }>> {
    return [];
  }
}
