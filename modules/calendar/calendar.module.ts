import {
  RequestedCommand,
  TerminalModule
} from "../../shared/module.contract.js";
import { ModuleManifest } from "../../shared/module.types.js";
import { ModuleRequest } from "../../shared/terminal.types.js";
import { ResultEnvelope } from "../../shared/result.types.js";
import { CalendarInput, CalendarOutput } from "./calendar.types.js";
import { CalendarUnit } from "./unit/calendar.unit.js";

export class CalendarModule
  implements TerminalModule<CalendarInput, CalendarOutput>
{
  public readonly manifest: ModuleManifest = {
    name: "calendar",
    version: "1.0.0",
    capabilities: [
      "read_calendar",
      "schedule_local",
      "request_command",
      "render_panel",
      "emit_event"
    ],
    permissions: ["calendar:read", "calendar:propose"],
    subscribes_to: ["terminal.session.opened"],
    emits: ["calendar.schedule.proposed", "calendar.panel.rendered"],
    ui_panel: true
  };

  private readonly unit = new CalendarUnit();

  async init(): Promise<void> {}

  async shutdown(): Promise<void> {}

  async health(): Promise<"healthy"> {
    return "healthy";
  }

  async validate(request: ModuleRequest<CalendarInput>): Promise<void> {
    if (!request.context.actorId) {
      throw new Error("CALENDAR_INVALID_ACTOR");
    }
    if (
      request.payload.op === "propose_schedule" &&
      request.context.terminalMode === "view"
    ) {
      throw new Error("CALENDAR_VIEW_MODE_CANNOT_PROPOSE");
    }
    if (request.action.startsWith("exec:")) {
      throw new Error("CALENDAR_DIRECT_EXEC_FORBIDDEN");
    }
  }

  async process(
    request: ModuleRequest<CalendarInput>
  ): Promise<ResultEnvelope<CalendarOutput>> {
    await this.validate(request);
    const startedAtUtc = request.context.issuedAtUtc;
    const data = await this.unit.run(request.payload);
    return {
      ok: true,
      module: "calendar",
      requestId: request.requestId,
      data,
      audit: {
        startedAtUtc,
        finishedAtUtc: new Date().toISOString()
      }
    };
  }

  async renderPanel(
    session: ModuleRequest<void>
  ): Promise<ResultEnvelope<string>> {
    return {
      ok: true,
      module: "calendar",
      requestId: session.requestId,
      data: "calendar panel ready",
      audit: {
        startedAtUtc: session.context.issuedAtUtc,
        finishedAtUtc: new Date().toISOString()
      }
    };
  }

  async requestCommand(
    request: ModuleRequest<CalendarInput>
  ): Promise<ResultEnvelope<RequestedCommand | null>> {
    const startedAtUtc = request.context.issuedAtUtc;
    if (request.payload.op !== "propose_schedule") {
      return {
        ok: true,
        module: "calendar",
        requestId: request.requestId,
        data: null,
        audit: {
          startedAtUtc,
          finishedAtUtc: new Date().toISOString()
        }
      };
    }

    return {
      ok: true,
      module: "calendar",
      requestId: request.requestId,
      data: {
        type: "calendar.state.upsert",
        target: "vxstation.bridge.calendar",
        payload: {
          atUtc: request.payload.atUtc,
          title: request.payload.title
        },
        reason: "Operator requested new schedule proposal",
        required_capabilities: ["calendar.state"]
      },
      audit: {
        startedAtUtc,
        finishedAtUtc: new Date().toISOString()
      }
    };
  }
}
