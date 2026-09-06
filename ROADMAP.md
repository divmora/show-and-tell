# ShowAndTell Product Roadmap

This document serves as the **living product roadmap** for ShowAndTell.
- **Adding Items**: Whenever a new capability, enhancement, or edge-case improvement is identified for the future, add it here under the appropriate category.
- **Removing Items**: Once a feature is fully implemented, verified, and committed, **remove it from this roadmap**.

---

## 1. Recording UX & Real-Time Feedback

- [ ] **Live Microphone Audio Level Meter (VU Meter)**
  - Add a real-time 3-segment pulsating audio level indicator next to the microphone icon on the floating toolbar (`RecordingWidget`) and Document PiP window (`PipController`).
  - Utilizes Web Audio `AnalyserNode` connected to `micSourceNode` to compute RMS volume.
  - Alert the user if the microphone is unmuted but audio level stays near zero for >5 seconds ("Silent Mic Warning").

- [ ] **Pre-Recording 3-2-1 Countdown Overlay**
  - Configurable countdown timer (`countdown: 3`) after screen selection before recording actually starts.
  - Smooth animated circular countdown numbers (`3`, `2`, `1`, `Go!`) with synthetic audio tick.
  - Includes a "Start Immediately" skip button to jump straight into recording.

- [ ] **Click Ripple & Cursor Spotlight**
  - Transient radial pulse animations around mouse clicks during recording so viewers can clearly track user interactions in pixel screen recordings.
  - Optional spotlight dimming mode for focusing on specific UI elements.

- [ ] **Global Keyboard Shortcuts (Hotkeys)**
  - Configurable hotkeys (e.g., `Alt+Shift+R` to Start/Stop, `Alt+Shift+P` to Pause/Resume, `Alt+Shift+C` to toggle camera bubble).
  - Allows seamless control during full-screen apps and presentations without touching the toolbar.

---

## 2. Screen Annotations & Video Editing

- [ ] **Screen Annotation / Telestrator (Drawing Tools)**
  - In-page transparent canvas overlay allowing users to draw directly on screen while recording:
    - Freehand pen / marker with color selection (Red, Yellow, Blue, Green).
    - Vector arrow pointer tool for calling out specific buttons and UI areas.
    - Disappearing ink mode (drawings automatically fade away after 3 seconds to avoid screen clutter).
    - 1-click Clear / Eraser button.
  - Captured natively in Pixel mode and serialized as vector drawing events in DOM mode.

- [ ] **Post-Recording Video Trimmer**
  - Interactive `[In]` and `[Out]` trim handles on the video timeline scrubber in `PreviewModal`.
  - Display trimmed duration in real time (e.g. `Original: 01:00 | Trimmed: 00:42`).
  - Client-side trimming upon export so users can clip unwanted beginnings or endings without external video editors.

---

## 3. Session Replay & Diagnostics

- [ ] **Skip Inactivity in Session Replay**
  - Replay viewer toggle `[x] Skip Inactivity` in `DomReplayer` and standalone HTML player.
  - Fast-forwards through periods of idle time / silence (>2 seconds with no user events) at 8x speed.

- [ ] **Full Network Request & Response Inspector (HAR-lite)**
  - Expand `DiagnosticsCollector` to capture sanitized HTTP request headers, request JSON bodies, response status, and response bodies (up to 32 KB).
  - Display interactive Network tab inside the Diagnostics drawer of `PreviewModal` with method, status badge, headers, and formatted JSON viewer.
  - Automatic redaction of sensitive credentials (`Authorization: Bearer ***`, `Cookie`, `x-api-key`).

---

## 4. Storage & Cloud Uploads

- [ ] **Direct S3 / Cloudflare R2 / Supabase Presigned URL Upload**
  - Add first-class support for direct presigned URL upload providers:
    ```ts
    upload: {
      getPresignedUrl: async (filename, mimeType) => ({ url, method: 'PUT', headers }),
      onProgress: (percent) => console.log(`Uploading: ${percent}%`),
    }
    ```
  - Enables serverless deployments to upload multi-hundred-megabyte recordings directly to object storage without proxying through application servers.

- [ ] **IndexedDB Auto-Pruning & Storage Budget Cap**
  - Automatic TTL expiration for recovered/unsaved sessions older than 7 days.
  - Configurable storage budget (e.g., max 300 MB) with LRU eviction to prevent local disk bloat over long periods of usage.

---

## 5. Developer Ecosystem & Theming

- [ ] **Custom Theming & White-Label Styling**
  - Allow developers to customize toolbar and modal appearance to match their brand:
    ```ts
    theme: {
      primaryColor: '#6366f1',
      fontFamily: 'Inter, sans-serif',
      borderRadius: '8px',
      mode: 'dark' | 'light',
    }
    ```

- [ ] **React Component Package (`@show-and-tell/react`)**
  - Drop-in React hook and component:
    ```tsx
    import { useShowAndTell, ShowAndTellWidget } from '@show-and-tell/react';
    ```
