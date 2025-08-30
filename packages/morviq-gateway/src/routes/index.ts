import type { Express, Request, Response } from 'express';
import type { Logger } from 'pino';
import type { SessionManager } from '../session/SessionManager.js';
import type { StreamManager } from '../stream/StreamManager.js';
import { config } from '../config.js';
import { SFU } from '../webrtc/sfu.js';

export function setupRoutes(
  app: Express,
  sessionManager: SessionManager,
  streamManager: StreamManager,
  logger: Logger
): void {
  
  app.get('/', (_req: Request, res: Response) => {
    res.json({
      service: 'Morviq Gateway',
      version: '0.1.0',
      endpoints: {
        sessions: '/api/sessions',
        stream: '/api/stream',
        websocket: '/ws',
        webrtc: config.webrtc.enabled ? {
          capabilities: '/api/webrtc/capabilities'
        } : undefined
      }
    });
  });
  
  app.post('/api/sessions', (req: Request, res: Response) => {
    try {
      const userId = (req.body && typeof req.body === 'object') ? (req.body as any).userId : undefined;
      const session = sessionManager.createSession(userId);
      
      res.json({
        sessionId: session.id,
        userId: session.userId,
        streamUrl: `/api/stream?session=${session.id}`,
        websocketUrl: `/ws?session=${session.id}`
      });
    } catch (error) {
      const err = error as Error;
      logger.error({ message: err.message, stack: err.stack }, 'Failed to create session');
      res.status(500).json({ error: 'Failed to create session' });
    }
  });
  
  app.get('/api/sessions', (_req: Request, res: Response) => {
    const sessions = sessionManager.getAllSessions().map(s => ({
      id: s.id,
      userId: s.userId,
      lastActivity: s.lastActivity
    }));
    
    res.json({ sessions });
  });
  
  app.get('/api/sessions/:id', (req: Request, res: Response) => {
    const session = sessionManager.getSession(req.params.id);
    
    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }
    
    res.json({
      id: session.id,
      userId: session.userId,
      lastActivity: session.lastActivity,
      state: session.getState()
    });
  });
  
  app.delete('/api/sessions/:id', (req: Request, res: Response) => {
    const deleted = sessionManager.deleteSession(req.params.id);
    
    if (!deleted) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }
    
    res.json({ message: 'Session deleted' });
  });
  
  app.patch('/api/sessions/:id/camera', (req: Request, res: Response) => {
    const session = sessionManager.getSession(req.params.id);
    
    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }
    
    session.handleMessage({ type: 'camera', data: req.body });
    res.json({ message: 'Camera updated' });
  });
  
  app.patch('/api/sessions/:id/transfer-function', (req: Request, res: Response) => {
    const session = sessionManager.getSession(req.params.id);
    
    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }
    
    session.handleMessage({ type: 'transferFunction', data: req.body });
    res.json({ message: 'Transfer function updated' });
  });
  
  app.patch('/api/sessions/:id/overlays', (req: Request, res: Response) => {
    const session = sessionManager.getSession(req.params.id);
    
    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }
    
    session.handleMessage({ type: 'overlays', data: req.body });
    res.json({ message: 'Overlays updated' });
  });
  
  app.get('/api/stream', async (req: Request, res: Response) => {
    const sessionId = req.query.session as string;
    
    logger.info({ sessionId }, 'Stream request received');
    
    if (!sessionId || !sessionManager.getSession(sessionId)) {
      res.status(401).json({ error: 'Invalid or missing session' });
      return;
    }
    
    res.writeHead(200, {
      'Content-Type': 'multipart/x-mixed-replace; boundary=frame',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Connection': 'close'
    });
    
    // Immediately send the latest available frame once
    let lastFrameId = -1;
    const initialId = streamManager.getLatestFrameId();
    logger.info({ initialId, framesAvailable: streamManager.getAllFrames().length }, 'Initial stream state');
    
    if (initialId >= 0) {
      const frame = await streamManager.getLatestFrame();
      if (frame) {
        logger.info({ frameId: initialId, size: frame.length }, 'Sending initial frame');
        res.write('--frame\r\n');
        res.write('Content-Type: image/png\r\n');
        res.write(`Content-Length: ${frame.length}\r\n\r\n`);
        res.write(frame);
        res.write('\r\n');
        lastFrameId = initialId;
      } else {
        logger.warn({ frameId: initialId }, 'No frame data for initial frame');
      }
    } else {
      logger.warn('No frames available for streaming');
    }
    const interval = setInterval(async () => {
      const currentFrameId = streamManager.getLatestFrameId();
      
      if (currentFrameId > lastFrameId) {
        const frame = await streamManager.getLatestFrame();
        
        if (frame) {
          logger.debug({ frameId: currentFrameId, size: frame.length }, 'Streaming frame');
          res.write('--frame\r\n');
          res.write('Content-Type: image/png\r\n');
          res.write(`Content-Length: ${frame.length}\r\n\r\n`);
          res.write(frame);
          res.write('\r\n');
          
          lastFrameId = currentFrameId;
        } else {
          logger.warn({ frameId: currentFrameId }, 'Failed to read frame for streaming');
        }
      }
    }, 50);
    
    req.on('close', () => {
      clearInterval(interval);
      logger.info({ sessionId }, 'Stream closed');
    });
  });
  
  app.get('/api/frames', (_req: Request, res: Response) => {
    const frames = streamManager.getAllFrames().map(f => ({
      id: f.id,
      timestamp: f.timestamp,
      size: f.size
    }));
    
    res.json({ frames, latest: streamManager.getLatestFrameId() });
  });
  
  app.get('/api/frames/:id', async (req: Request, res: Response) => {
    const frameId = parseInt(req.params.id, 10);
    const frame = await streamManager.getFrame(frameId);
    
    if (!frame) {
      res.status(404).json({ error: 'Frame not found' });
      return;
    }
    
    res.type('image/png').send(frame);
  });
  
  app.get('/health', (_req: Request, res: Response) => {
    res.json({
      status: 'healthy',
      timestamp: Date.now(),
      sessions: sessionManager.getAllSessions().length,
      latestFrame: streamManager.getLatestFrameId()
    });
  });

  // Minimal mediasoup SFU bootstrap (guarded by config)
  if (config.webrtc.enabled) {
    const sfu = new SFU(logger);
    sfu.start().catch(err => logger.error({ err }, 'Failed to start SFU'));
    app.get('/api/webrtc/capabilities', (_req: Request, res: Response) => {
      const caps = sfu.getRtpCapabilities();
      if (!caps) {
        res.status(503).json({ error: 'SFU not ready' });
        return;
      }
      res.json({ rtpCapabilities: caps });
    });
  }
}
