Morviq Web (Next.js)

Requirements (macOS)
- Node.js 18+ (`brew install node`)

Run
- `cd packages/morviq-web`
- `npm install`
- `npm run dev`
- Open http://localhost:3000

Config
- Gateway URL (default `http://localhost:8080`): set `NEXT_PUBLIC_GATEWAY_URL` if needed.
  - Example: `NEXT_PUBLIC_GATEWAY_URL=http://127.0.0.1:8080 npm run dev`

Workflow
- On first load, the app creates a session via the Gateway, displays the multipart stream, and opens a WebSocket.
- The control panel adjusts camera, transfer function, time-step, and quality; changes are forwarded to the renderer.
