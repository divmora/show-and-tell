# ShowAndTell Product Roadmap

This document serves as the **living product roadmap** for ShowAndTell.

> [!NOTE]
> In accordance with [AGENTS.md](AGENTS.md), items are added when identified and pruned immediately once implemented, tested, and committed. Active tasks or defects tracked as GitHub Issues are intentionally omitted to avoid duplication.

---

## 🎯 Living Roadmap


### ✏️ 2. Screen Annotations & Video Editing
- *(Active implementation tasks for in-page telestrator drawing tools [#16](https://github.com/divmora/show-and-tell/issues/16) are tracked directly in GitHub Issues)*

### 🔍 3. Session Replay & Diagnostics
- *(Active implementation tasks for skipping inactivity in session replay [#18](https://github.com/divmora/show-and-tell/issues/18) are tracked directly in GitHub Issues)*

---

## 🔮 Long-Term Architectural Vision (Unassigned Backlog)

The following high-level capabilities represent long-term exploration and backlog vision for the SDK:

- [ ] **Direct S3 / Cloudflare R2 Multipart Presigned Uploads**
  - Native client-side multipart chunk uploader for multi-gigabyte recordings streaming directly to object storage with automatic retry and resume support.
- [ ] **WebCodecs Hardware Acceleration Pipeline**
  - Transition from `MediaRecorder` to low-latency `VideoEncoder` and `AudioEncoder` primitives for precision frame-by-frame bitrate control and in-browser MP4 container muxing without transcoding delays.
- [ ] **WebAssembly (WASM) Camera Virtual Background & Blur**
  - Optional camera bubble background blur and virtual background replacement powered by a lightweight WASM/ONNX Web segmentation pipeline.
- [ ] **Audio Noise Suppression & Speech Normalization Worklet**
  - High-performance AudioWorklet DSP filter chain to automatically suppress microphone room echo, background HVAC hum, and typing clicks in real time.
