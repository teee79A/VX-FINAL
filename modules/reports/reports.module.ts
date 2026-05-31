import {
  RequestedCommand,
  TerminalModule
} from "../../shared/module.contract.js";
import { ModuleManifest } from "../../shared/module.types.js";
import { ResultEnvelope } from "../../shared/result.types.js";
import { ModuleRequest } from "../../shared/terminal.types.js";
import { ReportsInput, ReportsOutput } from "./reports.types.js";
import { ReportsUnit } from "./unit/reports.unit.js";

export class ReportsModule implements TerminalModule<ReportsInput, ReportsOutput> {
  public readonly manifest: ModuleManifest = {
    name: "reports",
    version: "1.0.0",
    capabilities: ["read_context", "request_command", "render_panel", "emit_event"],
    permissions: ["reports:read", "reports:export"],
    subscribes_to: ["terminal.session.opened"],
    emits: ["reports.generated", "reports.panel.rendered"],
    ui_panel: true
  };

  private readonly unit = new ReportsUnit();

  async init(): Promise<void> {}
  async shutdown(): Promise<void> {}
  async health(): Promise<"healthy"> {
    return "healthy";
  }

  async validate(request: ModuleRequest<ReportsInput>): Promise<void> {
    if (!request.context.actorId) {
      throw new Error("REPORTS_ACTOR_REQUIRED");
    }
    if (request.action.startsWith("exec:")) {
      throw new Error("REPORTS_DIRECT_EXEC_FORBIDDEN");
    }
  }

  async process(
    request: ModuleRequest<ReportsInput>
  ): Promise<ResultEnvelope<ReportsOutput>> {
    await this.validate(request);
    return {
      ok: true,
      module: "reports",
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
      module: "reports",
      requestId: session.requestId,
      data: "reports panel: ready",
      audit: {
        startedAtUtc: session.context.issuedAtUtc,
        finishedAtUtc: new Date().toISOString()
      }
    };
  }

  async requestCommand(
    request: ModuleRequest<ReportsInput>
  ): Promise<ResultEnvelope<RequestedCommand | null>> {
    if (request.payload.op !== "export_status") {
      return {
        ok: true,
        module: "reports",
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
      module: "reports",
      requestId: request.requestId,
      data: {
        type: "reports.export.request",
        target: "vxstation.reports",
        payload: {
          format: request.payload.format
        },
        reason: "Reports module requesting bounded export operation"
      },
      audit: {
        startedAtUtc: request.context.issuedAtUtc,
        finishedAtUtc: new Date().toISOString()
      }
    };
  }
}
