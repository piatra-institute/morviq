'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

interface WebSocketMessage {
  type: string;
  data: any;
}

export function useWebSocket(sessionId: string | null) {
  const ws = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const reconnectTimer = useRef<NodeJS.Timeout>();

  const connect = useCallback(() => {
    if (!sessionId) return;
    
    const gatewayUrl = process.env.NEXT_PUBLIC_GATEWAY_URL || 'http://localhost:8080';
    const wsUrl = gatewayUrl.replace(/^http/, 'ws') + `/ws?session=${sessionId}`;
    
    try {
      ws.current = new WebSocket(wsUrl);
      
      ws.current.onopen = () => {
        console.log('WebSocket connected');
        setConnected(true);
      };
      
      ws.current.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as WebSocketMessage;
          console.log('Received:', message);
        } catch (err) {
          console.error('Failed to parse WebSocket message:', err);
        }
      };
      
      ws.current.onerror = (error) => {
        console.error('WebSocket error:', error);
      };
      
      ws.current.onclose = () => {
        console.log('WebSocket disconnected');
        setConnected(false);
        ws.current = null;
        
        // Reconnect after 2 seconds
        clearTimeout(reconnectTimer.current);
        reconnectTimer.current = setTimeout(connect, 2000);
      };
    } catch (err) {
      console.error('Failed to create WebSocket:', err);
    }
  }, [sessionId]);

  const sendMessage = useCallback((type: string, data: any) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({ type, data }));
      return true;
    }
    return false;
  }, []);

  const sendBioelectricParams = useCallback((params: {
    ionConcentrations?: {
      sodium?: number;
      potassium?: number;
      chloride?: number;
      calcium?: number;
    };
    membraneProperties?: {
      restingPotential?: number;
      capacitance?: number;
      temperature?: number;
    };
    channels?: Array<{
      name: string;
      conductance: number;
      enabled: boolean;
    }>;
    pumps?: Array<{
      name: string;
      rate: number;
      enabled: boolean;
    }>;
    gapJunctions?: {
      conductance: number;
      enabled: boolean;
    };
  }) => {
    return sendMessage('bioelectric', params);
  }, [sendMessage]);

  useEffect(() => {
    connect();
    
    return () => {
      clearTimeout(reconnectTimer.current);
      if (ws.current) {
        ws.current.close();
      }
    };
  }, [connect]);

  return {
    connected,
    sendMessage,
    sendBioelectricParams
  };
}