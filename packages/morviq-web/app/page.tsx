'use client';

import { useState, useEffect } from 'react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { CssBaseline, Box, AppBar, Toolbar, Typography, Chip } from '@mui/material';
import RenderCanvas from './components/RenderCanvas';
import BioelectricControls from './components/BioelectricControls';

const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#00bcd4',
    },
    secondary: {
      main: '#ff4081',
    },
    background: {
      default: '#0a0a0a',
      paper: '#1a1a1a',
    },
  },
});

export default function Home() {
  const [fps, setFps] = useState(0);
  const [connected, setConnected] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  
  // Create session on mount
  useEffect(() => {
    const createSession = async () => {
      const gatewayUrl = process.env.NEXT_PUBLIC_GATEWAY_URL || 'http://localhost:8080';
      try {
        const response = await fetch(`${gatewayUrl}/api/sessions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: 'web-viewer' })
        });
        if (response.ok) {
          const data = await response.json();
          setSessionId(data.sessionId);
        }
      } catch (err) {
        console.error('Failed to create session:', err);
      }
    };
    createSession();
  }, []);
  
  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <Box sx={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
        <BioelectricControls sessionId={sessionId || undefined} />
        
        <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
          <AppBar position="static" elevation={0} sx={{ bgcolor: 'background.paper' }}>
            <Toolbar variant="dense">
              <Typography variant="h6" sx={{ flexGrow: 1, fontWeight: 700 }}>
                Morviq
              </Typography>
              
              <Chip 
                label={`FPS: ${fps.toFixed(1)}`} 
                color="primary" 
                size="small" 
                sx={{ mx: 1 }}
              />
              <Chip 
                label={connected ? 'Connected' : 'Disconnected'} 
                color={connected ? 'success' : 'error'} 
                size="small"
              />
            </Toolbar>
          </AppBar>
          
          <Box sx={{ flexGrow: 1, bgcolor: '#000', position: 'relative' }}>
            <RenderCanvas 
              sessionId={sessionId} 
              onFpsUpdate={setFps} 
              onConnectionChange={setConnected} 
            />
          </Box>
        </Box>
      </Box>
    </ThemeProvider>
  );
}