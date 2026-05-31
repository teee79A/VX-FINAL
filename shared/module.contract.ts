import { ModuleHealth, ModuleManifest } from "./module.types.js";
import { ModuleRequest } from "./terminal.types.js";
import { ResultEnvelope } from "./result.types.js";

export interface RequestedCommand {
  type: string;
  target: string;
  payload: Record<string, unknown>;
  reason: string;
  required_capabilities?: string[];
  preferred_node_id?: string;
}

export interface TerminalModule<TInput = unknown, TOutput = unknown> {
  readonly manifest: ModuleManifest;

  init(): Promise<void>;
  shutdown(): Promise<void>;

  health(): Promise<ModuleHealth>;

  validate(request: ModuleRequest<TInput>): Promise<void>;

  process(request: ModuleRequest<TInput>): Promise<ResultEnvelope<TOutput>>;

  renderPanel?(session: ModuleRequest<void>): Promise<ResultEnvelope<string>>;

  requestCommand?(
    request: ModuleRequest<TInput>
  ): Promise<ResultEnvelope<RequestedCommand | null>>;
}
