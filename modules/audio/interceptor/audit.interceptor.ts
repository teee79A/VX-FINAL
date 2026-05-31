export function audioAuditRef(requestId: string): string {
  return `vxstation.audio.${requestId}`;
}
