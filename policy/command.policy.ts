import { NoDirectExecGuard } from "../command-bus/no-direct-exec.guard.js";
import { SafeCommand } from "../command-bus/command.types.js";
import { RoutePolicy } from "./route.policy.js";

export class CommandPolicy {
  private readonly noDirectExecGuard = new NoDirectExecGuard();
  private readonly routePolicy = new RoutePolicy();

  assert(command: SafeCommand): void {
    this.noDirectExecGuard.assert({
      type: command.type,
      source: command.source
    });
    this.routePolicy.assertAllowedTarget(command.target);
  }
}
