import { ModuleRegistry } from "../registry/module.registry.js";
import { ModuleRequest } from "../shared/terminal.types.js";
import { ResultEnvelope } from "../shared/result.types.js";
import { ModuleWrapper } from "../wrappers/module.wrapper.js";
import { TerminalPolicy } from "../policy/terminal.policy.js";
import { CommandBus } from "../command-bus/command.bus.js";
import { appendFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { RouteController } from "./route.controller.js";
import { LayoutController } from "./layout.controller.js";
import { HotkeyController } from "./hotkey.controller.js";
import { EventStream } from "./event.stream.js";
import { SafeCommand } from "../command-bus/command.types.js";

const KITTY_ROOT =
  process.env.KITTY_ROOT ?? path.join(import.meta.dirname, "..");
const MODULE_JOURNAL_FILE =
  process.env.KITTY_JOURNAL_FILE ??
  path.join(KITTY_ROOT, "evidence/journal/module_actions.jsonl");
const COMMAND_AUDIT_FILE =
  process.env.KITTY_AUDIT_FILE ??
  path.join(KITTY_ROOT, "evidence/journal/command_bus.audit.jsonl");
const OPS_STATUS_FILE =
  process.env.KITTY_OPS_STATUS ??
  path.join(KITTY_ROOT, "OPERATION_ROOM/monitoring/latest_status.json");

export interface TowerSnapshot {
  generatedAtUtc: string;
  radar: {
    overallStatus: "green" | "yellow" | "red";
    lanesOnline: number;
    lanesTotal: number;
    commandGate: {
      accepted: number;
      denied: number;
    };
    opsRegistryStatus: string;
    aiLaneReady: boolean;
  };
  lanes: Array<{
    id: string;
    label: string;
    purpose: string;
    priority: "critical" | "high" | "normal";
    online: boolean;
    root: string;
  }>;
  hotkeys: Array<{
    key: string;
    action: string;
    lane: string;
    risk: "safe" | "guarded";
  }>;
  evidence: {
    moduleJournal: string;
    commandAudit: string;
  };
}

export class TerminalShell {
  private readonly policy = new TerminalPolicy();
  private readonly commandBus = new CommandBus();
  private readonly routes = new RouteController();
  private readonly layout = new LayoutController();
  private readonly hotkeys = new HotkeyController();
  private readonly events = new EventStream();

  constructor(private readonly registry: ModuleRegistry) {}

  async process<TIn, TOut>(
    request: ModuleRequest<TIn>
  ): Promise<ResultEnvelope<TOut>> {
    const mod = this.registry.get(request.module);
    const wrapper = new ModuleWrapper(this.policy, mod);
    const result = await wrapper.process<TIn, TOut>(request);

    if (!result.audit.evidenceRef) {
      result.audit.evidenceRef = `kitty.module.${request.module}.${request.requestId}`;
    }

    let commandOutcome:
      | ResultEnvelope<{ accepted: boolean; route?: string }>
      | undefined;

    if (typeof mod.requestCommand === "function") {
      const commandRequest = await mod.requestCommand(request);
      if (commandRequest.ok && commandRequest.data) {
        await this.policy.assertCommandRequest(
          mod.manifest,
          request,
          commandRequest.data
        );
        commandOutcome = await this.commandBus.submit({
          ...commandRequest.data,
          source: `module:${mod.manifest.name}`
        });
        if (!commandOutcome.ok || !commandOutcome.data?.accepted) {
          throw new Error("MODULE_REQUESTED_COMMAND_REJECTED_BY_COMMAND_BUS");
        }
      }
    }

    await this.writeEvidence({
      timestamp: new Date().toISOString(),
      requestId: request.requestId,
      module: request.module,
      action: request.action,
      actorId: request.context.actorId,
      actorRole: request.context.actorRole,
      evidenceRef: result.audit.evidenceRef,
      commandBus: commandOutcome?.data ?? null
    });
    this.events.emit("tower.module.processed", {
      module: request.module,
      requestId: request.requestId,
      action: request.action
    });

    return result;
  }

  async gateOperatorCommand(
    command: Omit<SafeCommand, "source">
  ): Promise<ResultEnvelope<{ accepted: boolean; route?: string }>> {
    const outcome = await this.commandBus.submit({
      ...command,
      source: "operator"
    });
    this.events.emit("tower.operator.command", {
      type: command.type,
      target: command.target,
      accepted: Boolean(outcome.data?.accepted)
    });
    return outcome;
  }

  async radarSnapshot(): Promise<TowerSnapshot> {
    const generatedAtUtc = new Date().toISOString();
    const [laneStatuses, gateCounts, opsStatus] = await Promise.all([
      this.routes.status(),
      this.readCommandGateCounts(),
      this.readOpsRegistryStatus()
    ]);

    const layoutById = new Map(this.layout.lanes().map((lane) => [lane.id, lane]));
    const lanes = laneStatuses.map((route) => {
      const lane = layoutById.get(route.lane);
      return {
        id: route.lane,
        label: lane?.label ?? route.label,
        purpose: lane?.purpose ?? "lane status",
        priority: lane?.priority ?? "normal",
        online: route.online,
        root: route.root
      };
    });

    const lanesOnline = lanes.filter((lane) => lane.online).length;
    const lanesTotal = lanes.length;
    const opsState = this.normalizeOpsStatus(opsStatus.overallStatus);
    const gateState = gateCounts.denied > 0 ? "yellow" : "green";
    const laneState = lanesOnline === lanesTotal ? "green" : "yellow";
    const overallStatus = this.maxSeverity([opsState, gateState, laneState]);
    const aiLane = lanes.find((lane) => lane.id === "lane_06_lab");
    const aiLaneReady = Boolean(aiLane?.online);

    this.events.heartbeat(overallStatus, {
      lanes_online: lanesOnline,
      lanes_total: lanesTotal,
      command_accepts: gateCounts.accepted,
      command_denials: gateCounts.denied
    });

    return {
      generatedAtUtc,
      radar: {
        overallStatus,
        lanesOnline,
        lanesTotal,
        commandGate: gateCounts,
        opsRegistryStatus: opsStatus.overallStatus,
        aiLaneReady
      },
      lanes,
      hotkeys: this.hotkeys.list(),
      evidence: {
        moduleJournal: MODULE_JOURNAL_FILE,
        commandAudit: COMMAND_AUDIT_FILE
      }
    };
  }

  liveFeed(limit = 20) {
    return this.events.recentEvents(limit);
  }

  private async writeEvidence(record: Record<string, unknown>): Promise<void> {
    await mkdir(path.dirname(MODULE_JOURNAL_FILE), { recursive: true });
    await appendFile(MODULE_JOURNAL_FILE, `${JSON.stringify(record)}\n`, "utf8");
  }

  private async readCommandGateCounts(): Promise<{ accepted: number; denied: number }> {
    let text = "";
    try {
      text = await readFile(COMMAND_AUDIT_FILE, "utf8");
    } catch {
      return { accepted: 0, denied: 0 };
    }

    const lines = text
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    let accepted = 0;
    let denied = 0;
    for (const line of lines) {
      try {
        const parsed = JSON.parse(line) as {
          receipt?: { accepted?: boolean };
        };
        if (parsed.receipt?.accepted) {
          accepted += 1;
        } else {
          denied += 1;
        }
      } catch {
        denied += 1;
      }
    }
    return { accepted, denied };
  }

  private async readOpsRegistryStatus(): Promise<{ overallStatus: string }> {
    try {
      const raw = await readFile(OPS_STATUS_FILE, "utf8");
      const parsed = JSON.parse(raw) as { overall_status?: string };
      return {
        overallStatus: parsed.overall_status ?? "unknown"
      };
    } catch {
      return { overallStatus: "unknown" };
    }
  }

  private normalizeOpsStatus(
    status: string
  ): "green" | "yellow" | "red" {
    if (status === "healthy") {
      return "green";
    }
    if (status === "degraded" || status === "unknown") {
      return "yellow";
    }
    return "red";
  }

  private maxSeverity(
    states: Array<"green" | "yellow" | "red">
  ): "green" | "yellow" | "red" {
    if (states.includes("red")) {
      return "red";
    }
    if (states.includes("yellow")) {
      return "yellow";
    }
    return "green";
  }
}
