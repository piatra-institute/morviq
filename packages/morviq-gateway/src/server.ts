import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import cors from 'cors';
import morgan from 'morgan';
import pino from 'pino';
import { SessionManager } from './session/SessionManager.js';
import { StreamManager } from './stream/StreamManager.js';
import { setupRoutes } from './routes/index.js';
import { RendererClient } from './control/RendererClient.js';
import { config } from './config.js';

const logger = pino({
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'HH:MM:ss',
      ignore: 'pid,hostname'
    }
  }
});

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

app.use(morgan('dev'));
app.use(cors());
app.use(express.json());

const rendererClient = new RendererClient(logger);
rendererClient.connect();

const sessionManager = new SessionManager(logger, rendererClient);
const streamManager = new StreamManager(logger, config.frames);

setupRoutes(app, sessionManager, streamManager, logger);

wss.on('connection', (ws, req) => {
  const url = new URL(req.url!, `http://${req.headers.host}`);
  const sessionId = url.searchParams.get('session');
  
  if (!sessionId) {
    ws.close(1008, 'Session ID required');
    return;
  }

  const session = sessionManager.getSession(sessionId);
  if (!session) {
    ws.close(1008, 'Invalid session');
    return;
  }

  logger.info({ sessionId }, 'WebSocket connected');
  
  session.addWebSocket(ws);
  
  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      session.handleMessage(message);
    } catch (error) {
      logger.error({ error }, 'Failed to parse WebSocket message');
    }
  });

  ws.on('close', () => {
    session.removeWebSocket(ws);
    logger.info({ sessionId }, 'WebSocket disconnected');
  });

  ws.on('error', (error) => {
    logger.error({ sessionId, error }, 'WebSocket error');
  });
});

const PORT = config.port;
server.listen(PORT, () => {
  logger.info(`Morviq Gateway listening on http://localhost:${PORT}`);
  logger.info(`WebSocket endpoint: ws://localhost:${PORT}/ws`);
  logger.info(`Frames directory: ${config.frames.directory}`);
});
