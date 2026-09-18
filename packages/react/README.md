# @divmora/show-and-tell-react

> Drop-in React hooks and components for [ShowAndTell](https://github.com/divmora/show-and-tell) screen recording and session replay.

[![npm version](https://img.shields.io/npm/v/@divmora/show-and-tell-react.svg)](https://www.npmjs.com/package/@divmora/show-and-tell-react)
[![License: BSL 1.1](https://img.shields.io/badge/License-BSL_1.1-blue.svg)](https://github.com/divmora/show-and-tell/blob/main/LICENSE)

---

## Features

- ⚛️ **First-Class React 18 & 19 Support**: Works with Next.js App Router, Pages Router, Vite, Remix, and standard SPA setups.
- 🪝 **`useShowAndTell` Hook**: Reactive recording state, timer, mic toggle, and session controls.
- 🌐 **`<ShowAndTellProvider>` Context**: Access recording state anywhere in your tree without prop drilling.
- 🔘 **Drop-in UI Components**: Ready-to-use `<ShowAndTellButton />` and `<ShowAndTellWidget />` with zero configuration.
- 🛡️ **SSR Safe**: Fully guarded against `window` and `navigator.mediaDevices` access on the server (`'use client'`).
- 📦 **Dual ESM & CJS Bundles**: Tree-shakeable modern ES modules and CommonJS with bundled TypeScript types.

---

## Installation

```bash
npm install @divmora/show-and-tell-react @divmora/show-and-tell
# or
pnpm add @divmora/show-and-tell-react @divmora/show-and-tell
# or
yarn add @divmora/show-and-tell-react @divmora/show-and-tell
```

---

## Quick Start

### 1. Using the Hook (`useShowAndTell`)

```tsx
import React from 'react';
import { useShowAndTell } from '@divmora/show-and-tell-react';

export function ScreenRecordToolbar() {
  const {
    state,
    isRecording,
    isPaused,
    formattedElapsed,
    isMicMuted,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    toggleMic
  } = useShowAndTell({
    maxDuration: 120, // 2 minutes max
    onStop: (result) => {
      console.log('Recorded video URL:', result.url);
    }
  });

  return (
    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
      {!isRecording && !isPaused ? (
        <button onClick={() => startRecording()}>Start Recording</button>
      ) : (
        <>
          <span>🔴 {formattedElapsed}</span>
          <button onClick={isPaused ? resumeRecording : pauseRecording}>
            {isPaused ? 'Resume' : 'Pause'}
          </button>
          <button onClick={toggleMic}>
            {isMicMuted ? 'Unmute Mic' : 'Mute Mic'}
          </button>
          <button onClick={() => stopRecording()}>Stop Recording</button>
        </>
      )}
    </div>
  );
}
```

---

### 2. Using the Pre-styled `<ShowAndTellButton />`

Drop in a ready-made recording button with built-in status badge, pulsing recording indicator, and live duration timer:

```tsx
import { ShowAndTellButton } from '@divmora/show-and-tell-react';

export function Header() {
  return (
    <header>
      <h1>My App</h1>
      <ShowAndTellButton
        idleText="Record Feedback"
        recordingText="Finish Recording"
        showTimer={true}
        onStop={(result) => {
          console.log('Video ready:', result.url);
        }}
      />
    </header>
  );
}
```

Or customize its rendering completely using render props:

```tsx
<ShowAndTellButton>
  {({ isRecording, formattedElapsed, startRecording, stopRecording }) => (
    <button onClick={isRecording ? () => stopRecording() : () => startRecording()}>
      {isRecording ? `Recording: ${formattedElapsed}` : 'Click to Record'}
    </button>
  )}
</ShowAndTellButton>
```

---

### 3. Using Global Context (`<ShowAndTellProvider>`)

Wrap your application to share recording state across disparate components:

```tsx
// app/providers.tsx or index.tsx
import { ShowAndTellProvider } from '@divmora/show-and-tell-react';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ShowAndTellProvider
      maxDuration={300}
      onStop={(result) => {
        // Submit bug report with recording attached
        console.log('Recorded blob:', result.blob);
      }}
    >
      {children}
    </ShowAndTellProvider>
  );
}
```

Access recording state in any child component:

```tsx
import { useShowAndTellContext } from '@divmora/show-and-tell-react';

export function NavigationRecorderBadge() {
  const { isRecording, formattedElapsed } = useShowAndTellContext();

  if (!isRecording) return null;

  return <div className="recording-pill">REC {formattedElapsed}</div>;
}
```

---

### 4. Floating / Embedded `<ShowAndTellWidget />`

```tsx
import { ShowAndTellWidget } from '@divmora/show-and-tell-react';

export function FeedbackModal() {
  return (
    <div>
      <h3>Submit a Video Bug Report</h3>
      <ShowAndTellWidget
        config={{
          includeMic: true,
          includeDisplayAudio: true,
          maxDuration: 180
        }}
        onStop={(result) => alert(`Recorded: ${result.filename}`)}
      />
    </div>
  );
}
```

---

## API Reference

### `useShowAndTell(options)`

#### Options:
- Extends standard `ShowAndTellConfig`:
  - `includeMic?: boolean`
  - `includeDisplayAudio?: boolean`
  - `maxDuration?: number` (seconds)
  - `warningThreshold?: number` (seconds)
  - `audioEffects?: boolean`
  - `mode?: 'auto' | 'pixel' | 'dom'`
  - `fallbackToDom?: boolean`
  - `presignedUpload?: PresignedUploadConfig`
  - `camera?: boolean | CameraConfig`
  - `diagnostics?: boolean`
- `cleanupOnUnmount?: boolean` (default: `false`): Stops active recording when component unmounts.
- `onStart?: (session: RecordingSession) => void`
- `onStop?: (result: RecordingResult) => void`
- `onError?: (error: Error) => void`

#### Returns:
- `state`: `'idle' | 'starting' | 'recording' | 'paused' | 'stopping' | 'stopped' | 'error'`
- `isRecording`: `boolean`
- `isPaused`: `boolean`
- `isActive`: `boolean` (recording or paused)
- `stats`: `DurationStats | null`
- `formattedElapsed`: `string` (`"01:23"`)
- `formattedRemaining?: string` (`"00:37"`)
- `progressRatio?: number` (`0.0` to `1.0`)
- `isWarning`: `boolean`
- `isMicMuted`: `boolean`
- `activeSession`: `RecordingSession | null`
- `lastResult`: `RecordingResult | null`
- `error`: `Error | null`
- `startRecording(overrideConfig?)`: `Promise<RecordingSession>`
- `stopRecording()`: `Promise<RecordingResult>`
- `pauseRecording()`: `void`
- `resumeRecording()`: `void`
- `toggleMic()`: `boolean`
- `muteMic()`: `void`
- `unmuteMic()`: `void`
- `clearError()`: `void`

---

## License

ShowAndTell is licensed under the [Business Source License 1.1 (BSL 1.1)](https://github.com/divmora/show-and-tell/blob/main/LICENSE). Free for non-production use and testing.
