#include "data/DataLoader.h"
#include "utils/Logger.h"
#include <fstream>
#include <filesystem>
#include <cmath>

namespace morviq {

DataLoader::DataLoader() {}

DataLoader::~DataLoader() {}

void DataLoader::setBasePath(const std::string& path) {
    basePath = path;
}

std::unique_ptr<VolumeData> DataLoader::loadVolume(const std::string& dataset, int timeStep) {
    std::filesystem::path dataPath = basePath;
    dataPath = dataPath / dataset / ("t_" + std::to_string(timeStep));
    
    if (std::filesystem::exists(dataPath / "volume.raw")) {
        // Load raw volume
        return loadRawVolume((dataPath / "volume.raw").string(), 128, 128, 128);
    } else if (std::filesystem::exists(dataPath / ".zarray")) {
        // Load Zarr volume
        return loadZarr(dataPath.string(), timeStep);
    } else {
        LOG_WARN("Dataset not found, generating procedural volume");
        return generateProceduralVolume(64);
    }
}

std::unique_ptr<VolumeData> DataLoader::loadZarr(const std::string& path, int timeStep) {
    // Simplified Zarr loader - would implement full Zarr spec
    LOG_INFO("Loading Zarr dataset from " << path);
    return generateProceduralVolume(128);
}

std::unique_ptr<VolumeData> DataLoader::loadRawVolume(const std::string& filename, 
                                                      int width, int height, int depth) {
    std::ifstream file(filename, std::ios::binary);
    if (!file) {
        LOG_ERROR("Failed to open volume file: " << filename);
        return nullptr;
    }
    
    auto volume = std::make_unique<VolumeData>();
    volume->dimensions[0] = width;
    volume->dimensions[1] = height;
    volume->dimensions[2] = depth;
    volume->voxelCount = width * height * depth;
    
    volume->data = std::make_unique<float[]>(volume->voxelCount);
    file.read(reinterpret_cast<char*>(volume->data.get()), 
             volume->voxelCount * sizeof(float));
    
    if (!file) {
        LOG_ERROR("Failed to read volume data");
        return nullptr;
    }
    
    return volume;
}

std::unique_ptr<VolumeData> DataLoader::generateProceduralVolume(int size) {
    auto volume = std::make_unique<VolumeData>();
    volume->dimensions[0] = size;
    volume->dimensions[1] = size;
    volume->dimensions[2] = size;
    volume->voxelCount = size * size * size;
    
    volume->data = std::make_unique<float[]>(volume->voxelCount);
    
    // Generate a simple sphere
    float center = size / 2.0f;
    float radius = size / 3.0f;
    
    for (int z = 0; z < size; ++z) {
        for (int y = 0; y < size; ++y) {
            for (int x = 0; x < size; ++x) {
                float dx = x - center;
                float dy = y - center;
                float dz = z - center;
                float dist = std::sqrt(dx*dx + dy*dy + dz*dz);
                
                int idx = x + y * size + z * size * size;
                volume->data[idx] = std::max(0.0f, 1.0f - dist / radius);
            }
        }
    }
    
    return volume;
}

} // namespace morviq