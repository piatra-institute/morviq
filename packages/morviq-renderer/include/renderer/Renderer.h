#pragma once

#include "types.h"
#include <memory>
#include <mpi.h>

namespace morviq {

class DataLoader;
class VolumeRenderer;
class DepthCompositor;

class Renderer {
public:
    Renderer(int rank, int size, MPI_Comm comm);
    ~Renderer();
    
    bool initialize(int width, int height);
    void shutdown();
    
    void setDataPath(const std::string& path);
    bool loadVolume(const std::string& dataset, int timeStep);
    
    void setCamera(const Camera& camera);
    void setTransferFunction(const TransferFunction& tf);
    void setRenderParams(const RenderParams& params);
    
    bool render();
    const Frame& getFrame() const { return *currentFrame; }
    
    void saveFrame(const std::string& outputPath, int frameNumber);
    
private:
    int mpiRank;
    int mpiSize;
    MPI_Comm mpiComm;
    
    std::unique_ptr<DataLoader> dataLoader;
    std::unique_ptr<VolumeRenderer> volumeRenderer;
    std::unique_ptr<DepthCompositor> compositor;
    std::unique_ptr<Frame> currentFrame;
    std::unique_ptr<Frame> compositeFrame;
    
    Camera camera;
    TransferFunction transferFunction;
    RenderParams renderParams;
    
    std::vector<BrickInfo> assignedBricks;
    
    void assignBricks();
    void renderBricks();
    void compositeFrames();
};

} // namespace morviq