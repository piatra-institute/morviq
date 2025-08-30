#include <iostream>
#include <mpi.h>
#include <cstdlib>
#include <string>
#include <chrono>
#include <thread>
#include "renderer/Renderer.h"
#include "utils/Logger.h"
#include "control/ControlServer.h"

using namespace morviq;

struct Config {
    int width = 1280;
    int height = 720;
    int frames = 240;
    std::string outputPath = "./output/frames";
    std::string dataPath = "";
    std::string dataset = "default";
    int timeStep = 0;
    bool interactive = false;
    int port = 9090;
};

Config parseArgs(int argc, char* argv[]) {
    Config config;
    
    for (int i = 1; i < argc; ++i) {
        std::string arg = argv[i];
        
        if (arg == "--width" && i + 1 < argc) {
            config.width = std::atoi(argv[++i]);
        } else if (arg == "--height" && i + 1 < argc) {
            config.height = std::atoi(argv[++i]);
        } else if (arg == "--frames" && i + 1 < argc) {
            config.frames = std::atoi(argv[++i]);
        } else if (arg == "--out" && i + 1 < argc) {
            config.outputPath = argv[++i];
        } else if (arg == "--data" && i + 1 < argc) {
            config.dataPath = argv[++i];
        } else if (arg == "--dataset" && i + 1 < argc) {
            config.dataset = argv[++i];
        } else if (arg == "--timestep" && i + 1 < argc) {
            config.timeStep = std::atoi(argv[++i]);
        } else if (arg == "--interactive") {
            config.interactive = true;
        } else if (arg == "--port" && i + 1 < argc) {
            config.port = std::atoi(argv[++i]);
        } else if (arg == "--help") {
            std::cout << "Usage: " << argv[0] << " [options]\n"
                      << "Options:\n"
                      << "  --width W        Frame width (default: 1280)\n"
                      << "  --height H       Frame height (default: 720)\n"
                      << "  --frames N       Number of frames (default: 240)\n"
                      << "  --out PATH       Output path (default: ./output/frames)\n"
                      << "  --data PATH      Data directory path\n"
                      << "  --dataset NAME   Dataset name (default: default)\n"
                      << "  --timestep T     Time step (default: 0)\n"
                      << "  --interactive    Enable interactive mode\n"
                      << "  --port P         Control port (default: 9090)\n"
                      << "  --help           Show this help\n";
            MPI_Finalize();
            exit(0);
        }
    }
    
    return config;
}

void animateCamera(Camera& camera, float t) {
    float angle = t * 2.0f * 3.14159f;
    float distance = 3.0f;
    
    // Set up a proper view matrix for 3D volume viewing
    // Eye position rotating around volume
    float eyeX = distance * std::cos(angle);
    float eyeY = 2.0f;
    float eyeZ = distance * std::sin(angle);
    
    // Simple look-at matrix (looking at origin)
    camera.view.m[0] = -std::sin(angle);
    camera.view.m[1] = 0;
    camera.view.m[2] = -std::cos(angle);
    camera.view.m[3] = 0;
    
    camera.view.m[4] = 0;
    camera.view.m[5] = 1;
    camera.view.m[6] = 0;
    camera.view.m[7] = 0;
    
    camera.view.m[8] = -std::cos(angle);
    camera.view.m[9] = 0;
    camera.view.m[10] = std::sin(angle);
    camera.view.m[11] = 0;
    
    camera.view.m[12] = eyeX;
    camera.view.m[13] = eyeY;
    camera.view.m[14] = eyeZ;
    camera.view.m[15] = 1;
}

int main(int argc, char* argv[]) {
    MPI_Init(&argc, &argv);
    
    int rank, size;
    MPI_Comm_rank(MPI_COMM_WORLD, &rank);
    MPI_Comm_size(MPI_COMM_WORLD, &size);
    
    Logger::initialize(rank);
    
    Config config = parseArgs(argc, argv);
    
    if (rank == 0) {
        LOG_INFO("Morviq Renderer starting with " << size << " ranks");
        LOG_INFO("Resolution: " << config.width << "x" << config.height);
        LOG_INFO("Output path: " << config.outputPath);
    }
    
    Renderer renderer(rank, size, MPI_COMM_WORLD);
    
    if (!renderer.initialize(config.width, config.height)) {
        LOG_ERROR("Failed to initialize renderer");
        MPI_Finalize();
        return 1;
    }
    
    if (!config.dataPath.empty()) {
        renderer.setDataPath(config.dataPath);
        if (!renderer.loadVolume(config.dataset, config.timeStep)) {
            LOG_WARN("Failed to load volume data, using procedural data");
        }
    }
    
    Camera camera;
    camera.viewport[2] = config.width;
    camera.viewport[3] = config.height;
    
    TransferFunction tf;
    RenderParams params;
    params.quality = 2;
    params.stepSize = 0.01f;
    params.enableGradients = true;
    
    renderer.setTransferFunction(tf);
    renderer.setRenderParams(params);
    
    auto startTime = std::chrono::high_resolution_clock::now();
    
    if (config.interactive) {
        LOG_INFO("Interactive mode - waiting for commands on port " << config.port);
        // Start simple TCP control server on rank 0 and broadcast state to all ranks
        ControlServer control;
        if (rank == 0) {
            control.start(config.port, [&](const ControlState& s){
                // no-op: state is polled each iteration and broadcast
            });
        }
        
        while (true) {
            // Rank 0: poll control state and broadcast
            ControlState s;
            if (rank == 0) {
                s = control.getState();
            }
            // Broadcast projection, view, viewport, quality and timestep
            if (rank == 0) {
                // pack viewport to int array
            }
            MPI_Bcast(s.projection, 16, MPI_FLOAT, 0, MPI_COMM_WORLD);
            MPI_Bcast(s.view, 16, MPI_FLOAT, 0, MPI_COMM_WORLD);
            MPI_Bcast(s.viewport, 2, MPI_INT, 0, MPI_COMM_WORLD);
            MPI_Bcast(&s.timeStep, 1, MPI_INT, 0, MPI_COMM_WORLD);
            MPI_Bcast(&s.quality, 1, MPI_INT, 0, MPI_COMM_WORLD);

            // Apply camera from shared state
            for (int i = 0; i < 16; ++i) { camera.projection.m[i] = s.projection[i]; camera.view.m[i] = s.view[i]; }
            camera.viewport[2] = s.viewport[0];
            camera.viewport[3] = s.viewport[1];
            renderer.setCamera(camera);

            // Apply render params mapping from quality
            if (s.quality == 0) { params.quality = 0; params.stepSize = 0.02f; }
            else if (s.quality == 2) { params.quality = 3; params.stepSize = 0.005f; }
            else { params.quality = 1; params.stepSize = 0.01f; }
            renderer.setRenderParams(params);
            
            if (!renderer.render()) {
                LOG_ERROR("Rendering failed");
                break;
            }
            
            if (rank == 0) {
                static int frameNum = 0;
                renderer.saveFrame(config.outputPath, frameNum++);
            }
            
            std::this_thread::sleep_for(std::chrono::milliseconds(50));
        }
        if (rank == 0) {
            control.stop();
        }
    } else {
        for (int frame = 0; frame < config.frames; ++frame) {
            float t = static_cast<float>(frame) / config.frames;
            animateCamera(camera, t);
            renderer.setCamera(camera);
            
            if (!renderer.render()) {
                LOG_ERROR("Rendering failed at frame " << frame);
                break;
            }
            
            if (rank == 0) {
                renderer.saveFrame(config.outputPath, frame);
                
                if (frame % 10 == 0) {
                    auto currentTime = std::chrono::high_resolution_clock::now();
                    auto elapsed = std::chrono::duration<double>(currentTime - startTime).count();
                    double fps = (frame + 1) / elapsed;
                    LOG_INFO("Frame " << frame << "/" << config.frames 
                            << " (" << fps << " FPS)");
                }
            }
            
            MPI_Barrier(MPI_COMM_WORLD);
        }
    }
    
    if (rank == 0) {
        auto endTime = std::chrono::high_resolution_clock::now();
        auto totalTime = std::chrono::duration<double>(endTime - startTime).count();
        LOG_INFO("Rendering complete: " << config.frames << " frames in " 
                << totalTime << " seconds (" 
                << (config.frames / totalTime) << " FPS average)");
    }
    
    renderer.shutdown();
    Logger::shutdown();
    MPI_Finalize();
    
    return 0;
}
