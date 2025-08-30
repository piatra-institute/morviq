#pragma once

#include "types.h"
#include <memory>

namespace morviq {

class VolumeRenderer {
public:
    VolumeRenderer();
    ~VolumeRenderer();
    
    bool initialize(int width, int height);
    void shutdown();
    
    void setVolumeData(std::unique_ptr<VolumeData> data);
    void setCamera(const Camera& camera);
    void setTransferFunction(const TransferFunction& tf);
    void setRenderParams(const RenderParams& params);
    
    void renderBrick(const BrickInfo& brick, Frame& frame);
    
private:
    std::unique_ptr<VolumeData> volumeData;
    Camera camera;
    TransferFunction transferFunction;
    RenderParams renderParams;
    
    int frameWidth;
    int frameHeight;
    
    void raycast(const Vec3& origin, const Vec3& direction, 
                 const BrickInfo& brick, Vec4& color, float& depth);
    Vec3 sampleGradient(const Vec3& pos);
    float sampleVolume(const Vec3& pos);
    Vec4 applyTransferFunction(float value);
};

} // namespace morviq