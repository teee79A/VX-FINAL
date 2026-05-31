export interface SessionContext {
  sessionId: string;
  actorId: string;
  actorRole: string;
  room: "ai-room" | "vxstation" | "vyrdx";
  terminalMode: "view" | "operator" | "admin";
  correlationId: string;
  issuedAtUtc: string;
}

export interface ModuleRequest<TPayload = unknown> {
  requestId: string;
  module: string;
  action: string;
  payload: TPayload;
  context: SessionContext;
}
