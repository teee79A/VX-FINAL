// VYRDON AI Room — Task Executor
// Runs real tasks: fetches data from sources, formats context, sends to agent for analysis
// No placeholders — real data in, real analysis out

import type { AgentId } from '../core/types.js';
import { getTaskDefinition, findTaskByName, getTasksForAgent, type TaskDefinition } from './task-definitions.js';
import { appendAgentMemory, logAgentEvidence, recordAgentTask } from './workspace.js';
import { getAgentIdentity } from './identity.js';
import { getInferenceRouter } from '../ai/inference/router.js';
import {
  fetchCryptoPrices,
  fetchHackerNewsTop,
  searchGitHubRepos,
  fetchNpmPackage,
  scanDomain,
  getSystemStats,
  checkServices,
  getDockerContainers,
  fetchGasData,
  searchVulnerabilities,
  getInternalStats,
  calculateBurnRate,
} from './data-sources.js';

export interface TaskExecutionResult {
  taskId: string;
  agentId: AgentId;
  taskName: string;
  status: 'completed' | 'failed';
  rawData: Record<string, unknown>;
  analysis: string;
  durationMs: number;
  dataSources: string[];
  timestamp: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// DATA GATHERER — Fetch real data based on task definition
// ═══════════════════════════════════════════════════════════════════════════

async function gatherData(
  taskDef: TaskDefinition,
  inputs: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const data: Record<string, unknown> = {};

  for (const source of taskDef.dataSources) {
    try {
      switch (source) {
        case 'coingecko-api': {
          const coins = (inputs['coins'] as string) ?? 'bitcoin,ethereum,solana';
          const currency = (inputs['currency'] as string) ?? 'usd';
          data['cryptoPrices'] = await fetchCryptoPrices(coins, currency);
          break;
        }
        case 'hackernews-api': {
          const count = (inputs['count'] as number) ?? 30;
          data['hackerNews'] = await fetchHackerNewsTop(count);
          break;
        }
        case 'github-api':
        case 'github-trending': {
          const query = (inputs['market'] as string) ?? (inputs['competitor'] as string) ?? (inputs['language'] as string) ?? 'stars:>1000';
          data['githubRepos'] = await searchGitHubRepos(query, 'stars', 15);
          break;
        }
        case 'npm-registry': {
          const pkg = (inputs['package'] as string) ?? (inputs['competitor'] as string);
          if (pkg) data['npmPackage'] = await fetchNpmPackage(pkg);
          break;
        }
        case 'dns-lookup':
        case 'ssl-check':
        case 'headers-check': {
          const domain = (inputs['domain'] as string) ?? (inputs['competitor'] as string);
          if (domain && !data['domainScan']) {
            data['domainScan'] = await scanDomain(domain.replace(/^https?:\/\//, ''));
          }
          break;
        }
        case 'system-stats': {
          data['systemStats'] = getSystemStats();
          break;
        }
        case 'service-checks': {
          data['serviceChecks'] = await checkServices();
          break;
        }
        case 'docker-stats': {
          data['dockerContainers'] = getDockerContainers();
          break;
        }
        case 'etherscan-gas': {
          data['gasData'] = await fetchGasData();
          break;
        }
        case 'cve-api':
        case 'osv-api':
        case 'npm-audit': {
          const target = (inputs['package'] as string) ?? 'express';
          data['vulnerabilities'] = await searchVulnerabilities(target);
          break;
        }
        case 'internal-stats': {
          data['internalStats'] = getInternalStats();
          break;
        }
        case 'calculation': {
          if (taskDef.id === 'cfo:burn-rate') {
            data['burnRate'] = calculateBurnRate(
              (inputs['monthlyExpenses'] as number) ?? 0,
              (inputs['currentBalance'] as number) ?? 0,
              (inputs['monthlyRevenue'] as number) ?? 0
            );
          }
          break;
        }
        case 'filesystem': {
          // Code review — read file if specified
          const filePath = inputs['file'] as string;
          if (filePath) {
            try {
              const { readFileSync } = require('node:fs');
              data['fileContent'] = readFileSync(filePath, 'utf-8').slice(0, 5000);
            } catch {
              data['fileContent'] = `[Could not read file: ${filePath}]`;
            }
          }
          break;
        }
        case 'llm-analysis':
          // No pre-fetch needed — the agent itself does the analysis
          break;
      }
    } catch (err) {
      data[`error_${source}`] = String(err);
    }
  }

  return data;
}

// ═══════════════════════════════════════════════════════════════════════════
// FORMAT DATA → AGENT CONTEXT
// ═══════════════════════════════════════════════════════════════════════════

function formatDataForAgent(taskDef: TaskDefinition, rawData: Record<string, unknown>, inputs: Record<string, unknown>): string {
  const sections: string[] = [];
  sections.push(`TASK: ${taskDef.name}`);
  sections.push(`DESCRIPTION: ${taskDef.description}`);

  if (Object.keys(inputs).length > 0) {
    sections.push(`INPUTS: ${JSON.stringify(inputs)}`);
  }

  sections.push('');
  sections.push('=== REAL DATA (live, fetched now) ===');

  for (const [key, value] of Object.entries(rawData)) {
    if (key.startsWith('error_')) {
      sections.push(`[ERROR fetching ${key.replace('error_', '')}]: ${value}`);
      continue;
    }

    if (key === 'cryptoPrices' && Array.isArray(value)) {
      sections.push('\nCRYPTO MARKET DATA:');
      for (const coin of value as Record<string, unknown>[]) {
        sections.push(`  ${(coin['symbol'] as string)?.toUpperCase()}: $${coin['current_price']} | 24h: ${((coin['price_change_percentage_24h'] as number) ?? 0).toFixed(2)}% | MCap: $${((coin['market_cap'] as number) ?? 0).toLocaleString()} | Vol: $${((coin['total_volume'] as number) ?? 0).toLocaleString()}`);
      }
    }

    if (key === 'hackerNews' && Array.isArray(value)) {
      sections.push(`\nHACKERNEWS TOP STORIES (${(value as unknown[]).length}):`);
      for (const story of (value as Record<string, unknown>[]).slice(0, 20)) {
        sections.push(`  [${story['score']}pts] ${story['title']} (${story['url'] || 'no url'})`);
      }
    }

    if (key === 'githubRepos' && Array.isArray(value)) {
      sections.push(`\nGITHUB REPOS:`);
      for (const repo of value as Record<string, unknown>[]) {
        sections.push(`  ★${repo['stars']} ${repo['full_name']} — ${repo['description'] || 'no desc'} [${repo['language'] || 'unknown'}]`);
      }
    }

    if (key === 'npmPackage' && typeof value === 'object' && value !== null) {
      const pkg = value as Record<string, unknown>;
      sections.push(`\nNPM PACKAGE: ${pkg['name']}`);
      sections.push(`  Version: ${pkg['version']} | Downloads/week: ${((pkg['weekly_downloads'] as number) ?? 0).toLocaleString()} | License: ${pkg['license']} | Deps: ${pkg['dependencies']}`);
    }

    if (key === 'domainScan' && typeof value === 'object' && value !== null) {
      const scan = value as Record<string, unknown>;
      sections.push(`\nDOMAIN SECURITY SCAN: ${scan['domain']}`);
      sections.push(`  SSL Valid: ${scan['sslValid']} | Expiry: ${scan['sslExpiry'] || 'unknown'} | Score: ${scan['securityScore']}/100`);
      if (Array.isArray(scan['issues']) && (scan['issues'] as string[]).length > 0) {
        sections.push(`  Issues: ${(scan['issues'] as string[]).join('; ')}`);
      }
      if (Array.isArray(scan['dnsRecords'])) {
        for (const r of scan['dnsRecords'] as { type: string; value: string }[]) {
          sections.push(`  DNS ${r.type}: ${r.value}`);
        }
      }
    }

    if (key === 'systemStats' && typeof value === 'object' && value !== null) {
      const s = value as Record<string, unknown>;
      sections.push(`\nSYSTEM STATS:`);
      sections.push(`  Host: ${s['hostname']} | Uptime: ${Math.round((s['uptime'] as number) / 3600)}h | CPUs: ${s['cpuCount']} | Platform: ${s['platform']}`);
      sections.push(`  Memory: ${s['memoryUsedPercent']}% used (${Math.round((s['memoryFree'] as number) / 1e9)}GB free / ${Math.round((s['memoryTotal'] as number) / 1e9)}GB total)`);
      sections.push(`  Disk: ${s['diskUsedPercent']}% used | Node: ${s['nodeVersion']}`);
      sections.push(`  Load: ${(s['loadAvg'] as number[]).map(l => l.toFixed(2)).join(', ')}`);
    }

    if (key === 'serviceChecks' && Array.isArray(value)) {
      sections.push(`\nSERVICE STATUS:`);
      for (const svc of value as Record<string, unknown>[]) {
        sections.push(`  ${svc['status'] === 'up' ? '✓' : '✗'} ${svc['name']}: ${svc['status']} (${svc['responseTimeMs']}ms) [${svc['statusCode']}]`);
      }
    }

    if (key === 'dockerContainers' && Array.isArray(value)) {
      sections.push(`\nDOCKER CONTAINERS (${(value as unknown[]).length}):`);
      if ((value as unknown[]).length === 0) {
        sections.push('  No containers running');
      }
      for (const c of value as Record<string, unknown>[]) {
        sections.push(`  ${c['name']}: ${c['image']} | ${c['status']} | ${c['ports']}`);
      }
    }

    if (key === 'gasData' && typeof value === 'object' && value !== null) {
      const g = value as Record<string, unknown>;
      sections.push(`\nETHEREUM GAS:`);
      sections.push(`  Low: ${g['low']} gwei | Avg: ${g['average']} gwei | High: ${g['high']} gwei | Base: ${g['baseFee']} gwei`);
      sections.push(`  ETH Price: $${g['ethPrice']}`);
    }

    if (key === 'vulnerabilities' && Array.isArray(value)) {
      sections.push(`\nVULNERABILITIES (${(value as unknown[]).length}):`);
      for (const v of (value as Record<string, unknown>[]).slice(0, 10)) {
        sections.push(`  ${v['id']}: ${v['summary']} [${v['severity']}]`);
      }
    }

    if (key === 'burnRate' && typeof value === 'object' && value !== null) {
      const b = value as Record<string, unknown>;
      sections.push(`\nBURN RATE ANALYSIS:`);
      sections.push(`  Monthly Burn: $${((b['monthlyBurn'] as number) ?? 0).toLocaleString()}`);
      sections.push(`  Net Burn: $${((b['netBurn'] as number) ?? 0).toLocaleString()}/mo`);
      sections.push(`  Runway: ${b['runwayMonths']} months (until ${b['runwayDate']})`);
      sections.push(`  Status: ${(b['status'] as string)?.toUpperCase()}`);
    }

    if (key === 'internalStats' && typeof value === 'object' && value !== null) {
      const stats = value as Record<string, unknown>;
      sections.push(`\nVYRDON INTERNAL STATS:`);
      sections.push(`  Server Uptime: ${Math.round((stats['serverUptime'] as number) / 60)}min`);
      if (stats['agents'] && typeof stats['agents'] === 'object') {
        for (const [agentId, agentData] of Object.entries(stats['agents'] as Record<string, Record<string, unknown>>)) {
          sections.push(`  ${agentId}: ${agentData['taskCount']} tasks | ${agentData['memoryEntries']} memories | ${agentData['evidenceFiles']} evidence files`);
        }
      }
    }

    if (key === 'fileContent' && typeof value === 'string') {
      sections.push(`\nFILE CONTENT:\n${value}`);
    }
  }

  sections.push('\n=== END REAL DATA ===');
  sections.push('\nAnalyze the above real data and provide your expert assessment. Be specific, reference the data, and provide actionable recommendations.');

  return sections.join('\n');
}

// ═══════════════════════════════════════════════════════════════════════════
// EXECUTE TASK — Main entry point
// ═══════════════════════════════════════════════════════════════════════════

export async function executeRealTask(
  taskIdOrName: string,
  inputs: Record<string, unknown> = {},
  overrideAgent?: AgentId
): Promise<TaskExecutionResult> {
  const startTime = Date.now();

  // Find task definition
  let taskDef = getTaskDefinition(taskIdOrName);
  if (!taskDef) taskDef = findTaskByName(taskIdOrName);
  if (!taskDef) {
    // Try to auto-route based on keywords
    taskDef = autoRouteTask(taskIdOrName);
  }

  if (!taskDef) {
    return {
      taskId: 'unknown',
      agentId: overrideAgent ?? 'DIR-1',
      taskName: taskIdOrName,
      status: 'failed',
      rawData: {},
      analysis: `No task definition found for: "${taskIdOrName}". Available tasks: ${getAvailableTaskNames().join(', ')}`,
      durationMs: Date.now() - startTime,
      dataSources: [],
      timestamp: new Date().toISOString(),
    };
  }

  const agentId = overrideAgent ?? taskDef.agent;
  const identity = getAgentIdentity(agentId);

  // Step 1: Gather real data
  let rawData: Record<string, unknown> = {};
  try {
    rawData = await gatherData(taskDef, inputs);
  } catch (err) {
    rawData = { error: String(err) };
  }

  // Step 2: Format data into agent context
  const dataContext = formatDataForAgent(taskDef, rawData, inputs);

  // Step 3: Send to agent for analysis via LLM
  let analysis = '';
  try {
    const router = getInferenceRouter();
    const response = await router.generate({
      prompt: dataContext,
      systemPrompt: identity.systemPrompt,
      model: identity.model,
      temperature: 0.7,
      maxTokens: 4096,
    });
    analysis = response.content ?? response.text ?? '';
  } catch (err) {
    analysis = `[Inference failed: ${String(err)}]`;
  }

  const result: TaskExecutionResult = {
    taskId: taskDef.id,
    agentId,
    taskName: taskDef.name,
    status: analysis.startsWith('[Inference failed') ? 'failed' : 'completed',
    rawData,
    analysis,
    durationMs: Date.now() - startTime,
    dataSources: taskDef.dataSources,
    timestamp: new Date().toISOString(),
  };

  // Step 4: Record to agent's isolated workspace
  recordAgentTask(agentId, {
    taskId: taskDef.id,
    taskName: taskDef.name,
    inputs,
    status: result.status,
    durationMs: result.durationMs,
    dataSources: taskDef.dataSources,
  });

  appendAgentMemory(agentId, {
    type: 'task_execution',
    taskId: taskDef.id,
    inputs,
    summary: analysis.slice(0, 200),
  });

  logAgentEvidence(agentId, {
    event: 'task_executed',
    taskId: taskDef.id,
    taskName: taskDef.name,
    inputs,
    dataSources: taskDef.dataSources,
    durationMs: result.durationMs,
    status: result.status,
  });

  return result;
}

// ═══════════════════════════════════════════════════════════════════════════
// AUTO-ROUTER — Match free-text to task definitions
// ═══════════════════════════════════════════════════════════════════════════

function autoRouteTask(text: string): TaskDefinition | undefined {
  const lower = text.toLowerCase();

  // Security keywords
  if (/\b(scan|security|ssl|vuln|hack|pentest|threat|cve)\b/.test(lower)) {
    if (/\b(domain|site|website|url)\b/.test(lower)) return getTaskDefinition('sec:domain-scan');
    if (/\b(depend|package|npm|pip|audit)\b/.test(lower)) return getTaskDefinition('sec:dependency-audit');
    return getTaskDefinition('sec:threat-model');
  }

  // Financial keywords
  if (/\b(crypto|bitcoin|ethereum|price|treasury|portfolio)\b/.test(lower)) return getTaskDefinition('cfo:crypto-treasury');
  if (/\b(burn|runway|expenses|balance)\b/.test(lower)) return getTaskDefinition('cfo:burn-rate');
  if (/\b(gas|gwei|fee|transaction cost)\b/.test(lower)) return getTaskDefinition('cfo:gas-analysis');

  // Strategy keywords
  if (/\b(market analysis|market size|tam|sam|som)\b/.test(lower)) return getTaskDefinition('rev:market-analysis');
  if (/\b(competitor|competitive)\b/.test(lower)) return getTaskDefinition('rev:competitor-scan');
  if (/\b(target market|audience|segment)\b/.test(lower)) return getTaskDefinition('rev:target-market');
  if (/\b(go.to.market|gtm|launch|channel)\b/.test(lower)) return getTaskDefinition('rev:gtm-plan');

  // Engineering keywords
  if (/\b(code review|review code|pr review)\b/.test(lower)) return getTaskDefinition('eng:code-review');
  if (/\b(architect|design|system design)\b/.test(lower)) return getTaskDefinition('eng:architecture');
  if (/\b(npm package|npm info|package check)\b/.test(lower)) return getTaskDefinition('eng:npm-package-check');

  // Infra keywords
  if (/\b(health|system status|cpu|memory|disk|uptime)\b/.test(lower)) return getTaskDefinition('eng2:system-health');
  if (/\b(service|endpoint|status check)\b/.test(lower)) return getTaskDefinition('eng2:service-status');
  if (/\b(docker|container)\b/.test(lower)) return getTaskDefinition('eng2:docker-report');

  // Business keywords
  if (/\b(hackernews|hacker news|hn|tech news|trends)\b/.test(lower)) return getTaskDefinition('biz:hackernews-trends');
  if (/\b(github trending|trending repo)\b/.test(lower)) return getTaskDefinition('biz:github-trending');
  if (/\b(kpi|dashboard|metrics)\b/.test(lower)) return getTaskDefinition('biz:kpi-dashboard');

  // Director keywords
  if (/\b(room status|agent status|all agents)\b/.test(lower)) return getTaskDefinition('dir:room-status');
  if (/\b(performance|review agents)\b/.test(lower)) return getTaskDefinition('dir:agent-performance');

  return undefined;
}

function getAvailableTaskNames(): string[] {
  const all = [
    ...getTasksForAgent('SEC-1'),
    ...getTasksForAgent('CFO-1'),
    ...getTasksForAgent('REV-1'),
    ...getTasksForAgent('ENG-1'),
    ...getTasksForAgent('ENG-2'),
    ...getTasksForAgent('BIZ-1'),
    ...getTasksForAgent('DIR-1'),
  ];
  return all.map(t => `${t.id} (${t.name})`);
}
