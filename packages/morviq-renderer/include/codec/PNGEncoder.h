#pragma once

#include "types.h"
#include <string>

namespace morviq {

class PNGEncoder {
public:
    PNGEncoder();
    ~PNGEncoder();
    
    bool encode(const Frame& frame, const std::string& filename);
    bool encodeToMemory(const Frame& frame, std::vector<uint8_t>& output);
    
private:
    void writePNG(const std::string& filename, const uint8_t* image, 
                  int width, int height, int channels);
};

} // namespace morviq