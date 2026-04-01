#include <cstddef>
#include <Processing.NDI.Lib.h>
#include <iostream>
#include <string>
#include <cstring>
#include <unistd.h>

// ============================================================
// ndi_bridge.cpp
// Ponte entre o NDI SDK e o Node.js via stdin/stdout
//
// PROTOCOLO:
//   ← { "type": "sources", "list": [...] }   lista de fontes encontradas
//   → "0\n"                                   Node.js envia índice escolhido
//   ← { "type": "status", "msg": "connected" }
//   ← { "type": "frame", "w": N, "h": N, "bytes": N }
//      seguido de N bytes binários RGBA do frame
// ============================================================

void sendJSON(const std::string& json) {
    std::cout << json << "\n";
    std::cout.flush();
}

int main() {
    if (!NDIlib_initialize()) {
        sendJSON("{\"type\":\"error\",\"msg\":\"NDI init failed\"}");
        return 1;
    }

    sendJSON("{\"type\":\"status\",\"msg\":\"NDI initialized\"}");

    // ── Descoberta de fontes ──────────────────────────────
    NDIlib_find_instance_t finder = NDIlib_find_create_v2();
    if (!finder) {
        sendJSON("{\"type\":\"error\",\"msg\":\"Finder failed\"}");
        return 1;
    }

    NDIlib_find_wait_for_sources(finder, 3000);

    uint32_t num_sources = 0;
    const NDIlib_source_t* sources =
        NDIlib_find_get_current_sources(finder, &num_sources);

    // Monta JSON da lista de fontes
    std::string sourcesJSON = "{\"type\":\"sources\",\"list\":[";
    for (uint32_t i = 0; i < num_sources; i++) {
        if (i > 0) sourcesJSON += ",";
        sourcesJSON += "{\"name\":\"";
        sourcesJSON += sources[i].p_ndi_name;
        sourcesJSON += "\",\"url\":\"";
        sourcesJSON += (sources[i].p_url_address ? sources[i].p_url_address : "");
        sourcesJSON += "\"}";
    }
    sourcesJSON += "]}";
    sendJSON(sourcesJSON);

    if (num_sources == 0) {
        sendJSON("{\"type\":\"status\",\"msg\":\"no_sources\"}");
        NDIlib_find_destroy(finder);
        NDIlib_destroy();
        return 0;
    }

    // ── Aguarda escolha da fonte via stdin ────────────────
    int sourceIndex = 0;
    std::string line;
    if (std::getline(std::cin, line)) {
        try { sourceIndex = std::stoi(line); } catch (...) { sourceIndex = 0; }
    }
    if (sourceIndex < 0 || (uint32_t)sourceIndex >= num_sources) sourceIndex = 0;

    // ── Conecta ao receiver ───────────────────────────────
    NDIlib_recv_create_v3_t recv_desc;
    memset(&recv_desc, 0, sizeof(recv_desc));
    recv_desc.source_to_connect_to = sources[sourceIndex];
    recv_desc.color_format         = NDIlib_recv_color_format_RGBX_RGBA;
    recv_desc.bandwidth            = NDIlib_recv_bandwidth_highest;
    recv_desc.allow_video_fields   = false;

    NDIlib_recv_instance_t receiver = NDIlib_recv_create_v3(&recv_desc);
    NDIlib_find_destroy(finder);

    if (!receiver) {
        sendJSON("{\"type\":\"error\",\"msg\":\"Receiver creation failed\"}");
        NDIlib_destroy();
        return 1;
    }

    sendJSON("{\"type\":\"status\",\"msg\":\"connected\"}");

    // ── Loop de recepção de frames ────────────────────────
    while (true) {
        NDIlib_video_frame_v2_t video_frame;
        NDIlib_frame_type_e type = NDIlib_recv_capture_v2(
            receiver, &video_frame, nullptr, nullptr, 1000
        );

        if (type == NDIlib_frame_type_video) {
            int w     = video_frame.xres;
            int h     = video_frame.yres;
            int bytes = w * h * 4;

            // 1. Envia metadados JSON
            std::string meta = "{\"type\":\"frame\",\"w\":";
            meta += std::to_string(w);
            meta += ",\"h\":";
            meta += std::to_string(h);
            meta += ",\"bytes\":";
            meta += std::to_string(bytes);
            meta += "}";
            sendJSON(meta);

            // 2. Envia bytes brutos RGBA
            fwrite(video_frame.p_data, 1, bytes, stdout);
            fflush(stdout);

            NDIlib_recv_free_video_v2(receiver, &video_frame);
        }

        if (type == NDIlib_frame_type_error) {
            sendJSON("{\"type\":\"error\",\"msg\":\"Receiver error\"}");
            break;
        }
    }

    NDIlib_recv_destroy(receiver);
    NDIlib_destroy();
    return 0;
}
