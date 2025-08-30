import type { WebSocket } from 'ws';
import type { Logger } from 'pino';
import type { RendererClient } from '../control/RendererClient.js';

export interface CameraState {
  projection: number[];
  view: number[];
  viewport: { width: number; height: number };
}

export interface TransferFunction {
  colorMap: string;
  opacityPoints: Array<{ x: number; y: number }>;
  range: [number, number];
}

export interface SessionState {
  camera: CameraState;
  transferFunction: TransferFunction;
  dataset: string;
  timeStep: number;
  renderQuality: 'low' | 'medium' | 'high';
  overlays: {
    paths: boolean;
    barriers: boolean;
    hotSpots: boolean;
  };
}

export class Session {
  public lastActivity: number = Date.now();
  private webSockets: Set<WebSocket> = new Set();
  private state: SessionState;
  
  constructor(
    public readonly id: string,
    public readonly userId: string | undefined,
    private logger: Logger,
    private rendererClient: RendererClient | null = null
  ) {
    this.state = this.getDefaultState();
  }
  
  private getDefaultState(): SessionState {
    return {
      camera: {
        projection: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
        view: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, -5, 1],
        viewport: { width: 1280, height: 720 }
      },
      transferFunction: {
        colorMap: 'viridis',
        opacityPoints: [{ x: 0, y: 0 }, { x: 1, y: 1 }],
        range: [0, 1]
      },
      dataset: 'default',
      timeStep: 0,
      renderQuality: 'medium',
      overlays: {
        paths: false,
        barriers: false,
        hotSpots: false
      }
    };
  }
  
  addWebSocket(ws: WebSocket): void {
    this.webSockets.add(ws);
    this.sendState(ws);
    this.updateActivity();
  }
  
  removeWebSocket(ws: WebSocket): void {
    this.webSockets.delete(ws);
  }
  
  handleMessage(message: any): void {
    this.updateActivity();
    
    switch (message.type) {
      case 'camera':
        this.updateCamera(message.data);
        break;
      case 'transferFunction':
        this.updateTransferFunction(message.data);
        break;
      case 'dataset':
        this.updateDataset(message.data);
        break;
      case 'timeStep':
        this.updateTimeStep(message.data);
        break;
      case 'quality':
        this.updateRenderQuality(message.data);
        break;
      case 'overlays':
        this.updateOverlays(message.data);
        break;
      case 'heartbeat':
        this.handleHeartbeat();
        break;
      default:
        this.logger.warn({ type: message.type }, 'Unknown message type');
    }
  }
  
  private updateCamera(camera: Partial<CameraState>): void {
    this.state.camera = { ...this.state.camera, ...camera };
    // Forward to renderer control channel if available
    if (this.rendererClient) {
      this.rendererClient.setCamera(
        this.state.camera.projection,
        this.state.camera.view,
        { width: this.state.camera.viewport.width, height: this.state.camera.viewport.height }
      );
    }
    this.broadcast({
      type: 'stateUpdate',
      data: { camera: this.state.camera }
    });
  }
  
  private updateTransferFunction(tf: Partial<TransferFunction>): void {
    this.state.transferFunction = { ...this.state.transferFunction, ...tf };
    this.broadcast({
      type: 'stateUpdate',
      data: { transferFunction: this.state.transferFunction }
    });
  }
  
  private updateDataset(dataset: string): void {
    this.state.dataset = dataset;
    this.broadcast({
      type: 'stateUpdate',
      data: { dataset: this.state.dataset }
    });
  }
  
  private updateTimeStep(timeStep: number): void {
    this.state.timeStep = timeStep;
    if (this.rendererClient) {
      this.rendererClient.setTimeStep(timeStep);
    }
    this.broadcast({
      type: 'stateUpdate',
      data: { timeStep: this.state.timeStep }
    });
  }
  
  private updateRenderQuality(quality: SessionState['renderQuality']): void {
    this.state.renderQuality = quality;
    if (this.rendererClient) {
      this.rendererClient.setQuality(quality);
    }
    this.broadcast({
      type: 'stateUpdate',
      data: { renderQuality: this.state.renderQuality }
    });
  }
  
  private updateOverlays(overlays: Partial<SessionState['overlays']>): void {
    this.state.overlays = { ...this.state.overlays, ...overlays };
    this.broadcast({
      type: 'stateUpdate',
      data: { overlays: this.state.overlays }
    });
  }
  
  private handleHeartbeat(): void {
    this.broadcast({ type: 'heartbeat', timestamp: Date.now() });
  }
  
  private sendState(ws: WebSocket): void {
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify({
        type: 'fullState',
        data: this.state
      }));
    }
  }
  
  broadcast(message: any): void {
    const data = JSON.stringify(message);
    for (const ws of this.webSockets) {
      if (ws.readyState === ws.OPEN) {
        ws.send(data);
      }
    }
  }
  
  private updateActivity(): void {
    this.lastActivity = Date.now();
  }
  
  getState(): SessionState {
    return { ...this.state };
  }
  
  cleanup(): void {
    for (const ws of this.webSockets) {
      ws.close(1000, 'Session ended');
    }
    this.webSockets.clear();
  }
}
