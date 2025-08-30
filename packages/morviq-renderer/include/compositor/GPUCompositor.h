#pragma once

#include "types.h"
#include <mpi.h>

namespace morviq {

class GPUCompositor {
public:
    GPUCompositor(int rank, int size, MPI_Comm comm);
    ~GPUCompositor();
    
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
    bool initialized;
    
#ifdef USE_CUDA
    void* d_colorBuffer;
    void* d_depthBuffer;
    void* d_recvColorBuffer;
    void* d_recvDepthBuffer;
#endif
};

} // namespace morviq