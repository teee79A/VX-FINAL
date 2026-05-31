import { describe, expect, it } from "vitest";
import { NoDirectExecGuard } from "../command-bus/no-direct-exec.guard.js";
import { TerminalPolicy } from "../policy/terminal.policy.js";
import { CalendarModule } from "../modules/calendar/calendar.module.js";

describe("bypass gates", () => {
  it("blocks exec-prefixed module actions at terminal policy", async () => {
    const policy = new TerminalPolicy();
    const mod = new CalendarModule();

    await expect(
      policy.assertModuleAccess(mod.manifest, {
        requestId: "r1",
        module: "calendar",
        action: "exec:runtime.transfer",
        payload: {},
        context: {
          sessionId: "s1",
          actorId: "a1",
          actorRole: "operator",
          room: "vxstation",
          terminalMode: "operator",
          correlationId: "c1",
          issuedAtUtc: new Date().toISOString()
        }
      })
    ).rejects.toThrow("Modules cannot execute runtime actions directly.");
  });

  it("blocks module-sourced vyrdx.exec command types", () => {
    const guard = new NoDirectExecGuard();
    expect(() =>
      guard.assert({
        type: "vyrdx.exec.anything",
        source: "module:voice"
      })
    ).toThrow("Module attempted execution bypass.");
  });
});
