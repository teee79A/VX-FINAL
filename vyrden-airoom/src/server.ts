// VYRDON AI Room Server
// vyrden.com — Hidden Operations Center
// 98 engines, 7 agents, WebSocket, real inference

import 'dotenv/config';
import Fastify from 'fastify';
import fastifyWebsocket from '@fastify/websocket';
import cors from '@fastify/cors';
import { loadConfig } from './core/config.js';
import { registerRoutes } from './routes/api.js';
import { aiRoom } from './ws/room.js';
import { agentRegistry } from './agents/registry.js';
import { ENGINE_COUNT } from './engines/catalog.js';

async function main(): Promise<void> {
  console.log('VYRDON AI Room starting...');

  const config = loadConfig();
  console.log(`Configuration loaded: ${config.host}:${config.port} [${config.env}]`);

  const app = Fastify({
    logger: {
      level: process.env['LOG_LEVEL'] ?? 'info',
    },
    trustProxy: true,
  });

  // CORS
  await app.register(cors, {
    origin: [config.corsOrigin, 'https://vyrden.com', 'https://api.vyrden.com', 'http://localhost:8788'],
    credentials: true,
  });

  // WebSocket
  await app.register(fastifyWebsocket, {
    options: {
      maxPayload: 1048576,
    },
  });

  // WebSocket endpoint — open for operator (no auth for now, behind Cloudflare Zero Trust)
  app.get('/ws', { websocket: true }, (socket, req) => {
    const clientId = aiRoom.connect(socket, 'OPERATOR');

    socket.on('message', (raw: Buffer) => {
      try {
        const data = JSON.parse(raw.toString()) as Record<string, unknown>;
        aiRoom.handleMessage(clientId, data);
      } catch (e) {
        app.log.error(`Message parse error for ${clientId}: ${String(e)}`);
      }
    });

    socket.on('close', () => {
      aiRoom.disconnect(clientId);
    });

    socket.on('error', (err: Error) => {
      app.log.error(`WebSocket error for ${clientId}: ${err.message}`);
    });
  });

  // REST routes
  await registerRoutes(app);

  // Health / status
  app.get('/status', async () => ({
    status: 'operational',
    agents: agentRegistry.getAll().length,
    engines: ENGINE_COUNT,
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  }));

  // Activate all agents on startup
  for (const agent of agentRegistry.getAll()) {
    agentRegistry.activate(agent.id);
  }

  await app.listen({ host: config.host, port: config.port });

  console.log(`
╔══════════════════════════════════════════════════════════════╗
║                    VYRDON AI ROOM                            ║
║                                                              ║
║  Status:  OPERATIONAL                                        ║
║  Domain:  vyrden.com                                         ║
║  Port:    ${String(config.port).padEnd(47)}║
║  Agents:  ${String(agentRegistry.getAll().length).padEnd(46)}║
║  Engines: ${String(ENGINE_COUNT).padEnd(46)}║
║  Mode:    ${config.env.padEnd(47)}║
║                                                              ║
║  WebSocket: /ws                                              ║
║  REST API:  /api/*                                           ║
║  Inference: Ollama (local) → hybrid                          ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
`);

  const shutdown = async (signal: string) => {
    app.log.info(`Shutdown signal received: ${signal}`);
    await app.close();
    process.exit(0);
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

main().catch((err: unknown) => {
  console.error(`Fatal startup error: ${String(err)}`);
  process.exit(1);
});
