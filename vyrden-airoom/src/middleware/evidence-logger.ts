// Evidence Logger — Immutable request logging
// vyrden.com — All requests logged to /var/vyrden/evidence/

import { promises as fs } from 'fs';
import path from 'path';

export interface EvidenceEntry {
  id: string;
  timestamp: string;
  sessionId: string;
  method: string;
  path: string;
  statusCode: number;
  agentId?: string;
  userId?: string;
  prompt?: string;
  response?: string;
  duration: number;
  metadata?: Record<string, unknown>;
}

export class EvidenceLogger {
  private baseDir = process.env['KITTY_ROOT']
    ? `${process.env['KITTY_ROOT']}/vyrden-airoom/evidence`
    : '/tmp/vyrden/evidence';

  async initialize(): Promise<void> {
    try {
      await fs.mkdir(this.baseDir, { recursive: true });
      await fs.mkdir(path.join(this.baseDir, 'requests'), { recursive: true });
      await fs.mkdir(path.join(this.baseDir, 'agents'), { recursive: true });
      await fs.mkdir(path.join(this.baseDir, 'audit'), { recursive: true });
    } catch (error) {
      console.error(`Evidence logger init failed: ${String(error)}`);
    }
  }

  async log(entry: EvidenceEntry): Promise<void> {
    try {
      const timestamp = new Date(entry.timestamp);
      const dateStr = timestamp.toISOString().split('T')[0]; // YYYY-MM-DD

      // Main request log (JSONL format)
      const requestLog = path.join(this.baseDir, 'requests', `${dateStr}.jsonl`);
      await fs.appendFile(requestLog, `${JSON.stringify(entry)}\n`);

      // Agent-specific log if agentId present
      if (entry.agentId) {
        const agentLog = path.join(this.baseDir, 'agents', `${entry.agentId}.jsonl`);
        await fs.appendFile(agentLog, `${JSON.stringify(entry)}\n`);
      }

      // Audit log for sensitive operations
      if (entry.method === 'POST' || entry.method === 'PUT' || entry.method === 'DELETE') {
        const auditLog = path.join(this.baseDir, 'audit', `${dateStr}.jsonl`);
        await fs.appendFile(auditLog, `${JSON.stringify(entry)}\n`);
      }
    } catch (error) {
      console.error(`Evidence log write failed: ${String(error)}`);
    }
  }

  async getRequestsForDate(date: string): Promise<EvidenceEntry[]> {
    try {
      const filePath = path.join(this.baseDir, 'requests', `${date}.jsonl`);
      const content = await fs.readFile(filePath, 'utf-8');
      return content
        .split('\n')
        .filter(Boolean)
        .map((line) => JSON.parse(line) as EvidenceEntry);
    } catch {
      return [];
    }
  }

  async getAgentLog(agentId: string, limit: number = 100): Promise<EvidenceEntry[]> {
    try {
      const filePath = path.join(this.baseDir, 'agents', `${agentId}.jsonl`);
      const content = await fs.readFile(filePath, 'utf-8');
      return content
        .split('\n')
        .filter(Boolean)
        .map((line) => JSON.parse(line) as EvidenceEntry)
        .slice(-limit);
    } catch {
      return [];
    }
  }

  async getStats(): Promise<{ totalRequests: number; totalSize: number }> {
    try {
      const requestDir = path.join(this.baseDir, 'requests');
      const files = await fs.readdir(requestDir);

      let totalRequests = 0;
      let totalSize = 0;

      for (const file of files) {
        const filePath = path.join(requestDir, file);
        const stats = await fs.stat(filePath);
        totalSize += stats.size;

        const content = await fs.readFile(filePath, 'utf-8');
        totalRequests += content.split('\n').filter(Boolean).length;
      }

      return { totalRequests, totalSize };
    } catch {
      return { totalRequests: 0, totalSize: 0 };
    }
  }
}

export const evidenceLogger = new EvidenceLogger();

// Initialize on module load
void evidenceLogger.initialize();
