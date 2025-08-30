'use client';

import { useEffect, useRef, useState } from 'react';
import { Box, Typography, CircularProgress } from '@mui/material';
import { useViewerStore } from '../store/viewerStore';

export default function StreamViewer() {
  const imgRef = useRef<HTMLImageElement>(null);
  const { streamUrl, connected, createSession } = useViewerStore();
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    if (!streamUrl) {
      createSession();
    }
  }, [streamUrl, createSession]);
  
  useEffect(() => {
    if (imgRef.current && streamUrl) {
      imgRef.current.onload = () => setLoading(false);
      imgRef.current.onerror = () => setLoading(true);
      // Fallback: hide spinner shortly after assigning the stream
      const t = setTimeout(() => setLoading(false), 1000);
      return () => clearTimeout(t);
    }
  }, [streamUrl]);
  
  if (!streamUrl) {
    return (
      <Box
        sx={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: 'background.paper',
        }}
      >
        <CircularProgress />
      </Box>
    );
  }
  
  return (
    <Box
      sx={{
        width: '100%',
        height: '100%',
        position: 'relative',
        bgcolor: 'black',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {loading && (
        <Box
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 1,
          }}
        >
          <CircularProgress />
        </Box>
      )}
      
      <img
        ref={imgRef}
        src={streamUrl}
        alt="Live Stream"
        style={{
          maxWidth: '100%',
          maxHeight: '100%',
          objectFit: 'contain',
          display: 'block',
        }}
      />
      
      {!connected && (
        <Box
          sx={{
            position: 'absolute',
            top: 16,
            right: 16,
            bgcolor: 'error.main',
            color: 'white',
            px: 2,
            py: 1,
            borderRadius: 1,
          }}
        >
          <Typography variant="caption">Disconnected</Typography>
        </Box>
      )}
    </Box>
  );
}
