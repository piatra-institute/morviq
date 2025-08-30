#pragma once

#include "types.h"
#include <string>
#include <memory>

namespace morviq {

class DataLoader {
public:
    DataLoader();
    ~DataLoader();
    
    void setBasePath(const std::string& path);
    
    std::unique_ptr<VolumeData> loadVolume(const std::string& dataset, int timeStep);
    std::unique_ptr<VolumeData> loadZarr(const std::string& path, int timeStep);
    std::unique_ptr<VolumeData> generateProceduralVolume(int size);
    
private:
    std::string basePath;
    
    std::unique_ptr<VolumeData> loadRawVolume(const std::string& filename, 
                                              int width, int height, int depth);
};

} // namespace morviq