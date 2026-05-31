import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { CommandEnvelope } from "./command.types.js";

const KITTY_ROOT = process.env.KITTY_ROOT ?? path.join(import.meta.dirname, "..");
const DEFAULT_BACKBONE_DIR = path.join(KITTY_ROOT, "evidence/journal/command_backbone");

type CommandStatus = "ACCEPTED" | "REJECTED";
export type EvidenceType =
  | "ACCEPTED"
  | "REJECTED"
  | "REPLAY_DETECTED"
  | "IDEMPOTENCY_CONFLICT"
  | "NONCE_REUSED"
  | "TIME_WINDOW_EXCEEDED"
  | "CAUSAL_CHAIN_MISMATCH";

export interface CommandRow {
  command_id: string;
  idempotency_key: string;
  fingerprint: string;
  status: CommandStatus;
  payload_hash: string;
  causal_hash: string;
  actor_id: string;
  issued_at: number;
  intent: string;
  parent_command_id?: string;
}

export interface CommandLockRow {
  idempotency_key: string;
  command_id: string;
  locked_at: number;
}

export interface NonceRow {
  nonce: string;
  command_id: string;
  expires_at: number;
}

export interface EvidenceRow {
  evidence_id: string;
  command_id: string;
  type: EvidenceType;
  data: Record<string, unknown>;
  created_at: number;
}

interface BackboneState {
  commands: CommandRow[];
  command_locks: CommandLockRow[];
  nonces: NonceRow[];
  evidence: EvidenceRow[];
}

export class CommandBackbone {
  private readonly baseDir: string;
  private queue: Promise<void> = Promise.resolve();

  constructor(baseDir = process.env.KITTY_COMMAND_BACKBONE_DIR || DEFAULT_BACKBONE_DIR) {
    this.baseDir = baseDir;
  }

  async findCommandByIdempotencyKey(idempotencyKey: string): Promise<CommandRow | undefined> {
    const state = await this.loadState();
    return state.commands.find((row) => row.idempotency_key === idempotencyKey);
  }

  async existsFingerprint(fingerprint: string): Promise<boolean> {
    const state = await this.loadState();
    return state.commands.some((row) => row.fingerprint === fingerprint);
  }

  async findNonce(nonce: string): Promise<NonceRow | undefined> {
    const state = await this.loadState();
    return state.nonces.find((row) => row.nonce === nonce);
  }

  async findCommandById(commandId: string): Promise<CommandRow | undefined> {
    const state = await this.loadState();
    return state.commands.find((row) => row.command_id === commandId);
  }

  async purgeExpiredNonces(now = Date.now()): Promise<void> {
    await this.withWrite(async (state) => {
      state.nonces = state.nonces.filter((row) => row.expires_at > now);
    });
  }

  async insertAccepted(command: CommandEnvelope, now = Date.now()): Promise<void> {
    await this.withWrite(async (state) => {
      const existingLock = state.command_locks.find(
        (row) => row.idempotency_key === command.idempotency_key,
      );
      if (existingLock) {
        throw new Error("IDEMPOTENCY_LOCKED");
      }

      const existingCommand = state.commands.find(
        (row) => row.idempotency_key === command.idempotency_key,
      );
      if (existingCommand) {
        throw new Error("IDEMPOTENCY_CONFLICT");
      }

      if (state.nonces.some((row) => row.nonce === command.nonce)) {
        throw new Error("NONCE_REUSED");
      }

      if (state.commands.some((row) => row.fingerprint === command.fingerprint)) {
        throw new Error("FINGERPRINT_DUPLICATE");
      }

      state.command_locks.push({
        idempotency_key: command.idempotency_key,
        command_id: command.command_id,
        locked_at: now,
      });

      const row: (typeof state.commands)[0] = {
        command_id: command.command_id,
        idempotency_key: command.idempotency_key,
        fingerprint: command.fingerprint,
        status: "ACCEPTED",
        payload_hash: command.payload_hash,
        causal_hash: command.causal_hash,
        actor_id: command.actor_id,
        issued_at: command.issued_at,
        intent: command.intent,
        ...(command.parent_command_id ? { parent_command_id: command.parent_command_id } : {}),
      };
      state.commands.push(row);

      state.nonces.push({
        nonce: command.nonce,
        command_id: command.command_id,
        expires_at: command.issued_at + command.replay_window_ms,
      });
    });
  }

  async insertRejected(command: CommandEnvelope, _now = Date.now()): Promise<void> {
    await this.withWrite(async (state) => {
      if (state.commands.some((row) => row.command_id === command.command_id)) {
        return;
      }
      const rejectedRow: (typeof state.commands)[0] = {
        command_id: command.command_id,
        idempotency_key: command.idempotency_key,
        fingerprint: command.fingerprint,
        status: "REJECTED",
        payload_hash: command.payload_hash,
        causal_hash: command.causal_hash,
        actor_id: command.actor_id,
        issued_at: command.issued_at,
        intent: command.intent,
        ...(command.parent_command_id ? { parent_command_id: command.parent_command_id } : {}),
      };
      state.commands.push(rejectedRow);
      if (!state.nonces.some((row) => row.nonce === command.nonce)) {
        state.nonces.push({
          nonce: command.nonce,
          command_id: command.command_id,
          expires_at: command.issued_at + command.replay_window_ms,
        });
      }
    });
  }

  async insertEvidence(
    commandId: string,
    type: EvidenceType,
    data: Record<string, unknown>,
    now = Date.now(),
  ): Promise<void> {
    await this.withWrite(async (state) => {
      state.evidence.push({
        evidence_id: `${commandId}:${type}:${now}`,
        command_id: commandId,
        type,
        data,
        created_at: now,
      });
    });
  }

  private async withWrite(fn: (state: BackboneState) => Promise<void> | void): Promise<void> {
    const run = this.queue.then(async () => {
      const state = await this.loadState();
      await fn(state);
      await this.saveState(state);
    });
    this.queue = run.catch(() => undefined);
    await run;
  }

  private async loadState(): Promise<BackboneState> {
    await mkdir(this.baseDir, { recursive: true });
    const [commands, commandLocks, nonces, evidence] = await Promise.all([
      this.readTable<CommandRow[]>("commands.json", []),
      this.readTable<CommandLockRow[]>("command_locks.json", []),
      this.readTable<NonceRow[]>("nonces.json", []),
      this.readTable<EvidenceRow[]>("evidence.json", []),
    ]);
    return {
      commands,
      command_locks: commandLocks,
      nonces,
      evidence,
    };
  }

  private async saveState(state: BackboneState): Promise<void> {
    await mkdir(this.baseDir, { recursive: true });
    await Promise.all([
      this.writeTable("commands.json", state.commands),
      this.writeTable("command_locks.json", state.command_locks),
      this.writeTable("nonces.json", state.nonces),
      this.writeTable("evidence.json", state.evidence),
    ]);
  }

  private async readTable<T>(fileName: string, fallback: T): Promise<T> {
    const filePath = path.join(this.baseDir, fileName);
    try {
      const raw = await readFile(filePath, "utf8");
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  }

  private async writeTable(fileName: string, value: unknown): Promise<void> {
    const filePath = path.join(this.baseDir, fileName);
    const tmpFilePath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
    await writeFile(tmpFilePath, JSON.stringify(value, null, 2), "utf8");
    await rename(tmpFilePath, filePath);
  }
}
