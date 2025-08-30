'use client';

import { useState } from 'react';
import {
  Box,
  Drawer,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  Slider,
  Switch,
  FormControlLabel,
  Typography,
  Select,
  MenuItem,
  FormControl,
  IconButton,
  Chip,
} from '@mui/material';
import type { SelectChangeEvent } from '@mui/material/Select';
import {
  Tune,
  Layers,
  Timeline,
  ViewInAr,
  ChevronLeft,
  ChevronRight,
  Palette,
  Speed,
  Visibility,
} from '@mui/icons-material';
import { useViewerStore } from '../store/viewerStore';

const DRAWER_WIDTH = 320;

export default function ControlPanel() {
  const [open, setOpen] = useState(true);
  const {
    timeStep,
    renderQuality,
    overlays,
    transferFunction,
    connected,
    fps,
    latency,
    setTimeStep,
    setRenderQuality,
    updateOverlays,
    updateTransferFunction,
  } = useViewerStore();
  
  const handleDrawerToggle = () => {
    setOpen(!open);
  };
  
  return (
    <>
      <IconButton
        onClick={handleDrawerToggle}
        sx={{
          position: 'fixed',
          left: open ? DRAWER_WIDTH - 8 : 8,
          top: '50%',
          transform: 'translateY(-50%)',
          zIndex: 1201,
          bgcolor: 'background.paper',
          boxShadow: 2,
          '&:hover': { bgcolor: 'background.paper' },
        }}
      >
        {open ? <ChevronLeft /> : <ChevronRight />}
      </IconButton>
      
      <Drawer
        variant="persistent"
        anchor="left"
        open={open}
        sx={{
          width: open ? DRAWER_WIDTH : 0,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: DRAWER_WIDTH,
            boxSizing: 'border-box',
            bgcolor: 'background.default',
          },
        }}
      >
        <Box sx={{ p: 2 }}>
          <Typography variant="h6" gutterBottom>
            Morviq Controls
          </Typography>
          
          <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
            <Chip
              label={connected ? 'Connected' : 'Disconnected'}
              color={connected ? 'success' : 'error'}
              size="small"
            />
            <Chip label={`${fps} FPS`} size="small" />
            <Chip label={`${latency}ms`} size="small" />
          </Box>
        </Box>
        
        <Divider />
        
        <List>
          <ListItem>
            <ListItemIcon>
              <Timeline />
            </ListItemIcon>
            <ListItemText primary="Time Step" />
          </ListItem>
          <ListItem>
            <Slider
              value={timeStep}
              onChange={(_, value) => setTimeStep(value as number)}
              min={0}
              max={100}
              valueLabelDisplay="auto"
              sx={{ mx: 2 }}
            />
          </ListItem>
          
          <ListItem>
            <ListItemIcon>
              <Speed />
            </ListItemIcon>
            <ListItemText primary="Render Quality" />
          </ListItem>
          <ListItem>
            <FormControl fullWidth size="small">
              <Select
                value={renderQuality}
                onChange={(e: SelectChangeEvent<'low' | 'medium' | 'high'>) =>
                  setRenderQuality(e.target.value as 'low' | 'medium' | 'high')
                }
              >
                <MenuItem value="low">Low</MenuItem>
                <MenuItem value="medium">Medium</MenuItem>
                <MenuItem value="high">High</MenuItem>
              </Select>
            </FormControl>
          </ListItem>
          
          <ListItem>
            <ListItemIcon>
              <Palette />
            </ListItemIcon>
            <ListItemText primary="Transfer Function" />
          </ListItem>
          <ListItem>
            <FormControl fullWidth size="small">
              <Select
                value={transferFunction.colorMap}
                onChange={(e) => updateTransferFunction({ colorMap: e.target.value })}
              >
                <MenuItem value="viridis">Viridis</MenuItem>
                <MenuItem value="plasma">Plasma</MenuItem>
                <MenuItem value="inferno">Inferno</MenuItem>
                <MenuItem value="magma">Magma</MenuItem>
                <MenuItem value="jet">Jet</MenuItem>
                <MenuItem value="rainbow">Rainbow</MenuItem>
              </Select>
            </FormControl>
          </ListItem>
          
          <ListItem>
            <Typography variant="body2" sx={{ mr: 2 }}>
              Data Range
            </Typography>
          </ListItem>
          <ListItem>
            <Box sx={{ px: 2, width: '100%' }}>
              <Slider
                value={transferFunction.range}
                onChange={(_, value) => updateTransferFunction({ range: value as [number, number] })}
                min={0}
                max={1}
                step={0.01}
                valueLabelDisplay="auto"
                valueLabelFormat={(value) => value.toFixed(2)}
              />
            </Box>
          </ListItem>
        </List>
        
        <Divider />
        
        <List>
          <ListItem>
            <ListItemIcon>
              <Visibility />
            </ListItemIcon>
            <ListItemText primary="Overlays" />
          </ListItem>
          
          <ListItem>
            <FormControlLabel
              control={
                <Switch
                  checked={overlays.paths}
                  onChange={(e) => updateOverlays({ paths: e.target.checked })}
                />
              }
              label="Wild-Sheaf Paths"
            />
          </ListItem>
          
          <ListItem>
            <FormControlLabel
              control={
                <Switch
                  checked={overlays.barriers}
                  onChange={(e) => updateOverlays({ barriers: e.target.checked })}
                />
              }
              label="Barrier Fields"
            />
          </ListItem>
          
          <ListItem>
            <FormControlLabel
              control={
                <Switch
                  checked={overlays.hotSpots}
                  onChange={(e) => updateOverlays({ hotSpots: e.target.checked })}
                />
              }
              label="Sensitivity Hot Spots"
            />
          </ListItem>
        </List>
      </Drawer>
    </>
  );
}
