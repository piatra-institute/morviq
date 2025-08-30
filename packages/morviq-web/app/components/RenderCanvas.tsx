'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';

interface RenderCanvasProps {
  onFpsUpdate?: (fps: number) => void;
  onConnectionChange?: (connected: boolean) => void;
}

export default function RenderCanvas({ onFpsUpdate, onConnectionChange }: RenderCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const frameTimesRef = useRef<number[]>([]);
  const lastFrameTimeRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      setError('Failed to get canvas context');
      return;
    }

    let isConnected = false;
    let reconnectTimer: NodeJS.Timeout;
    let sessionId: string | null = null;

    const connectToStream = async () => {
      const gatewayUrl = process.env.NEXT_PUBLIC_GATEWAY_URL || 'http://localhost:8080';
      
      // First create a session
      try {
        const sessionResponse = await fetch(`${gatewayUrl}/api/sessions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: 'web-viewer' })
        });
        
        if (!sessionResponse.ok) {
          throw new Error(`Failed to create session: ${sessionResponse.status}`);
        }
        
        const sessionData = await sessionResponse.json();
        sessionId = sessionData.sessionId;
      } catch (err) {
        console.error('Failed to create session:', err);
        setError('Failed to create session');
        reconnectTimer = setTimeout(connectToStream, 2000);
        return;
      }
      
      const streamUrl = `${gatewayUrl}/api/stream?session=${sessionId}`;

      fetch(streamUrl)
        .then(response => {
          if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
          if (!response.body) throw new Error('No response body');
          
          const reader = response.body.getReader();
          let buffer = new Uint8Array(0);
          
          isConnected = true;
          setLoading(false);
          setError(null);
          onConnectionChange?.(true);

          const processStream = async () => {
            try {
              console.log('Starting stream processing...');
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                console.log(`Received ${value.length} bytes, buffer size: ${buffer.length}`);
                
                // Append new data to buffer
                const newBuffer = new Uint8Array(buffer.length + value.length);
                newBuffer.set(buffer);
                newBuffer.set(value, buffer.length);
                buffer = newBuffer;

                // Process buffer looking for complete frames
                while (true) {
                  // Look for boundary marker
                  const boundaryBytes = new TextEncoder().encode('--frame\r\n');
                  let boundaryIdx = -1;
                  
                  for (let i = 0; i <= buffer.length - boundaryBytes.length; i++) {
                    let match = true;
                    for (let j = 0; j < boundaryBytes.length; j++) {
                      if (buffer[i + j] !== boundaryBytes[j]) {
                        match = false;
                        break;
                      }
                    }
                    if (match) {
                      boundaryIdx = i;
                      break;
                    }
                  }
                  
                  if (boundaryIdx === -1) break; // No boundary found, wait for more data
                  
                  // Look for end of headers (double CRLF)
                  const headerEndBytes = new TextEncoder().encode('\r\n\r\n');
                  let headerEndIdx = -1;
                  
                  for (let i = boundaryIdx + boundaryBytes.length; i <= buffer.length - headerEndBytes.length; i++) {
                    let match = true;
                    for (let j = 0; j < headerEndBytes.length; j++) {
                      if (buffer[i + j] !== headerEndBytes[j]) {
                        match = false;
                        break;
                      }
                    }
                    if (match) {
                      headerEndIdx = i;
                      break;
                    }
                  }
                  
                  if (headerEndIdx === -1) break; // Headers not complete, wait for more data
                  
                  // Extract Content-Length from headers
                  const headersBytes = buffer.slice(boundaryIdx + boundaryBytes.length, headerEndIdx);
                  const headersStr = new TextDecoder().decode(headersBytes);
                  const contentLengthMatch = headersStr.match(/Content-Length: (\d+)/i);
                  
                  if (!contentLengthMatch) {
                    console.error('No Content-Length header found');
                    buffer = buffer.slice(headerEndIdx + headerEndBytes.length);
                    continue;
                  }
                  
                  const contentLength = parseInt(contentLengthMatch[1], 10);
                  const imageStart = headerEndIdx + headerEndBytes.length;
                  const imageEnd = imageStart + contentLength;
                  
                  if (buffer.length < imageEnd) break; // Image not complete, wait for more data
                  
                  // Extract image data
                  const imageData = buffer.slice(imageStart, imageEnd);
                  console.log(`Extracted frame: ${imageData.length} bytes`);
                  
                  // Display the image
                  const blob = new Blob([imageData], { type: 'image/png' });
                  const url = URL.createObjectURL(blob);
                  const img = new Image();
                  
                  img.onload = () => {
                    if (canvas.width !== img.width || canvas.height !== img.height) {
                      canvas.width = img.width;
                      canvas.height = img.height;
                    }
                    
                    ctx.drawImage(img, 0, 0);
                    URL.revokeObjectURL(url);
                    
                    // Update FPS
                    const now = performance.now();
                    if (lastFrameTimeRef.current > 0) {
                      const deltaTime = now - lastFrameTimeRef.current;
                      frameTimesRef.current.push(deltaTime);
                      if (frameTimesRef.current.length > 30) {
                        frameTimesRef.current.shift();
                      }
                      const avgFrameTime = frameTimesRef.current.reduce((a, b) => a + b, 0) / frameTimesRef.current.length;
                      onFpsUpdate?.(1000 / avgFrameTime);
                    }
                    lastFrameTimeRef.current = now;
                  };
                  
                  img.onerror = () => {
                    console.error('Failed to load frame image');
                    URL.revokeObjectURL(url);
                  };
                  
                  img.src = url;
                  
                  // Remove processed data from buffer
                  buffer = buffer.slice(imageEnd);
                  
                  // Skip any trailing CRLF after the image
                  if (buffer.length >= 2 && buffer[0] === 0x0d && buffer[1] === 0x0a) {
                    buffer = buffer.slice(2);
                  }
                }
              }
            } catch (err) {
              console.error('Stream processing error:', err);
              setError('Stream processing error');
            }
          };

          processStream();
        })
        .catch(err => {
          console.error('Failed to connect to stream:', err);
          setError(`Failed to connect: ${err.message}`);
          isConnected = false;
          onConnectionChange?.(false);
          
          // Retry connection after 2 seconds
          clearTimeout(reconnectTimer);
          reconnectTimer = setTimeout(connectToStream, 2000);
        });
    };

    connectToStream();

    return () => {
      clearTimeout(reconnectTimer);
    };
  }, [onFpsUpdate, onConnectionChange]);

  return (
    <Box sx={{ 
      width: '100%', 
      height: '100%', 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center',
      position: 'relative'
    }}>
      <canvas
        ref={canvasRef}
        style={{
          maxWidth: '100%',
          maxHeight: '100%',
          width: 'auto',
          height: 'auto',
          display: loading ? 'none' : 'block'
        }}
      />
      
      {loading && (
        <Box sx={{ textAlign: 'center' }}>
          <CircularProgress />
          <Typography sx={{ mt: 2 }}>Connecting to renderer...</Typography>
        </Box>
      )}
      
      {error && (
        <Box sx={{ 
          position: 'absolute', 
          bottom: 20, 
          left: '50%', 
          transform: 'translateX(-50%)',
          bgcolor: 'error.main',
          px: 2,
          py: 1,
          borderRadius: 1
        }}>
          <Typography variant="body2">{error}</Typography>
        </Box>
      )}
    </Box>
  );
}