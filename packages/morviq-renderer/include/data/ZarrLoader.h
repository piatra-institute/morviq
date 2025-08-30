#pragma once

#include "types.h"
#include <string>
#include <vector>
#include <memory>

namespace morviq {

class ZarrLoader {
public:
    ZarrLoader();
    ~ZarrLoader();
    
    bool open(const std::string& path);
    
    std::unique_ptr<VolumeData> loadTimeStep(int t, int scale = 0);
    std::unique_ptr<VolumeData> loadBrick(int t, int scale, 
                                          int brickX, int brickY, int brickZ);
    
    const std::vector<int>& getShape() const { return shape; }
    const std::vector<int>& getChunks() const { return chunks; }
    
private:
    std::string zarrPath;
    std::vector<int> shape;
    std::vector<int> chunks;
    std::string dtype;
};

} // namespace morviq