#pragma once

#include <chrono>

namespace morviq {

class Timer {
public:
    Timer();
    
    void reset();
    double elapsed() const;
    double elapsedMilliseconds() const;
    
private:
    std::chrono::high_resolution_clock::time_point start;
};

} // namespace morviq