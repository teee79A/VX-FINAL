import {
  RequestedCommand,
  TerminalModule
} from "../../shared/module.contract.js";
import { ModuleManifest } from "../../shared/module.types.js";
import { ResultEnvelope } from "../../shared/result.types.js";
import { ModuleRequest } from "../../shared/terminal.types.js";
import { RagInput, RagOutput } from "./rag.types.js";
import { RagUnit } from "./unit/rag.unit.js";

export class RagModule implements TerminalModule<RagInput, RagOutput> {
  public readonly manifest: ModuleManifest = {
    name: "rag",
    version: "1.0.0",
    capabilities: ["read_context", "emit_event", "request_command", "render_panel"],
    permissions: ["rag:read", "rag:request"],
    subscribes_to: ["terminal.session.opened"],
    emits: ["rag.answer.generated"],
    ui_panel: true
  };

  private readonly unit = new RagUnit();

  async init(): Promise<void> {}
  async shutdown(): Promise<void> {}
  async health(): Promise<"healthy"> {
    return "healthy";
  }
  async validate(request: ModuleRequest<RagInput>): Promise<void> {
    if (request.action.startsWith("exec:")) {
      throw new Error("RAG_DIRECT_EXEC_FORBIDDEN");
    }
    if (!request.payload.query) {
      throw new Error("RAG_QUERY_REQUIRED");
    }
  }
  async process(request: ModuleRequest<RagInput>): Promise<ResultEnvelope<RagOutput>> {
    await this.validate(request);
    return {
      ok: true,
      module: "rag",
      requestId: request.requestId,
      data: await this.unit.run(request.payload),
      audit: {
        startedAtUtc: request.context.issuedAtUtc,
        finishedAtUtc: new Date().toISOString()
      }
    };
  }
  async requestCommand(
    request: ModuleRequest<RagInput>
  ): Promise<ResultEnvelope<RequestedCommand | null>> {
    if (request.payload.op !== "ask") {
      return {
        ok: true,
        module: "rag",
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
      module: "rag",
      requestId: request.requestId,
      data: {
        type: "brain.infer.request",
        target: "vxstation.brain.infer",
        payload: {
          prompt: request.payload.query,
          query: request.payload.query,
          system:
            "You are Kitty Brain inside the VYRDON tower. Respond with concise operator-safe output.",
          maxTokens: 256,
          temperature: 0.2
        },
        reason: "RAG module requesting gated brain inference via command bus"
      },
      audit: {
        startedAtUtc: request.context.issuedAtUtc,
        finishedAtUtc: new Date().toISOString()
      }
    };
  }
}
