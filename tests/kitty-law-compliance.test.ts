import { describe, expect, it } from "vitest";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

const KITTY_ROOT = process.env.KITTY_ROOT ?? path.join(import.meta.dirname, "..");
const MODULES = ["rag", "memory", "audio", "voice", "calendar", "reports"];

describe("KITTY law and role compliance", () => {
  it("keeps required base structure", async () => {
    const requiredDirs = [
      "shell",
      "registry",
      "policy",
      "command-bus",
      "bridge",
      "state",
      "dispatch",
      "terminal",
      "wrappers",
      "modules",
      "shared",
      "tests"
    ];

    for (const rel of requiredDirs) {
      const full = path.join(KITTY_ROOT, rel);
      const info = await stat(full);
      expect(info.isDirectory()).toBe(true);
    }
  });

  it("keeps required module set", async () => {
    for (const mod of MODULES) {
      const info = await stat(path.join(KITTY_ROOT, "modules", mod));
      expect(info.isDirectory()).toBe(true);
    }
  });

  it("enforces file law across modules and wrappers", async () => {
    for (const mod of MODULES) {
      const modRoot = path.join(KITTY_ROOT, "modules", mod);

      await expectFile(path.join(modRoot, `${mod}.module.ts`));
      await expectAnyWithSuffix(path.join(modRoot, "processor"), ".processor.ts");
      await expectAnyWithSuffix(path.join(modRoot, "gateway"), ".gateway.ts");
      await expectAnyWithSuffix(
        path.join(modRoot, "interceptor"),
        ".interceptor.ts"
      );
      await expectAnyWithSuffix(path.join(modRoot, "unit"), ".unit.ts");
    }

    await expectAnyWithSuffix(path.join(KITTY_ROOT, "wrappers"), ".wrapper.ts");
  });

  it("enforces module law: no execute/seal, no command-bus bypass, no raw DB imports", async () => {
    const forbiddenRegexes = [
      /\bexecute\s*\(/,
      /\bseal\s*\(/,
      /from\s+["'].*command-bus\/.*["']/,
      /from\s+["']pg["']/,
      /from\s+["']pg-pool["']/,
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
      const tsFiles = await walkTsFiles(path.join(KITTY_ROOT, "modules", mod));
      for (const file of tsFiles) {
        if (file.includes("/tests/")) {
          continue;
        }
        const content = await readFile(file, "utf8");
        for (const pattern of forbiddenRegexes) {
          expect(pattern.test(content)).toBe(false);
        }
      }
    }
  });

  it("enforces 4-table backbone for each module", async () => {
    for (const mod of MODULES) {
      const tablesRoot = path.join(KITTY_ROOT, "modules", mod, "tables");
      const required = [
        `${mod}_summary.sql`,
        `${mod}_status_reasons.sql`,
        `${mod}_change_events.sql`,
        `${mod}_actions.sql`
      ];

      for (const rel of required) {
        const full = path.join(tablesRoot, rel);
        const info = await stat(full);
        expect(info.size).toBeGreaterThan(0);
      }
    }
  });

  it("enforces evidence-first command and module journal writers", async () => {
    const busAudit = await readFile(
      path.join(KITTY_ROOT, "command-bus", "command.audit.ts"),
      "utf8"
    );
    expect(busAudit.includes("command_bus.audit.jsonl")).toBe(true);
    expect(busAudit.includes("appendFile")).toBe(true);

    const shell = await readFile(
      path.join(KITTY_ROOT, "shell", "terminal.shell.ts"),
      "utf8"
    );
    expect(shell.includes("module_actions.jsonl")).toBe(true);
    expect(shell.includes("if (!result.audit.evidenceRef)")).toBe(true);
    expect(shell.includes("writeEvidence")).toBe(true);
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

async function expectFile(fullPath: string): Promise<void> {
  const info = await stat(fullPath);
  expect(info.isFile()).toBe(true);
}

async function expectAnyWithSuffix(dirPath: string, suffix: string): Promise<void> {
  const entries = await readdir(dirPath, { withFileTypes: true });
  const hasMatch = entries.some(
    (entry) => entry.isFile() && entry.name.endsWith(suffix)
  );
  expect(hasMatch).toBe(true);
}
