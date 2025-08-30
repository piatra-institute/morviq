import net from 'net';
import type { Logger } from 'pino';
import { config } from '../config.js';

export class RendererClient {
  private socket: net.Socket | null = null;
  private connecting = false;

  constructor(private logger: Logger) {}

  connect() {
    if (this.socket || this.connecting) return;
    this.connecting = true;
    const port = config.renderer.controlPort;
    const host = '127.0.0.1';
    const sock = net.createConnection({ port, host }, () => {
      this.logger.info({ port }, 'Connected to renderer control');
      this.socket = sock;
      this.connecting = false;
    });
    sock.on('error', (err) => {
      this.logger.warn({ err }, 'Renderer control connection error');
      this.cleanup();
      // Retry later
      setTimeout(() => this.connect(), 2000);
    });
    sock.on('close', () => {
      this.logger.info('Renderer control connection closed');
      this.cleanup();
      setTimeout(() => this.connect(), 2000);
    });
  }

  private send(line: string) {
    if (!this.socket) {
      this.connect();
      return;
    }
    try {
      this.socket.write(line.trim() + '\n');
    } catch (e) {
      this.logger.warn({ e }, 'Failed to send control message');
      this.cleanup();
    }
  }

  setCamera(projection: number[], view: number[], viewport: { width: number; height: number }) {
    // Flatten and format floats
    const pf = projection.map(n => Number(n).toFixed(6)).join(',');
    const vf = view.map(n => Number(n).toFixed(6)).join(',');
    const line = `CAMERA ${pf};${vf};${viewport.width} ${viewport.height}`;
    this.send(line);
  }

  setTimeStep(t: number) {
    const line = `TIMESTEP ${Math.max(0, Math.floor(t))}`;
    this.send(line);
  }

  setQuality(q: 'low'|'medium'|'high') {
    const line = `QUALITY ${q}`;
    this.send(line);
  }

  cleanup() {
    this.connecting = false;
    if (this.socket) {
      try { this.socket.destroy(); } catch {}
    }
    this.socket = null;
  }
}

