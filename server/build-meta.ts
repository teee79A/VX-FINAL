// server/build-meta.ts — Deterministic build metadata for runtime verification.
// Values injected by deploy script into production .env.

import { ENV } from "./env.js";

export const BUILD_META = {
  commit: ENV.gitCommit,
  branch: ENV.gitBranch,
  builtAt: ENV.buildId,
  nodeEnv: ENV.nodeEnv,
  mode: ENV.mode,
  environment: ENV.environment,
  releaseId: ENV.releaseId,
} as const;
