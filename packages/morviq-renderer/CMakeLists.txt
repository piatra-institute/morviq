cmake_minimum_required(VERSION 3.16)
project(morviq_renderer CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

find_package(MPI REQUIRED)
find_package(OpenGL REQUIRED)
find_package(Threads REQUIRED)
find_package(PNG REQUIRED)

option(USE_GPU "Enable GPU acceleration" ON)
option(USE_NVENC "Enable NVENC encoding" OFF)

if(USE_GPU)
    find_package(CUDA)
    if(CUDA_FOUND)
        enable_language(CUDA)
        add_definitions(-DUSE_CUDA)
        set(CMAKE_CUDA_STANDARD 14)
    endif()
endif()

set(SOURCES
    src/main.cpp
    src/control/ControlServer.cpp
    src/renderer/Renderer.cpp
    src/renderer/VolumeRenderer.cpp
    src/compositor/DepthCompositor.cpp
    src/compositor/GPUCompositor.cpp
    src/data/DataLoader.cpp
    src/data/ZarrLoader.cpp
    src/utils/Timer.cpp
    src/utils/Logger.cpp
    src/codec/Encoder.cpp
    src/codec/PNGEncoder.cpp
)

set(HEADERS
    include/control/ControlServer.h
    include/renderer/Renderer.h
    include/renderer/VolumeRenderer.h
    include/compositor/DepthCompositor.h
    include/compositor/GPUCompositor.h
    include/data/DataLoader.h
    include/data/ZarrLoader.h
    include/utils/Timer.h
    include/utils/Logger.h
    include/codec/Encoder.h
    include/codec/PNGEncoder.h
    include/types.h
)

add_executable(morviq_renderer ${SOURCES} ${HEADERS})

target_include_directories(morviq_renderer PRIVATE 
    ${CMAKE_CURRENT_SOURCE_DIR}/include
    ${MPI_CXX_INCLUDE_DIRS}
)

target_link_libraries(morviq_renderer
    ${MPI_CXX_LIBRARIES}
    ${CMAKE_THREAD_LIBS_INIT}
    ${OPENGL_LIBRARIES}
    PNG::PNG
)

if(CUDA_FOUND AND USE_GPU)
    target_include_directories(morviq_renderer PRIVATE ${CUDA_INCLUDE_DIRS})
    target_link_libraries(morviq_renderer ${CUDA_LIBRARIES})
endif()

target_compile_options(morviq_renderer PRIVATE ${MPI_CXX_COMPILE_FLAGS})
target_link_options(morviq_renderer PRIVATE ${MPI_CXX_LINK_FLAGS})

if(CMAKE_BUILD_TYPE STREQUAL "Debug")
    target_compile_options(morviq_renderer PRIVATE -g -O0 -Wall -Wextra)
else()
    target_compile_options(morviq_renderer PRIVATE -O3 -march=native)
endif()

install(TARGETS morviq_renderer DESTINATION bin)
