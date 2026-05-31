// VYRDON AI Room Configuration Loader
// vyrden.com — Hidden Operations Center

import { type AgentId, type Config } from './types.js';

function required(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required env: ${key}`);
  return val;
}

function optional(key: string, fallback: string): string {
  return process.env[key] ?? fallback;
}

function optionalInt(key: string, fallback: number): number {
  const raw = process.env[key];
  if (!raw) return fallback;
  const parsed = parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function loadConfig(): Config {
  const agentIds: readonly AgentId[] = [
    'SEC-1', 'CFO-1', 'REV-1', 'ENG-1', 'ENG-2', 'BIZ-1', 'DIR-1'
  ] as const;

  const keyEnvMap: Record<AgentId, string> = {
    'SEC-1': 'AGENT_ABYSSAL_KEY',
    'CFO-1': 'AGENT_LEVERAGE_KEY',
    'REV-1': 'AGENT_MAMMON_KEY',
    'ENG-1': 'AGENT_OBSIDIAN_KEY',
    'ENG-2': 'AGENT_THUNDER_KEY',
    'BIZ-1': 'AGENT_TITAN_KEY',
    'DIR-1': 'AGENT_VYRDOX_KEY',
  };

  const agentKeys = new Map<AgentId, string>();
  for (const id of agentIds) {
    const key = process.env[keyEnvMap[id]];
    if (key) agentKeys.set(id, key);
  }

  return {
    host: optional('AIROOM_HOST', '0.0.0.0'),
    port: optionalInt('AIROOM_PORT', 3100),
    env: (optional('AIROOM_ENV', 'production') as Config['env']),
    kittyRoot: optional('KITTY_ROOT', '/home/t79/KITTY'),
    vyrdxRoot: optional('VYRDX_ROOT', '/opt/vyrdx'),
    corsOrigin: optional('AIROOM_CORS_ORIGIN', 'https://vyrden.com'),
    secret: required('AIROOM_SECRET'),
    redis: {
      host: optional('REDIS_HOST', 'localhost'),
      port: optionalInt('REDIS_PORT', 6379),
      ...(process.env['REDIS_PASSWORD'] ? { password: process.env['REDIS_PASSWORD'] } : {}),
    },
    postgres: {
      host: optional('POSTGRES_HOST', 'localhost'),
      port: optionalInt('POSTGRES_PORT', 5432),
      database: optional('POSTGRES_DB', 'vyrdx'),
      user: optional('POSTGRES_USER', 'vyrdx'),
      password: required('POSTGRES_PASSWORD'),
    },
    agentKeys,
  };
}

let _config: Config | null = null;

export function getConfig(): Config {
  if (!_config) _config = loadConfig();
  return _config;
}
