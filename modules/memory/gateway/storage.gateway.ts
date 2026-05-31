export class MemoryStorageGateway {
  private readonly store = new Map<string, string[]>();

  async read(sessionId: string): Promise<string[]> {
    return this.store.get(sessionId) ?? [];
  }

  async append(sessionId: string, item: string): Promise<void> {
    const current = this.store.get(sessionId) ?? [];
    this.store.set(sessionId, [...current, item]);
  }
}
