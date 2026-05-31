export type ModuleName =
  | "rag"
  | "memory"
  | "audio"
  | "voice"
  | "calendar"
  | "reports";

export type ModuleCapability =
  | "read_context"
  | "read_memory"
  | "write_memory_local"
  | "read_calendar"
  | "schedule_local"
  | "transcribe_audio"
  | "synthesize_audio"
  | "emit_event"
  | "request_command"
  | "render_panel";

export type ModuleHealth = "healthy" | "degraded" | "failed" | "disabled";

export interface ModuleManifest {
  name: ModuleName;
  version: string;
  capabilities: ModuleCapability[];
  permissions: string[];
  subscribes_to: string[];
  emits: string[];
  ui_panel: boolean;
}
