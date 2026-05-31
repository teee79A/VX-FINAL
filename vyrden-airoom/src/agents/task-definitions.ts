// VYRDON AI Room — Real Task Definitions
// Each agent has concrete, executable task types with data source hooks
// No placeholders — these fetch real data from free APIs

import type { AgentId } from '../core/types.js';

export interface TaskDefinition {
  id: string;
  name: string;
  description: string;
  agent: AgentId;
  category: string;
  inputSchema: Record<string, { type: string; required: boolean; description: string }>;
  dataSources: string[];
  outputFormat: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// SEC-1 ABYSSAL — Security Tasks
// ═══════════════════════════════════════════════════════════════════════════

const SEC1_TASKS: TaskDefinition[] = [
  {
    id: 'sec:domain-scan',
    name: 'Domain Security Scan',
    description: 'Scan a domain for SSL, headers, DNS, and security configuration',
    agent: 'SEC-1',
    category: 'scan',
    inputSchema: {
      domain: { type: 'string', required: true, description: 'Target domain (e.g., vyrden.com)' },
    },
    dataSources: ['dns-lookup', 'ssl-check', 'headers-check'],
    outputFormat: 'security-report',
  },
  {
    id: 'sec:dependency-audit',
    name: 'Dependency Vulnerability Audit',
    description: 'Audit npm/pip dependencies for known CVEs',
    agent: 'SEC-1',
    category: 'audit',
    inputSchema: {
      path: { type: 'string', required: false, description: 'Path to package.json or requirements.txt' },
    },
    dataSources: ['npm-audit', 'osv-api'],
    outputFormat: 'vuln-report',
  },
  {
    id: 'sec:threat-model',
    name: 'Threat Model Analysis',
    description: 'Generate STRIDE-based threat model for a system',
    agent: 'SEC-1',
    category: 'analysis',
    inputSchema: {
      system: { type: 'string', required: true, description: 'System name or description' },
      components: { type: 'string', required: false, description: 'Comma-separated component list' },
    },
    dataSources: ['cve-api', 'llm-analysis'],
    outputFormat: 'threat-model',
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// CFO-1 LEVERAGE — Financial Tasks
// ═══════════════════════════════════════════════════════════════════════════

const CFO1_TASKS: TaskDefinition[] = [
  {
    id: 'cfo:crypto-treasury',
    name: 'Crypto Treasury Report',
    description: 'Real-time crypto portfolio valuation from CoinGecko',
    agent: 'CFO-1',
    category: 'treasury',
    inputSchema: {
      coins: { type: 'string', required: false, description: 'Comma-separated coin ids (default: bitcoin,ethereum)' },
      currency: { type: 'string', required: false, description: 'Fiat currency (default: usd)' },
    },
    dataSources: ['coingecko-api'],
    outputFormat: 'treasury-report',
  },
  {
    id: 'cfo:burn-rate',
    name: 'Burn Rate Calculator',
    description: 'Calculate burn rate and runway from expenses',
    agent: 'CFO-1',
    category: 'analysis',
    inputSchema: {
      monthlyExpenses: { type: 'number', required: true, description: 'Monthly expenses in USD' },
      currentBalance: { type: 'number', required: true, description: 'Current treasury balance in USD' },
      monthlyRevenue: { type: 'number', required: false, description: 'Monthly revenue in USD (default: 0)' },
    },
    dataSources: ['calculation'],
    outputFormat: 'financial-report',
  },
  {
    id: 'cfo:gas-analysis',
    name: 'Ethereum Gas Analysis',
    description: 'Current gas prices and optimal transaction timing',
    agent: 'CFO-1',
    category: 'blockchain',
    inputSchema: {},
    dataSources: ['etherscan-gas', 'coingecko-api'],
    outputFormat: 'gas-report',
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// REV-1 MAMMON — Strategy Tasks
// ═══════════════════════════════════════════════════════════════════════════

const REV1_TASKS: TaskDefinition[] = [
  {
    id: 'rev:market-analysis',
    name: 'Market Analysis',
    description: 'Analyze a target market with real data from HackerNews, GitHub, and web trends',
    agent: 'REV-1',
    category: 'strategy',
    inputSchema: {
      market: { type: 'string', required: true, description: 'Target market (e.g., "AI agents", "DeFi", "DevTools")' },
      focus: { type: 'string', required: false, description: 'Specific focus area' },
    },
    dataSources: ['hackernews-api', 'github-trending', 'llm-analysis'],
    outputFormat: 'market-report',
  },
  {
    id: 'rev:competitor-scan',
    name: 'Competitor Intelligence',
    description: 'Scan competitor presence on GitHub, npm, and web',
    agent: 'REV-1',
    category: 'intelligence',
    inputSchema: {
      competitor: { type: 'string', required: true, description: 'Competitor name or domain' },
    },
    dataSources: ['github-api', 'npm-registry', 'dns-lookup'],
    outputFormat: 'competitor-report',
  },
  {
    id: 'rev:target-market',
    name: 'Target Market Definition',
    description: 'Define TAM/SAM/SOM with data-backed market sizing',
    agent: 'REV-1',
    category: 'planning',
    inputSchema: {
      product: { type: 'string', required: true, description: 'Product or service description' },
      vertical: { type: 'string', required: false, description: 'Industry vertical' },
    },
    dataSources: ['hackernews-api', 'github-api', 'llm-analysis'],
    outputFormat: 'market-sizing',
  },
  {
    id: 'rev:gtm-plan',
    name: 'Go-To-Market Plan',
    description: 'Generate GTM strategy with channels, pricing, and timeline',
    agent: 'REV-1',
    category: 'planning',
    inputSchema: {
      product: { type: 'string', required: true, description: 'Product name and description' },
      targetAudience: { type: 'string', required: true, description: 'Primary audience' },
      budget: { type: 'string', required: false, description: 'Monthly budget range' },
    },
    dataSources: ['llm-analysis'],
    outputFormat: 'gtm-report',
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// ENG-1 OBSIDIAN — Engineering Tasks
// ═══════════════════════════════════════════════════════════════════════════

const ENG1_TASKS: TaskDefinition[] = [
  {
    id: 'eng:code-review',
    name: 'Code Review',
    description: 'Review code for quality, security, and best practices',
    agent: 'ENG-1',
    category: 'quality',
    inputSchema: {
      file: { type: 'string', required: false, description: 'File path to review' },
      code: { type: 'string', required: false, description: 'Code snippet to review' },
      language: { type: 'string', required: false, description: 'Programming language' },
    },
    dataSources: ['filesystem', 'llm-analysis'],
    outputFormat: 'review-report',
  },
  {
    id: 'eng:architecture',
    name: 'Architecture Design',
    description: 'Design system architecture for a given requirement',
    agent: 'ENG-1',
    category: 'design',
    inputSchema: {
      requirement: { type: 'string', required: true, description: 'System requirement description' },
      constraints: { type: 'string', required: false, description: 'Technical constraints' },
    },
    dataSources: ['llm-analysis'],
    outputFormat: 'architecture-doc',
  },
  {
    id: 'eng:npm-package-check',
    name: 'NPM Package Analysis',
    description: 'Analyze an npm package for quality, security, and suitability',
    agent: 'ENG-1',
    category: 'analysis',
    inputSchema: {
      package: { type: 'string', required: true, description: 'npm package name' },
    },
    dataSources: ['npm-registry'],
    outputFormat: 'package-report',
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// ENG-2 THUNDER — Infrastructure Tasks
// ═══════════════════════════════════════════════════════════════════════════

const ENG2_TASKS: TaskDefinition[] = [
  {
    id: 'eng2:system-health',
    name: 'System Health Check',
    description: 'Check system resources — CPU, memory, disk, services',
    agent: 'ENG-2',
    category: 'monitoring',
    inputSchema: {},
    dataSources: ['system-stats'],
    outputFormat: 'health-report',
  },
  {
    id: 'eng2:service-status',
    name: 'Service Status Report',
    description: 'Check status of all VYRDON services and endpoints',
    agent: 'ENG-2',
    category: 'monitoring',
    inputSchema: {},
    dataSources: ['service-checks', 'dns-lookup'],
    outputFormat: 'service-report',
  },
  {
    id: 'eng2:docker-report',
    name: 'Docker Container Report',
    description: 'List running containers with resource usage',
    agent: 'ENG-2',
    category: 'infra',
    inputSchema: {},
    dataSources: ['docker-stats'],
    outputFormat: 'container-report',
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// BIZ-1 TITAN — Business Intelligence Tasks
// ═══════════════════════════════════════════════════════════════════════════

const BIZ1_TASKS: TaskDefinition[] = [
  {
    id: 'biz:hackernews-trends',
    name: 'HackerNews Trend Analysis',
    description: 'Analyze top HackerNews stories for market signals',
    agent: 'BIZ-1',
    category: 'intelligence',
    inputSchema: {
      topic: { type: 'string', required: false, description: 'Filter topic (e.g., "AI", "crypto", "devtools")' },
      count: { type: 'number', required: false, description: 'Number of stories (default: 30)' },
    },
    dataSources: ['hackernews-api'],
    outputFormat: 'trend-report',
  },
  {
    id: 'biz:github-trending',
    name: 'GitHub Trending Analysis',
    description: 'Analyze trending GitHub repos for competitive intelligence',
    agent: 'BIZ-1',
    category: 'intelligence',
    inputSchema: {
      language: { type: 'string', required: false, description: 'Programming language filter' },
      since: { type: 'string', required: false, description: 'Time range: daily, weekly, monthly' },
    },
    dataSources: ['github-trending'],
    outputFormat: 'trending-report',
  },
  {
    id: 'biz:kpi-dashboard',
    name: 'KPI Dashboard',
    description: 'Generate KPI summary from VYRDON operational data',
    agent: 'BIZ-1',
    category: 'reporting',
    inputSchema: {},
    dataSources: ['internal-stats'],
    outputFormat: 'kpi-report',
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// DIR-1 VYRDOX — Director Tasks
// ═══════════════════════════════════════════════════════════════════════════

const DIR1_TASKS: TaskDefinition[] = [
  {
    id: 'dir:room-status',
    name: 'AI Room Status',
    description: 'Full status report across all agents, engines, and tasks',
    agent: 'DIR-1',
    category: 'coordination',
    inputSchema: {},
    dataSources: ['internal-stats'],
    outputFormat: 'status-report',
  },
  {
    id: 'dir:agent-performance',
    name: 'Agent Performance Review',
    description: 'Review task completion stats and response quality per agent',
    agent: 'DIR-1',
    category: 'evaluation',
    inputSchema: {
      agentId: { type: 'string', required: false, description: 'Specific agent ID (default: all)' },
    },
    dataSources: ['internal-stats'],
    outputFormat: 'performance-report',
  },
  {
    id: 'dir:cross-agent-task',
    name: 'Cross-Agent Task',
    description: 'Route a complex task across multiple agents',
    agent: 'DIR-1',
    category: 'orchestration',
    inputSchema: {
      task: { type: 'string', required: true, description: 'Task description' },
      agents: { type: 'string', required: false, description: 'Comma-separated agent IDs' },
    },
    dataSources: ['internal-stats', 'llm-analysis'],
    outputFormat: 'multi-agent-report',
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// REGISTRY
// ═══════════════════════════════════════════════════════════════════════════

const ALL_TASKS: TaskDefinition[] = [
  ...SEC1_TASKS,
  ...CFO1_TASKS,
  ...REV1_TASKS,
  ...ENG1_TASKS,
  ...ENG2_TASKS,
  ...BIZ1_TASKS,
  ...DIR1_TASKS,
];

const TASK_MAP = new Map<string, TaskDefinition>();
for (const t of ALL_TASKS) {
  TASK_MAP.set(t.id, t);
}

export function getTaskDefinition(taskId: string): TaskDefinition | undefined {
  return TASK_MAP.get(taskId);
}

export function getTasksForAgent(agentId: AgentId): TaskDefinition[] {
  return ALL_TASKS.filter(t => t.agent === agentId);
}

export function getAllTaskDefinitions(): TaskDefinition[] {
  return ALL_TASKS;
}

export function findTaskByName(name: string): TaskDefinition | undefined {
  const lower = name.toLowerCase();
  return ALL_TASKS.find(t =>
    t.name.toLowerCase().includes(lower) ||
    t.description.toLowerCase().includes(lower) ||
    t.id.toLowerCase().includes(lower)
  );
}
