import { describe, expect, it } from "vitest";
import { ModuleRegistry } from "../registry/module.registry.js";
import { TerminalShell } from "../shell/terminal.shell.js";
import { CalendarModule } from "../modules/calendar/calendar.module.js";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { ModuleLoader } from "../registry/module.loader.js";
import { TerminalModule } from "../shared/module.contract.js";
import { ModuleManifest } from "../shared/module.types.js";

const KITTY_ROOT = process.env.KITTY_ROOT ?? path.join(import.meta.dirname, "..");
const MODULES_ROOT = path.join(KITTY_ROOT, "modules");
const MODULES = ["rag", "memory", "audio", "voice", "calendar", "reports"];

describe("terminal policy enforcement", () => {
  it("fails closed on module mismatch", async () => {
    const registry = new ModuleRegistry();
    registry.register("calendar", new CalendarModule());
    const shell = new TerminalShell(registry);

    await expect(
      shell.process({
        requestId: "r1",
        module: "calendar",
        action: "list",
        payload: {
          op: "list_events" as const,
          fromUtc: "2026-03-27T00:00:00Z",
          toUtc: "2026-03-28T00:00:00Z"
        },
        context: {
          sessionId: "s1",
          actorId: "a1",
          actorRole: "",
          room: "vxstation" as const,
          terminalMode: "operator" as const,
          correlationId: "c1",
          issuedAtUtc: "2026-03-27T01:00:00Z"
        }
      })
    ).rejects.toThrow("Actor role is required.");
  });

  it("allows valid non-exec module requests", async () => {
    const registry = new ModuleRegistry();
    registry.register("calendar", new CalendarModule());
    const shell = new TerminalShell(registry);

    const result = await shell.process({
      requestId: "r2",
      module: "calendar",
      action: "list",
      payload: {
        op: "list_events" as const,
        fromUtc: "2026-03-27T00:00:00Z",
        toUtc: "2026-03-28T00:00:00Z"
      },
      context: {
        sessionId: "s2",
        actorId: "a2",
        actorRole: "operator",
        room: "vxstation" as const,
        terminalMode: "operator" as const,
        correlationId: "c2",
        issuedAtUtc: "2026-03-27T01:00:00Z"
      }
    });

    expect(result.ok).toBe(true);
  });

  it("builds tower radar snapshot with lane and gate visibility", async () => {
    const registry = new ModuleRegistry();
    registry.register("calendar", new CalendarModule());
    const shell = new TerminalShell(registry);

    const snapshot = await shell.radarSnapshot();

    expect(snapshot.lanes.length).toBe(8);
    expect(snapshot.radar.lanesTotal).toBe(8);
    expect(["green", "yellow", "red"]).toContain(snapshot.radar.overallStatus);
    expect(snapshot.hotkeys.length).toBeGreaterThan(0);
  });

  it("gates operator commands through command bus", async () => {
    const registry = new ModuleRegistry();
    const shell = new TerminalShell(registry);

    const allowed = await shell.gateOperatorCommand({
      type: "tower.radar.snapshot",
      target: "terminal.radar",
      payload: {},
      reason: "operator radar check"
    });
    expect(allowed.ok).toBe(true);

    const denied = await shell.gateOperatorCommand({
      type: "tower.raw.exec",
      target: "internet.raw",
      payload: {},
      reason: "invalid route"
    });
    expect(denied.ok).toBe(false);
  });

  it("enforces 4-table backbone for every module", async () => {
    for (const mod of MODULES) {
      const dir = path.join(MODULES_ROOT, mod, "tables");
      const required = [
        `${mod}_summary.sql`,
        `${mod}_status_reasons.sql`,
        `${mod}_change_events.sql`,
        `${mod}_actions.sql`
      ];
      for (const file of required) {
        const full = path.join(dir, file);
        const info = await stat(full);
        expect(info.size).toBeGreaterThan(0);
      }
    }
  });

  it("forbids direct execution/seal symbols and raw DB imports in module code", async () => {
    const forbiddenPatterns = [
      /\bexecute\s*\(/,
      /\bseal\s*\(/,
      /from\s+["']pg["']/,
      /from\s+["']redis["']/,
      /from\s+["']ioredis["']/,
      /from\s+["']mongodb["']/,
      /from\s+["']mongoose["']/,
      /from\s+["']mysql2["']/,
      /from\s+["']@prisma\/client["']/,
      /from\s+["']typeorm["']/,
      /from\s+["']sequelize["']/
    ];

    for (const mod of MODULES) {
      const moduleDir = path.join(MODULES_ROOT, mod);
      const files = await walkTsFiles(moduleDir);
      for (const file of files) {
        const content = await readFile(file, "utf8");
        for (const pattern of forbiddenPatterns) {
          expect(pattern.test(content)).toBe(false);
        }
      }
    }
  });

  it("rejects modules that claim request_command but do not implement requestCommand()", async () => {
    class BrokenModule implements TerminalModule {
      readonly manifest: ModuleManifest = {
        name: "rag",
        version: "1.0.0",
        capabilities: ["request_command"],
        permissions: ["rag:request"],
        subscribes_to: [],
        emits: [],
        ui_panel: false
      };

      async init(): Promise<void> {}
      async shutdown(): Promise<void> {}
      async health(): Promise<"healthy"> {
        return "healthy";
      }
      async validate(): Promise<void> {}
      async process() {
        return {
          ok: true,
          module: "rag",
          requestId: "r1",
          audit: {
            startedAtUtc: new Date().toISOString(),
            finishedAtUtc: new Date().toISOString()
          }
        };
      }
    }

    const loader = new ModuleLoader();
    await expect(
      loader.load(async () => new BrokenModule() as unknown as TerminalModule)
    ).rejects.toThrow("MODULE_REQUEST_COMMAND_PROCESSOR_MISSING");
  });
});

async function walkTsFiles(root: string): Promise<string[]> {
  const out: string[] = [];
  const stack = [root];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) {
      continue;
    }
    const entries = await readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
      } else if (entry.isFile() && full.endsWith(".ts")) {
        out.push(full);
      }
    }
  }
  return out;
}
