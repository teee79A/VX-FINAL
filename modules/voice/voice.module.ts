import {
  RequestedCommand,
  TerminalModule
} from "../../shared/module.contract.js";
import { ModuleManifest } from "../../shared/module.types.js";
import { ResultEnvelope } from "../../shared/result.types.js";
import { ModuleRequest } from "../../shared/terminal.types.js";
import { VoiceInput, VoiceOutput } from "./voice.types.js";
import { VoiceUnit } from "./unit/voice.unit.js";

export class VoiceModule implements TerminalModule<VoiceInput, VoiceOutput> {
  public readonly manifest: ModuleManifest = {
    name: "voice",
    version: "1.0.0",
    capabilities: [
      "synthesize_audio",
      "request_command",
      "render_panel",
      "emit_event"
    ],
    permissions: ["voice:synthesize", "voice:route"],
    subscribes_to: ["terminal.session.opened"],
    emits: ["voice.synthesized", "voice.panel.rendered"],
    ui_panel: true
  };

  private readonly unit = new VoiceUnit();

  async init(): Promise<void> {}
  async shutdown(): Promise<void> {}
  async health(): Promise<"healthy"> {
    return "healthy";
  }

  async validate(request: ModuleRequest<VoiceInput>): Promise<void> {
    if (!request.context.actorId) {
      throw new Error("VOICE_ACTOR_REQUIRED");
    }
    if (request.action.startsWith("exec:")) {
      throw new Error("VOICE_DIRECT_EXEC_FORBIDDEN");
    }
  }

  async process(
    request: ModuleRequest<VoiceInput>
  ): Promise<ResultEnvelope<VoiceOutput>> {
    await this.validate(request);
    return {
      ok: true,
      module: "voice",
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
      module: "voice",
      requestId: session.requestId,
      data: "voice panel: ready",
      audit: {
        startedAtUtc: session.context.issuedAtUtc,
        finishedAtUtc: new Date().toISOString()
      }
    };
  }

  async requestCommand(
    request: ModuleRequest<VoiceInput>
  ): Promise<ResultEnvelope<RequestedCommand | null>> {
    if (request.payload.op !== "synthesize") {
      return {
        ok: true,
        module: "voice",
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
      module: "voice",
      requestId: request.requestId,
      data: {
        type: "voice.synthesize.request",
        target: "vyrdx.boundary.request",
        payload: {
          text: request.payload.text,
          voiceProfile: request.payload.voiceProfile
        },
        reason: "Voice module requesting bounded synthesis execution path"
      },
      audit: {
        startedAtUtc: request.context.issuedAtUtc,
        finishedAtUtc: new Date().toISOString()
      }
    };
  }
}
