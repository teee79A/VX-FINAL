import {
  bootstrapRuntimeMode,
  getRuntimeModeSnapshot,
  refreshRuntimeMode,
  requirePrimaryDbMode,
  RuntimeModeError,
  startRuntimeModeMonitor,
  stopRuntimeModeMonitor,
  type RuntimeMode,
  type RuntimeModeSnapshot,
} from "../db/mode.js";

export type { RuntimeMode, RuntimeModeSnapshot };

export const runtimeModeService = {
  bootstrapRuntimeMode,
  getRuntimeModeSnapshot,
  refreshRuntimeMode,
  requirePrimaryDbMode,
  RuntimeModeError,
  startRuntimeModeMonitor,
  stopRuntimeModeMonitor,
};

export function isRuntimeMode(mode: RuntimeMode): boolean {
  return runtimeModeService.getRuntimeModeSnapshot().runtimeMode === mode;
}

