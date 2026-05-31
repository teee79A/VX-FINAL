// ENGINES/infra/index.ts
import { BaseEngine } from "../base.js";
import type { EngineContext } from "../types.js";
import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

const DOCKER_ACTIONS = new Set(["ps", "images", "info", "version", "stats --no-stream", "network ls", "volume ls"]);
const SYSTEMD_ACTIONS = new Set(["status", "is-active", "is-enabled", "list-units", "list-timers", "show"]);
const SYSTEMD_UNIT_RE = /^[a-zA-Z0-9@._-]+$/;
const HEALTHCHECK_TARGET_RE = /^[a-zA-Z0-9._-]+:\d{1,5}$/;

export class InfraCore extends BaseEngine {
  readonly id = "infra_core";
  readonly type = "infra" as const;
  readonly description = "Infrastructure reasoning and planning";
  protected async run(_: unknown, ctx: EngineContext) {
    return { ready: true, root: ctx.stationRoot };
  }
}

export class CIPipeline extends BaseEngine {
  readonly id = "ci_pipeline";
  readonly type = "infra" as const;
  readonly description = "CI/CD pipeline management and execution";
  protected async run(input: unknown, ctx: EngineContext) {
    const cmd = (input as { command?: string })?.command ?? "check";
    try {
      const { stdout } = await execAsync(`npm run ci:mandatory 2>&1`, {
        cwd: ctx.stationRoot,
        timeout: 120000,
      });
      return { command: cmd, output: stdout.slice(-2000), pass: true };
    } catch (e: unknown) {
      return { command: cmd, pass: false, error: String(e).slice(-1000) };
    }
  }
}

export class DockerManager extends BaseEngine {
  readonly id = "docker_manager";
  readonly type = "infra" as const;
  readonly description = "Docker image building, registry, orchestration";
  protected async run(input: unknown, _ctx: EngineContext) {
    const action = (input as { action?: string })?.action ?? "ps";
    if (!DOCKER_ACTIONS.has(action)) {
      return { action, error: "ACTION_NOT_ALLOWED" };
    }
    try {
      const { stdout } = await execAsync(`docker ${action} 2>&1`, { timeout: 15000 });
      return { action, output: stdout.trim() };
    } catch {
      return { action, error: "docker_not_available" };
    }
  }
}

export class SystemdManager extends BaseEngine {
  readonly id = "systemd_manager";
  readonly type = "infra" as const;
  readonly description = "Systemd unit management — start, stop, enable, status";
  protected async run(input: unknown, _ctx: EngineContext) {
    const unit = (input as { unit?: string })?.unit ?? "";
    const action = (input as { action?: string })?.action ?? "status";
    if (!SYSTEMD_ACTIONS.has(action)) {
      return { unit, action, error: "ACTION_NOT_ALLOWED" };
    }
    if (unit && !SYSTEMD_UNIT_RE.test(unit)) {
      return { unit, action, error: "INVALID_UNIT_NAME" };
    }
    try {
      const { stdout } = await execAsync(`systemctl ${action} ${unit} 2>&1`, { timeout: 10000 });
      return { unit, action, output: stdout.trim() };
    } catch (e: unknown) {
      return { unit, action, error: String(e).slice(-500) };
    }
  }
}

export class NginxConfig extends BaseEngine {
  readonly id = "nginx_config";
  readonly type = "infra" as const;
  readonly description = "Nginx configuration generation and reload";
  protected async run(input: unknown, _ctx: EngineContext) {
    const action = (input as { action?: string })?.action ?? "test";
    try {
      const { stdout } = await execAsync(`nginx -t 2>&1`, { timeout: 5000 });
      return { action, valid: true, output: stdout.trim() };
    } catch {
      return { action, valid: false };
    }
  }
}

export class CloudflaredTunnel extends BaseEngine {
  readonly id = "cloudflared_tunnel";
  readonly type = "infra" as const;
  readonly description = "Cloudflare Tunnel lifecycle and routing";
  protected async run(input: unknown, _ctx: EngineContext) {
    const action = (input as { action?: string })?.action ?? "status";
    try {
      const { stdout } = await execAsync(`cloudflared tunnel list 2>&1`, { timeout: 10000 });
      return { action, tunnels: stdout.trim() };
    } catch {
      return { action, error: "cloudflared_not_available" };
    }
  }
}

export class TailscaleBridge extends BaseEngine {
  readonly id = "tailscale_bridge";
  readonly type = "infra" as const;
  readonly description = "Tailscale mesh network management between nodes";
  protected async run(_input: unknown, _ctx: EngineContext) {
    try {
      const { stdout } = await execAsync(`tailscale status --json 2>/dev/null`, { timeout: 10000 });
      return JSON.parse(stdout);
    } catch {
      return { error: "tailscale_not_available" };
    }
  }
}

export class Healthcheck extends BaseEngine {
  readonly id = "healthcheck";
  readonly type = "infra" as const;
  readonly description = "Service health checks and uptime monitoring";
  override readonly feeds = ["radar"];
  protected async run(input: unknown, _ctx: EngineContext) {
    const targets = (input as { targets?: string[] })?.targets ?? [
      "localhost:7700",
      "localhost:7710",
    ];
    const results: Record<string, boolean> = {};
    for (const t of targets) {
      if (!HEALTHCHECK_TARGET_RE.test(t)) {
        results[t] = false;
        continue;
      }
      try {
        await execAsync(`curl -sf --max-time 3 http://${t}/health 2>/dev/null`, { timeout: 4000 });
        results[t] = true;
      } catch {
        results[t] = false;
      }
    }
    return { results, allHealthy: Object.values(results).every(Boolean) };
  }
}

export class LogCollector extends BaseEngine {
  readonly id = "log_collector";
  readonly type = "infra" as const;
  readonly description = "Log aggregation and structured event collection";
  protected async run(input: unknown, _ctx: EngineContext) {
    const rawLines = (input as { lines?: number })?.lines ?? 100;
    const lines = Math.max(1, Math.min(10000, Math.floor(Number(rawLines) || 100)));
    try {
      const { stdout } = await execAsync(
        `journalctl --no-pager -n ${lines} --output=json 2>/dev/null | tail -${lines}`,
        { encoding: "utf-8", timeout: 10000 },
      );
      return { lines: stdout.split("\n").length, sample: stdout.slice(0, 2000) };
    } catch {
      return { error: "journalctl_not_available" };
    }
  }
}

export class SnapshotManager extends BaseEngine {
  readonly id = "snapshot_manager";
  readonly type = "infra" as const;
  readonly description = "DO droplet and volume snapshot management";
  protected async run(input: unknown, ctx: EngineContext) {
    const action = (input as { action?: string })?.action ?? "list";
    return { action, provider: "digitalocean", timestamp: ctx.timestamp };
  }
}

export class RollbackEngine extends BaseEngine {
  readonly id = "rollback_engine";
  readonly type = "infra" as const;
  readonly description = "Service and deployment rollback execution";
  protected async run(input: unknown, ctx: EngineContext) {
    const target = (input as { target?: string })?.target ?? "";
    const version = (input as { version?: string })?.version ?? "previous";
    return { target, version, status: "ready", timestamp: ctx.timestamp };
  }
}

export class CanaryDeploy extends BaseEngine {
  readonly id = "canary_deploy";
  readonly type = "infra" as const;
  readonly description = "Canary deployment with automatic rollback triggers";
  override readonly feeds = ["healthcheck", "rollback_engine"];
  protected async run(input: unknown, ctx: EngineContext) {
    const service = (input as { service?: string })?.service ?? "";
    return { service, canary_percent: 10, status: "staged", timestamp: ctx.timestamp };
  }
}
