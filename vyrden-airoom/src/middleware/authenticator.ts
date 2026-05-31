// Authenticator — Session management and auth gates
// vyrden.com — Public landing gate with optional auth

import { randomBytes } from 'crypto';

export interface AuthSession {
  sessionId: string;
  token: string;
  createdAt: number;
  expiresAt: number;
  authenticated: boolean;
}

export class Authenticator {
  private sessions: Map<string, AuthSession> = new Map();
  private readonly SESSION_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days
  private readonly TOKEN_LENGTH = 32;

  createSession(): AuthSession {
    const sessionId = randomBytes(16).toString('hex');
    const token = randomBytes(this.TOKEN_LENGTH).toString('hex');
    const now = Date.now();

    const session: AuthSession = {
      sessionId,
      token,
      createdAt: now,
      expiresAt: now + this.SESSION_DURATION,
      authenticated: false,
    };

    this.sessions.set(sessionId, session);
    return session;
  }

  authenticateSession(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    const now = Date.now();
    if (now > session.expiresAt) {
      this.sessions.delete(sessionId);
      return false;
    }

    session.authenticated = true;
    session.expiresAt = now + this.SESSION_DURATION; // Extend expiry
    return true;
  }

  verifySession(sessionId: string, token: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    const now = Date.now();
    if (now > session.expiresAt) {
      this.sessions.delete(sessionId);
      return false;
    }

    return session.authenticated && session.token === token;
  }

  getSession(sessionId: string): AuthSession | null {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    const now = Date.now();
    if (now > session.expiresAt) {
      this.sessions.delete(sessionId);
      return null;
    }

    return session;
  }

  isAuthenticated(sessionId: string): boolean {
    const session = this.getSession(sessionId);
    return session?.authenticated ?? false;
  }

  cleanup(): void {
    const now = Date.now();
    for (const [sessionId, session] of this.sessions) {
      if (now > session.expiresAt) {
        this.sessions.delete(sessionId);
      }
    }
  }
}

export const authenticator = new Authenticator();

// Periodic cleanup (every hour)
setInterval(() => {
  authenticator.cleanup();
}, 60 * 60 * 1000);
