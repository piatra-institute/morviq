#pragma once

#include <iostream>
#include <sstream>
#include <iomanip>
#include <chrono>
#include <string>

namespace morviq {

class Logger {
public:
    enum Level {
        DEBUG = 0,
        INFO = 1,
        WARN = 2,
        ERROR = 3
    };
    
    static void initialize(int rank);
    static void shutdown();
    static void setLevel(Level level);
    static void log(Level level, const std::string& message);
    
    static int getRank() { return mpiRank; }
    
private:
    static int mpiRank;
    static Level currentLevel;
    static bool initialized;
};

#define LOG_DEBUG(msg) do { \
    std::ostringstream ss; \
    ss << msg; \
    morviq::Logger::log(morviq::Logger::DEBUG, ss.str()); \
} while(0)

#define LOG_INFO(msg) do { \
    std::ostringstream ss; \
    ss << msg; \
    morviq::Logger::log(morviq::Logger::INFO, ss.str()); \
} while(0)

#define LOG_WARN(msg) do { \
    std::ostringstream ss; \
    ss << msg; \
    morviq::Logger::log(morviq::Logger::WARN, ss.str()); \
} while(0)

#define LOG_ERROR(msg) do { \
    std::ostringstream ss; \
    ss << msg; \
    morviq::Logger::log(morviq::Logger::ERROR, ss.str()); \
} while(0)

} // namespace morviq