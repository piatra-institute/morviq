'use client';

import { useState, useEffect } from 'react';
import { useWebSocket } from '../hooks/useWebSocket';
import { 
  Box, 
  Typography, 
  Slider, 
  Switch, 
  FormControlLabel,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Divider,
  Paper,
  Button,
  Tooltip
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import RestartAltIcon from '@mui/icons-material/RestartAlt';

interface IonChannel {
  name: string;
  conductance: number;
  enabled: boolean;
}

interface IonPump {
  name: string;
  rate: number;
  enabled: boolean;
}

interface BioelectricControlsProps {
  sessionId?: string;
}

export default function BioelectricControls({ sessionId }: BioelectricControlsProps) {
  const { sendBioelectricParams } = useWebSocket(sessionId || null);
  const [playing, setPlaying] = useState(false);
  
  // Ion concentrations (mM)
  const [sodium, setSodium] = useState(145); // Extracellular
  const [potassium, setPotassium] = useState(5);
  const [chloride, setChloride] = useState(110);
  const [calcium, setCalcium] = useState(2);
  
  // Membrane properties
  const [restingPotential, setRestingPotential] = useState(-70); // mV
  const [membraneCapacitance, setMembraneCapacitance] = useState(1); // μF/cm²
  const [temperature, setTemperature] = useState(37); // °C
  
  // Ion channels
  const [channels, setChannels] = useState<IonChannel[]>([
    { name: 'Nav1.2 (Voltage-gated Na+)', conductance: 120, enabled: true },
    { name: 'Kv1.1 (Voltage-gated K+)', conductance: 36, enabled: true },
    { name: 'Kir2.1 (Inward-rectifier K+)', conductance: 20, enabled: true },
    { name: 'HCN1 (Hyperpolarization-activated)', conductance: 10, enabled: false },
    { name: 'CaV3.1 (T-type Ca2+)', conductance: 5, enabled: false },
    { name: 'CaV1.2 (L-type Ca2+)', conductance: 8, enabled: true },
  ]);
  
  // Ion pumps/exchangers
  const [pumps, setPumps] = useState<IonPump[]>([
    { name: 'Na+/K+-ATPase', rate: 100, enabled: true },
    { name: 'Ca2+-ATPase', rate: 50, enabled: true },
    { name: 'Na+/Ca2+ Exchanger', rate: 30, enabled: true },
    { name: 'V-ATPase (H+ pump)', rate: 20, enabled: false },
  ]);
  
  // Gap junction properties
  const [gapJunctionConductance, setGapJunctionConductance] = useState(50);
  const [gapJunctionEnabled, setGapJunctionEnabled] = useState(true);
  
  // Visualization settings
  const [showElectricField, setShowElectricField] = useState(true);
  const [showIonFlux, setShowIonFlux] = useState(false);
  const [showGapJunctions, setShowGapJunctions] = useState(true);
  
  const handleChannelChange = (index: number, field: 'conductance' | 'enabled', value: number | boolean) => {
    const newChannels = [...channels];
    if (field === 'conductance') {
      newChannels[index].conductance = value as number;
    } else {
      newChannels[index].enabled = value as boolean;
    }
    setChannels(newChannels);
    sendParameters();
  };
  
  const handlePumpChange = (index: number, field: 'rate' | 'enabled', value: number | boolean) => {
    const newPumps = [...pumps];
    if (field === 'rate') {
      newPumps[index].rate = value as number;
    } else {
      newPumps[index].enabled = value as boolean;
    }
    setPumps(newPumps);
    sendParameters();
  };
  
  // Send all parameters to the renderer
  const sendParameters = () => {
    sendBioelectricParams({
      ionConcentrations: {
        sodium,
        potassium,
        chloride,
        calcium
      },
      membraneProperties: {
        restingPotential,
        capacitance: membraneCapacitance,
        temperature
      },
      channels,
      pumps,
      gapJunctions: {
        conductance: gapJunctionConductance,
        enabled: gapJunctionEnabled
      }
    });
  };

  return (
    <Paper sx={{ width: 360, height: '100%', overflow: 'auto', p: 2 }}>
      <Typography variant="h6" sx={{ mb: 2 }}>
        Bioelectric Parameters
      </Typography>
      
      <Box sx={{ mb: 2, display: 'flex', gap: 1 }}>
        <Button
          variant="contained"
          startIcon={playing ? <PauseIcon /> : <PlayArrowIcon />}
          onClick={() => setPlaying(!playing)}
          fullWidth
        >
          {playing ? 'Pause' : 'Play'}
        </Button>
        <Button
          variant="outlined"
          startIcon={<RestartAltIcon />}
          onClick={() => {}}
        >
          Reset
        </Button>
      </Box>
      
      <Divider sx={{ my: 2 }} />
      
      <Accordion defaultExpanded>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography>Ion Concentrations (mM)</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Box sx={{ px: 1 }}>
            <Typography variant="body2">Na+ (Extracellular)</Typography>
            <Slider
              value={sodium}
              onChange={(_, v) => {
                setSodium(v as number);
                sendParameters();
              }}
              min={0}
              max={200}
              valueLabelDisplay="auto"
              size="small"
            />
            
            <Typography variant="body2">K+ (Extracellular)</Typography>
            <Slider
              value={potassium}
              onChange={(_, v) => {
                setPotassium(v as number);
                sendParameters();
              }}
              min={0}
              max={50}
              valueLabelDisplay="auto"
              size="small"
            />
            
            <Typography variant="body2">Cl- (Extracellular)</Typography>
            <Slider
              value={chloride}
              onChange={(_, v) => {
                setChloride(v as number);
                sendParameters();
              }}
              min={0}
              max={150}
              valueLabelDisplay="auto"
              size="small"
            />
            
            <Typography variant="body2">Ca2+ (Extracellular)</Typography>
            <Slider
              value={calcium}
              onChange={(_, v) => {
                setCalcium(v as number);
                sendParameters();
              }}
              min={0}
              max={10}
              step={0.1}
              valueLabelDisplay="auto"
              size="small"
            />
          </Box>
        </AccordionDetails>
      </Accordion>
      
      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography>Ion Channels</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Box sx={{ px: 1 }}>
            {channels.map((channel, idx) => (
              <Box key={idx} sx={{ mb: 2 }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={channel.enabled}
                      onChange={(e) => handleChannelChange(idx, 'enabled', e.target.checked)}
                      size="small"
                    />
                  }
                  label={<Typography variant="body2">{channel.name}</Typography>}
                />
                {channel.enabled && (
                  <Box sx={{ ml: 4 }}>
                    <Typography variant="caption">Conductance (mS/cm²)</Typography>
                    <Slider
                      value={channel.conductance}
                      onChange={(_, v) => handleChannelChange(idx, 'conductance', v as number)}
                      min={0}
                      max={200}
                      valueLabelDisplay="auto"
                      size="small"
                    />
                  </Box>
                )}
              </Box>
            ))}
          </Box>
        </AccordionDetails>
      </Accordion>
      
      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography>Ion Pumps & Exchangers</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Box sx={{ px: 1 }}>
            {pumps.map((pump, idx) => (
              <Box key={idx} sx={{ mb: 2 }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={pump.enabled}
                      onChange={(e) => handlePumpChange(idx, 'enabled', e.target.checked)}
                      size="small"
                    />
                  }
                  label={<Typography variant="body2">{pump.name}</Typography>}
                />
                {pump.enabled && (
                  <Box sx={{ ml: 4 }}>
                    <Typography variant="caption">Pump Rate (%)</Typography>
                    <Slider
                      value={pump.rate}
                      onChange={(_, v) => handlePumpChange(idx, 'rate', v as number)}
                      min={0}
                      max={200}
                      valueLabelDisplay="auto"
                      size="small"
                    />
                  </Box>
                )}
              </Box>
            ))}
          </Box>
        </AccordionDetails>
      </Accordion>
      
      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography>Gap Junctions</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Box sx={{ px: 1 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={gapJunctionEnabled}
                  onChange={(e) => setGapJunctionEnabled(e.target.checked)}
                />
              }
              label="Enable Gap Junctions"
            />
            {gapJunctionEnabled && (
              <>
                <Typography variant="body2" sx={{ mt: 1 }}>
                  Conductance (nS)
                </Typography>
                <Slider
                  value={gapJunctionConductance}
                  onChange={(_, v) => setGapJunctionConductance(v as number)}
                  min={0}
                  max={200}
                  valueLabelDisplay="auto"
                  size="small"
                />
              </>
            )}
          </Box>
        </AccordionDetails>
      </Accordion>
      
      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography>Membrane Properties</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Box sx={{ px: 1 }}>
            <Typography variant="body2">Resting Potential (mV)</Typography>
            <Slider
              value={restingPotential}
              onChange={(_, v) => setRestingPotential(v as number)}
              min={-100}
              max={0}
              valueLabelDisplay="auto"
              size="small"
            />
            
            <Typography variant="body2">Capacitance (μF/cm²)</Typography>
            <Slider
              value={membraneCapacitance}
              onChange={(_, v) => setMembraneCapacitance(v as number)}
              min={0.1}
              max={5}
              step={0.1}
              valueLabelDisplay="auto"
              size="small"
            />
            
            <Typography variant="body2">Temperature (°C)</Typography>
            <Slider
              value={temperature}
              onChange={(_, v) => setTemperature(v as number)}
              min={0}
              max={50}
              valueLabelDisplay="auto"
              size="small"
            />
          </Box>
        </AccordionDetails>
      </Accordion>
      
      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography>Visualization</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Box sx={{ px: 1 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={showElectricField}
                  onChange={(e) => setShowElectricField(e.target.checked)}
                />
              }
              label="Show Electric Field"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={showIonFlux}
                  onChange={(e) => setShowIonFlux(e.target.checked)}
                />
              }
              label="Show Ion Flux"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={showGapJunctions}
                  onChange={(e) => setShowGapJunctions(e.target.checked)}
                />
              }
              label="Show Gap Junctions"
            />
          </Box>
        </AccordionDetails>
      </Accordion>
    </Paper>
  );
}