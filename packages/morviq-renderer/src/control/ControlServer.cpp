#include "control/ControlServer.h"
#include "utils/Logger.h"
#include <sys/types.h>
#include <sys/socket.h>
#include <netinet/in.h>
#include <arpa/inet.h>
#include <unistd.h>
#include <cstring>
#include <sstream>

namespace morviq {

ControlServer::ControlServer() : listenFd(-1), running(false) {
    // default state
    for (int i = 0; i < 16; ++i) { state.projection[i] = (i % 5 == 0) ? 1.0f : 0.0f; state.view[i] = (i % 5 == 0) ? 1.0f : 0.0f; }
    state.viewport[0] = 1280; state.viewport[1] = 720;
    state.timeStep = 0; state.quality = 1;
}

ControlServer::~ControlServer() { stop(); }

bool ControlServer::start(int port, std::function<void(const ControlState&)> onUpdate) {
    if (running.load()) return true;
    listenFd = ::socket(AF_INET, SOCK_STREAM, 0);
    if (listenFd < 0) {
        LOG_ERROR("ControlServer: socket() failed");
        return false;
    }
    int opt = 1;
    setsockopt(listenFd, SOL_SOCKET, SO_REUSEADDR, &opt, sizeof(opt));
    sockaddr_in addr{};
    addr.sin_family = AF_INET;
    addr.sin_addr.s_addr = inet_addr("127.0.0.1");
    addr.sin_port = htons(port);
    if (bind(listenFd, (sockaddr*)&addr, sizeof(addr)) < 0) {
        LOG_ERROR("ControlServer: bind() failed on port " << port);
        ::close(listenFd); listenFd = -1;
        return false;
    }
    if (listen(listenFd, 1) < 0) {
        LOG_ERROR("ControlServer: listen() failed");
        ::close(listenFd); listenFd = -1;
        return false;
    }
    running = true;
    serverThread = std::thread([this, onUpdate]() {
        LOG_INFO("ControlServer: listening on 127.0.0.1" );
        while (running.load()) {
            sockaddr_in client{}; socklen_t len = sizeof(client);
            int fd = accept(listenFd, (sockaddr*)&client, &len);
            if (fd < 0) { if (!running.load()) break; continue; }
            LOG_INFO("ControlServer: client connected");
            std::string buffer;
            buffer.reserve(4096);
            char tmp[1024];
            while (running.load()) {
                ssize_t n = ::read(fd, tmp, sizeof(tmp));
                if (n <= 0) break;
                buffer.append(tmp, tmp + n);
                size_t pos;
                while ((pos = buffer.find('\n')) != std::string::npos) {
                    std::string line = buffer.substr(0, pos);
                    buffer.erase(0, pos + 1);
                    // Parse line commands
                    std::istringstream iss(line);
                    std::string cmd; iss >> cmd;
                    if (cmd == "TIMESTEP") {
                        int t; if (iss >> t) { state.timeStep = t; onUpdate(state); }
                    } else if (cmd == "QUALITY") {
                        std::string q; if (iss >> q) {
                            if (q == "low") state.quality = 0; else if (q == "high") state.quality = 2; else state.quality = 1;
                            onUpdate(state);
                        }
                    } else if (cmd == "BIOELECTRIC") {
                        // Format: BIOELECTRIC <JSON>
                        std::string json;
                        if (std::getline(iss, json)) {
                            // Remove leading space
                            size_t p = json.find_first_not_of(' ');
                            if (p != std::string::npos) json = json.substr(p);
                            state.bioelectricParams = json;
                            onUpdate(state);
                        }
                    } else if (cmd == "CAMERA") {
                        // Format: CAMERA <16 floats proj>;<16 floats view>;<w> <h>
                        std::string proj, view; if (std::getline(iss, proj)) {
                            // proj starts with a space
                            size_t p = proj.find_first_not_of(' ');
                            if (p != std::string::npos) proj = proj.substr(p);
                            size_t semi1 = proj.find(';');
                            size_t semi2 = proj.find(';', semi1 != std::string::npos ? semi1 + 1 : std::string::npos);
                            if (semi1 != std::string::npos && semi2 != std::string::npos) {
                                std::string projArr = proj.substr(0, semi1);
                                std::string viewArr = proj.substr(semi1 + 1, semi2 - semi1 - 1);
                                std::string tail = proj.substr(semi2 + 1);
                                auto parseFloats = [](const std::string& s, float* out, int count){
                                    std::istringstream ss(s); char c; int i=0; std::string token; 
                                    while (std::getline(ss, token, ',') && i < count) {
                                        out[i++] = std::stof(token);
                                    }
                                    return i == count;
                                };
                                if (parseFloats(projArr, state.projection, 16) && parseFloats(viewArr, state.view, 16)) {
                                    std::istringstream tailss(tail);
                                    int w,h; if (tailss >> w >> h) { state.viewport[0] = w; state.viewport[1] = h; }
                                    onUpdate(state);
                                }
                            }
                        }
                    }
                }
            }
            ::close(fd);
            LOG_INFO("ControlServer: client disconnected");
        }
    });
    return true;
}

void ControlServer::stop() {
    if (!running.load()) return;
    running = false;
    if (listenFd >= 0) { ::shutdown(listenFd, SHUT_RDWR); ::close(listenFd); listenFd = -1; }
    if (serverThread.joinable()) serverThread.join();
}

ControlState ControlServer::getState() const { return state; }

} // namespace morviq

