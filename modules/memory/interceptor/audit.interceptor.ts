export function memoryAuditRef(requestId: string): string {
  return `vxstation.memory.${requestId}`;
}
