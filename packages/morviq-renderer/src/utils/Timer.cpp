#include "utils/Timer.h"

namespace morviq {

Timer::Timer() {
    reset();
}

void Timer::reset() {
    start = std::chrono::high_resolution_clock::now();
}

double Timer::elapsed() const {
    auto end = std::chrono::high_resolution_clock::now();
    return std::chrono::duration<double>(end - start).count();
}

double Timer::elapsedMilliseconds() const {
    return elapsed() * 1000.0;
}

} // namespace morviq