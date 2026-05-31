import {
  RequestedCommand,
  TerminalModule
} from "../../shared/module.contract.js";
import { ModuleManifest } from "../../shared/module.types.js";
import { ResultEnvelope } from "../../shared/result.types.js";
import { ModuleRequest } from "../../shared/terminal.types.js";
import { AudioInput, AudioOutput } from "./audio.types.js";
import { AudioUnit } from "./unit/audio.unit.js";

export class AudioModule implements TerminalModule<AudioInput, AudioOutput> {
  public readonly manifest: ModuleManifest = {
    name: "audio",
    version: "1.0.0",
    capabilities: [
      "transcribe_audio",
      "request_command",
      "render_panel",
      "emit_event"
    ],
    permissions: ["audio:transcribe", "audio:read"],
    subscribes_to: ["terminal.session.opened"],
    emits: ["audio.transcribed", "audio.panel.rendered"],
    ui_panel: true
  };

  private readonly unit = new AudioUnit();

  async init(): Promise<void> {}
  async shutdown(): Promise<void> {}
  async health(): Promise<"healthy"> {
    return "healthy";
  }

  async validate(request: ModuleRequest<AudioInput>): Promise<void> {
    if (!request.context.actorId) {
      throw new Error("AUDIO_ACTOR_REQUIRED");
    }
    if (request.action.startsWith("exec:")) {
      throw new Error("AUDIO_DIRECT_EXEC_FORBIDDEN");
    }
  }

  async process(
    request: ModuleRequest<AudioInput>
  ): Promise<ResultEnvelope<AudioOutput>> {
    await this.validate(request);
    return {
      ok: true,
      module: "audio",
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
      module: "audio",
      requestId: session.requestId,
      data: "audio panel: ready",
      audit: {
        startedAtUtc: session.context.issuedAtUtc,
        finishedAtUtc: new Date().toISOString()
      }
    };
  }

  async requestCommand(
    request: ModuleRequest<AudioInput>
  ): Promise<ResultEnvelope<RequestedCommand | null>> {
    if (request.payload.op !== "transcribe_chunk") {
      return {
        ok: true,
        module: "audio",
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
      module: "audio",
      requestId: request.requestId,
      data: {
        type: "audio.transcribe.request",
        target: "vyrdx.boundary.request",
        payload: {
          roomId: request.payload.roomId,
          chunkId: request.payload.chunkId
        },
        reason: "Audio module requesting bounded transcription execution path"
      },
      audit: {
        startedAtUtc: request.context.issuedAtUtc,
        finishedAtUtc: new Date().toISOString()
      }
    };
  }
}
