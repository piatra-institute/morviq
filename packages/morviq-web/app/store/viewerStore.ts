import { create } from 'zustand';
import axios from 'axios';

interface Camera {
  projection: number[];
  view: number[];
  viewport: { width: number; height: number };
}

interface TransferFunction {
  colorMap: string;
  opacityPoints: Array<{ x: number; y: number }>;
  range: [number, number];
}

interface ViewerState {
  sessionId: string | null;
  connected: boolean;
  streamUrl: string | null;
  websocket: WebSocket | null;
  
  camera: Camera;
  transferFunction: TransferFunction;
  dataset: string;
  timeStep: number;
  renderQuality: 'low' | 'medium' | 'high';
  overlays: {
    paths: boolean;
    barriers: boolean;
    hotSpots: boolean;
  };
  
  fps: number;
  latency: number;
  
  createSession: () => Promise<void>;
  connectWebSocket: () => void;
  disconnectWebSocket: () => void;
  updateCamera: (camera: Partial<Camera>) => void;
  updateTransferFunction: (tf: Partial<TransferFunction>) => void;
  updateOverlays: (overlays: Partial<ViewerState['overlays']>) => void;
  setTimeStep: (step: number) => void;
  setRenderQuality: (quality: ViewerState['renderQuality']) => void;
}

const GATEWAY_URL = process.env.NEXT_PUBLIC_GATEWAY_URL || 'http://localhost:8080';

export const useViewerStore = create<ViewerState>((set, get) => ({
  sessionId: null,
  connected: false,
  streamUrl: null,
  websocket: null,
  
  camera: {
    projection: Array(16).fill(0).map((_, i) => i % 5 === 0 ? 1 : 0),
    view: Array(16).fill(0).map((_, i) => i % 5 === 0 ? 1 : 0),
    viewport: { width: 1280, height: 720 }
  },
  
  transferFunction: {
    colorMap: 'viridis',
    opacityPoints: [{ x: 0, y: 0 }, { x: 1, y: 1 }],
    range: [0, 1] as [number, number]
  },
  
  dataset: 'default',
  timeStep: 0,
  renderQuality: 'medium',
  
  overlays: {
    paths: false,
    barriers: false,
    hotSpots: false
  },
  
  fps: 0,
  latency: 0,
  
  createSession: async () => {
    try {
      const response = await axios.post(`${GATEWAY_URL}/api/sessions`);
      const { sessionId, streamUrl, websocketUrl } = response.data;
      
      set({
        sessionId,
        streamUrl: `${GATEWAY_URL}${streamUrl}`,
      });
      
      get().connectWebSocket();
    } catch (error) {
      console.error('Failed to create session:', error);
    }
  },
  
  connectWebSocket: () => {
    const state = get();
    if (!state.sessionId || state.websocket) return;
    
    const wsUrl = `${GATEWAY_URL.replace('http', 'ws')}/ws?session=${state.sessionId}`;
    const ws = new WebSocket(wsUrl);
    
    ws.onopen = () => {
      set({ connected: true, websocket: ws });
      console.log('WebSocket connected');
    };
    
    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        
        switch (message.type) {
          case 'fullState':
            set(message.data);
            break;
          case 'stateUpdate':
            set(state => ({ ...state, ...message.data }));
            break;
          case 'heartbeat':
            ws.send(JSON.stringify({ type: 'heartbeat' }));
            break;
        }
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };
    
    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
    
    ws.onclose = () => {
      set({ connected: false, websocket: null });
      console.log('WebSocket disconnected');
    };
  },
  
  disconnectWebSocket: () => {
    const { websocket } = get();
    if (websocket) {
      websocket.close();
      set({ websocket: null, connected: false });
    }
  },
  
  updateCamera: (camera) => {
    const state = get();
    const newCamera = { ...state.camera, ...camera };
    set({ camera: newCamera });
    
    if (state.websocket?.readyState === WebSocket.OPEN) {
      state.websocket.send(JSON.stringify({
        type: 'camera',
        data: newCamera
      }));
    }
  },
  
  updateTransferFunction: (tf) => {
    const state = get();
    const newTF = { ...state.transferFunction, ...tf };
    set({ transferFunction: newTF });
    
    if (state.websocket?.readyState === WebSocket.OPEN) {
      state.websocket.send(JSON.stringify({
        type: 'transferFunction',
        data: newTF
      }));
    }
  },
  
  updateOverlays: (overlays) => {
    const state = get();
    const newOverlays = { ...state.overlays, ...overlays };
    set({ overlays: newOverlays });
    
    if (state.websocket?.readyState === WebSocket.OPEN) {
      state.websocket.send(JSON.stringify({
        type: 'overlays',
        data: newOverlays
      }));
    }
  },
  
  setTimeStep: (timeStep) => {
    const state = get();
    set({ timeStep });
    
    if (state.websocket?.readyState === WebSocket.OPEN) {
      state.websocket.send(JSON.stringify({
        type: 'timeStep',
        data: timeStep
      }));
    }
  },
  
  setRenderQuality: (renderQuality) => {
    const state = get();
    set({ renderQuality });
    
    if (state.websocket?.readyState === WebSocket.OPEN) {
      state.websocket.send(JSON.stringify({
        type: 'quality',
        data: renderQuality
      }));
    }
  }
}));