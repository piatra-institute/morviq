#include "renderer/VolumeRenderer.h"
#include "utils/Logger.h"
#include <cmath>
#include <algorithm>

namespace morviq {

VolumeRenderer::VolumeRenderer() : frameWidth(0), frameHeight(0) {}

VolumeRenderer::~VolumeRenderer() {
    shutdown();
}

bool VolumeRenderer::initialize(int width, int height) {
    frameWidth = width;
    frameHeight = height;
    LOG_INFO("VolumeRenderer initialized at " << width << "x" << height);
    return true;
}

void VolumeRenderer::shutdown() {
    volumeData.reset();
}

void VolumeRenderer::setVolumeData(std::unique_ptr<VolumeData> data) {
    volumeData = std::move(data);
}

void VolumeRenderer::setCamera(const Camera& cam) {
    camera = cam;
}

void VolumeRenderer::setTransferFunction(const TransferFunction& tf) {
    transferFunction = tf;
}

void VolumeRenderer::setRenderParams(const RenderParams& params) {
    renderParams = params;
}

void VolumeRenderer::setBioelectricParams(const std::string& jsonParams) {
    // Simple JSON parsing for bioelectric parameters
    // In production, use a proper JSON library
    if (jsonParams.find("sodium") != std::string::npos) {
        size_t pos = jsonParams.find("\"sodium\":");
        if (pos != std::string::npos) {
            pos = jsonParams.find(":", pos) + 1;
            bioelectricState.sodiumConc = std::stof(jsonParams.substr(pos));
        }
    }
    if (jsonParams.find("potassium") != std::string::npos) {
        size_t pos = jsonParams.find("\"potassium\":");
        if (pos != std::string::npos) {
            pos = jsonParams.find(":", pos) + 1;
            bioelectricState.potassiumConc = std::stof(jsonParams.substr(pos));
        }
    }
    if (jsonParams.find("restingPotential") != std::string::npos) {
        size_t pos = jsonParams.find("\"restingPotential\":");
        if (pos != std::string::npos) {
            pos = jsonParams.find(":", pos) + 1;
            bioelectricState.restingPotential = std::stof(jsonParams.substr(pos));
        }
    }
    
    // Regenerate volume data with new parameters
    if (volumeData) {
        generateBioelectricVolume();
    }
}

void VolumeRenderer::generateBioelectricVolume() {
    if (!volumeData) {
        volumeData = std::make_unique<VolumeData>();
        volumeData->dimensions[0] = 64;
        volumeData->dimensions[1] = 64;
        volumeData->dimensions[2] = 64;
        volumeData->voxelCount = 64 * 64 * 64;
        volumeData->data = std::make_unique<float[]>(volumeData->voxelCount);
    }
    
    // Generate realistic bioelectric tissue patterns
    for (int z = 0; z < 64; ++z) {
        for (int y = 0; y < 64; ++y) {
            for (int x = 0; x < 64; ++x) {
                float fx = x / 63.0f;
                float fy = y / 63.0f;
                float fz = z / 63.0f;
                
                // Base tissue potential normalized from resting potential
                float baseVoltage = bioelectricState.restingPotential;
                float value = (baseVoltage + 100.0f) / 200.0f; // Normalize -100mV to +100mV -> 0 to 1
                
                // Central hyperpolarized region (influenced by ion concentrations)
                float dx = fx - 0.5f;
                float dy = fy - 0.5f;
                float dz = fz - 0.5f;
                float dist = std::sqrt(dx*dx + dy*dy + dz*dz);
                if (dist < 0.25f) {
                    // Hyperpolarization influenced by K+ concentration
                    float hyperpolarization = bioelectricState.potassiumConc / 50.0f;
                    value = 0.1f * hyperpolarization + (1.0f - dist/0.25f) * 0.2f;
                }
                
                // Depolarized region (influenced by Na+ concentration)
                dx = fx - 0.7f;
                dy = fy - 0.3f;
                dz = fz - 0.6f;
                dist = std::sqrt(dx*dx + dy*dy + dz*dz);
                if (dist < 0.2f) {
                    float depolarization = bioelectricState.sodiumConc / 145.0f;
                    value = std::max(value, 0.8f * depolarization + (1.0f - dist/0.2f) * 0.2f);
                }
                
                // Action potential wave (modulated by ion channel conductances)
                float waveStrength = (bioelectricState.navConductance + bioelectricState.kvConductance) / 300.0f;
                float wave = std::sin((fx + fy) * 10.0f - fz * 5.0f) * 0.1f * waveStrength;
                value += wave;
                
                // Gap junction network pattern
                if (bioelectricState.gapJunctionsEnabled) {
                    float networkStrength = bioelectricState.gapJunctionCond / 100.0f;
                    float network = std::sin(fx * 20.0f) * std::sin(fy * 20.0f) * std::sin(fz * 20.0f) * 0.05f * networkStrength;
                    value += network;
                }
                
                value = std::max(0.0f, std::min(1.0f, value));
                
                int idx = x + y * 64 + z * 64 * 64;
                volumeData->data[idx] = value;
            }
        }
    }
}

void VolumeRenderer::renderBrick(const BrickInfo& brick, Frame& frame) {
    // Generate 3D bioelectric volume data if not present
    if (!volumeData) {
        LOG_INFO("Generating 3D bioelectric tissue volume");
        generateBioelectricVolume();
    }
    
    // 3D Ray marching through the volume
    for (int py = 0; py < frameHeight; ++py) {
        for (int px = 0; px < frameWidth; ++px) {
            // Screen to NDC coordinates
            float u = (px / float(frameWidth)) * 2.0f - 1.0f;
            float v = 1.0f - (py / float(frameHeight)) * 2.0f;
            
            // Ray setup with perspective
            Vec3 rayOrigin;
            Vec3 rayDir;
            
            // Camera at distance looking at origin
            float camDist = 2.0f;
            float rotAngle = brick.id * 0.5f; // Rotate based on brick for multi-view
            
            // Eye position
            rayOrigin.x = camDist * std::sin(rotAngle);
            rayOrigin.y = 0.5f;
            rayOrigin.z = camDist * std::cos(rotAngle);
            
            // Ray direction from eye through screen pixel
            Vec3 screenPos;
            screenPos.x = u * 0.5f;
            screenPos.y = v * 0.5f;
            screenPos.z = 0.0f;
            
            // Transform screen position by rotation
            float screenX = screenPos.x * std::cos(rotAngle) - screenPos.z * std::sin(rotAngle);
            float screenZ = screenPos.x * std::sin(rotAngle) + screenPos.z * std::cos(rotAngle);
            
            rayDir.x = screenX - rayOrigin.x + 0.5f;
            rayDir.y = screenPos.y - rayOrigin.y + 0.5f;
            rayDir.z = screenZ - rayOrigin.z + 0.5f;
            
            // Normalize ray direction
            float len = std::sqrt(rayDir.x*rayDir.x + rayDir.y*rayDir.y + rayDir.z*rayDir.z);
            if (len > 0) {
                rayDir.x /= len;
                rayDir.y /= len;
                rayDir.z /= len;
            }
            
            // Ray march
            Vec4 accum(0, 0, 0, 0);
            float stepSize = 0.01f;
            float tMax = 5.0f;
            
            for (float t = 0; t < tMax; t += stepSize) {
                Vec3 pos;
                pos.x = rayOrigin.x + rayDir.x * t;
                pos.y = rayOrigin.y + rayDir.y * t;
                pos.z = rayOrigin.z + rayDir.z * t;
                
                // Check if inside volume [0,1]³
                if (pos.x >= 0 && pos.x <= 1 &&
                    pos.y >= 0 && pos.y <= 1 &&
                    pos.z >= 0 && pos.z <= 1) {
                    
                    float val = sampleVolume(pos);
                    
                    if (val > 0.05f) {
                        Vec4 color = applyTransferFunction(val);
                        
                        // Apply gradient-based shading for 3D effect
                        Vec3 gradient = sampleGradient(pos);
                        float gradMag = std::sqrt(gradient.x*gradient.x + gradient.y*gradient.y + gradient.z*gradient.z);
                        if (gradMag > 0.01f) {
                            // Simple lighting
                            Vec3 lightDir(0.5f, 0.5f, 0.5f);
                            float lighting = std::max(0.0f, 
                                -(gradient.x*lightDir.x + gradient.y*lightDir.y + gradient.z*lightDir.z) / gradMag);
                            color.x *= (0.3f + 0.7f * lighting);
                            color.y *= (0.3f + 0.7f * lighting);
                            color.z *= (0.3f + 0.7f * lighting);
                        }
                        
                        // Alpha accumulation
                        float alpha = color.w * stepSize * 3.0f;
                        alpha = std::min(alpha, 1.0f);
                        
                        accum.x += color.x * alpha * (1.0f - accum.w);
                        accum.y += color.y * alpha * (1.0f - accum.w);
                        accum.z += color.z * alpha * (1.0f - accum.w);
                        accum.w += alpha * (1.0f - accum.w);
                        
                        if (accum.w > 0.95f) break;
                    }
                }
            }
            
            // Write to frame buffer
            int idx = py * frameWidth + px;
            if (accum.w > 0.01f) {
                frame.colorBuffer[idx * 4 + 0] = static_cast<uint8_t>(std::min(1.0f, accum.x) * 255);
                frame.colorBuffer[idx * 4 + 1] = static_cast<uint8_t>(std::min(1.0f, accum.y) * 255);
                frame.colorBuffer[idx * 4 + 2] = static_cast<uint8_t>(std::min(1.0f, accum.z) * 255);
                frame.colorBuffer[idx * 4 + 3] = static_cast<uint8_t>(std::min(1.0f, accum.w) * 255);
                frame.depthBuffer[idx] = 0.5f;
            }
        }
    }
}

float VolumeRenderer::sampleVolume(const Vec3& pos) {
    if (!volumeData) return 0.0f;
    
    // Trilinear interpolation for smooth rendering
    float x = pos.x * (volumeData->dimensions[0] - 1);
    float y = pos.y * (volumeData->dimensions[1] - 1);
    float z = pos.z * (volumeData->dimensions[2] - 1);
    
    int x0 = static_cast<int>(x);
    int y0 = static_cast<int>(y);
    int z0 = static_cast<int>(z);
    int x1 = std::min(x0 + 1, volumeData->dimensions[0] - 1);
    int y1 = std::min(y0 + 1, volumeData->dimensions[1] - 1);
    int z1 = std::min(z0 + 1, volumeData->dimensions[2] - 1);
    
    float fx = x - x0;
    float fy = y - y0;
    float fz = z - z0;
    
    // Sample 8 corners
    int stride = volumeData->dimensions[0];
    int slice = stride * volumeData->dimensions[1];
    
    float v000 = volumeData->data[x0 + y0 * stride + z0 * slice];
    float v100 = volumeData->data[x1 + y0 * stride + z0 * slice];
    float v010 = volumeData->data[x0 + y1 * stride + z0 * slice];
    float v110 = volumeData->data[x1 + y1 * stride + z0 * slice];
    float v001 = volumeData->data[x0 + y0 * stride + z1 * slice];
    float v101 = volumeData->data[x1 + y0 * stride + z1 * slice];
    float v011 = volumeData->data[x0 + y1 * stride + z1 * slice];
    float v111 = volumeData->data[x1 + y1 * stride + z1 * slice];
    
    // Trilinear interpolation
    float v00 = v000 * (1 - fx) + v100 * fx;
    float v01 = v001 * (1 - fx) + v101 * fx;
    float v10 = v010 * (1 - fx) + v110 * fx;
    float v11 = v011 * (1 - fx) + v111 * fx;
    
    float v0 = v00 * (1 - fy) + v10 * fy;
    float v1 = v01 * (1 - fy) + v11 * fy;
    
    return v0 * (1 - fz) + v1 * fz;
}

Vec3 VolumeRenderer::sampleGradient(const Vec3& pos) {
    const float h = 0.01f;
    float dx = sampleVolume(Vec3(pos.x + h, pos.y, pos.z)) - 
               sampleVolume(Vec3(pos.x - h, pos.y, pos.z));
    float dy = sampleVolume(Vec3(pos.x, pos.y + h, pos.z)) - 
               sampleVolume(Vec3(pos.x, pos.y - h, pos.z));
    float dz = sampleVolume(Vec3(pos.x, pos.y, pos.z + h)) - 
               sampleVolume(Vec3(pos.x, pos.y, pos.z - h));
    
    return Vec3(dx / (2*h), dy / (2*h), dz / (2*h));
}

Vec4 VolumeRenderer::applyTransferFunction(float value) {
    Vec4 color;
    
    // Bioelectric-specific transfer function
    if (value < 0.3f) {
        // Hyperpolarized (very negative Vmem) - blue/purple
        float t = value / 0.3f;
        color.x = 0.1f + t * 0.2f;
        color.y = 0.0f;
        color.z = 0.5f + t * 0.5f;
        color.w = 0.2f + t * 0.3f;
    } else if (value < 0.5f) {
        // Normal resting potential - green/cyan
        float t = (value - 0.3f) / 0.2f;
        color.x = 0.0f;
        color.y = 0.5f + t * 0.3f;
        color.z = 0.5f - t * 0.3f;
        color.w = 0.5f + t * 0.2f;
    } else if (value < 0.7f) {
        // Slightly depolarized - yellow
        float t = (value - 0.5f) / 0.2f;
        color.x = 0.5f + t * 0.5f;
        color.y = 0.8f;
        color.z = 0.2f - t * 0.2f;
        color.w = 0.7f;
    } else {
        // Highly depolarized (cancer/wound) - red/orange
        float t = (value - 0.7f) / 0.3f;
        color.x = 1.0f;
        color.y = 0.8f - t * 0.6f;
        color.z = 0.0f;
        color.w = 0.7f + t * 0.3f;
    }
    
    return color;
}

} // namespace morviq