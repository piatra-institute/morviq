#include "data/ZarrLoader.h"
#include "utils/Logger.h"
#include <fstream>
#include <filesystem>

namespace morviq {

ZarrLoader::ZarrLoader() {}

ZarrLoader::~ZarrLoader() {}

bool ZarrLoader::open(const std::string& path) {
    zarrPath = path;
    
    // Read .zarray metadata
    std::filesystem::path metaPath = std::filesystem::path(path) / ".zarray";
    if (!std::filesystem::exists(metaPath)) {
        LOG_ERROR("Zarr metadata not found: " << metaPath);
        return false;
    }
    
    // Parse JSON metadata (simplified - would use proper JSON parser)
    std::ifstream metaFile(metaPath);
    if (!metaFile) {
        LOG_ERROR("Failed to open Zarr metadata");
        return false;
    }
    std::string json((std::istreambuf_iterator<char>(metaFile)), std::istreambuf_iterator<char>());
    
    auto parseArray = [&](const std::string& key, std::vector<int>& out, int expect=3) {
        out.clear();
        auto pos = json.find("\"" + key + "\"");
        if (pos == std::string::npos) return false;
        pos = json.find('[', pos);
        if (pos == std::string::npos) return false;
        auto end = json.find(']', pos);
        if (end == std::string::npos) return false;
        std::string arr = json.substr(pos + 1, end - pos - 1);
        size_t i = 0;
        while (i < arr.size()) {
            while (i < arr.size() && (arr[i] == ' ' || arr[i] == ',')) ++i;
            size_t j = i;
            while (j < arr.size() && (arr[j] == '-' || (arr[j] >= '0' && arr[j] <= '9'))) ++j;
            if (j > i) {
                out.push_back(std::stoi(arr.substr(i, j - i)));
                i = j;
            } else {
                break;
            }
        }
        if (expect > 0 && static_cast<int>(out.size()) != expect) {
            LOG_WARN("Zarr metadata: key '" << key << "' expected " << expect << " elems, got " << out.size());
        }
        return !out.empty();
    };
    
    auto parseString = [&](const std::string& key, std::string& out) {
        auto pos = json.find("\"" + key + "\"");
        if (pos == std::string::npos) return false;
        pos = json.find(':', pos);
        if (pos == std::string::npos) return false;
        pos = json.find('"', pos);
        if (pos == std::string::npos) return false;
        auto end = json.find('"', pos + 1);
        if (end == std::string::npos) return false;
        out = json.substr(pos + 1, end - pos - 1);
        return true;
    };
    
    if (!parseArray("shape", shape)) shape = {128,128,128};
    if (!parseArray("chunks", chunks)) chunks = {64,64,64};
    if (!parseString("dtype", dtype)) dtype = "<f4";
    
    return true;
}

std::unique_ptr<VolumeData> ZarrLoader::loadTimeStep(int t, int scale) {
    std::filesystem::path dataPath = zarrPath;
    dataPath = dataPath / std::to_string(t) / std::to_string(scale);
    
    if (!std::filesystem::exists(dataPath)) {
        LOG_ERROR("Zarr time step not found: " << dataPath);
        return nullptr;
    }
    
    auto volume = std::make_unique<VolumeData>();
    volume->dimensions[0] = shape[0] >> scale;
    volume->dimensions[1] = shape[1] >> scale;
    volume->dimensions[2] = shape[2] >> scale;
    volume->voxelCount = volume->dimensions[0] * volume->dimensions[1] * volume->dimensions[2];
    
    volume->data = std::make_unique<float[]>(volume->voxelCount);
    
    // Load chunks (simplified - would implement proper chunked loading)
    // For now, return procedural data
    for (size_t i = 0; i < volume->voxelCount; ++i) {
        volume->data[i] = static_cast<float>(i) / volume->voxelCount;
    }
    
    return volume;
}

std::unique_ptr<VolumeData> ZarrLoader::loadBrick(int t, int scale, 
                                                  int brickX, int brickY, int brickZ) {
    // Load specific brick from Zarr chunks
    auto volume = std::make_unique<VolumeData>();
    
    volume->dimensions[0] = chunks[0];
    volume->dimensions[1] = chunks[1];
    volume->dimensions[2] = chunks[2];
    volume->voxelCount = chunks[0] * chunks[1] * chunks[2];
    
    volume->origin[0] = brickX * chunks[0];
    volume->origin[1] = brickY * chunks[1];
    volume->origin[2] = brickZ * chunks[2];
    
    volume->data = std::make_unique<float[]>(volume->voxelCount);
    
    // Load chunk data (stub)
    for (size_t i = 0; i < volume->voxelCount; ++i) {
        volume->data[i] = 0.5f;
    }
    
    return volume;
}

} // namespace morviq
