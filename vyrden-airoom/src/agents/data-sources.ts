// VYRDON AI Room — Real Data Sources
// Actual API calls to free public APIs — no fake data, no placeholders
// Each function returns structured real data for agent consumption

import { execSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import os from 'node:os';

// ═══════════════════════════════════════════════════════════════════════════
// HTTP HELPER (no deps — built-in fetch)
// ═══════════════════════════════════════════════════════════════════════════

async function fetchJSON(url: string, timeoutMs = 10000): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'VYRDON-AIRoom/1.0' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

async function fetchText(url: string, timeoutMs = 10000): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'VYRDON-AIRoom/1.0' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// COINGECKO — Crypto prices (free, no key)
// ═══════════════════════════════════════════════════════════════════════════

export interface CryptoPrice {
  id: string;
  symbol: string;
  name: string;
  current_price: number;
  market_cap: number;
  price_change_24h: number;
  price_change_percentage_24h: number;
  total_volume: number;
  last_updated: string;
}

export async function fetchCryptoPrices(
  coins = 'bitcoin,ethereum,solana',
  currency = 'usd'
): Promise<CryptoPrice[]> {
  const url = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=${encodeURIComponent(currency)}&ids=${encodeURIComponent(coins)}&order=market_cap_desc&per_page=20&sparkline=false`;
  const data = await fetchJSON(url) as CryptoPrice[];
  return data.map(c => ({
    id: c.id,
    symbol: c.symbol,
    name: c.name,
    current_price: c.current_price,
    market_cap: c.market_cap,
    price_change_24h: c.price_change_24h,
    price_change_percentage_24h: c.price_change_percentage_24h,
    total_volume: c.total_volume,
    last_updated: c.last_updated,
  }));
}

// ═══════════════════════════════════════════════════════════════════════════
// HACKERNEWS — Top stories (free, no key)
// ═══════════════════════════════════════════════════════════════════════════

export interface HNStory {
  id: number;
  title: string;
  url: string;
  score: number;
  by: string;
  time: number;
  descendants: number;
}

export async function fetchHackerNewsTop(count = 30): Promise<HNStory[]> {
  const ids = (await fetchJSON('https://hacker-news.firebaseio.com/v0/topstories.json')) as number[];
  const topIds = ids.slice(0, Math.min(count, 50));
  const stories: HNStory[] = [];

  // Fetch in batches of 10
  for (let i = 0; i < topIds.length; i += 10) {
    const batch = topIds.slice(i, i + 10);
    const results = await Promise.all(
      batch.map(id =>
        fetchJSON(`https://hacker-news.firebaseio.com/v0/item/${id}.json`).catch(() => null)
      )
    );
    for (const item of results) {
      if (item && typeof item === 'object') {
        const s = item as Record<string, unknown>;
        stories.push({
          id: s['id'] as number,
          title: (s['title'] as string) ?? '',
          url: (s['url'] as string) ?? '',
          score: (s['score'] as number) ?? 0,
          by: (s['by'] as string) ?? '',
          time: (s['time'] as number) ?? 0,
          descendants: (s['descendants'] as number) ?? 0,
        });
      }
    }
  }
  return stories;
}

// ═══════════════════════════════════════════════════════════════════════════
// GITHUB — Search repos, trending (free, no key required for basic)
// ═══════════════════════════════════════════════════════════════════════════

export interface GitHubRepo {
  name: string;
  full_name: string;
  description: string;
  stars: number;
  forks: number;
  language: string;
  url: string;
  created_at: string;
  updated_at: string;
  open_issues: number;
}

export async function searchGitHubRepos(query: string, sort = 'stars', limit = 10): Promise<GitHubRepo[]> {
  const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&sort=${sort}&per_page=${limit}`;
  const data = (await fetchJSON(url)) as { items?: Record<string, unknown>[] };
  return (data.items ?? []).map(r => ({
    name: (r['name'] as string) ?? '',
    full_name: (r['full_name'] as string) ?? '',
    description: (r['description'] as string) ?? '',
    stars: (r['stargazers_count'] as number) ?? 0,
    forks: (r['forks_count'] as number) ?? 0,
    language: (r['language'] as string) ?? '',
    url: (r['html_url'] as string) ?? '',
    created_at: (r['created_at'] as string) ?? '',
    updated_at: (r['updated_at'] as string) ?? '',
    open_issues: (r['open_issues_count'] as number) ?? 0,
  }));
}

// ═══════════════════════════════════════════════════════════════════════════
// NPM — Package info (free, no key)
// ═══════════════════════════════════════════════════════════════════════════

export interface NpmPackageInfo {
  name: string;
  version: string;
  description: string;
  weekly_downloads: number;
  license: string;
  repository: string;
  dependencies: number;
  maintainers: string[];
  last_publish: string;
}

export async function fetchNpmPackage(packageName: string): Promise<NpmPackageInfo> {
  const [registry, downloads] = await Promise.all([
    fetchJSON(`https://registry.npmjs.org/${encodeURIComponent(packageName)}/latest`) as Promise<Record<string, unknown>>,
    fetchJSON(`https://api.npmjs.org/downloads/point/last-week/${encodeURIComponent(packageName)}`).catch(() => ({ downloads: 0 })) as Promise<Record<string, unknown>>,
  ]);

  return {
    name: (registry['name'] as string) ?? packageName,
    version: (registry['version'] as string) ?? 'unknown',
    description: (registry['description'] as string) ?? '',
    weekly_downloads: (downloads['downloads'] as number) ?? 0,
    license: (registry['license'] as string) ?? 'unknown',
    repository: typeof registry['repository'] === 'object'
      ? ((registry['repository'] as Record<string, string>)['url'] ?? '')
      : '',
    dependencies: registry['dependencies'] ? Object.keys(registry['dependencies'] as object).length : 0,
    maintainers: Array.isArray(registry['maintainers'])
      ? (registry['maintainers'] as { name: string }[]).map(m => m.name)
      : [],
    last_publish: (registry['_time'] as string) ?? '',
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// DNS / SSL — Domain security checks
// ═══════════════════════════════════════════════════════════════════════════

export interface DomainScanResult {
  domain: string;
  dnsRecords: { type: string; value: string }[];
  sslValid: boolean;
  sslExpiry: string;
  headers: Record<string, string>;
  securityScore: number;
  issues: string[];
}

export async function scanDomain(domain: string): Promise<DomainScanResult> {
  const issues: string[] = [];
  let sslValid = false;
  let sslExpiry = '';
  const dnsRecords: { type: string; value: string }[] = [];
  const headers: Record<string, string> = {};

  // DNS lookup
  try {
    const output = execSync(`dig +short ${domain} A 2>/dev/null`, { timeout: 5000, encoding: 'utf-8' });
    for (const line of output.trim().split('\n').filter(Boolean)) {
      dnsRecords.push({ type: 'A', value: line.trim() });
    }
  } catch { /* no dig available */ }

  try {
    const output = execSync(`dig +short ${domain} AAAA 2>/dev/null`, { timeout: 5000, encoding: 'utf-8' });
    for (const line of output.trim().split('\n').filter(Boolean)) {
      dnsRecords.push({ type: 'AAAA', value: line.trim() });
    }
  } catch { /* */ }

  // SSL check
  try {
    const sslOutput = execSync(
      `echo | openssl s_client -servername ${domain} -connect ${domain}:443 2>/dev/null | openssl x509 -noout -dates 2>/dev/null`,
      { timeout: 10000, encoding: 'utf-8' }
    );
    const expiryMatch = sslOutput.match(/notAfter=(.+)/);
    if (expiryMatch?.[1]) {
      sslExpiry = expiryMatch[1].trim();
      sslValid = new Date(sslExpiry) > new Date();
    }
  } catch {
    issues.push('SSL check failed or not available');
  }

  // HTTP headers
  try {
    const res = await fetch(`https://${domain}`, {
      method: 'HEAD',
      redirect: 'follow',
      signal: AbortSignal.timeout(5000),
    });
    for (const [key, value] of res.headers) {
      headers[key] = value;
    }
    // Security header checks
    if (!headers['strict-transport-security']) issues.push('Missing HSTS header');
    if (!headers['x-content-type-options']) issues.push('Missing X-Content-Type-Options');
    if (!headers['x-frame-options'] && !headers['content-security-policy']) {
      issues.push('Missing clickjacking protection (X-Frame-Options or CSP frame-ancestors)');
    }
  } catch (e) {
    issues.push(`HTTP HEAD failed: ${String(e)}`);
  }

  const securityScore = Math.max(0, 100 - issues.length * 15);

  return { domain, dnsRecords, sslValid, sslExpiry, headers, securityScore, issues };
}

// ═══════════════════════════════════════════════════════════════════════════
// SYSTEM STATS — Local machine metrics
// ═══════════════════════════════════════════════════════════════════════════

export interface SystemStats {
  hostname: string;
  uptime: number;
  loadAvg: number[];
  memoryTotal: number;
  memoryFree: number;
  memoryUsedPercent: number;
  diskTotal: number;
  diskUsed: number;
  diskUsedPercent: number;
  cpuCount: number;
  nodeVersion: string;
  platform: string;
}

export function getSystemStats(): SystemStats {
  const totalMem = os.totalmem();
  const freeMem = os.freemem();

  let diskTotal = 0;
  let diskUsed = 0;
  try {
    const dfOutput = execSync("df -B1 / | tail -1", { timeout: 3000, encoding: 'utf-8' });
    const parts = dfOutput.trim().split(/\s+/);
    diskTotal = parseInt(parts[1] ?? '0', 10);
    diskUsed = parseInt(parts[2] ?? '0', 10);
  } catch { /* */ }

  return {
    hostname: os.hostname(),
    uptime: os.uptime(),
    loadAvg: os.loadavg(),
    memoryTotal: totalMem,
    memoryFree: freeMem,
    memoryUsedPercent: Math.round(((totalMem - freeMem) / totalMem) * 100),
    diskTotal,
    diskUsed,
    diskUsedPercent: diskTotal > 0 ? Math.round((diskUsed / diskTotal) * 100) : 0,
    cpuCount: os.cpus().length,
    nodeVersion: process.version,
    platform: os.platform(),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// SERVICE CHECKS — Ping VYRDON endpoints
// ═══════════════════════════════════════════════════════════════════════════

export interface ServiceCheck {
  name: string;
  url: string;
  status: 'up' | 'down' | 'degraded';
  responseTimeMs: number;
  statusCode: number;
}

export async function checkServices(): Promise<ServiceCheck[]> {
  const endpoints = [
    { name: 'VYRDEN AI Room', url: 'https://api.vyrden.com/status' },
    { name: 'VYRDEN Frontend', url: 'https://vyrden.com' },
    { name: 'Ollama', url: 'http://localhost:11434/api/tags' },
  ];

  const results: ServiceCheck[] = [];

  for (const ep of endpoints) {
    const start = Date.now();
    try {
      const res = await fetch(ep.url, { signal: AbortSignal.timeout(5000) });
      results.push({
        name: ep.name,
        url: ep.url,
        status: res.ok ? 'up' : 'degraded',
        responseTimeMs: Date.now() - start,
        statusCode: res.status,
      });
    } catch {
      results.push({
        name: ep.name,
        url: ep.url,
        status: 'down',
        responseTimeMs: Date.now() - start,
        statusCode: 0,
      });
    }
  }

  return results;
}

// ═══════════════════════════════════════════════════════════════════════════
// DOCKER — Container stats
// ═══════════════════════════════════════════════════════════════════════════

export interface DockerContainer {
  id: string;
  name: string;
  image: string;
  status: string;
  ports: string;
  created: string;
}

export function getDockerContainers(): DockerContainer[] {
  try {
    const output = execSync(
      'docker ps --format "{{.ID}}|{{.Names}}|{{.Image}}|{{.Status}}|{{.Ports}}|{{.CreatedAt}}" 2>/dev/null',
      { timeout: 5000, encoding: 'utf-8' }
    );
    return output.trim().split('\n').filter(Boolean).map(line => {
      const [id, name, image, status, ports, created] = line.split('|');
      return { id: id ?? '', name: name ?? '', image: image ?? '', status: status ?? '', ports: ports ?? '', created: created ?? '' };
    });
  } catch {
    return [];
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ETHEREUM GAS — Free Etherscan gas oracle
// ═══════════════════════════════════════════════════════════════════════════

export interface GasData {
  low: number;
  average: number;
  high: number;
  baseFee: number;
  ethPrice: number;
  timestamp: string;
}

export async function fetchGasData(): Promise<GasData> {
  // CoinGecko for ETH price
  const prices = await fetchCryptoPrices('ethereum', 'usd');
  const ethPrice = prices[0]?.current_price ?? 0;

  // Etherscan public gas oracle (free, no key needed for basic)
  let low = 0, average = 0, high = 0, baseFee = 0;
  try {
    const gasData = (await fetchJSON('https://api.etherscan.io/api?module=gastracker&action=gasoracle')) as {
      result?: { SafeGasPrice?: string; ProposeGasPrice?: string; FastGasPrice?: string; suggestBaseFee?: string };
    };
    if (gasData.result) {
      low = parseFloat(gasData.result.SafeGasPrice ?? '0');
      average = parseFloat(gasData.result.ProposeGasPrice ?? '0');
      high = parseFloat(gasData.result.FastGasPrice ?? '0');
      baseFee = parseFloat(gasData.result.suggestBaseFee ?? '0');
    }
  } catch { /* fallback to zero */ }

  return { low, average, high, baseFee, ethPrice, timestamp: new Date().toISOString() };
}

// ═══════════════════════════════════════════════════════════════════════════
// CVE / OSV — Vulnerability database (free)
// ═══════════════════════════════════════════════════════════════════════════

export interface VulnResult {
  id: string;
  summary: string;
  severity: string;
  affected: string;
  published: string;
}

export async function searchVulnerabilities(packageName: string, ecosystem = 'npm'): Promise<VulnResult[]> {
  try {
    const res = await fetch('https://api.osv.dev/v1/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ package: { name: packageName, ecosystem } }),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { vulns?: Record<string, unknown>[] };
    return (data.vulns ?? []).slice(0, 20).map(v => ({
      id: (v['id'] as string) ?? '',
      summary: (v['summary'] as string) ?? '',
      severity: Array.isArray(v['severity']) ? ((v['severity'] as Record<string, string>[])[0]?.['score'] ?? 'unknown') : 'unknown',
      affected: Array.isArray(v['affected']) ? ((v['affected'] as Record<string, unknown>[])[0]?.['package'] as Record<string, string>)?.['name'] ?? packageName : packageName,
      published: (v['published'] as string) ?? '',
    }));
  } catch {
    return [];
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// INTERNAL STATS — VYRDON operational metrics
// ═══════════════════════════════════════════════════════════════════════════

export function getInternalStats(): Record<string, unknown> {
  const agentsRoot = join(process.env['KITTY_ROOT'] ?? process.cwd(), 'vyrden-airoom', 'agents');
  const agentIds = ['SEC-1', 'CFO-1', 'REV-1', 'ENG-1', 'ENG-2', 'BIZ-1', 'DIR-1'];
  const agentStats: Record<string, Record<string, unknown>> = {};

  for (const id of agentIds) {
    const taskHistoryFile = join(agentsRoot, id, 'tasks', 'history.json');
    let taskCount = 0;
    if (existsSync(taskHistoryFile)) {
      try {
        taskCount = (JSON.parse(readFileSync(taskHistoryFile, 'utf-8')) as unknown[]).length;
      } catch { /* */ }
    }

    const memFile = join(agentsRoot, id, 'memory', 'memory.json');
    let memCount = 0;
    if (existsSync(memFile)) {
      try {
        memCount = (JSON.parse(readFileSync(memFile, 'utf-8')) as unknown[]).length;
      } catch { /* */ }
    }

    const evidenceDir = join(agentsRoot, id, 'evidence');
    let evidenceFiles = 0;
    if (existsSync(evidenceDir)) {
      evidenceFiles = readdirSync(evidenceDir).filter(f => f.endsWith('.jsonl')).length;
    }

    agentStats[id] = { taskCount, memoryEntries: memCount, evidenceFiles };
  }

  return {
    agents: agentStats,
    serverUptime: process.uptime(),
    timestamp: new Date().toISOString(),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// BURN RATE CALCULATOR — Pure math, no API needed
// ═══════════════════════════════════════════════════════════════════════════

export interface BurnRateReport {
  monthlyBurn: number;
  netBurn: number;
  runwayMonths: number;
  runwayDate: string;
  burnRate: string;
  status: 'healthy' | 'warning' | 'critical';
}

export function calculateBurnRate(monthlyExpenses: number, currentBalance: number, monthlyRevenue = 0): BurnRateReport {
  const netBurn = monthlyExpenses - monthlyRevenue;
  const runwayMonths = netBurn > 0 ? Math.floor(currentBalance / netBurn) : Infinity;
  const runwayDate = new Date();
  runwayDate.setMonth(runwayDate.getMonth() + (isFinite(runwayMonths) ? runwayMonths : 120));

  let status: 'healthy' | 'warning' | 'critical' = 'healthy';
  if (runwayMonths < 3) status = 'critical';
  else if (runwayMonths < 6) status = 'warning';

  return {
    monthlyBurn: monthlyExpenses,
    netBurn,
    runwayMonths: isFinite(runwayMonths) ? runwayMonths : -1,
    runwayDate: runwayDate.toISOString().split('T')[0]!,
    burnRate: netBurn > 0 ? `$${netBurn.toLocaleString()}/mo net burn` : `$${Math.abs(netBurn).toLocaleString()}/mo net profit`,
    status,
  };
}
