// VYRDON AI Room API Routes
// vyrden.com — Hidden Operations Center

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { agentRegistry } from '../agents/registry.js';
import { ENGINE_CATALOG, ENGINE_COUNT, getEnginesByOwner } from '../engines/catalog.js';
import { getGateway } from '../ai/gateway.js';
import { getInferenceRouter } from '../ai/inference/router.js';
import { languageManager } from '../ai/language/index.js';
import { calendarEngine } from '../ai/calendar/index.js';
import { memoryStore, promptInjector } from '../ai/memory/index.js';
import { omniLandEngine } from '../ai/omniland.js';
import { rateLimiter } from '../middleware/rate-limiter.js';
import { evidenceLogger } from '../middleware/evidence-logger.js';
import { agentInvoker } from '../middleware/agent-invoker.js';
import { healthDashboard } from '../middleware/health-dashboard.js';
import type { AgentId } from '../core/types.js';
import type { LanguageCode } from '../ai/language/types.js';
import type { MemoryEntry, MemoryQuery, PromptTemplate } from '../ai/memory/types.js';
import { getTasksForAgent, getAllTaskDefinitions } from '../agents/task-definitions.js';
import { executeRealTask } from '../agents/task-executor.js';
import { getAllAgentWorkspaceStats } from '../agents/workspace.js';
import { registerFlyerBotRoutes } from './flyer-bot.js';

// Extract or generate session ID from request
function getSessionId(req: FastifyRequest): string {
  const authHeader = req.headers['authorization'];
  const sessionHeader = req.headers['x-session-id'];

  if (typeof sessionHeader === 'string') return sessionHeader;
  if (typeof authHeader === 'string') return authHeader.replace('Bearer ', '');

  // Generate from IP + user agent hash
  const ip = req.ip || 'unknown';
  const ua = req.headers['user-agent'] || 'unknown';
  return `${ip}:${ua}`.substring(0, 64);
}

// Rate limiting hook
function setupRateLimitHook(app: FastifyInstance): void {
  app.addHook('preHandler', async (req: FastifyRequest, reply: FastifyReply) => {
    const sessionId = getSessionId(req);
    const { allowed, remaining, resetAt } = rateLimiter.check(sessionId);

    reply.header('X-RateLimit-Limit', '100');
    reply.header('X-RateLimit-Remaining', remaining.toString());
    reply.header('X-RateLimit-Reset', new Date(resetAt).toISOString());

    if (!allowed) {
      reply.code(429);
      return reply.send({
        error: 'RATE_LIMIT_EXCEEDED',
        message: 'Maximum 100 requests per minute exceeded',
        resetAt: new Date(resetAt).toISOString(),
      });
    }
  });
}

// Evidence logging hook
function setupEvidenceLoggingHook(app: FastifyInstance): void {
  app.addHook('onResponse', async (req: FastifyRequest, reply: FastifyReply) => {
    const sessionId = getSessionId(req);

    // Log all requests (async, non-blocking)
    void evidenceLogger.log({
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      timestamp: new Date().toISOString(),
      sessionId,
      method: req.method,
      path: req.url,
      statusCode: reply.statusCode,
      duration: reply.getResponseTime ? Math.round(reply.getResponseTime()) : 0,
    });
  });
}

export async function registerRoutes(app: FastifyInstance): Promise<void> {
  // Setup middleware
  setupRateLimitHook(app);
  setupEvidenceLoggingHook(app);
  await registerFlyerBotRoutes(app);
  // Health check
  app.get('/health', async () => ({
    status: 'operational',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  }));

  // Gateway stats API
  app.get('/api/status', async () => {
    const gateway = getGateway();
    const stats = await gateway.getStats();
    return {
      room: 'vyrden-airoom',
      status: 'active',
      ...stats,
      timestamp: new Date().toISOString(),
    };
  });

  // Agent listing
  app.get('/api/agents', async () => ({
    agents: agentRegistry.getAll(),
    active: agentRegistry.getActiveIds(),
    count: agentRegistry.getActiveCount(),
  }));

  // Agent detail with engines
  app.get<{ Params: { id: string } }>('/api/agents/:id', async (req, reply) => {
    const agentId = req.params.id as AgentId;
    const agent = agentRegistry.get(agentId);
    if (!agent) {
      reply.code(404);
      return { error: 'Agent not found' };
    }
    return {
      ...agent,
      isActive: agentRegistry.isActive(agent.id),
      engines: getEnginesByOwner(agent.id),
    };
  });

  // Engine catalog (metadata only, no execution exposed)
  app.get('/api/engines', async () => ({
    count: ENGINE_COUNT,
    catalog: ENGINE_CATALOG,
    note: 'Engine execution is internal-only. Use WebSocket protocol for authorized operations.',
  }));

  // Inference status
  app.get('/api/inference', async () => {
    const router = getInferenceRouter();
    return router.getStatus();
  });

  // Submit task (authenticated via header)
  app.post<{ Body: { prompt: string; agentId?: string; priority?: string } }>('/api/tasks', async (req, reply) => {
    const authHeader = req.headers['x-vyrdon-key'];
    if (!authHeader || authHeader !== process.env['AIROOM_SECRET']) {
      reply.code(401);
      return { error: 'UNAUTHORIZED' };
    }

    const gateway = getGateway();
    const options: { agentId?: AgentId; priority?: 'critical' | 'high' | 'normal' | 'low' } = {};
    if (req.body.agentId) {
      options.agentId = req.body.agentId as AgentId;
    }
    if (req.body.priority) {
      options.priority = req.body.priority as 'critical' | 'high' | 'normal' | 'low';
    }

    const task = await gateway.submitTask(req.body.prompt, options);

    return { taskId: task.id, status: task.status };
  });

  // Get task status
  app.get<{ Params: { id: string } }>('/api/tasks/:id', async (req, reply) => {
    const gateway = getGateway();
    const task = gateway.getTask(req.params.id);
    if (!task) {
      reply.code(404);
      return { error: 'TASK_NOT_FOUND' };
    }
    return task;
  });

  // Recent tasks (authenticated)
  app.get('/api/tasks', async (req, reply) => {
    const authHeader = req.headers['x-vyrdon-key'];
    if (!authHeader || authHeader !== process.env['AIROOM_SECRET']) {
      reply.code(401);
      return { error: 'UNAUTHORIZED' };
    }

    const gateway = getGateway();
    return { tasks: gateway.getRecentTasks(50) };
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // CHAT API — Streaming completions via Ollama/OpenRouter
  // ═══════════════════════════════════════════════════════════════════════════

  app.post<{
    Body: {
      prompt: string;
      model?: string;
      systemPrompt?: string;
      temperature?: number;
      maxTokens?: number;
      stream?: boolean;
    };
  }>('/api/chat', async (req, reply) => {
    const router = getInferenceRouter();
    const { prompt, model, systemPrompt, temperature, maxTokens, stream } = req.body;

    if (!prompt) {
      reply.code(400);
      return { error: 'PROMPT_REQUIRED' };
    }

    // Build request object, only include defined values
    const request: { prompt: string; model?: string; systemPrompt?: string; temperature?: number; maxTokens?: number } = { prompt };
    if (model !== undefined) request.model = model;
    if (systemPrompt !== undefined) request.systemPrompt = systemPrompt;
    if (temperature !== undefined) request.temperature = temperature;
    if (maxTokens !== undefined) request.maxTokens = maxTokens;

    // Non-streaming response
    if (!stream) {
      const response = await router.generate(request);
      return response;
    }

    // Streaming response via SSE
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });

    for await (const chunk of router.generateStream(request)) {
      reply.raw.write(`data: ${JSON.stringify(chunk)}\n\n`);
      if (chunk.done) break;
    }

    reply.raw.write('data: [DONE]\n\n');
    reply.raw.end();
    return reply;
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // MODELS API — List, pull, delete models
  // ═══════════════════════════════════════════════════════════════════════════

  // List available models (local + cloud)
  app.get('/api/models', async () => {
    const router = getInferenceRouter();
    const status = await router.getStatus();
    const allModels = await router.listAllModels();

    return {
      mode: status.mode,
      activeProvider: status.activeProvider,
      cloudflare: {
        available: status.cloudflareConfigured,
        models: allModels['cloudflare'] ?? [],
      },
      minimax: {
        available: status.minimaxConfigured,
        models: allModels['minimax'] ?? [],
      },
      ollama: {
        available: status.ollamaAvailable,
        models: allModels['ollama'] ?? [],
      },
      openrouter: {
        available: status.openRouterConfigured,
        models: status.openRouterConfigured
          ? [
            { name: 'meta-llama/llama-3.1-8b-instruct', provider: 'openrouter' },
            { name: 'meta-llama/llama-3.1-70b-instruct', provider: 'openrouter' },
          ]
          : [],
      },
    };
  });

  // Pull a model (Ollama)
  app.post<{ Body: { model: string } }>('/api/models/pull', async (req, reply) => {
    const { model } = req.body;
    if (!model) {
      reply.code(400);
      return { error: 'MODEL_NAME_REQUIRED' };
    }

    // Stream the pull progress via SSE
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });

    const response = await fetch('http://localhost:11434/api/pull', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: model, stream: true }),
    });

    if (!response.ok || !response.body) {
      reply.raw.write(`data: ${JSON.stringify({ error: 'PULL_FAILED', status: response.status })}\n\n`);
      reply.raw.end();
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const text = decoder.decode(value, { stream: true });
      const lines = text.split('\n').filter(Boolean);
      for (const line of lines) {
        reply.raw.write(`data: ${line}\n\n`);
      }
    }

    reply.raw.write('data: [DONE]\n\n');
    reply.raw.end();
    return reply;
  });

  // Delete a model (Ollama)
  app.delete<{ Params: { name: string } }>('/api/models/:name', async (req, reply) => {
    const response = await fetch('http://localhost:11434/api/delete', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: req.params.name }),
    });

    if (!response.ok) {
      reply.code(response.status);
      return { error: 'DELETE_FAILED' };
    }

    return { deleted: req.params.name };
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // LANGUAGE API — Translation, detection, sentiment, entities
  // ═══════════════════════════════════════════════════════════════════════════

  // Translate text
  app.post<{
    Body: { text: string; targetLang: string; sourceLang?: string };
  }>('/api/language/translate', async (req, reply) => {
    const { text, targetLang, sourceLang } = req.body;

    if (!text || !targetLang) {
      reply.code(400);
      return { error: 'TEXT_AND_TARGET_LANG_REQUIRED' };
    }

    const result = await languageManager.translate(
      text,
      targetLang as LanguageCode,
      sourceLang as LanguageCode | undefined
    );
    return result;
  });

  // Detect language
  app.post<{ Body: { text: string } }>('/api/language/detect', async (req, reply) => {
    const { text } = req.body;

    if (!text) {
      reply.code(400);
      return { error: 'TEXT_REQUIRED' };
    }

    const result = await languageManager.detectLanguage(text);
    return result;
  });

  // Analyze sentiment
  app.post<{ Body: { text: string } }>('/api/language/sentiment', async (req, reply) => {
    const { text } = req.body;

    if (!text) {
      reply.code(400);
      return { error: 'TEXT_REQUIRED' };
    }

    const result = await languageManager.analyzeSentiment(text);
    return result;
  });

  // Extract entities
  app.post<{ Body: { text: string } }>('/api/language/entities', async (req, reply) => {
    const { text } = req.body;

    if (!text) {
      reply.code(400);
      return { error: 'TEXT_REQUIRED' };
    }

    const result = await languageManager.extractEntities(text);
    return result;
  });

  // Summarize text
  app.post<{
    Body: { text: string; maxLength?: number; style?: 'bullet' | 'paragraph' | 'headline' };
  }>('/api/language/summarize', async (req, reply) => {
    const { text, maxLength, style } = req.body;

    if (!text) {
      reply.code(400);
      return { error: 'TEXT_REQUIRED' };
    }

    const result = await languageManager.summarize(text, maxLength, style);
    return result;
  });

  // Language health check
  app.get('/api/language/health', async () => {
    const health = await languageManager.checkHealth();
    return { providers: health };
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // CALENDAR API — Events, scheduling, reminders
  // ═══════════════════════════════════════════════════════════════════════════

  // List events
  app.get<{
    Querystring: { start?: string; end?: string; status?: string };
  }>('/api/calendar/events', async (req) => {
    const { start, end, status } = req.query;

    // Build query, only include defined values
    const query: { startDate?: string; endDate?: string; status?: 'scheduled' | 'completed' | 'cancelled' } = {};
    if (start !== undefined) query.startDate = start;
    if (end !== undefined) query.endDate = end;
    if (status !== undefined) query.status = status as 'scheduled' | 'completed' | 'cancelled';

    const events = calendarEngine.query(query);

    return { events };
  });

  // Get single event
  app.get<{ Params: { id: string } }>('/api/calendar/events/:id', async (req, reply) => {
    const event = calendarEngine.getEvent(req.params.id);
    if (!event) {
      reply.code(404);
      return { error: 'EVENT_NOT_FOUND' };
    }
    return event;
  });

  // Create event
  app.post<{
    Body: {
      title: string;
      description?: string;
      startTime: string;
      endTime?: string;
      priority?: 'critical' | 'high' | 'normal' | 'low';
      tags?: string[];
    };
  }>('/api/calendar/events', async (req, reply) => {
    const { title, description, startTime, endTime, priority, tags } = req.body;

    if (!title || !startTime) {
      reply.code(400);
      return { error: 'TITLE_AND_START_TIME_REQUIRED' };
    }

    const end = endTime || new Date(new Date(startTime).getTime() + 60 * 60 * 1000).toISOString();

    // Build options, only include defined values
    const options: { description?: string; priority?: 'critical' | 'high' | 'normal' | 'low'; tags?: string[] } = {};
    if (description !== undefined) options.description = description;
    if (priority !== undefined) options.priority = priority;
    if (tags !== undefined) options.tags = tags;

    const event = calendarEngine.createEvent(title, startTime, end, options);

    return event;
  });

  // Update event
  app.put<{
    Params: { id: string };
    Body: Partial<{
      title: string;
      description: string;
      startTime: string;
      endTime: string;
      status: 'scheduled' | 'completed' | 'cancelled';
      priority: 'critical' | 'high' | 'normal' | 'low';
      tags: string[];
    }>;
  }>('/api/calendar/events/:id', async (req, reply) => {
    const event = calendarEngine.updateEvent(req.params.id, req.body);
    if (!event) {
      reply.code(404);
      return { error: 'EVENT_NOT_FOUND' };
    }
    return event;
  });

  // Delete event
  app.delete<{ Params: { id: string } }>('/api/calendar/events/:id', async (req, reply) => {
    const deleted = calendarEngine.deleteEvent(req.params.id);
    if (!deleted) {
      reply.code(404);
      return { error: 'EVENT_NOT_FOUND' };
    }
    return { deleted: req.params.id };
  });

  // Calendar stats
  app.get('/api/calendar/stats', async () => {
    const stats = calendarEngine.getStats();
    return stats;
  });

  // Find free slots
  app.post<{
    Body: { startDate: string; endDate: string; durationMinutes: number };
  }>('/api/calendar/slots', async (req, reply) => {
    const { startDate, endDate, durationMinutes } = req.body;

    if (!startDate || !endDate || !durationMinutes) {
      reply.code(400);
      return { error: 'START_DATE_END_DATE_AND_DURATION_REQUIRED' };
    }

    const slots = calendarEngine.findAvailableSlots(startDate, endDate, durationMinutes);
    return { slots: slots.filter(s => s.available) };
  });

  // Upcoming events
  app.get<{ Querystring: { limit?: string } }>('/api/calendar/upcoming', async (req) => {
    const limit = parseInt(req.query.limit ?? '10', 10);
    const events = calendarEngine.getUpcoming(limit);
    return { events };
  });

  // Overdue events
  app.get('/api/calendar/overdue', async () => {
    const events = calendarEngine.getOverdue();
    return { events };
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // MEMORY API — Persistent context, auto-injection, templates
  // ═══════════════════════════════════════════════════════════════════════════

  // Memory stats
  app.get('/api/memory/stats', async () => {
    const stats = memoryStore.getStats();
    return stats;
  });

  // Query memories
  app.post<{
    Body: {
      agentId?: string;
      type?: MemoryEntry['type'];
      tags?: string[];
      limit?: number;
      minPriority?: number;
    };
  }>('/api/memory/query', async (req) => {
    const query: MemoryQuery = {};
    if (req.body.agentId !== undefined) query.agentId = req.body.agentId as AgentId | 'system';
    if (req.body.type !== undefined) query.type = req.body.type;
    if (req.body.tags !== undefined) query.tags = req.body.tags;
    if (req.body.limit !== undefined) query.limit = req.body.limit;
    if (req.body.minPriority !== undefined) query.minPriority = req.body.minPriority;
    const memories = memoryStore.query(query);
    return { memories, count: memories.length };
  });

  // Create memory entry
  app.post<{
    Body: {
      agentId: string;
      type: MemoryEntry['type'];
      content: string;
      priority?: number;
      tags?: string[];
      metadata?: Record<string, unknown>;
      expiresAt?: string;
    };
  }>('/api/memory', async (req, reply) => {
    const { agentId, type, content, priority, tags, metadata, expiresAt } = req.body;

    if (!agentId || !type || !content) {
      reply.code(400);
      return { error: 'AGENT_ID_TYPE_AND_CONTENT_REQUIRED' };
    }

    const entryData: Omit<MemoryEntry, 'id' | 'createdAt' | 'updatedAt'> = {
      agentId: agentId as AgentId | 'system',
      type,
      content,
      priority: priority ?? 5,
      tags: tags ?? [],
      metadata: metadata ?? {},
    };

    if (expiresAt !== undefined) {
      entryData.expiresAt = expiresAt;
    }

    const entry = memoryStore.create(entryData);

    return entry;
  });

  // Get memory by ID
  app.get<{ Params: { id: string } }>('/api/memory/:id', async (req, reply) => {
    const memory = memoryStore.get(req.params.id);
    if (!memory) {
      reply.code(404);
      return { error: 'MEMORY_NOT_FOUND' };
    }
    return memory;
  });

  // Update memory
  app.put<{
    Params: { id: string };
    Body: Partial<{
      content: string;
      priority: number;
      tags: string[];
      metadata: Record<string, unknown>;
      expiresAt: string;
    }>;
  }>('/api/memory/:id', async (req, reply) => {
    const memory = memoryStore.update(req.params.id, req.body);
    if (!memory) {
      reply.code(404);
      return { error: 'MEMORY_NOT_FOUND' };
    }
    return memory;
  });

  // Delete memory
  app.delete<{ Params: { id: string } }>('/api/memory/:id', async (req, reply) => {
    const deleted = memoryStore.delete(req.params.id);
    if (!deleted) {
      reply.code(404);
      return { error: 'MEMORY_NOT_FOUND' };
    }
    return { deleted: req.params.id };
  });

  // Add fact to agent memory
  app.post<{
    Body: { agentId: string; fact: string; priority?: number };
  }>('/api/memory/fact', async (req, reply) => {
    const { agentId, fact, priority } = req.body;

    if (!agentId || !fact) {
      reply.code(400);
      return { error: 'AGENT_ID_AND_FACT_REQUIRED' };
    }

    const entry = promptInjector.addFact(
      agentId as AgentId | 'system',
      fact,
      priority ?? 5
    );
    return entry;
  });

  // Add persistent injection
  app.post<{
    Body: { agentId: string; content: string; priority?: number };
  }>('/api/memory/injection', async (req, reply) => {
    const { agentId, content, priority } = req.body;

    if (!agentId || !content) {
      reply.code(400);
      return { error: 'AGENT_ID_AND_CONTENT_REQUIRED' };
    }

    const entry = promptInjector.addInjection(
      agentId as AgentId | 'system',
      content,
      priority ?? 10
    );
    return entry;
  });

  // Build injection context for agent
  app.post<{
    Body: {
      agentId: string;
      prompt: string;
      includeMemories?: boolean;
      includeTemplates?: boolean;
      maxMemories?: number;
      customContext?: string;
    };
  }>('/api/memory/context', async (req, reply) => {
    const { agentId, prompt, ...options } = req.body;

    if (!agentId || !prompt) {
      reply.code(400);
      return { error: 'AGENT_ID_AND_PROMPT_REQUIRED' };
    }

    const context = promptInjector.buildContext(agentId as AgentId, prompt, options);
    return context;
  });

  // Get agent memory summary
  app.get<{ Params: { agentId: string } }>('/api/memory/summary/:agentId', async (req) => {
    const summary = promptInjector.getSummary(req.params.agentId as AgentId);
    return {
      agentId: req.params.agentId,
      ...summary,
    };
  });

  // Template operations
  app.get('/api/memory/templates', async () => {
    const templates = memoryStore.getAllTemplates();
    return { templates };
  });

  app.post<{
    Body: {
      name: string;
      content: string;
      variables: string[];
      agentId?: string;
      autoInject?: boolean;
      priority?: number;
    };
  }>('/api/memory/templates', async (req, reply) => {
    const { name, content, variables, agentId, autoInject, priority } = req.body;

    if (!name || !content) {
      reply.code(400);
      return { error: 'NAME_AND_CONTENT_REQUIRED' };
    }

    const templateData: Omit<PromptTemplate, 'id'> = {
      name,
      content,
      variables: variables ?? [],
      autoInject: autoInject ?? false,
      priority: priority ?? 5,
    };

    if (agentId !== undefined) {
      templateData.agentId = agentId as AgentId;
    }

    const template = memoryStore.createTemplate(templateData);
    return template;
  });

  app.delete<{ Params: { id: string } }>('/api/memory/templates/:id', async (req, reply) => {
    const deleted = memoryStore.deleteTemplate(req.params.id);
    if (!deleted) {
      reply.code(404);
      return { error: 'TEMPLATE_NOT_FOUND' };
    }
    return { deleted: req.params.id };
  });

  // Force save memories to disk
  app.post('/api/memory/flush', async () => {
    memoryStore.flush();
    return { flushed: true, timestamp: new Date().toISOString() };
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // OMNI LAND API — Domain control, territories, land operations
  // ═══════════════════════════════════════════════════════════════════════════

  // Land stats overview
  app.get('/api/land/stats', async () => {
    const stats = omniLandEngine.getStats();
    return {
      ...stats,
      timestamp: new Date().toISOString(),
    };
  });

  // List all domains
  app.get('/api/land/domains', async () => {
    const domains = omniLandEngine.getAllDomains();
    return {
      domains,
      count: domains.length,
      active: domains.filter(d => d.status === 'active').length,
      building: domains.filter(d => d.status === 'building').length,
    };
  });

  // Get domain by ID
  app.get<{ Params: { id: string } }>('/api/land/domains/:id', async (req, reply) => {
    const domain = omniLandEngine.getDomain(req.params.id);
    if (!domain) {
      reply.code(404);
      return { error: 'DOMAIN_NOT_FOUND' };
    }
    return domain;
  });

  // List all territories
  app.get('/api/land/territories', async () => {
    const territories = omniLandEngine.getAllTerritories();
    return {
      territories,
      count: territories.length,
    };
  });

  // Get territory by ID
  app.get<{ Params: { id: string } }>('/api/land/territories/:id', async (req, reply) => {
    const territory = omniLandEngine.getTerritory(req.params.id);
    if (!territory) {
      reply.code(404);
      return { error: 'TERRITORY_NOT_FOUND' };
    }
    return territory;
  });

  // Get agent land status
  app.get<{ Params: { agentId: string } }>('/api/land/agents/:agentId', async (req) => {
    const agentId = req.params.agentId as AgentId;
    const land = omniLandEngine.getAgentLand(agentId);
    const agent = agentRegistry.get(agentId);

    return {
      agentId,
      agentName: agent?.name ?? 'Unknown',
      domains: land.domains,
      domainCount: land.domains.length,
      engines: land.engines,
      territory: land.territory,
      status: 'ALL AGENTS OWN THE LAND',
    };
  });

  // Claim land stake (symbolic ownership)
  app.post<{ Params: { agentId: string } }>('/api/land/claim/:agentId', async (req, reply) => {
    const authHeader = req.headers['x-vyrdon-key'];
    if (!authHeader || authHeader !== process.env['AIROOM_SECRET']) {
      reply.code(401);
      return { error: 'UNAUTHORIZED' };
    }

    const agentId = req.params.agentId as AgentId;
    const result = omniLandEngine.claimLand(agentId);

    return {
      claimed: true,
      agentId,
      message: result,
      timestamp: new Date().toISOString(),
    };
  });

  // Submit land operation
  app.post<{
    Body: {
      type: 'deploy' | 'expand' | 'fortify' | 'patrol' | 'scan' | 'report';
      target: string;
      agentId: string;
    };
  }>('/api/land/operations', async (req, reply) => {
    const authHeader = req.headers['x-vyrdon-key'];
    if (!authHeader || authHeader !== process.env['AIROOM_SECRET']) {
      reply.code(401);
      return { error: 'UNAUTHORIZED' };
    }

    const { type, target, agentId } = req.body;

    if (!type || !agentId) {
      reply.code(400);
      return { error: 'TYPE_AND_AGENT_ID_REQUIRED' };
    }

    const operation = await omniLandEngine.submitOperation(
      type,
      target ?? 'vyrdon-land',
      agentId as AgentId
    );

    return operation;
  });

  // Get operation by ID
  app.get<{ Params: { id: string } }>('/api/land/operations/:id', async (req, reply) => {
    const operation = omniLandEngine.getOperation(req.params.id);
    if (!operation) {
      reply.code(404);
      return { error: 'OPERATION_NOT_FOUND' };
    }
    return operation;
  });

  // List recent operations
  app.get<{ Querystring: { limit?: string } }>('/api/land/operations', async (req) => {
    const limit = parseInt(req.query.limit ?? '20', 10);
    const operations = omniLandEngine.getRecentOperations(limit);
    return {
      operations,
      count: operations.length,
    };
  });

  // Quick patrol (scan all domains)
  app.post<{ Body: { agentId?: string } }>('/api/land/patrol', async (req, reply) => {
    const authHeader = req.headers['x-vyrdon-key'];
    if (!authHeader || authHeader !== process.env['AIROOM_SECRET']) {
      reply.code(401);
      return { error: 'UNAUTHORIZED' };
    }

    const agentId = (req.body.agentId ?? 'DIR-1') as AgentId;
    const operation = await omniLandEngine.submitOperation('patrol', 'vyrdon-land', agentId);

    return {
      patrolComplete: operation.status === 'completed',
      result: operation.result,
      timestamp: new Date().toISOString(),
    };
  });

  // Quick scan (specific domain)
  app.post<{ Body: { domainId: string; agentId?: string } }>('/api/land/scan', async (req, reply) => {
    const authHeader = req.headers['x-vyrdon-key'];
    if (!authHeader || authHeader !== process.env['AIROOM_SECRET']) {
      reply.code(401);
      return { error: 'UNAUTHORIZED' };
    }

    const { domainId, agentId } = req.body;

    if (!domainId) {
      reply.code(400);
      return { error: 'DOMAIN_ID_REQUIRED' };
    }

    const agent = (agentId ?? 'SEC-1') as AgentId;
    const operation = await omniLandEngine.submitOperation('scan', domainId, agent);

    return {
      scanComplete: operation.status === 'completed',
      result: operation.result,
      timestamp: new Date().toISOString(),
    };
  });

  // Generate full land report
  app.get<{ Querystring: { agentId?: string } }>('/api/land/report', async (req, reply) => {
    const authHeader = req.headers['x-vyrdon-key'];
    if (!authHeader || authHeader !== process.env['AIROOM_SECRET']) {
      reply.code(401);
      return { error: 'UNAUTHORIZED' };
    }

    const agentId = (req.query.agentId ?? 'DIR-1') as AgentId;
    const operation = await omniLandEngine.submitOperation('report', 'vyrdon-land', agentId);

    return {
      reportGenerated: operation.status === 'completed',
      report: operation.result,
      timestamp: new Date().toISOString(),
    };
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // AGENT INVOCATION API — /api/agent/:id/invoke
  // ═══════════════════════════════════════════════════════════════════════════

  // Invoke agent with prompt (non-streaming)
  app.post<{
    Params: { id: string };
    Body: {
      prompt: string;
      context?: Record<string, unknown>;
      temperature?: number;
      maxTokens?: number;
      useCloudflare?: boolean;
    };
  }>('/api/agent/:id/invoke', async (req, reply) => {
    const agentId = req.params.id as AgentId;
    const agent = agentRegistry.get(agentId);

    if (!agent) {
      reply.code(404);
      return { error: 'AGENT_NOT_FOUND', agentId };
    }

    const sessionId = getSessionId(req);

    const response = await agentInvoker.invoke(agentId, {
      prompt: req.body.prompt,
      context: req.body.context,
      temperature: req.body.temperature,
      maxTokens: req.body.maxTokens,
      useCloudflare: req.body.useCloudflare ?? false,
    });

    // Log to evidence (async)
    void evidenceLogger.log({
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      timestamp: new Date().toISOString(),
      sessionId,
      method: 'POST',
      path: req.url,
      statusCode: 200,
      agentId,
      prompt: req.body.prompt,
      response: response.result,
      duration: response.duration,
      metadata: { model: response.model },
    });

    return response;
  });

  // Invoke agent with streaming response
  app.post<{
    Params: { id: string };
    Body: {
      prompt: string;
      temperature?: number;
      maxTokens?: number;
      useCloudflare?: boolean;
    };
  }>('/api/agent/:id/invoke/stream', async (req, reply) => {
    const agentId = req.params.id as AgentId;
    const agent = agentRegistry.get(agentId);

    if (!agent) {
      reply.code(404);
      return { error: 'AGENT_NOT_FOUND' };
    }

    // Stream via SSE
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });

    for await (const chunk of agentInvoker.invokeStream(agentId, {
      prompt: req.body.prompt,
      temperature: req.body.temperature,
      maxTokens: req.body.maxTokens,
      useCloudflare: req.body.useCloudflare ?? false,
    })) {
      reply.raw.write(`data: ${JSON.stringify(chunk)}\n\n`);
      if (chunk.done) break;
    }

    reply.raw.write('data: [DONE]\n\n');
    reply.raw.end();
    return reply;
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // HEALTH DASHBOARD — /admin/health (Behind Zero Trust)
  // ═══════════════════════════════════════════════════════════════════════════

  // Full health status (requires Cloudflare auth header)
  app.get('/admin/health', async (req, reply) => {
    // Require CF authentication header (set by Cloudflare Zero Trust)
    const cfAuth = req.headers['cf-authenticated-user'] || req.headers['cf-ray'];

    if (!cfAuth) {
      reply.code(401);
      return { error: 'UNAUTHORIZED', message: 'Cloudflare authentication required' };
    }

    const health = await healthDashboard.getFullHealth();
    return health;
  });

  // Quick health check (no auth required)
  app.get('/health/quick', async () => {
    const health = await healthDashboard.getFullHealth();
    return {
      status: health.status,
      agents: health.agents.total,
      agentsActive: health.agents.active,
      engines: health.engines.total,
      uptime: Math.round(health.uptime),
      timestamp: health.timestamp,
    };
  });

  // Agent health endpoint
  app.get<{ Params: { agentId: string } }>('/admin/health/agent/:agentId', async (req, reply) => {
    const cfAuth = req.headers['cf-authenticated-user'] || req.headers['cf-ray'];

    if (!cfAuth) {
      reply.code(401);
      return { error: 'UNAUTHORIZED' };
    }

    const agentHealth = await healthDashboard.getAgentHealth(req.params.agentId);
    if (!agentHealth) {
      reply.code(404);
      return { error: 'AGENT_NOT_FOUND' };
    }

    return agentHealth;
  });

  // Engine health endpoint
  app.get('/admin/health/engines', async (req, reply) => {
    const cfAuth = req.headers['cf-authenticated-user'] || req.headers['cf-ray'];

    if (!cfAuth) {
      reply.code(401);
      return { error: 'UNAUTHORIZED' };
    }

    return healthDashboard.getEngineHealth();
  });

  // Inference health endpoint
  app.get('/admin/health/inference', async (req, reply) => {
    const cfAuth = req.headers['cf-authenticated-user'] || req.headers['cf-ray'];

    if (!cfAuth) {
      reply.code(401);
      return { error: 'UNAUTHORIZED' };
    }

    return healthDashboard.getInferenceHealth();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // REAL TASK API — Per-agent task definitions + live execution
  // ═══════════════════════════════════════════════════════════════════════════

  // List all task definitions
  app.get('/api/task-definitions', async () => ({
    tasks: getAllTaskDefinitions(),
  }));

  // List tasks for a specific agent
  app.get<{ Params: { id: string } }>('/api/agents/:id/tasks', async (req, reply) => {
    const agentId = req.params.id as AgentId;
    const agent = agentRegistry.get(agentId);
    if (!agent) {
      reply.code(404);
      return { error: 'Agent not found' };
    }
    const tasks = getTasksForAgent(agentId);
    return {
      agentId,
      agentName: agent.name,
      tasks,
      count: tasks.length,
    };
  });

  // Execute a real task — fetches live data + LLM analysis
  app.post<{
    Params: { id: string };
    Body: { taskId: string; inputs?: Record<string, unknown> };
  }>('/api/agents/:id/execute', async (req, reply) => {
    const agentId = req.params.id as AgentId;
    const agent = agentRegistry.get(agentId);
    if (!agent) {
      reply.code(404);
      return { error: 'Agent not found' };
    }

    const { taskId, inputs } = req.body;
    if (!taskId) {
      reply.code(400);
      return { error: 'taskId required' };
    }

    const result = await executeRealTask(taskId, inputs ?? {}, agentId);
    return { ...result, content: result.analysis };
  });

  // Get workspace stats for all agents
  app.get('/api/workspace/stats', async () => ({
    stats: getAllAgentWorkspaceStats(),
    timestamp: new Date().toISOString(),
  }));
}
