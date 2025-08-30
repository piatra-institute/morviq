Morviq Renderer (C++/MPI)

Requirements (macOS)
- Homebrew packages: `brew install cmake open-mpi libpng`

Build
- From repo root:
  - `cd packages/morviq-renderer`
  - `make build`
  - Binary: `packages/morviq-renderer/build/morviq_renderer`

Run (non‑interactive)
- `make run NP=4 WIDTH=1280 HEIGHT=720 FRAMES=240 OUT_DIR=output/frames`
- Frames: `packages/morviq-renderer/output/frames/composited/frame_*.png`

Run (interactive)
- `make run-interactive NP=4 WIDTH=1280 HEIGHT=720 OUT_DIR=output/frames PORT=9090`
- Starts a TCP control server on `127.0.0.1:9090` (rank 0). Use the Gateway + Web UI to send camera/time/quality.

Direct commands (no Makefile)
- `mkdir -p build && cd build && cmake -DCMAKE_BUILD_TYPE=Release .. && cmake --build . -j`
- `mpirun -np 4 ./morviq_renderer --width 1280 --height 720 --frames 240 --out ../output/frames`

Flags
- `--width, --height`: Resolution (default 1280x720)
- `--frames`: Frame count for non-interactive runs (default 240)
- `--out`: Output dir for frames (default `./output/frames`)
- `--interactive`: Keep rendering and accept control messages
- `--port`: Control port (default 9090)
- `--data, --dataset, --timestep`: Data hooks (Zarr/raw stubs for now)

Notes
- PNG encoding uses system libpng.
- Compositing defaults to alpha‑blend near‑over‑far; switchable in code.
- In interactive mode, rank 0 polls control state and broadcasts to all ranks.
