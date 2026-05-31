import { TerminalErrorCode } from "../shared/error.types.js";
import { DenyReasons } from "./deny-reasons.js";

export class RoutePolicy {
  private readonly allowedTargets = [
    "vxstation.",
    "terminal.",
    "vyrdx.boundary.request"
  ];

  assertAllowedTarget(target: string): void {
    const allowed = this.allowedTargets.some((prefix) =>
      target.startsWith(prefix)
    );
    if (!allowed) {
      throw new TerminalErrorCode(
        DenyReasons.ROUTE_NOT_ALLOWED,
        `Route target is not allowed: ${target}`
      );
    }
  }
}
