import { describe, expect, it } from 'vitest';
import {
  PUBLIC_API_FACADE_ROUTES,
  PUBLIC_EXACT_ROUTES,
  resolveSurfaceAccess,
  toSurfacePath,
} from './surface-policy.js';

describe('surface-policy', () => {
  it('normalizes a request URL to a bare pathname', () => {
    expect(toSurfacePath('/billing?plan=pro')).toBe('/billing');
    expect(toSurfacePath('/proof#verify')).toBe('/proof');
  });

  it('keeps the explicit public route contract stable', () => {
    expect(PUBLIC_EXACT_ROUTES).toContain('/');
    expect(PUBLIC_EXACT_ROUTES).toContain('/billing');
    expect(PUBLIC_EXACT_ROUTES).toContain('/receipts');
    expect(PUBLIC_EXACT_ROUTES).toContain('/invoices');
    expect(PUBLIC_EXACT_ROUTES).toContain('/proof');
    expect(PUBLIC_EXACT_ROUTES).toContain('/webhooks/payment');
    expect(PUBLIC_EXACT_ROUTES).toContain('/auth/login');
  });

  it('keeps the public api facade explicit', () => {
    expect(PUBLIC_API_FACADE_ROUTES).toEqual(['/api/routes', '/api/status']);
  });

  it('marks public pages and facade endpoints as public', () => {
    expect(resolveSurfaceAccess('/')).toBe('public');
    expect(resolveSurfaceAccess('/billing')).toBe('public');
    expect(resolveSurfaceAccess('/proof')).toBe('public');
    expect(resolveSurfaceAccess('/api/status')).toBe('public');
    expect(resolveSurfaceAccess('/api/routes')).toBe('public');
    expect(resolveSurfaceAccess('/webhooks/payment')).toBe('public');
  });

  it('marks /app and nested app paths as protected', () => {
    expect(resolveSurfaceAccess('/app')).toBe('protected');
    expect(resolveSurfaceAccess('/app/rooms/commercial')).toBe('protected');
  });

  it('blocks internal room prefixes from the public surface', () => {
    expect(resolveSurfaceAccess('/operational/control')).toBe('internal');
    expect(resolveSurfaceAccess('/campaign/audience')).toBe('internal');
    expect(resolveSurfaceAccess('/ai-internal/orchestrator')).toBe('internal');
    expect(resolveSurfaceAccess('/evidence-private/journal')).toBe('internal');
    expect(resolveSurfaceAccess('/shared/postgres')).toBe('internal');
    expect(resolveSurfaceAccess('/asus/keys')).toBe('internal');
    expect(resolveSurfaceAccess('/kitty-internal/shell')).toBe('internal');
  });

  it('does not treat legacy or internal ai-room paths as public', () => {
    expect(resolveSurfaceAccess('/room')).toBe('unknown');
    expect(resolveSurfaceAccess('/api/chat')).toBe('unknown');
    expect(resolveSurfaceAccess('/ws')).toBe('internal');
    expect(resolveSurfaceAccess('/shell')).toBe('internal');
  });
});
