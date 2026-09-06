# ShowAndTell 🎬

> **100% Standalone, Zero-Server-Dependency JavaScript Screen Recording SDK** with Audio Mixing, Configurable Max Duration Limits, and Browser Reload Resilience.

[![Latest Release](https://img.shields.io/github/v/release/divmora/show-and-tell?logo=github)](https://github.com/divmora/show-and-tell/releases)
[![License: BSL 1.1](https://img.shields.io/badge/License-BSL_1.1-blue.svg)](https://github.com/divmora/.github/blob/main/LICENSING.md)
[![CI/CD](https://github.com/divmora/show-and-tell/actions/workflows/ci.yml/badge.svg)](https://github.com/divmora/show-and-tell/actions)
[![Security Policy](https://img.shields.io/badge/Security-Policy-green.svg)](SECURITY.md)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Bundled_with-Vite-646CFF)](https://vitejs.dev/)
[![Live Demo](https://img.shields.io/badge/Live_Demo-GitHub_Pages-22c55e?logo=github)](https://divmora.github.io/show-and-tell/)
[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/divmora/show-and-tell)

---

## ⚡ Key Features

- **Zero Server Dependency**: Runs 100% in client browsers. Captures and generates video Blobs and downloads files directly without requiring a backend.
- **Dual Recording Modes (`pixel` default & `dom` opt-in)**:
  - **`pixel` (default)**: Captures full screens, windows, or tabs with system + microphone audio mixing via Web Audio API, exporting WebM/MP4 video files.
  - **`dom` (zero-permission)**: Instant in-app session replay capturing DOM mutations, typing, clicks, and scrolling without browser permission dialogs. Export as offline interactive `.html` replays or JSON event logs.
- **Fine-Grained PII & Selector Masking**: Target sensitive text and text-type inputs (Aadhar card, PAN card, tax IDs) using multi-level scoped CSS selectors (e.g. `#customerScope #kycForm`), class names, or parent container boundaries.
- **Single Drop-in Bundle**: Embed `<script src="dist/show-and-tell.min.js"></script>` into any static HTML page, Single Page Application (SPA), or web application.
- **Single Function Call**: Start recording instantly with `ShowAndTell.startRecording()`.
- **Website Owner Max Duration Limit**: Enforce maximum recording time (e.g. `maxDuration: 60` or `'2m'`) with visual countdown alerts and automatic discontinuation upon reaching the limit.
- **Pause-Aware Time Tracking**: High-resolution precision timer (`performance.now()`) that pauses and resumes without penalizing user recording time.
- **Browser Reload & Navigation Resilience**: Buffers 1-second timeslices into `IndexedDB`. If the user refreshes or navigates away, the pre-reload recording can be recovered with 1 click.
- **Isolated Floating UI Widget**: Draggable on-screen recording toolbar embedded in Shadow DOM with inlined CSS (zero CSS collisions with Tailwind, Bootstrap, etc.).
- **Post-Recording Preview Modal**: Built-in video player & DOM session replayer with scrubber, speed controls (0.5x, 1x, 2x), and instant export/upload.

---

## 🎯 Popular Use Cases

ShowAndTell provides lightweight client-side screen capture designed for privacy, ease of integration, and zero server costs:

| Use Case | Why ShowAndTell | Configuration Highlight |
| :--- | :--- | :--- |
| **🐞 In-App Bug Reporting & QA Feedback** | Users record reproduction steps with voiceover narration. Reload resilience ensures video chunks are never lost if the app crashes or navigates away. | `audio: { mic: true }, uploadEndpoint: '/api/tickets'` |
| **⏱️ Timed Coding Tests & EdTech (HRTech)** | Enforce strict time limits on candidate coding walkthroughs or student submissions with pause-aware duration tracking. | `maxDuration: '5m', warningThreshold: 30` |
| **💬 Async Customer Support & Sales** | Embed 1-click video messaging into Zendesk, Intercom, or CRM portals without requiring users to install desktop apps or browser extensions. | `ui: true, previewModal: true` |
| **🎨 Creative App Showcases & Demos** | Figma-like editors, canvas apps, and dashboard builders can let users export walkthroughs mixing microphone commentary with app sound effects. | `audio: { mic: true, system: true }` |
| **⚡ Static Sites, Jamstack & Offline PWAs** | Run entirely in client browsers on GitHub Pages, Netlify, or offline PWAs without managing streaming servers or transcoding clusters. | Zero backend required; works directly via `file://` |
| **🛡️ Compliance & Incident Audit Trails** | DevOps and cloud engineers can record visual audit logs of high-stakes cloud management console actions. | `timeslice: 1000, storage: true` |

---

## 🚀 Quickstart

### 1. Direct `<script>` Tag (No Server or Build Step Needed)

```html
<!DOCTYPE html>
<html>
<head>
  <!-- 1. Include the single standalone bundle -->
  <script src="dist/show-and-tell.min.js"></script>
</head>
<body>
  <button id="recordBtn">Start Screen Recording</button>

  <script>
    document.getElementById('recordBtn').addEventListener('click', async () => {
      // 2. Start recording with 1 line of code
      const session = await ShowAndTell.startRecording({
        maxDuration: 60, // Auto-stops after 60 seconds (optional)
        audio: { mic: true, system: true },
        ui: true // Floating draggable toolbar
      });

      // 3. Stop recording when finished (or auto-stops at maxDuration)
      // const result = await session.stop();
      // result.download('my-recording.webm');
    });
  </script>
</body>
</html>
```

### 2. NPM / Modern ES Module Import

```bash
npm install show-and-tell
```

```typescript
import { ShowAndTell } from 'show-and-tell';

const session = await ShowAndTell.startRecording({
  maxDuration: '2m', // Supports strings like '30s', '2m', '5min', '1h'
  warningThreshold: 10, // Highlight warning at 10s remaining
  audio: { mic: true, system: true }
});

// Subscribe to events
session.on('warning', ({ remainingSeconds }) => {
  console.warn(`Only ${remainingSeconds}s left!`);
});

session.on('maxDurationReached', () => {
  console.log('Max limit reached! Recording completed.');
});

// Stop manually if ready early
const result = await session.stop();
console.log('Video Blob:', result.blob);
console.log('Duration:', result.duration, 'seconds');
result.download('presentation.webm');
```

---

## 🛠 Configuration Options (`ShowAndTellConfig`)

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `mode` | `'pixel' \| 'dom'` | `'pixel'` | Recording mode. `'pixel'` captures screen/window video blobs; `'dom'` captures in-app DOM mutations and user interactions with zero permission prompt. |
| `dom` | `DomConfig` | `{ maskAllInputs: true }` | Detailed options for in-app DOM session replay (see table below). |
| `maxDuration` | `number \| string` | `undefined` | Maximum recording duration in seconds (e.g. `120`) or string format (e.g. `'2m'`, `'30s'`). Auto-discontinues recording when reached. |
| `warningThreshold` | `number` | `10` | Seconds before `maxDuration` to switch the UI timer to warning mode (amber/red pulse). |
| `audio` | `boolean \| { mic?: boolean; system?: boolean }` | `{ mic: false, system: true }` | Audio capture configuration. Set `mic: true` to mix microphone commentary with system audio. |
| `ui` | `boolean` | `true` | Show on-screen floating recording toolbar (timer, mic mute, pause, stop). |
| `previewModal` | `boolean` | `true` | Automatically open video/replay preview modal with download button after recording completes. |
| `timeslice` | `number` | `1000` | Chunk interval in ms for streaming slices into `IndexedDB`. |
| `storage` | `boolean` | `true` | Enable client-side IndexedDB persistence for reload and crash recovery. |
| `filename` | `string` | `'recording'` | Default base filename for the exported recording file. |
| `uploadEndpoint` | `string` | `undefined` | Optional server URL to enable 1-click video upload in preview modal. |

### DOM Recording Options (`DomConfig`)

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `maskAllInputs` | `boolean` | `true` | When `true`, masks all input values with `••••••••`. When `false`, inputs capture clear text unless targeted. |
| `maskAllText` | `boolean` | `false` | When `true`, masks all rendered text across the entire page (`***`), except whitelisted elements. |
| `maskSelector` | `string` | `undefined` | CSS selector (supporting multilevel and scoped selectors) for elements, text, or inputs to mask. |
| `unmaskSelector` | `string` | `undefined` | CSS selector for elements, text, or inputs to explicitly whitelist/unmask. |
| `maskTextClass` | `string` | `'sat-mask'` | Class name to mask elements and text for PII protection. |
| `unmaskClass` | `string` | `'sat-unmask'` | Class name to explicitly unmask elements when `maskAllInputs` or `maskAllText` is `true`. |
| `blockClass` | `string` | `'sat-block'` | Class name for elements to completely exclude from the recording snapshot. |
| `recordMouse` | `boolean` | `true` | Whether to track mouse cursor movements and clicks. |
| `mouseThrottleMs`| `number` | `50` | Throttling interval for mouse movement events in milliseconds. |

---

## 🛡️ Privacy & PII Masking (DOM Mode)

ShowAndTell provides robust, enterprise-grade privacy controls that require **zero changes to your application HTML**:

### 1. Mask Certain Fields Only (e.g. Aadhar Card, PAN Card, Tax ID)
Fields like Aadhar cards or PAN cards are standard `<input type="text">`. Target them directly via ID or class without affecting other inputs:

```javascript
const session = await ShowAndTell.startRecording({
  mode: 'dom',
  dom: {
    maskAllInputs: false, // Normal inputs capture clear text
    maskSelector: '#aadharInput, .pan-input, #aadharTextDisplay'
  }
});
```

### 2. Disambiguate Duplicate IDs with Multilevel Scoped Selectors
If your application has duplicate IDs across different tabs, modals, or micro-frontends (e.g. two forms with `id="kycForm"`), use standard descendant CSS selectors without modifying the site's code:

```javascript
const session = await ShowAndTell.startRecording({
  mode: 'dom',
  dom: {
    maskAllInputs: false,
    // Only masks #kycForm when it resides inside #customerScope:
    maskSelector: '#customerScope #kycForm'
  }
});
```

### 3. Container-Level Masking & Nested Whitelisting
Targeting a parent container (`<form>`, `<div>`, `<section>`) automatically masks all nested inputs and text within it. You can carve out specific exceptions using `sat-unmask`:

```html
<form id="kycForm">
  <!-- All nested inputs inherit masking ('••••••••') -->
  <input type="text" name="aadhar" value="1234 5678 9012" />
  <input type="text" name="pan" value="ABCDE1234F" />

  <!-- Specific exception inside masked parent: captured in clear text -->
  <input type="text" name="country" class="sat-unmask" value="India" />
</form>
```

### 4. Maximum Privacy Mode (Mask All Text & Inputs)
For banking or healthcare apps where all user data must be concealed by default, enable `maskAllText: true` and whitelist only safe navigation:

```javascript
const session = await ShowAndTell.startRecording({
  mode: 'dom',
  dom: {
    maskAllInputs: true,
    maskAllText: true,
    unmaskSelector: '#siteHeader, .nav-bar, #searchBox'
  }
});
```

---

## 🔍 Zoom & Large-Screen Replay (DOM Mode)

Unlike traditional pixel recordings that can blur when scaled up on high-resolution displays (4K monitors, wide desktop screens), DOM session replays are rendered natively with HTML elements and CSS fonts at crisp native resolution.

ShowAndTell includes rich video-player-like zoom and viewport controls:
- **`🔍 Fit` (Default)**: Automatically scales the recorded application viewport proportionally to fit cleanly inside the player modal or container without cropping.
- **`🔍 100%` (Actual Size)**: Renders the session at the exact 1:1 pixel dimensions of the recorded browser view.
- **`🔍 150%` / `200%` (Zoomed In)**: Magnifies fine details (code snippets, complex tables, tiny form inputs, micro-interactions).
- **Auto-Follow Virtual Cursor**: When zoomed in, the viewport smoothly auto-centers and pans to follow the user's recorded mouse movements and clicks in real time.
- **Grab-to-Pan (Interactive Navigation)**: Click and drag anywhere on the player surface with a natural `grab` / `grabbing` hand cursor to inspect any part of the page.
- **Modal Maximize (`⛶`) & Fullscreen Mode**: Expand the replay modal to 96vw × 94vh or take the player into true fullscreen with 1 click for detailed inspection.

---

## 🔄 How Page Reload Resilience Works

When a user reloads the browser tab or navigates away during an active recording session:
1. `ShowAndTell` intercepts `beforeunload` and flushes in-memory video timeslices to browser `IndexedDB`.
2. When the page reloads, `ShowAndTell.init()` automatically detects the interrupted recording session.
3. An on-screen recovery banner appears: *"Unsaved Screen Recording Found (01:23). [Download Video] [Discard]"*.
4. Clicking "Download Video" reconstructs the complete video up to the exact moment of reload.

---

## 📦 Monorepo Structure

```
show-and-tell/
├── packages/
│   ├── sdk/                         # Standalone ShowAndTell client library
│   │   ├── src/
│   │   │   ├── index.ts             # Main entry point & window.ShowAndTell export
│   │   │   ├── core/                # Recorder, AudioMixer, DurationTracker, Session
│   │   │   ├── storage/             # IndexedDB chunk persistence & recovery
│   │   │   ├── ui/                  # Shadow DOM Widget, PreviewModal, RecoveryBanner
│   │   │   └── utils/               # Codec detection, time formatters, EventEmitter
│   │   ├── dist/                    # Bundled UMD (show-and-tell.min.js), ESM, & types
│   │   └── vite.config.ts
│   │
│   └── server/                      # Companion Demo Server (Node.js/Express)
│       └── src/index.ts             # Static hosting & upload test endpoint
│
├── demo/                            # Interactive Demo Playground
│   ├── index.html                   # Rich interactive web app
│   ├── demo.js
│   ├── demo.css
│   └── standalone.html              # Raw static file test (zero server)
│
├── Makefile                         # Standard build & test automation
├── LICENSE                          # Business Source License 1.1
├── SECURITY.md                      # Vulnerability reporting & SLA
├── CONTRIBUTING.md                  # Development guidelines
└── README.md
```

---

## 🧪 Development & Building

This repository includes a standardized `Makefile` for development workflows:

```bash
# Install dependencies across monorepo packages
make dev-setup

# Run TypeScript typechecking & linting
make lint

# Run automated unit test suite (Vitest)
make test

# Build SDK bundles (dist/show-and-tell.{min.js,esm.js,cjs.js}) and demo server
make build

# Launch companion demo server & interactive playground
make demo
# Open http://localhost:3000 in your browser
```

---

## 🤝 Community & Standards

- **[DeepWiki Documentation](https://deepwiki.com/divmora/show-and-tell)**: Interactive AI architecture exploration, code walkthroughs, and Q&A.
- **[Contributing Guide](CONTRIBUTING.md)**: Guidelines for reporting bugs, submitting PRs, and Conventional Commits.
- **[Code of Conduct](https://github.com/divmora/.github/blob/main/CODE_OF_CONDUCT.md)**: Community standards and expectations.
- **[Security Policy](SECURITY.md)**: Responsible disclosure guidelines with a 48-hour SLA.

---

## 📄 License & Commercial Use

This repository is licensed under the **Business Source License 1.1 (BSL 1.1)**.

- **Non-Production Use**: Free of charge for local development, testing, staging, QA, CI/CD automated validation, educational purposes, and proof-of-concept evaluation.
- **Production Deployments**: Executing ShowAndTell in a production environment, selling, reselling, sublicensing, or offering it as a commercial product or hosted service requires a commercial license (EULA) from **DIVMORA Technologies**.
- **Change Date**: Converts to the permissive **Apache License, Version 2.0** three (3) years after the release date of each respective version.

For commercial licenses and enterprise support, contact **[licensing@divmora.com](mailto:licensing@divmora.com)** or visit **[divmora.com](https://divmora.com)**.
