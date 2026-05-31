import { makeCorrelationId, makeRequestId } from "../shared/ids.js";
import { SessionContext } from "../shared/terminal.types.js";

export class SessionController {
  create(actorId: string, actorRole: string): SessionContext {
    return {
      sessionId: makeRequestId("sess"),
      actorId,
      actorRole,
      room: "vxstation",
      terminalMode: actorRole === "admin" ? "admin" : "operator",
      correlationId: makeCorrelationId(),
      issuedAtUtc: new Date().toISOString()
    };
  }
}
