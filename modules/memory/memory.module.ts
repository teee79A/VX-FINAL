import {
  RequestedCommand,
  TerminalModule
} from "../../shared/module.contract.js";
import { ModuleManifest } from "../../shared/module.types.js";
import { ResultEnvelope } from "../../shared/result.types.js";
import { ModuleRequest } from "../../shared/terminal.types.js";
import { MemoryInput, MemoryOutput } from "./memory.types.js";
import { MemoryUnit } from "./unit/memory.unit.js";

export class MemoryModule implements TerminalModule<MemoryInput, MemoryOutput> {
  public readonly manifest: ModuleManifest = {
    name: "memory",
    version: "1.0.0",
    capabilities: [
      "read_memory",
      "write_memory_local",
      "request_command",
      "render_panel",
      "emit_event"
    ],
    permissions: ["memory:read", "memory:append"],
    subscribes_to: ["terminal.session.opened"],
    emits: ["memory.item.appended", "memory.panel.rendered"],
    ui_panel: true
  };

  private readonly unit = new MemoryUnit();

  async init(): Promise<void> {}
  async shutdown(): Promise<void> {}
  async health(): Promise<"healthy"> {
    return "healthy";
  }

  async validate(request: ModuleRequest<MemoryInput>): Promise<void> {
    if (!request.context.actorId) {
      throw new Error("MEMORY_ACTOR_REQUIRED");
    }
    if (request.action.startsWith("exec:")) {
      throw new Error("MEMORY_DIRECT_EXEC_FORBIDDEN");
    }
    if (request.payload.op === "append" && request.context.terminalMode === "view") {
      throw new Error("MEMORY_VIEW_MODE_CANNOT_APPEND");
    }
  }

  async process(
    request: ModuleRequest<MemoryInput>
  ): Promise<ResultEnvelope<MemoryOutput>> {
    await this.validate(request);
    return {
      ok: true,
      module: "memory",
      requestId: request.requestId,
      data: await this.unit.run(request.payload),
      audit: {
        startedAtUtc: request.context.issuedAtUtc,
        finishedAtUtc: new Date().toISOString()
      }
    };
  }

  async renderPanel(
    session: ModuleRequest<void>
  ): Promise<ResultEnvelope<string>> {
    return {
      ok: true,
      module: "memory",
      requestId: session.requestId,
      data: "memory panel: ready",
      audit: {
        startedAtUtc: session.context.issuedAtUtc,
        finishedAtUtc: new Date().toISOString()
      }
    };
  }

  async requestCommand(
    request: ModuleRequest<MemoryInput>
  ): Promise<ResultEnvelope<RequestedCommand | null>> {
    if (request.payload.op !== "append") {
      return {
        ok: true,
        module: "memory",
        requestId: request.requestId,
        data: null,
        audit: {
          startedAtUtc: request.context.issuedAtUtc,
          finishedAtUtc: new Date().toISOString()
        }
      };
    }

    return {
      ok: true,
      module: "memory",
      requestId: request.requestId,
      data: {
        type: "memory.append.request",
        target: "vxstation.memory",
        payload: {
          sessionId: request.payload.sessionId,
          item: request.payload.item
        },
        reason: "Memory module requested bounded append operation"
      },
      audit: {
        startedAtUtc: request.context.issuedAtUtc,
        finishedAtUtc: new Date().toISOString()
      }
    };
  }
}
