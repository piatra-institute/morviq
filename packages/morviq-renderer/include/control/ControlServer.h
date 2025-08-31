#pragma once

#include <string>
#include <thread>
#include <atomic>
#include <functional>

namespace morviq {

struct ControlState {
    float projection[16];
    float view[16];
    int viewport[2]; // width, height
    int timeStep;
    int quality; // 0=low,1=medium,2=high
    std::string bioelectricParams; // JSON string with bioelectric parameters
};

class ControlServer {
public:
    ControlServer();
    ~ControlServer();

    bool start(int port, std::function<void(const ControlState&)> onUpdate);
    void stop();

    ControlState getState() const;

private:
    int listenFd;
    std::thread serverThread;
    std::atomic<bool> running;
    ControlState state;
};

} // namespace morviq

