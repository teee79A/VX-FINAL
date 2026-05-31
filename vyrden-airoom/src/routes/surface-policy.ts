export type SurfaceAccess = 'public' | 'protected' | 'internal' | 'unknown';

export interface SurfaceRouteSpec {
  path: string;
  access: Exclude<SurfaceAccess, 'unknown'>;
  methods: readonly string[];
  room: string;
  purpose: string;
}

export const PUBLIC_EXACT_ROUTES = [
  '/',
  '/auth/login',
  '/billing',
  '/health',
  '/invoices',
  '/proof',
  '/receipts',
  '/webhooks/payment',
] as const;

export const PUBLIC_API_FACADE_ROUTES = ['/api/routes', '/api/status'] as const;

export const PROTECTED_ROUTE_PREFIXES = ['/app'] as const;

export const INTERNAL_ROUTE_PREFIXES = [
  '/admin',
  '/ai-internal',
  '/asus',
  '/campaign',
  '/evidence-private',
  '/kitty-internal',
  '/operational',
  '/shared',
  '/shell',
  '/ws',
] as const;

export const SURFACE_ROUTE_CATALOG: readonly SurfaceRouteSpec[] = [
  { path: '/', access: 'public', methods: ['GET'], room: 'commercial', purpose: 'platform landing and public app shell' },
  { path: '/app', access: 'protected', methods: ['GET'], room: 'commercial', purpose: 'authenticated platform UI' },
  { path: '/billing', access: 'public', methods: ['GET'], room: 'commercial', purpose: 'billing and account surface' },
  { path: '/receipts', access: 'public', methods: ['GET'], room: 'commercial', purpose: 'receipt surface' },
  { path: '/invoices', access: 'public', methods: ['GET'], room: 'commercial', purpose: 'invoice surface' },
  { path: '/proof', access: 'public', methods: ['GET'], room: 'evidence-public', purpose: 'proof and verification surface' },
  { path: '/webhooks/payment', access: 'public', methods: ['POST'], room: 'commercial', purpose: 'payment webhook ingress' },
  { path: '/api/status', access: 'public', methods: ['GET'], room: 'commercial', purpose: 'public platform status facade' },
  { path: '/api/routes', access: 'public', methods: ['GET'], room: 'commercial', purpose: 'public route contract' },
  { path: '/operational/*', access: 'internal', methods: ['ANY'], room: 'operational', purpose: 'internal runtime operations' },
  { path: '/campaign/*', access: 'internal', methods: ['ANY'], room: 'campaign', purpose: 'internal campaign workflows' },
  { path: '/ai-internal/*', access: 'internal', methods: ['ANY'], room: 'ai', purpose: 'hidden AI execution lane' },
  { path: '/evidence-private/*', access: 'internal', methods: ['ANY'], room: 'evidence-private', purpose: 'private evidence engine' },
  { path: '/shared/*', access: 'internal', methods: ['ANY'], room: 'shared', purpose: 'shared runtime infrastructure' },
  { path: '/asus/*', access: 'internal', methods: ['ANY'], room: 'governance', purpose: 'governance and authority lane' },
  { path: '/kitty-internal/*', access: 'internal', methods: ['ANY'], room: 'internal', purpose: 'private workstation and service paths' },
] as const;

function matchesPrefix(path: string, prefix: string): boolean {
  return path === prefix || path.startsWith(`${prefix}/`);
}

export function toSurfacePath(urlOrPath: string): string {
  try {
    return new URL(urlOrPath, 'https://vyrdx.vyrdon.com').pathname;
  } catch {
    const [withoutHash] = urlOrPath.split('#');
    const [withoutQuery] = withoutHash.split('?');
    return withoutQuery || '/';
  }
}

export function resolveSurfaceAccess(urlOrPath: string): SurfaceAccess {
  const path = toSurfacePath(urlOrPath);

  if (INTERNAL_ROUTE_PREFIXES.some(prefix => matchesPrefix(path, prefix))) {
    return 'internal';
  }

  if (PROTECTED_ROUTE_PREFIXES.some(prefix => matchesPrefix(path, prefix))) {
    return 'protected';
  }

  if (PUBLIC_EXACT_ROUTES.includes(path as (typeof PUBLIC_EXACT_ROUTES)[number])) {
    return 'public';
  }

  if (PUBLIC_API_FACADE_ROUTES.includes(path as (typeof PUBLIC_API_FACADE_ROUTES)[number])) {
    return 'public';
  }

  return 'unknown';
}
