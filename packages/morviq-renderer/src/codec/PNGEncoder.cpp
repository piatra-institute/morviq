#include "codec/PNGEncoder.h"
#include "utils/Logger.h"
#include <png.h>
#include <vector>
#include <cstdio>

namespace morviq {

// PNG encoder implementation using libpng

PNGEncoder::PNGEncoder() {}

PNGEncoder::~PNGEncoder() {}

bool PNGEncoder::encode(const Frame& frame, const std::string& filename) {
    if (frame.channels != 4) {
        LOG_WARN("PNGEncoder: expected RGBA (4 channels), got " << frame.channels);
        return false;
    }
    // Convert from premultiplied RGBA to straight alpha for PNG display
    std::vector<uint8_t> straight(frame.colorBufferSize());
    const uint8_t* src = frame.colorBuffer.get();
    for (size_t i = 0; i < static_cast<size_t>(frame.width * frame.height); ++i) {
        float a = src[i * 4 + 3] / 255.0f;
        if (a > 0.0f) {
            straight[i * 4 + 0] = static_cast<uint8_t>(std::min(255.0f, src[i * 4 + 0] / a));
            straight[i * 4 + 1] = static_cast<uint8_t>(std::min(255.0f, src[i * 4 + 1] / a));
            straight[i * 4 + 2] = static_cast<uint8_t>(std::min(255.0f, src[i * 4 + 2] / a));
            straight[i * 4 + 3] = src[i * 4 + 3];
        } else {
            straight[i * 4 + 0] = 0;
            straight[i * 4 + 1] = 0;
            straight[i * 4 + 2] = 0;
            straight[i * 4 + 3] = 0;
        }
    }

    FILE* fp = std::fopen(filename.c_str(), "wb");
    if (!fp) {
        LOG_ERROR("PNGEncoder: failed to open file: " << filename);
        return false;
    }

    png_structp png_ptr = png_create_write_struct(PNG_LIBPNG_VER_STRING, nullptr, nullptr, nullptr);
    if (!png_ptr) { std::fclose(fp); return false; }
    png_infop info_ptr = png_create_info_struct(png_ptr);
    if (!info_ptr) { png_destroy_write_struct(&png_ptr, nullptr); std::fclose(fp); return false; }
    if (setjmp(png_jmpbuf(png_ptr))) { png_destroy_write_struct(&png_ptr, &info_ptr); std::fclose(fp); return false; }

    png_init_io(png_ptr, fp);
    png_set_IHDR(png_ptr, info_ptr,
                 frame.width, frame.height,
                 8, PNG_COLOR_TYPE_RGBA,
                 PNG_INTERLACE_NONE, PNG_COMPRESSION_TYPE_DEFAULT, PNG_FILTER_TYPE_DEFAULT);

    png_write_info(png_ptr, info_ptr);

    std::vector<png_bytep> rows(frame.height);
    for (int y = 0; y < frame.height; ++y) {
        rows[y] = (png_bytep)(straight.data() + y * frame.width * frame.channels);
    }
    png_write_image(png_ptr, rows.data());
    png_write_end(png_ptr, nullptr);

    png_destroy_write_struct(&png_ptr, &info_ptr);
    std::fclose(fp);
    return true;
}

static void png_memory_write(png_structp png_ptr, png_bytep data, png_size_t length) {
    auto vec = static_cast<std::vector<uint8_t>*>(png_get_io_ptr(png_ptr));
    vec->insert(vec->end(), data, data + length);
}
static void png_memory_flush(png_structp) {}

bool PNGEncoder::encodeToMemory(const Frame& frame, std::vector<uint8_t>& output) {
    output.clear();
    if (frame.channels != 4) return false;
    // Convert from premultiplied RGBA to straight alpha
    std::vector<uint8_t> straight(frame.colorBufferSize());
    const uint8_t* src = frame.colorBuffer.get();
    for (size_t i = 0; i < static_cast<size_t>(frame.width * frame.height); ++i) {
        float a = src[i * 4 + 3] / 255.0f;
        if (a > 0.0f) {
            straight[i * 4 + 0] = static_cast<uint8_t>(std::min(255.0f, src[i * 4 + 0] / a));
            straight[i * 4 + 1] = static_cast<uint8_t>(std::min(255.0f, src[i * 4 + 1] / a));
            straight[i * 4 + 2] = static_cast<uint8_t>(std::min(255.0f, src[i * 4 + 2] / a));
            straight[i * 4 + 3] = src[i * 4 + 3];
        } else {
            straight[i * 4 + 0] = 0;
            straight[i * 4 + 1] = 0;
            straight[i * 4 + 2] = 0;
            straight[i * 4 + 3] = 0;
        }
    }
    png_structp png_ptr = png_create_write_struct(PNG_LIBPNG_VER_STRING, nullptr, nullptr, nullptr);
    if (!png_ptr) return false;
    png_infop info_ptr = png_create_info_struct(png_ptr);
    if (!info_ptr) { png_destroy_write_struct(&png_ptr, nullptr); return false; }
    if (setjmp(png_jmpbuf(png_ptr))) { png_destroy_write_struct(&png_ptr, &info_ptr); return false; }

    png_set_write_fn(png_ptr, &output, png_memory_write, png_memory_flush);

    png_set_IHDR(png_ptr, info_ptr,
                 frame.width, frame.height,
                 8, PNG_COLOR_TYPE_RGBA,
                 PNG_INTERLACE_NONE, PNG_COMPRESSION_TYPE_DEFAULT, PNG_FILTER_TYPE_DEFAULT);
    png_write_info(png_ptr, info_ptr);

    std::vector<png_bytep> rows(frame.height);
    for (int y = 0; y < frame.height; ++y) {
        rows[y] = (png_bytep)(straight.data() + y * frame.width * frame.channels);
    }
    png_write_image(png_ptr, rows.data());
    png_write_end(png_ptr, nullptr);
    png_destroy_write_struct(&png_ptr, &info_ptr);
    return true;
}

void PNGEncoder::writePNG(const std::string& filename, const uint8_t* image, 
                          int width, int height, int channels) {
    Frame f;
    f.width = width; f.height = height; f.channels = channels;
    // Wrap buffer without copying for this usage
    // Note: writePNG is only used internally; prefer encode() for file output
    LOG_WARN("PNGEncoder::writePNG is deprecated; use encode()");
}

} // namespace morviq
