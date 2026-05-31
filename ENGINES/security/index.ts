// ENGINES/security/index.ts
import { BaseEngine } from "../base.js";
import type { EngineContext } from "../types.js";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { readFile } from "node:fs/promises";

const execAsync = promisify(exec);

export class Blackhat extends BaseEngine {
  readonly id = "blackhat";
  readonly type = "security" as const;
  readonly description = "Offensive security simulation — finds exploitable paths";
  override readonly feeds = ["threat_model", "risk_register"];

  protected async run(input: unknown, ctx: EngineContext) {
    const target = (input as { target?: string })?.target ?? "localhost";
    const scope = (input as { scope?: string })?.scope ?? "recon";
    return { target, scope, phase: "recon", timestamp: ctx.timestamp };
  }
}

export class Redhat extends BaseEngine {
  readonly id = "redhat";
  readonly type = "security" as const;
  readonly description = "Defensive posture analysis — hardens surfaces";
  override readonly feeds = ["threat_model"];

  protected async run(input: unknown, ctx: EngineContext) {
    const checks = ["firewall", "selinux", "sshd", "fail2ban", "unattended-upgrades"];
    const results: Record<string, boolean> = {};
    for (const c of checks) {
      try {
        await execAsync(`systemctl is-active ${c}`);
        results[c] = true;
      } catch {
        results[c] = false;
      }
    }
    return { posture: results, timestamp: ctx.timestamp };
  }
}

export class PerimeterScan extends BaseEngine {
  readonly id = "perimeter_scan";
  readonly type = "security" as const;
  readonly description = "Network perimeter enumeration and port audit";
  override readonly feeds = ["threat_model", "radar"];

  private sanitizeTarget(target: string): string {
    // Strict validation: only allow valid hostname/IP — no shell metacharacters
    if (!/^[a-zA-Z0-9._-]+$/.test(target)) {
      throw new Error("INVALID_TARGET");
    }
    return target;
  }

  private sanitizePorts(ports: string): string {
    // Ports must be comma-separated digits or ranges (e.g. "22,80,443" or "1-1000")
    if (!/^[0-9,-]+$/.test(ports)) {
      throw new Error("INVALID_PORTS");
    }
    return ports;
  }

  protected async run(input: unknown, ctx: EngineContext) {
    const rawTarget = (input as { target?: string })?.target ?? "127.0.0.1";
    const rawPorts = (input as { ports?: string })?.ports ?? "22,80,443,7700,7710,7720";
    let target: string, ports: string;
    try {
      target = this.sanitizeTarget(rawTarget);
      ports = this.sanitizePorts(rawPorts);
    } catch (e: unknown) {
      return { target: rawTarget, error: String(e), timestamp: ctx.timestamp };
    }
    // Real nmap call — requires nmap installed
    try {
      const { stdout } = await execAsync(`nmap -p ${ports} --open -oG - ${target} 2>/dev/null`, {
        timeout: 30000,
      });
      return { target, raw: stdout.trim(), timestamp: ctx.timestamp };
    } catch {
      return { target, error: "nmap_not_available", timestamp: ctx.timestamp };
    }
  }
}

export class InjectionAudit extends BaseEngine {
  readonly id = "injection_audit";
  readonly type = "security" as const;
  readonly description = "Prompt injection and input validation testing";

  protected async run(input: unknown, ctx: EngineContext) {
    const payload = (input as { text?: string })?.text ?? "";
    const vectors = [
      { pattern: /ignore previous/i, risk: "prompt_injection" },
      { pattern: /system:\s/i, risk: "role_override" },
      { pattern: /<script/i, risk: "xss" },
      { pattern: /;\s*(drop|delete|update)\s/i, risk: "sqli" },
      { pattern: /\.\.\//g, risk: "path_traversal" },
      { pattern: /\$\{.*\}/g, risk: "template_injection" },
    ];
    const findings = vectors.filter((v) => v.pattern.test(payload)).map((v) => v.risk);
    return { clean: findings.length === 0, findings, timestamp: ctx.timestamp };
  }
}

export class KeyRotation extends BaseEngine {
  readonly id = "key_rotation";
  readonly type = "security" as const;
  readonly description = "API key and secret rotation enforcement";

  protected async run(input: unknown, ctx: EngineContext) {
    const envPath = (input as { envPath?: string })?.envPath ?? `${ctx.stationRoot}/.env`;
    try {
      const content = await readFile(envPath, "utf-8");
      const stale = content
        .split("\n")
        .filter((l) => l.includes("=") && !l.startsWith("#"))
        .filter((l) => l.includes("[ROTATE]") || l.includes("CHANGEME") || l.includes("xxx"));
      return {
        total_keys: content.split("\n").filter((l) => l.includes("=")).length,
        stale: stale.length,
        stale_keys: stale.map((l) => l.split("=")[0]),
      };
    } catch {
      return { error: "env_not_found", path: envPath };
    }
  }
}

export class WalletAllowlist extends BaseEngine {
  readonly id = "wallet_allowlist";
  readonly type = "security" as const;
  readonly description = "Wallet address allowlist validation";
  override readonly feeds = ["tenderly"];

  protected async run(input: unknown, _ctx: EngineContext) {
    const address = (input as { address?: string })?.address ?? "";
    const valid = /^0x[a-fA-F0-9]{40}$/.test(address);
    // In production: check against on-chain allowlist contract
    return { address, validFormat: valid, checksum: valid ? address.toLowerCase() : null };
  }
}

export class ThreatModel extends BaseEngine {
  readonly id = "threat_model";
  readonly type = "security" as const;
  readonly description = "Attack surface mapping";

  protected async run(input: unknown, ctx: EngineContext) {
    const scope = (input as { scope?: string })?.scope ?? "full";
    const surfaces = [
      { surface: "network", vectors: ["open_ports", "dns_exposure", "tailscale_mesh"] },
      { surface: "application", vectors: ["api_endpoints", "mcp_servers", "injection_points"] },
      { surface: "blockchain", vectors: ["contract_calls", "wallet_keys", "rpc_exposure"] },
      { surface: "infrastructure", vectors: ["ssh_access", "docker_escape", "systemd_units"] },
      { surface: "supply_chain", vectors: ["npm_deps", "pip_deps", "container_images"] },
    ];
    return { scope, surfaces, generated: ctx.timestamp };
  }
}

export class VulnScanner extends BaseEngine {
  readonly id = "vuln_scanner";
  readonly type = "security" as const;
  readonly description = "Dependency and container vulnerability scanning";

  protected async run(input: unknown, ctx: EngineContext) {
    const target = (input as { path?: string })?.path ?? ctx.stationRoot;
    try {
      const { stdout } = await execAsync(`npm audit --json 2>/dev/null || echo '{}'`, {
        cwd: target,
        timeout: 30000,
      });
      const audit = JSON.parse(stdout);
      return {
        path: target,
        vulnerabilities: audit.metadata?.vulnerabilities ?? {},
        timestamp: ctx.timestamp,
      };
    } catch {
      return { path: target, error: "audit_failed", timestamp: ctx.timestamp };
    }
  }
}

export class AccessControl extends BaseEngine {
  readonly id = "access_control";
  readonly type = "security" as const;
  readonly description = "RBAC enforcement and permission validation";

  protected async run(input: unknown, _ctx: EngineContext) {
    const agent = (input as { agent?: string })?.agent ?? "";
    const action = (input as { action?: string })?.action ?? "";
    const roles: Record<string, string[]> = {
      "SEC-1": ["read:all", "write:audit", "write:security", "exec:scan", "exec:pentest"],
      "CFO-1": ["read:financial", "write:financial", "read:contracts", "exec:treasury"],
      "REV-1": ["read:all", "write:strategy", "write:decisions", "exec:approve"],
      "ENG-1": ["read:all", "write:code", "write:contracts", "exec:build", "exec:deploy"],
      "ENG-2": ["read:infra", "write:infra", "exec:deploy", "exec:restart", "exec:rollback"],
      "BIZ-1": ["read:market", "read:financial", "write:reports", "exec:scan"],
      "DIR-1": ["read:all", "write:all", "exec:route", "exec:escalate", "exec:broadcast"],
    };
    const perms = roles[agent] ?? [];
    const allowed =
      perms.includes(action) || perms.includes("write:all") || perms.includes("read:all");
    return { agent, action, allowed, permissions: perms };
  }
}

export class IncidentResponse extends BaseEngine {
  readonly id = "incident_response";
  readonly type = "security" as const;
  readonly description = "Incident detection, triage, and response workflow";
  override readonly feeds = ["radar", "perimeter_scan", "log_collector"];

  protected async run(input: unknown, ctx: EngineContext) {
    const severity = (input as { severity?: string })?.severity ?? "medium";
    const description = (input as { description?: string })?.description ?? "";
    const incident = {
      id: `INC-${ctx.timestamp}`,
      severity,
      description,
      status: "open",
      created: ctx.timestamp,
      actions:
        severity === "critical"
          ? ["isolate", "collect_evidence", "notify_all", "legal_hold"]
          : ["investigate", "collect_logs", "assess_impact"],
    };
    this.emit("incident_created", incident);
    return incident;
  }
}
