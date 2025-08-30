#pragma once

#include "types.h"
#include <mpi.h>

namespace morviq {

class DepthCompositor {
public:
    DepthCompositor(int rank, int size, MPI_Comm comm);
    ~DepthCompositor();
    
    bool initialize(int width, int height);
    void shutdown();
    
    void composite(const Frame& localFrame, Frame& outputFrame, 
                   const CompositeParams& params);
    
private:
    int mpiRank;
    int mpiSize;
    MPI_Comm mpiComm;
    
    int frameWidth;
    int frameHeight;
    
    std::unique_ptr<uint8_t[]> recvColorBuffer;
    std::unique_ptr<float[]> recvDepthBuffer;
    
    void binarySwapComposite(const Frame& localFrame, Frame& outputFrame, const CompositeParams& params);
    void directSendComposite(const Frame& localFrame, Frame& outputFrame, const CompositeParams& params);
    void minDepthMerge(const uint8_t* color1, const float* depth1,
                       const uint8_t* color2, const float* depth2,
                       uint8_t* colorOut, float* depthOut,
                       size_t pixelCount);
};

} // namespace morviq
