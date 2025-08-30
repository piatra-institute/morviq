import { config as dotenvConfig } from 'dotenv';
import path from 'path';

dotenvConfig();

export const config = {
  port: parseInt(process.env.PORT || '8080', 10),
  environment: process.env.NODE_ENV || 'development',
  
  frames: {
    directory: process.env.FRAMES_DIR ? 
      path.resolve(process.env.FRAMES_DIR) : 
      path.resolve(__dirname, '../../morviq-renderer/output/frames/composited'),
    pollInterval: parseInt(process.env.FRAME_POLL_INTERVAL || '50', 10),
    format: process.env.FRAME_FORMAT || 'png'
  },
  
  webrtc: {
    enabled: process.env.WEBRTC_ENABLED === 'true',
    stunServers: process.env.STUN_SERVERS?.split(',') || ['stun:stun.l.google.com:19302'],
    turnServers: process.env.TURN_SERVERS?.split(',') || [],
    listenIp: process.env.WEBRTC_LISTEN_IP || '0.0.0.0',
    listenPort: parseInt(process.env.WEBRTC_LISTEN_PORT || '10000', 10),
    minPort: parseInt(process.env.WEBRTC_MIN_PORT || '10000', 10),
    maxPort: parseInt(process.env.WEBRTC_MAX_PORT || '10100', 10)
  },
  
  session: {
    maxSessions: parseInt(process.env.MAX_SESSIONS || '100', 10),
    sessionTimeout: parseInt(process.env.SESSION_TIMEOUT || '3600000', 10),
    heartbeatInterval: parseInt(process.env.HEARTBEAT_INTERVAL || '30000', 10)
  },
  
  renderer: {
    mpiCommand: process.env.MPI_COMMAND || 'mpirun',
    mpiRanks: parseInt(process.env.MPI_RANKS || '4', 10),
    rendererPath: process.env.RENDERER_PATH || path.resolve('../../packages/morviq-renderer/build/morviq_renderer'),
    outputPath: process.env.RENDERER_OUTPUT || path.resolve('../../packages/morviq-renderer/output'),
    controlPort: parseInt(process.env.RENDERER_CONTROL_PORT || '9090', 10)
  },
  
  security: {
    corsOrigin: process.env.CORS_ORIGIN || '*',
    maxRequestSize: process.env.MAX_REQUEST_SIZE || '10mb',
    rateLimitWindow: parseInt(process.env.RATE_LIMIT_WINDOW || '60000', 10),
    rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX || '100', 10)
  }
} as const;
