#pragma once

#include "types.h"
#include <string>
#include <vector>

namespace morviq {

class Encoder {
public:
    virtual ~Encoder() = default;
    
    virtual bool encode(const Frame& frame, std::vector<uint8_t>& output) = 0;
    virtual bool encodeToFile(const Frame& frame, const std::string& filename) = 0;
    
    virtual std::string getMimeType() const = 0;
};

} // namespace morviq