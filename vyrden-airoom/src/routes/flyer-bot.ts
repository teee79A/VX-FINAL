import type { FastifyInstance } from 'fastify';
import {
  ingestFlyerFeedback,
  parsePilotList,
  sendFlyer,
  type FlyerFeedbackInput,
  type FlyerPilotContact,
} from '../bots/flyer-distribution.js';

export async function registerFlyerBotRoutes(app: FastifyInstance): Promise<void> {
  app.post<{ Body: FlyerPilotContact }>('/api/flyer-bot/send', async (request, reply) => {
    try {
      const result = sendFlyer(request.body);
      if (!result.ok) return reply.code(403).send(result);
      return reply.code(202).send(result);
    } catch (error) {
      return reply.code(503).send({
        error: 'evidence_not_written',
        detail: error instanceof Error ? error.message : String(error),
      });
    }
  });

  app.post<{ Body: { format?: 'json' | 'csv'; raw?: string } }>('/api/flyer-bot/pilots/parse', async (request, reply) => {
    const format = request.body?.format;
    const raw = request.body?.raw;
    if (!format || !raw) {
      return reply.code(400).send({
        error: 'pilot_list_required',
        requiredFields: ['format', 'raw'],
      });
    }

    try {
      return { pilots: parsePilotList(raw, format) };
    } catch (error) {
      return reply.code(400).send({
        error: 'pilot_list_parse_failed',
        detail: error instanceof Error ? error.message : String(error),
      });
    }
  });

  app.post<{ Body: FlyerFeedbackInput }>('/api/flyer-bot/feedback', async (request, reply) => {
    try {
      return reply.code(201).send(ingestFlyerFeedback(request.body));
    } catch (error) {
      return reply.code(400).send({
        error: 'feedback_ingestion_failed',
        detail: error instanceof Error ? error.message : String(error),
      });
    }
  });
}
