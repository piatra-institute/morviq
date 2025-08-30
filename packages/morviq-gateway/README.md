Morviq Gateway (Node.js)

Requirements (macOS)
- Node.js 18+ (`brew install node`)

Install & Run
- `cd packages/morviq-gateway`
- `npm install`
- Copy env (optional): `cp .env.example .env.development` (already set for local repo layout)
- Dev: `npm run dev`
- Prod: `npm run build && npm start`

Defaults
- Port: `8080`
- Frames directory: `packages/morviq-renderer/output/frames/composited` (from `.env.development`)
- Renderer control port: `9090`

Environment Variables
- `PORT`: HTTP port (default `8080`)
- `FRAMES_DIR`: Frames directory (default via `.env.development`)
- `RENDERER_CONTROL_PORT`: TCP control port (default `9090`)
- `WEBRTC_ENABLED`: `true` to boot a minimal mediasoup SFU and expose `/api/webrtc/capabilities`

Endpoints
- `POST /api/sessions` → `{ sessionId, streamUrl, websocketUrl }`
- `GET /api/stream?session=...` → multipart image stream
- `GET /ws?session=...` → WebSocket control/state
- `GET /api/frames`, `GET /api/frames/:id` → frame list and specific frame
- `GET /health` → service status
- (If WebRTC enabled) `GET /api/webrtc/capabilities`

With Renderer & Web
1) Start the renderer (interactive): `make run-interactive` inside `packages/morviq-renderer`
2) Start the gateway: `npm run dev` (ensure frames dir matches renderer output)
3) Start the web app: see `packages/morviq-web/README.md`
