import { ResultEnvelope } from "./result.types.js";

export interface ModuleHost {
  emit(event: { type: string; payload: unknown }): Promise<void>;
  requestCommand(command: {
    type: string;
    target: string;
    payload: Record<string, unknown>;
    reason: string;
    required_capabilities?: string[];
    preferred_node_id?: string;
  }): Promise<ResultEnvelope<{ accepted: boolean; route?: string }>>;
  readScopedState<T>(key: string): Promise<T | null>;
}
