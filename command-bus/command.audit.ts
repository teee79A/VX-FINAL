import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { CommandReceipt, SafeCommand } from "./command.types.js";

const KITTY_ROOT = process.env.KITTY_ROOT ?? path.join(import.meta.dirname, "..");
const AUDIT_FILE =
  process.env.KITTY_COMMAND_AUDIT_FILE ??
  path.join(KITTY_ROOT, "evidence/journal/command_bus.audit.jsonl");

export class CommandAudit {
  async write(command: SafeCommand, receipt: CommandReceipt): Promise<void> {
    await mkdir(path.dirname(AUDIT_FILE), { recursive: true });
    const record = {
      timestamp: new Date().toISOString(),
      command,
      receipt
    };
    await appendFile(AUDIT_FILE, `${JSON.stringify(record)}\n`, "utf8");
  }
}
