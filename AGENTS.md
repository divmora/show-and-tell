# AGENTS.md — Workspace Guidelines for ShowAndTell

This document defines architecture layouts, safety guarantees, coding standards, and operational guidelines for AI agents and developers working in the **ShowAndTell** codebase.

---

## 1. Project Architecture Layout

ShowAndTell is structured as an npm monorepo providing a client-side screen recording SDK and a companion demo/upload server:

```
show-and-tell/
├── packages/
│   ├── sdk/                         # Standalone ShowAndTell client library
│   │   ├── src/
│   │   │   ├── index.ts             # Main entry point & window.ShowAndTell export
│   │   │   ├── core/                # Core recording subsystems:
│   │   │   │   ├── recorder.ts      # MediaRecorder orchestrator & stream management
│   │   │   │   ├── audio-mixer.ts   # Web Audio API context for mixing mic + display audio
│   │   │   │   ├── duration-tracker.ts # High-resolution precision timer with pause awareness
│   │   │   │   └── session.ts       # Recording session lifecycle & state machine
│   │   │   ├── storage/             # IndexedDB chunk persistence & crash/reload recovery:
│   │   │   │   └── indexeddb.ts     # 1-second timeslice buffering & session reconstruction
│   │   │   ├── ui/                  # Isolated Shadow DOM widgets:
│   │   │   │   ├── widget.ts        # Floating draggable on-screen toolbar
│   │   │   │   ├── preview-modal.ts # Post-recording video playback & download/upload modal
│   │   │   │   └── recovery-banner.ts # Banner prompting restoration of interrupted sessions
│   │   │   ├── utils/               # Time formatting, event emitter, codec detection
│   │   │   └── types/               # TypeScript interface definitions (ShowAndTellConfig, etc.)
│   │   ├── dist/                    # Bundled UMD (show-and-tell.min.js), ESM, CJS, and .d.ts
│   │   ├── vite.config.ts           # Vite multi-format library bundler
│   │   └── vitest.config.ts         # Vitest unit testing configuration
│   │
│   └── server/                      # Companion Demo & Upload Server (Node.js/Express)
│       ├── src/
│       │   └── index.ts             # Static file hosting & /api/upload endpoint
│       └── uploads/                 # Storage directory for uploaded demo recordings (.gitkeep)
│
├── demo/                            # Interactive Demo Playground
│   ├── index.html                   # Rich interactive playground app
│   ├── demo.js                      # Playground control logic
│   ├── demo.css                     # Playground UI styling
│   └── standalone.html              # Zero-server static test harness
│
├── .github/                         # GitHub Actions & Dependabot configurations
├── LICENSE                          # Business Source License 1.1 (BSL 1.1)
├── Makefile                         # Standard automation targets
├── README.md                        # Project documentation & status badges
├── ROADMAP.md                       # Living product roadmap (future items to implement/prune)
├── SECURITY.md                      # Security vulnerability reporting policy
└── CONTRIBUTING.md                  # Contribution guidelines & Conventional Commits
```

---

## 2. Safety & Client-Side Isolation

When making changes to the SDK or demo server, adhere strictly to these safety invariants:

1. **Shadow DOM Encapsulation**:
   - All SDK UI elements (`RecordingWidget`, `PreviewModal`, `RecoveryBanner`) **MUST** reside within a closed/isolated Shadow DOM boundary (`attachShadow({ mode: 'open' })`).
   - CSS must be inlined within the Shadow DOM to guarantee zero style leakage into the host application and zero inheritance interference from external CSS frameworks (Tailwind, Bootstrap, etc.).

2. **MediaStream Lifecycle & Cleanup**:
   - Never leave active media tracks (`videoTrack`, `audioTrack`) dangling.
   - When a session stops, is discarded, or aborts due to error, iterate through all stream tracks and invoke `track.stop()`.
   - The browser recording indicator light/pill must extinguish immediately upon stopping.

3. **IndexedDB Data Isolation & Cleanup**:
   - IndexedDB database and store names must remain partitioned per session.
   - Upon successful export or explicit discard, remove persisted chunks from IndexedDB to prevent storage leaks.

4. **Zero Server Dependency in SDK Core**:
   - The SDK in `packages/sdk` must remain 100% functional in standalone static environments (`standalone.html`) without requiring `packages/server`.
   - The server is strictly a companion test and upload target.

---

## 3. TypeScript & Ecosystem Best Practices

- **Strict TypeScript**: Keep `noImplicitAny: true`, `strictNullChecks: true`, and strict compiler flags active.
- **Bundle Formats**: The SDK build must continue producing UMD (`dist/show-and-tell.min.js` exposing `window.ShowAndTell`), ESM (`dist/show-and-tell.esm.js`), and CJS (`dist/show-and-tell.cjs.js`).
- **Unit Testing**: All business logic (time parsing, event emitters, duration tracking, IndexedDB persistence) must be accompanied by Vitest unit tests in `packages/sdk/src/`.
- **Browser Compatibility**: Guard all browser-specific APIs (`navigator.mediaDevices`, `indexedDB`, `AudioContext`) with appropriate capability checks and friendly error messages.

---

## 4. Conventional Commits

All commits in this repository must follow the Conventional Commits specification:

```
<type>(<scope>): <summary>
```

- Allowed types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `chore`, `ci`, `build`.
- Scope should reflect the subsystem being modified: `sdk`, `server`, `demo`, `storage`, `ui`, `deps`.

---

## 5. Verification Commands

Always run the full verification pipeline before submitting any changes:

```bash
# 1. Typecheck & lint
make lint

# 2. Run unit tests
make test

# 3. Build SDK and server
make build

# 4. Clean up any artifacts
make clean
```

---

## 6. Living Product Roadmap Management

`ROADMAP.md` is the central living document tracking future capabilities, optimizations, and technical debt:
- **Adding Items**: Whenever you or the user identify a capability, optimization, or edge-case improvement for future work, add it to `ROADMAP.md` under the appropriate category.
- **Removing Items**: Once a feature is fully implemented, verified with tests, and committed, **remove it from `ROADMAP.md`** immediately to keep the roadmap focused on active upcoming tasks.

