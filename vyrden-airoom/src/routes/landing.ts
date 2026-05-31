import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { getGateway } from '../ai/gateway.js';
import { authenticator } from '../middleware/authenticator.js';
import {
  PUBLIC_API_FACADE_ROUTES,
  SURFACE_ROUTE_CATALOG,
  type SurfaceRouteSpec,
} from './surface-policy.js';
import { renderScene, type SceneMeta } from './ui.js';

const NAMESPACE_MODEL = [
  'vyrdx-commercial',
  'vyrdx-evidence-public',
  'vyrdx-evidence-private',
  'vyrdx-operational',
  'vyrdx-campaign',
  'vyrdx-ai',
  'vyrdx-shared',
  'vyrdx-governance',
] as const;

const [ROUTES_FACADE_PATH, STATUS_FACADE_PATH] = PUBLIC_API_FACADE_ROUTES;

const PUBLIC_SCENE_META: Record<string, SceneMeta> = {
  '/': {
    pageTitle: 'VYRDON',
    routeLabel: 'vyrdx.vyrdon.com / platform landing',
    hint: 'public shell for commercial, proof, and authenticated app entry.',
  },
  '/billing': {
    pageTitle: 'VYRDON Billing',
    routeLabel: 'vyrdx.vyrdon.com/billing / commercial billing surface',
    hint: 'billing, account, and subscription entry on the commercial room.',
  },
  '/receipts': {
    pageTitle: 'VYRDON Receipts',
    routeLabel: 'vyrdx.vyrdon.com/receipts / receipt surface',
    hint: 'evidence-backed receipt output on the commercial room.',
  },
  '/invoices': {
    pageTitle: 'VYRDON Invoices',
    routeLabel: 'vyrdx.vyrdon.com/invoices / invoice surface',
    hint: 'invoice output routed through the commercial room.',
  },
  '/proof': {
    pageTitle: 'VYRDON Proof',
    routeLabel: 'vyrdx.vyrdon.com/proof / evidence public verification',
    hint: 'proof metadata and verification only. no raw evidence, no signer exposure.',
  },
};

async function replyWithScene(path: keyof typeof PUBLIC_SCENE_META, reply: FastifyReply): Promise<string> {
  const stats = await getGateway().getStats();
  reply.type('text/html');
  return renderScene(stats, PUBLIC_SCENE_META[path]);
}

function getPublicRoutes(): readonly SurfaceRouteSpec[] {
  return SURFACE_ROUTE_CATALOG.filter(route => route.access === 'public' || route.access === 'protected');
}

export async function registerLandingRoutes(app: FastifyInstance): Promise<void> {
  app.post('/auth/login', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as { passkey?: string; guest?: boolean };
      const session = authenticator.createSession();

      if (body.guest) {
        reply.cookie('vyrden_session', session.sessionId, {
          httpOnly: true,
          secure: true,
          sameSite: 'strict',
          maxAge: 7 * 24 * 60 * 60,
          path: '/',
        });

        return reply.send({
          ok: true,
          redirect: '/app?mode=guest',
        });
      }

      const validPasskey = process.env['VYRDEN_PASSKEY'] || 'vyrden-access-2026';
      if (body.passkey === validPasskey) {
        authenticator.authenticateSession(session.sessionId);

        reply.cookie('vyrden_session', session.sessionId, {
          httpOnly: true,
          secure: true,
          sameSite: 'strict',
          maxAge: 7 * 24 * 60 * 60,
          path: '/',
        });

        return reply.send({
          ok: true,
          redirect: '/app',
        });
      }

      return reply.status(401).send({
        error: 'Invalid access code',
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return reply.status(500).send({
        error: `Authentication error: ${message}`,
      });
    }
  });

  app.get('/health', async () => ({
    status: 'operational',
    surface: 'vyrdx.vyrdon.com',
    timestamp: new Date().toISOString(),
  }));

  app.get('/', async (_, reply) => replyWithScene('/', reply));
  app.get('/billing', async (_, reply) => replyWithScene('/billing', reply));
  app.get('/receipts', async (_, reply) => replyWithScene('/receipts', reply));
  app.get('/invoices', async (_, reply) => replyWithScene('/invoices', reply));
  app.get('/proof', async (_, reply) => replyWithScene('/proof', reply));

  app.get(STATUS_FACADE_PATH, async () => {
    const stats = await getGateway().getStats();
    return {
      surface: 'vyrdx.vyrdon.com',
      runtime: 'digitalocean',
      rooms: {
        commercial: 'public',
        evidencePublic: 'public',
        evidencePrivate: 'internal',
        operational: 'internal',
        campaign: 'internal',
        ai: 'internal',
        shared: 'internal',
        governance: 'restricted',
      },
      stats,
      timestamp: new Date().toISOString(),
    };
  });

  app.get(ROUTES_FACADE_PATH, async () => ({
    surface: 'vyrdx.vyrdon.com',
    routes: getPublicRoutes(),
    namespaces: NAMESPACE_MODEL,
    timestamp: new Date().toISOString(),
  }));

  app.post('/webhooks/payment', async (_, reply) => {
    return reply.status(501).send({
      error: 'NOT_IMPLEMENTED',
      message: 'Payment webhook ingress is reserved for the commercial room integration track.',
    });
  });
}
