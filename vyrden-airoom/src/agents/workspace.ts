// VYRDON AI Room — Agent Workspace Manager
// Each agent gets an isolated path: agents/{AGENT_ID}/{workspace,memory,evidence,tasks}

import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { AgentId } from '../core/types.js';

const AGENTS_ROOT = join(process.env['KITTY_ROOT'] ?? process.cwd(), 'vyrden-airoom', 'agents');

const SUBDIRS = ['workspace', 'memory', 'evidence', 'tasks'] as const;

export interface AgentWorkspace {
  root: string;
  workspace: string;
  memory: string;
  evidence: string;
  tasks: string;
}

function ensureAgentDirs(agentId: AgentId): AgentWorkspace {
  const root = join(AGENTS_ROOT, agentId);
  const paths: AgentWorkspace = {
    root,
    workspace: join(root, 'workspace'),
    memory: join(root, 'memory'),
    evidence: join(root, 'evidence'),
    tasks: join(root, 'tasks'),
  };
  for (const dir of Object.values(paths)) {
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  }
  return paths;
}

// Per-agent memory: isolated JSON file per agent
export function getAgentMemoryPath(agentId: AgentId): string {
  const ws = ensureAgentDirs(agentId);
  return join(ws.memory, 'memory.json');
}

export function loadAgentMemory(agentId: AgentId): Record<string, unknown>[] {
  const memPath = getAgentMemoryPath(agentId);
  if (!existsSync(memPath)) return [];
  try {
    return JSON.parse(readFileSync(memPath, 'utf-8')) as Record<string, unknown>[];
  } catch {
    return [];
  }
}

export function appendAgentMemory(agentId: AgentId, entry: Record<string, unknown>): void {
  const existing = loadAgentMemory(agentId);
  existing.push({ ...entry, timestamp: new Date().toISOString() });
  // Keep last 500 entries per agent
  const trimmed = existing.slice(-500);
  writeFileSync(getAgentMemoryPath(agentId), JSON.stringify(trimmed, null, 2));
}

// Per-agent evidence logging
export function logAgentEvidence(agentId: AgentId, entry: Record<string, unknown>): void {
  const ws = ensureAgentDirs(agentId);
  const dateStr = new Date().toISOString().split('T')[0];
  const logFile = join(ws.evidence, `${dateStr}.jsonl`);
  const line = JSON.stringify({ ...entry, agentId, timestamp: new Date().toISOString() }) + '\n';
  try {
    appendFileSync(logFile, line);
  } catch {
    writeFileSync(logFile, line);
  }
}

// Per-agent task history
export function getAgentTaskHistory(agentId: AgentId, limit = 50): Record<string, unknown>[] {
  const ws = ensureAgentDirs(agentId);
  const historyFile = join(ws.tasks, 'history.json');
  if (!existsSync(historyFile)) return [];
  try {
    const all = JSON.parse(readFileSync(historyFile, 'utf-8')) as Record<string, unknown>[];
    return all.slice(-limit);
  } catch {
    return [];
  }
}

export function recordAgentTask(agentId: AgentId, task: Record<string, unknown>): void {
  const history = getAgentTaskHistory(agentId, 999);
  history.push({ ...task, timestamp: new Date().toISOString() });
  const trimmed = history.slice(-500);
  const ws = ensureAgentDirs(agentId);
  writeFileSync(join(ws.tasks, 'history.json'), JSON.stringify(trimmed, null, 2));
}

// Get workspace paths for an agent
export function getAgentWorkspace(agentId: AgentId): AgentWorkspace {
  return ensureAgentDirs(agentId);
}

// List all agent workspace stats
export function getAllAgentWorkspaceStats(): Record<AgentId, { memoryEntries: number; evidenceFiles: number; taskCount: number }> {
  const agents: AgentId[] = ['SEC-1', 'CFO-1', 'REV-1', 'ENG-1', 'ENG-2', 'BIZ-1', 'DIR-1'];
  const stats = {} as Record<AgentId, { memoryEntries: number; evidenceFiles: number; taskCount: number }>;

  for (const id of agents) {
    const ws = ensureAgentDirs(id);
    const memoryEntries = loadAgentMemory(id).length;
    const evidenceFiles = existsSync(ws.evidence) ? readdirSync(ws.evidence).length : 0;
    const taskCount = getAgentTaskHistory(id).length;
    stats[id] = { memoryEntries, evidenceFiles, taskCount };
  }

  return stats;
}
