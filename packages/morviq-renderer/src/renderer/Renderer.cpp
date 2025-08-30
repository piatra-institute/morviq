#include "renderer/Renderer.h"
#include "renderer/VolumeRenderer.h"
#include "compositor/DepthCompositor.h"
#include "data/DataLoader.h"
#include "codec/PNGEncoder.h"
#include "utils/Logger.h"
#include <cstring>
#include <filesystem>
#include <fstream>

namespace morviq {

Renderer::Renderer(int rank, int size, MPI_Comm comm)
    : mpiRank(rank), mpiSize(size), mpiComm(comm) {
    dataLoader = std::make_unique<DataLoader>();
    volumeRenderer = std::make_unique<VolumeRenderer>();
    compositor = std::make_unique<DepthCompositor>(rank, size, comm);
}

Renderer::~Renderer() {
    shutdown();
}

bool Renderer::initialize(int width, int height) {
    LOG_INFO("Initializing renderer at " << width << "x" << height);
    
    currentFrame = std::make_unique<Frame>(width, height, 4);
    if (mpiRank == 0) {
        compositeFrame = std::make_unique<Frame>(width, height, 4);
    }
    
    if (!volumeRenderer->initialize(width, height)) {
        LOG_ERROR("Failed to initialize volume renderer");
        return false;
    }
    
    if (!compositor->initialize(width, height)) {
        LOG_ERROR("Failed to initialize compositor");
        return false;
    }
    
    // Initialize bricks
    assignBricks();
    
    return true;
}

void Renderer::shutdown() {
    if (volumeRenderer) {
        volumeRenderer->shutdown();
    }
    if (compositor) {
        compositor->shutdown();
    }
}

void Renderer::setDataPath(const std::string& path) {
    dataLoader->setBasePath(path);
}

bool Renderer::loadVolume(const std::string& dataset, int timeStep) {
    auto volumeData = dataLoader->loadVolume(dataset, timeStep);
    if (!volumeData) {
        LOG_ERROR("Failed to load volume data");
        return false;
    }
    
    volumeRenderer->setVolumeData(std::move(volumeData));
    assignBricks();
    
    return true;
}

void Renderer::setCamera(const Camera& cam) {
    camera = cam;
    volumeRenderer->setCamera(camera);
}

void Renderer::setTransferFunction(const TransferFunction& tf) {
    transferFunction = tf;
    volumeRenderer->setTransferFunction(transferFunction);
}

void Renderer::setRenderParams(const RenderParams& params) {
    renderParams = params;
    volumeRenderer->setRenderParams(renderParams);
}

bool Renderer::render() {
    renderBricks();
    compositeFrames();
    return true;
}

void Renderer::assignBricks() {
    int totalBricks = 8;
    assignedBricks.clear();
    
    int bricksPerRank = (totalBricks + mpiSize - 1) / mpiSize;
    int startBrick = mpiRank * bricksPerRank;
    int endBrick = std::min(startBrick + bricksPerRank, totalBricks);
    
    for (int i = startBrick; i < endBrick; ++i) {
        BrickInfo brick;
        brick.id = i;
        brick.lodLevel = 0;
        
        int bx = i % 2;
        int by = (i / 2) % 2;
        int bz = i / 4;
        
        brick.minBounds = Vec3(bx * 0.5f, by * 0.5f, bz * 0.5f);
        brick.maxBounds = Vec3((bx + 1) * 0.5f, (by + 1) * 0.5f, (bz + 1) * 0.5f);
        brick.priority = 1.0f;
        
        assignedBricks.push_back(brick);
    }
    
    LOG_DEBUG("Rank " << mpiRank << " assigned " << assignedBricks.size() << " bricks");
}

void Renderer::renderBricks() {
    // Clear frame with dark blue background for bioelectric viz
    std::fill(currentFrame->depthBuffer.get(),
              currentFrame->depthBuffer.get() + currentFrame->width * currentFrame->height,
              1.0f);
    const int pixels = currentFrame->width * currentFrame->height;
    for (int i = 0; i < pixels; ++i) {
        currentFrame->colorBuffer[i * 4 + 0] = 10;   // dark blue background
        currentFrame->colorBuffer[i * 4 + 1] = 10;
        currentFrame->colorBuffer[i * 4 + 2] = 30;
        currentFrame->colorBuffer[i * 4 + 3] = 255; // opaque
    }
    
    // Render all bricks (for now just render brick 0 which contains the full volume)
    if (!assignedBricks.empty()) {
        volumeRenderer->renderBrick(assignedBricks[0], *currentFrame);
    }
}

void Renderer::compositeFrames() {
    CompositeParams params;
    params.mode = CompositeParams::MIN_DEPTH;
    params.useGPU = false;
    params.numRanks = mpiSize;
    
    if (mpiRank == 0) {
        compositor->composite(*currentFrame, *compositeFrame, params);
    } else {
        Frame dummy;
        compositor->composite(*currentFrame, dummy, params);
    }
}

void Renderer::saveFrame(const std::string& outputPath, int frameNumber) {
    if (mpiRank != 0 || !compositeFrame) {
        return;
    }
    
    std::filesystem::path outDir(outputPath);
    std::filesystem::path compositedDir = outDir / "composited";
    std::filesystem::create_directories(compositedDir);
    
    char filename[256];
    std::snprintf(filename, sizeof(filename), "frame_%06d.png", frameNumber);
    std::filesystem::path filePath = compositedDir / filename;
    
    PNGEncoder encoder;
    if (!encoder.encode(*compositeFrame, filePath.string())) {
        LOG_ERROR("Failed to save frame " << frameNumber);
    }
}

} // namespace morviq
