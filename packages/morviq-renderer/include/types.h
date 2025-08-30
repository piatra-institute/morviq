#pragma once

#include <vector>
#include <array>
#include <memory>
#include <cstdint>

namespace morviq {

struct Vec3 {
    float x, y, z;
    Vec3() : x(0), y(0), z(0) {}
    Vec3(float x, float y, float z) : x(x), y(y), z(z) {}
};

struct Vec4 {
    float x, y, z, w;
    Vec4() : x(0), y(0), z(0), w(0) {}
    Vec4(float x, float y, float z, float w) : x(x), y(y), z(z), w(w) {}
};

struct Mat4 {
    float m[16];
    Mat4() {
        for (int i = 0; i < 16; ++i) m[i] = (i % 5 == 0) ? 1.0f : 0.0f;
    }
};

struct Camera {
    Mat4 projection;
    Mat4 view;
    int viewport[4];
    
    Camera() {
        viewport[0] = 0;
        viewport[1] = 0;
        viewport[2] = 1280;
        viewport[3] = 720;
    }
};

struct TransferFunction {
    std::vector<Vec4> colorMap;
    std::vector<float> opacityMap;
    float dataRange[2];
    
    TransferFunction() {
        dataRange[0] = 0.0f;
        dataRange[1] = 1.0f;
        colorMap.resize(256);
        opacityMap.resize(256);
        for (int i = 0; i < 256; ++i) {
            float t = i / 255.0f;
            colorMap[i] = Vec4(t, t, t, 1.0f);
            opacityMap[i] = t;
        }
    }
};

struct VolumeData {
    std::unique_ptr<float[]> data;
    int dimensions[3];
    float spacing[3];
    float origin[3];
    size_t voxelCount;
    
    VolumeData() {
        dimensions[0] = dimensions[1] = dimensions[2] = 0;
        spacing[0] = spacing[1] = spacing[2] = 1.0f;
        origin[0] = origin[1] = origin[2] = 0.0f;
        voxelCount = 0;
    }
};

struct RenderParams {
    Camera camera;
    TransferFunction transferFunction;
    int quality;
    float stepSize;
    int maxSteps;
    bool enableShadows;
    bool enableGradients;
    
    RenderParams() : quality(1), stepSize(0.01f), maxSteps(1000),
                     enableShadows(false), enableGradients(true) {}
};

struct Frame {
    std::unique_ptr<uint8_t[]> colorBuffer;
    std::unique_ptr<float[]> depthBuffer;
    int width;
    int height;
    int channels;
    
    Frame() : width(0), height(0), channels(4) {}
    
    Frame(int w, int h, int c = 4) : width(w), height(h), channels(c) {
        size_t colorSize = width * height * channels;
        size_t depthSize = width * height;
        colorBuffer = std::make_unique<uint8_t[]>(colorSize);
        depthBuffer = std::make_unique<float[]>(depthSize);
    }
    
    size_t colorBufferSize() const { return width * height * channels; }
    size_t depthBufferSize() const { return width * height * sizeof(float); }
};

struct BrickInfo {
    int id;
    Vec3 minBounds;
    Vec3 maxBounds;
    int lodLevel;
    size_t voxelCount;
    float priority;
    
    BrickInfo() : id(-1), lodLevel(0), voxelCount(0), priority(0.0f) {}
};

struct CompositeParams {
    enum Mode {
        MIN_DEPTH,
        ALPHA_BLEND,
        MAX_INTENSITY
    };
    
    Mode mode;
    bool useGPU;
    int numRanks;
    
    CompositeParams() : mode(MIN_DEPTH), useGPU(false), numRanks(1) {}
};

} // namespace morviq