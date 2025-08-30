#include "compositor/DepthCompositor.h"
#include "utils/Logger.h"
#include <cstring>
#include <algorithm>

namespace morviq {

DepthCompositor::DepthCompositor(int rank, int size, MPI_Comm comm)
    : mpiRank(rank), mpiSize(size), mpiComm(comm), frameWidth(0), frameHeight(0) {}

DepthCompositor::~DepthCompositor() {
    shutdown();
}

bool DepthCompositor::initialize(int width, int height) {
    frameWidth = width;
    frameHeight = height;
    
    size_t pixelCount = width * height;
    recvColorBuffer = std::make_unique<uint8_t[]>(pixelCount * 4);
    recvDepthBuffer = std::make_unique<float[]>(pixelCount);
    
    return true;
}

void DepthCompositor::shutdown() {
    recvColorBuffer.reset();
    recvDepthBuffer.reset();
}

void DepthCompositor::composite(const Frame& localFrame, Frame& outputFrame, 
                                const CompositeParams& params) {
    // Support MIN_DEPTH and a simple ALPHA_BLEND approximation
    
    if (mpiSize == 1) {
        // Single rank, just copy
        std::memcpy(outputFrame.colorBuffer.get(), localFrame.colorBuffer.get(), 
                   localFrame.colorBufferSize());
        std::memcpy(outputFrame.depthBuffer.get(), localFrame.depthBuffer.get(), 
                   localFrame.depthBufferSize());
        return;
    }
    
    if (mpiSize <= 8) {
        directSendComposite(localFrame, outputFrame, params);
    } else {
        binarySwapComposite(localFrame, outputFrame, params);
    }
}

void DepthCompositor::directSendComposite(const Frame& localFrame, Frame& outputFrame, const CompositeParams& params) {
    size_t pixelCount = frameWidth * frameHeight;
    size_t colorSize = pixelCount * 4;
    size_t depthSize = pixelCount * sizeof(float);
    
    if (mpiRank == 0) {
        // Root receives from all other ranks and composites
        std::memcpy(outputFrame.colorBuffer.get(), localFrame.colorBuffer.get(), colorSize);
        std::memcpy(outputFrame.depthBuffer.get(), localFrame.depthBuffer.get(), depthSize);
        
        for (int rank = 1; rank < mpiSize; ++rank) {
            MPI_Status status;
            
            MPI_Recv(recvColorBuffer.get(), colorSize, MPI_UNSIGNED_CHAR, 
                    rank, 0, mpiComm, &status);
            MPI_Recv(recvDepthBuffer.get(), pixelCount, MPI_FLOAT, 
                    rank, 1, mpiComm, &status);
            
            if (params.mode == CompositeParams::MIN_DEPTH) {
                // Classic min-depth compositing
                minDepthMerge(outputFrame.colorBuffer.get(), outputFrame.depthBuffer.get(),
                              recvColorBuffer.get(), recvDepthBuffer.get(),
                              outputFrame.colorBuffer.get(), outputFrame.depthBuffer.get(),
                              pixelCount);
            } else {
                // ALPHA_BLEND with premultiplied colors in buffers
                for (size_t i = 0; i < pixelCount; ++i) {
                    const float dA = outputFrame.depthBuffer.get()[i];
                    const float dB = recvDepthBuffer.get()[i];
                    const uint8_t* cA = &outputFrame.colorBuffer.get()[i * 4];
                    const uint8_t* cB = &recvColorBuffer.get()[i * 4];

                    // Choose front (near) and back (far)
                    const uint8_t* cNear = cA; const uint8_t* cFar = cB; float dNear = dA; float dFar = dB;
                    if (dB < dA) { cNear = cB; cFar = cA; dNear = dB; dFar = dA; }

                    float aNear = cNear[3] / 255.0f;
                    float aFar  = cFar[3] / 255.0f;
                    float rNear = cNear[0] / 255.0f;
                    float gNear = cNear[1] / 255.0f;
                    float bNear = cNear[2] / 255.0f;
                    float rFar  = cFar[0] / 255.0f;
                    float gFar  = cFar[1] / 255.0f;
                    float bFar  = cFar[2] / 255.0f;

                    // Treat input as premultiplied RGB (as produced by renderer)
                    float outA = aNear + (1.0f - aNear) * aFar;
                    float outR = rNear + (1.0f - aNear) * rFar;
                    float outG = gNear + (1.0f - aNear) * gFar;
                    float outB = bNear + (1.0f - aNear) * bFar;

                    outputFrame.depthBuffer.get()[i] = dNear;
                    uint8_t* co = &outputFrame.colorBuffer.get()[i * 4];
                    co[0] = static_cast<uint8_t>(std::min(1.0f, outR) * 255.0f);
                    co[1] = static_cast<uint8_t>(std::min(1.0f, outG) * 255.0f);
                    co[2] = static_cast<uint8_t>(std::min(1.0f, outB) * 255.0f);
                    co[3] = static_cast<uint8_t>(std::min(1.0f, outA) * 255.0f);
                }
            }
        }
    } else {
        // Other ranks send to root
        MPI_Send(localFrame.colorBuffer.get(), colorSize, MPI_UNSIGNED_CHAR, 
                0, 0, mpiComm);
        MPI_Send(localFrame.depthBuffer.get(), pixelCount, MPI_FLOAT, 
                0, 1, mpiComm);
    }
}

void DepthCompositor::binarySwapComposite(const Frame& localFrame, Frame& outputFrame, const CompositeParams& params) {
    // Simplified binary swap for larger rank counts
    // In production, would implement full binary-swap or radix-k algorithm
    
    size_t pixelCount = frameWidth * frameHeight;
    size_t colorSize = pixelCount * 4;
    
    // For now, fall back to direct send for simplicity
    directSendComposite(localFrame, outputFrame, params);
}

void DepthCompositor::minDepthMerge(const uint8_t* color1, const float* depth1,
                                    const uint8_t* color2, const float* depth2,
                                    uint8_t* colorOut, float* depthOut,
                                    size_t pixelCount) {
    for (size_t i = 0; i < pixelCount; ++i) {
        if (depth2[i] < depth1[i]) {
            depthOut[i] = depth2[i];
            colorOut[i * 4 + 0] = color2[i * 4 + 0];
            colorOut[i * 4 + 1] = color2[i * 4 + 1];
            colorOut[i * 4 + 2] = color2[i * 4 + 2];
            colorOut[i * 4 + 3] = color2[i * 4 + 3];
        } else if (color1 != colorOut) {
            depthOut[i] = depth1[i];
            colorOut[i * 4 + 0] = color1[i * 4 + 0];
            colorOut[i * 4 + 1] = color1[i * 4 + 1];
            colorOut[i * 4 + 2] = color1[i * 4 + 2];
            colorOut[i * 4 + 3] = color1[i * 4 + 3];
        }
    }
}

} // namespace morviq
