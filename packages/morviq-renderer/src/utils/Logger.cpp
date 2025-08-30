#include "utils/Logger.h"

namespace morviq {

int Logger::mpiRank = 0;
Logger::Level Logger::currentLevel = Logger::INFO;
bool Logger::initialized = false;

void Logger::initialize(int rank) {
    mpiRank = rank;
    initialized = true;
    currentLevel = INFO;
}

void Logger::shutdown() {
    initialized = false;
}

void Logger::setLevel(Level level) {
    currentLevel = level;
}

void Logger::log(Level level, const std::string& message) {
    if (!initialized || level < currentLevel) {
        return;
    }
    
    const char* levelStr = "";
    switch (level) {
        case DEBUG: levelStr = "DEBUG"; break;
        case INFO:  levelStr = "INFO "; break;
        case WARN:  levelStr = "WARN "; break;
        case ERROR: levelStr = "ERROR"; break;
    }
    
    auto now = std::chrono::system_clock::now();
    auto time_t = std::chrono::system_clock::to_time_t(now);
    
    std::cout << "[" << std::put_time(std::localtime(&time_t), "%H:%M:%S") << "] "
              << "[Rank " << mpiRank << "] "
              << "[" << levelStr << "] "
              << message << std::endl;
}

} // namespace morviq