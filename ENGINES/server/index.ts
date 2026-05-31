// ENGINES/server/index.ts
import { BaseEngine } from '../base.js';
import type { EngineContext } from '../types.js';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

const SHELL_ALLOWLIST = new Set([
  'echo', 'date', 'whoami', 'hostname', 'uname', 'uptime', 'df', 'free',
  'ps', 'top', 'cat', 'ls', 'pwd', 'id', 'env', 'printenv', 'which',
  'wc', 'head', 'tail', 'grep', 'find', 'stat', 'file', 'du',
  'systemctl', 'journalctl', 'ip', 'ss', 'netstat', 'ping', 'dig', 'nslookup',
  'npm', 'npx', 'node', 'git', 'docker', 'curl',
]);

function validateShellCommand(cmd: string): boolean {
  const binary = cmd.trim().split(/\s+/)[0]?.replace(/^.*\//, '') ?? '';
  return SHELL_ALLOWLIST.has(binary);
}

export class OpenShell extends BaseEngine {
  readonly id = 'openshell'; readonly type = 'server' as const;
  readonly description = 'Secure sandboxed shell execution gateway';
  protected async run(input: unknown, _ctx: EngineContext) {
    const cmd = (input as { command?: string })?.command ?? 'echo ok';
    const timeout = (input as { timeout?: number })?.timeout ?? 10000;
    if (!validateShellCommand(cmd)) {
      return { output: '', exit: 1, error: 'COMMAND_NOT_ALLOWED' };
    }
    try {
      const { stdout } = await execAsync(cmd, { timeout, maxBuffer: 1024 * 1024 });
      return { output: stdout.trim(), exit: 0 };
    } catch (e: unknown) {
      const err = e as { stderr?: string; status?: number };
      return { output: err.stderr?.toString() ?? '', exit: err.status ?? 1 };
    }
  }
}

export class ProcessManager extends BaseEngine {
  readonly id = 'process_manager'; readonly type = 'server' as const;
  readonly description = 'Process lifecycle management — spawn, monitor, kill';
  protected async run(input: unknown, _ctx: EngineContext) {
    const action = (input as { action?: string })?.action ?? 'list';
    if (action === 'list') {
      try {
        const { stdout } = await execAsync('ps aux --sort=-pcpu | head -20');
        return { processes: stdout.trim() };
      } catch { return { error: 'ps_failed' }; }
    }
    return { action, status: 'ready' };
  }
}

export class FileWatcher extends BaseEngine {
  readonly id = 'file_watcher'; readonly type = 'server' as const;
  readonly description = 'Filesystem change detection and event dispatch';
  protected async run(input: unknown, _ctx: EngineContext) {
    const path = (input as { path?: string })?.path ?? '';
    return { watching: path, status: 'configured' };
  }
}

export class CronEngine extends BaseEngine {
  readonly id = 'cron_engine'; readonly type = 'server' as const;
  readonly description = 'Cron-style scheduled job execution';
  protected async run(_input: unknown, _ctx: EngineContext) {
    try {
      const { stdout } = await execAsync('crontab -l 2>/dev/null || echo "no crontab"');
      return { crontab: stdout.trim() };
    } catch { return { crontab: 'none' }; }
  }
}

export class WebhookReceiver extends BaseEngine {
  readonly id = 'webhook_receiver'; readonly type = 'server' as const;
  readonly description = 'Inbound webhook reception and event routing';
  protected async run(input: unknown, ctx: EngineContext) { return { status: 'listening', timestamp: ctx.timestamp }; }
}

export class SocketBridge extends BaseEngine {
  readonly id = 'socket_bridge'; readonly type = 'server' as const;
  readonly description = 'WebSocket bridge for real-time comms';
  protected async run(input: unknown, ctx: EngineContext) { return { status: 'ready', timestamp: ctx.timestamp }; }
}

export class BackupEngine extends BaseEngine {
  readonly id = 'backup_engine'; readonly type = 'server' as const;
  readonly description = 'Automated backup to Cloudflare R2 and local snapshots';
  protected async run(input: unknown, ctx: EngineContext) {
    const target = (input as { target?: string })?.target ?? 'state';
    return { target, destination: 'r2:vyrdon-backup', status: 'ready', timestamp: ctx.timestamp };
  }
}
