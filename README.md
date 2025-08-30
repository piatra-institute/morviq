# Morviq - Multi-GPU 3D Bioelectric Visualization Platform

**Morviq** is a web platform for **interactive 3-D, multi-GPU, server-side rendering** of bioelectric tissue data with **wild-sheaf analysis** (soft/minimax paths, barriers, sensitivities) and support for **BETSE** and similar simulation data ingestion.

## Architecture Overview

Morviq implements a distributed rendering architecture using **object-space (sort-last) partitioning** with **GPU depth compositing** for scalable multi-GPU visualization:

```
┌─────────────────────────────────────────────────────────┐
│                    Browser Client                       │
│  ┌─────────────────────────────────────────────────┐    │
│  │          Next.js/React Application              │    │
│  │  • Material-UI Components                       │    │
│  │  • Three.js 3D Viewer                           │    │
│  │  • WebSocket & HTTP Clients                     │    │
│  └─────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
                           ⇅
                WebSocket │ HTTP/Stream
                           ⇅
┌─────────────────────────────────────────────────────────┐
│                    Gateway Service                      │
│  ┌─────────────────────────────────────────────────┐    │
│  │           Node.js/Express Server                │    │
│  │  • WebSocket Session Management                 │    │
│  │  • Multipart Frame Streaming                    │    │
│  │  • Renderer Control Protocol                    │    │
│  │  • File System Frame Watcher                    │    │
│  └─────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
                           ⇅
                   TCP Control Protocol
                           ⇅
┌─────────────────────────────────────────────────────────┐
│              Distributed MPI Renderer                   │
│  ┌─────────────────────────────────────────────────┐    │
│  │           C++ Multi-GPU Application             │    │
│  │                                                 │    │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐         │    │
│  │  │  Rank 0  │ │  Rank 1  │ │  Rank N  │  ...    │    │
│  │  │ ┌──────┐ │ │ ┌──────┐ │ │ ┌──────┐ │         │    │
│  │  │ │Brick │ │ │ │Brick │ │ │ │Brick │ │         │    │
│  │  │ │ 0-2  │ │ │ │ 3-5  │ │ │ │ 6-8  │ │         │    │
│  │  │ └──────┘ │ │ └──────┘ │ │ └──────┘ │         │    │
│  │  │   GPU 0  │ │   GPU 1  │ │   GPU N  │         │    │
│  │  └──────────┘ └──────────┘ └──────────┘         │    │
│  │                      ⇓                          │    │
│  │         MPI Gather & Depth Compositing          │    │
│  │                      ⇓                          │    │
│  │              PNG Frame Encoding                 │    │
│  │                      ⇓                          │    │
│  │            File System (frames/)                │    │
│  └─────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
```

## Core Services

### 1. **morviq-web** (Frontend)
- **Next.js 15** with React 19 and TypeScript
- **Material-UI** components with dark theme
- **Three.js** integration for 3D visualization
- **Zustand** state management
- Real-time WebSocket communication
- Stream viewer for rendered frames
- Interactive control panel for rendering parameters

### 2. **morviq-gateway** (API Gateway)
- **Node.js/TypeScript** with Express
- WebSocket session management
- Frame streaming (multipart HTTP, WebRTC-ready)
- Renderer control via TCP
- Session state synchronization
- Optional mediasoup SFU for WebRTC

### 3. **morviq-renderer** (Distributed Renderer)
- **C++ with MPI** for multi-GPU rendering
- Volume rendering with brick-based LOD
- Depth compositing (MIN_DEPTH and ALPHA_BLEND modes)
- Zarr/N5 data loading support
- PNG frame encoding with libpng
- TCP control server for real-time parameter updates

## Features

### Rendering Capabilities
- **Object-space partitioning**: Volume divided into bricks distributed across GPUs
- **Sort-last compositing**: Each GPU renders full viewport, depth-correct merge
- **Progressive LOD**: Camera-aware brick selection for low latency
- **Transfer functions**: Customizable colormaps and opacity curves
- **Volume data support**: Zarr, N5, raw formats

### Wild-Sheaf Analysis (Future)
- **Soft geodesics**: Weighted shortest paths through bioelectric fields
- **Minimax barriers**: Bottleneck paths minimizing worst local barriers
- **Sensitivity maps**: Identify control points for field manipulation
- **BETSE integration**: Direct ingestion of simulation outputs

### User Interface
- **Live streaming**: Real-time rendered frame display
- **3D viewer**: Interactive Three.js visualization
- **Control panel**: Adjust camera, transfer functions, overlays
- **Session management**: Multi-user support with isolated sessions
- **Performance metrics**: FPS and latency monitoring

## Quick Start

### Prerequisites
- Node.js 20+ and pnpm
- C++ compiler with C++17 support
- MPI implementation (OpenMPI or MPICH)
- libpng development headers
- CMake 3.16+

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/yourusername/morviq.git
cd morviq
```

2. **Build the renderer**
```bash
cd packages/morviq-renderer
mkdir build && cd build
cmake ..
make -j4
cd ../../..
```

3. **Install gateway dependencies**
```bash
cd packages/morviq-gateway
pnpm install
cd ../..
```

4. **Install web dependencies**
```bash
cd packages/morviq-web
pnpm install
cd ../..
```

### Running the Services

1. **Start the MPI renderer** (in interactive mode)
```bash
cd packages/morviq-renderer/build
mpirun -np 4 ./morviq_renderer --width 1280 --height 720 --interactive --out ../output/frames
```

2. **Start the gateway** (in a new terminal)
```bash
cd packages/morviq-gateway
pnpm dev
# Gateway runs on http://localhost:8080
```

3. **Start the web UI** (in a new terminal)
```bash
cd packages/morviq-web
pnpm dev
# Web UI runs on http://localhost:3000
```

4. **Open browser**
Navigate to http://localhost:3000 to view the Morviq interface.

## Configuration

### Environment Variables

Create `.env` files in each service directory:

**morviq-gateway/.env**
```env
PORT=8080
FRAMES_DIR=../../packages/morviq-renderer/output/frames/composited
RENDERER_CONTROL_PORT=9090
MAX_SESSIONS=100
```

**morviq-web/.env.local**
```env
NEXT_PUBLIC_GATEWAY_URL=http://localhost:8080
```

### Renderer Options
```bash
morviq_renderer [options]
  --width W        Frame width (default: 1280)
  --height H       Frame height (default: 720)
  --frames N       Number of frames in batch mode (default: 240)
  --out PATH       Output path (default: ./output/frames)
  --data PATH      Data directory path
  --dataset NAME   Dataset name (default: default)
  --timestep T     Time step (default: 0)
  --interactive    Enable interactive mode with control server
  --port P         Control port (default: 9090)
```

## Development

### Project Structure
```
morviq/
   packages/
      morviq-web/          # Next.js frontend
         app/              # App router pages and components
         components/       # React components
         store/            # Zustand stores
      morviq-gateway/       # Node.js API gateway
         src/
            control/      # Renderer control client
            session/      # Session management
            stream/       # Frame streaming
            webrtc/       # WebRTC SFU (optional)
         dist/             # TypeScript build output
      morviq-renderer/      # C++ MPI renderer
          include/          # Header files
          src/              # Source files
             compositor/   # Depth compositing
             control/      # TCP control server
             data/         # Data loaders (Zarr, etc.)
             renderer/     # Volume rendering
             codec/        # Frame encoding
          build/            # CMake build directory
   ideas/                    # Design documents and prototypes
```

### Building for Production

**Web UI**
```bash
cd packages/morviq-web
pnpm build
pnpm start
```

**Gateway**
```bash
cd packages/morviq-gateway
pnpm build
node dist/server.js
```

**Renderer**
```bash
cd packages/morviq-renderer/build
cmake -DCMAKE_BUILD_TYPE=Release ..
make -j4
```

## API Documentation

### Gateway REST API

**Session Management**
- `POST /api/sessions` - Create new session
- `GET /api/sessions` - List all sessions
- `GET /api/sessions/:id` - Get session details
- `DELETE /api/sessions/:id` - Delete session

**Camera Control**
- `PATCH /api/sessions/:id/camera` - Update camera matrices

**Rendering Parameters**
- `PATCH /api/sessions/:id/transfer-function` - Update transfer function
- `PATCH /api/sessions/:id/overlays` - Toggle overlays

**Frame Streaming**
- `GET /api/stream?session=:id` - Multipart image stream
- `GET /api/frames` - List available frames
- `GET /api/frames/:id` - Get specific frame

### WebSocket Protocol

Connect to `ws://gateway/ws?session=:id`

**Messages from client:**
```javascript
{ type: 'camera', data: { projection: [...], view: [...] } }
{ type: 'transferFunction', data: { colorMap: 'viridis', ... } }
{ type: 'timeStep', data: 42 }
{ type: 'quality', data: 'high' }
{ type: 'overlays', data: { paths: true, barriers: false } }
```

**Messages from server:**
```javascript
{ type: 'fullState', data: { camera: {...}, ... } }
{ type: 'stateUpdate', data: { timeStep: 42 } }
{ type: 'heartbeat', timestamp: 1234567890 }
```

### Renderer Control Protocol

TCP text protocol on port 9090:
```
CAMERA <16 floats proj>;<16 floats view>;<width> <height>\n
TIMESTEP <int>\n
QUALITY low|medium|high\n
```

## Performance Tuning

### Renderer Optimization
- Adjust brick size: Smaller bricks = better load balancing
- Enable GPU compositing: Build with CUDA support
- Tune LOD levels: Balance quality vs performance
- Use sparse textures: Keep active bricks GPU-resident

### Network Optimization
- Enable compression for WebSocket messages
- Use WebRTC for lower latency (when available)
- Adjust frame polling interval in gateway
- Consider GPUDirect RDMA for multi-node setups

### Scaling Guidelines
- **Single node**: 4-8 GPUs with NVLink optimal
- **Multi-node**: Use high-speed interconnect (InfiniBand)
- **Cloud deployment**: Use MPI Operator on Kubernetes
- **HPC clusters**: Slurm with GPU GRES allocation

## Troubleshooting

### Common Issues

**No frames appearing:**
- Check renderer is running and outputting to correct directory
- Verify gateway FRAMES_DIR environment variable
- Ensure PNG files are being created in composited/ directory

**Connection refused errors:**
- Verify all services are running on correct ports
- Check firewall settings for localhost connections
- Ensure renderer control port matches gateway config

**Poor performance:**
- Reduce render quality in control panel
- Decrease frame resolution
- Check GPU utilization with nvidia-smi
- Verify MPI communication overhead

## Roadmap

### Phase 1 (Current)
-  Basic multi-GPU renderer with MPI
-  Web UI with streaming viewer
-  Session management and control
-  PNG frame encoding

### Phase 2 (In Progress)
- � WebRTC streaming with hardware encoding
- � Zarr/N5 data loading
- � GPU-accelerated compositing
- � Wild-sheaf analysis integration

### Phase 3 (Future)
- Advanced LOD with octree acceleration
- BETSE data ingestion pipeline
- Multi-user collaborative sessions
- Cloud/HPC deployment templates
- VR/AR support

## Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

MIT License - see [LICENSE](LICENSE) for details.

## Acknowledgments

- Based on concepts from bioelectric field analysis and wild-sheaf theory
- Inspired by large-scale scientific visualization systems
- Built with modern web and HPC technologies

## Contact

For questions and support, please open an issue on GitHub or contact the maintainers.

---

**Morviq** - Visualizing the electric patterns of life at scale.
