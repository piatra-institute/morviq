import { randomUUID as nodeRandomUUID, randomBytes } from 'crypto';
import type { Logger } from 'pino';
import { Session } from './Session.js';
import { RendererClient } from '../control/RendererClient.js';
import { config } from '../config.js';

export class SessionManager {
  private sessions: Map<string, Session> = new Map();
  private cleanupInterval: NodeJS.Timeout;
  
  constructor(private logger: Logger, private rendererClient: RendererClient | null = null) {
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredSessions();
    }, config.session.heartbeatInterval);
  }
  
  createSession(userId?: string): Session {
    if (this.sessions.size >= config.session.maxSessions) {
      throw new Error('Maximum number of sessions reached');
    }
    
    const sessionId = (typeof nodeRandomUUID === 'function')
      ? nodeRandomUUID()
      : randomBytes(16).toString('hex');
    const session = new Session(sessionId, userId, this.logger, this.rendererClient);
    
    this.sessions.set(sessionId, session);
    this.logger.info({ sessionId, userId }, 'Session created');
    
    return session;
  }
  
  getSession(sessionId: string): Session | undefined {
    return this.sessions.get(sessionId);
  }
  
  deleteSession(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.cleanup();
      this.sessions.delete(sessionId);
      this.logger.info({ sessionId }, 'Session deleted');
      return true;
    }
    return false;
  }
  
  getAllSessions(): Session[] {
    return Array.from(this.sessions.values());
  }
  
  private cleanupExpiredSessions(): void {
    const now = Date.now();
    const expiredSessions: string[] = [];
    
    for (const [sessionId, session] of this.sessions) {
      if (now - session.lastActivity > config.session.sessionTimeout) {
        expiredSessions.push(sessionId);
      }
    }
    
    for (const sessionId of expiredSessions) {
      this.deleteSession(sessionId);
      this.logger.info({ sessionId }, 'Session expired and removed');
    }
  }
  
  cleanup(): void {
    clearInterval(this.cleanupInterval);
    for (const session of this.sessions.values()) {
      session.cleanup();
    }
    this.sessions.clear();
  }
}
