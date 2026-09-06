export class AudioMixer {
  private audioContext?: AudioContext;
  private destinationNode?: MediaStreamAudioDestinationNode;
  private micGainNode?: GainNode;
  private systemGainNode?: GainNode;
  private micSourceNode?: MediaStreamAudioSourceNode;
  private systemSourceNode?: MediaStreamAudioSourceNode;

  private micStream?: MediaStream;
  private isMicMutedState: boolean = false;

  /**
   * Initializes Web Audio context and mixes display audio with microphone audio.
   */
  mix(displayStream?: MediaStream, micStream?: MediaStream): MediaStreamTrack[] {
    const displayAudioTracks = displayStream ? displayStream.getAudioTracks() : [];
    const micAudioTracks = micStream ? micStream.getAudioTracks() : [];

    // If no mic is used and only display audio exists, return display audio directly
    if (micAudioTracks.length === 0 && displayAudioTracks.length > 0) {
      return displayAudioTracks;
    }

    // If only mic audio exists and no display audio, return mic track
    if (displayAudioTracks.length === 0 && micAudioTracks.length > 0) {
      this.micStream = micStream;
      return micAudioTracks;
    }

    // If both exist, mix them via Web Audio API
    if (displayAudioTracks.length > 0 && micAudioTracks.length > 0) {
      this.micStream = micStream;
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) {
        // Fallback: Return mic tracks if AudioContext is unavailable
        return [...micAudioTracks, ...displayAudioTracks];
      }

      this.audioContext = new AudioCtx();
      this.destinationNode = this.audioContext.createMediaStreamDestination();

      // System audio track
      this.systemSourceNode = this.audioContext.createMediaStreamSource(
        new MediaStream(displayAudioTracks)
      );
      this.systemGainNode = this.audioContext.createGain();
      this.systemGainNode.gain.value = 1.0;
      this.systemSourceNode.connect(this.systemGainNode);
      this.systemGainNode.connect(this.destinationNode);

      // Mic audio track
      this.micSourceNode = this.audioContext.createMediaStreamSource(
        new MediaStream(micAudioTracks)
      );
      this.micGainNode = this.audioContext.createGain();
      this.micGainNode.gain.value = 1.0;
      this.micSourceNode.connect(this.micGainNode);
      this.micGainNode.connect(this.destinationNode);

      return this.destinationNode.stream.getAudioTracks();
    }

    return [];
  }

  /**
   * Mute or unmute microphone audio.
   */
  setMicMuted(muted: boolean): void {
    this.isMicMutedState = muted;
    if (this.micGainNode) {
      this.micGainNode.gain.value = muted ? 0 : 1;
    }
    if (this.micStream) {
      this.micStream.getAudioTracks().forEach(track => {
        track.enabled = !muted;
      });
    }
  }

  /**
   * Toggle mic mute. Returns new muted state.
   */
  toggleMic(): boolean {
    const newState = !this.isMicMutedState;
    this.setMicMuted(newState);
    return newState;
  }

  isMicMuted(): boolean {
    return this.isMicMutedState;
  }

  /**
   * Cleanup audio context and nodes.
   */
  destroy(): void {
    if (this.micSourceNode) {
      this.micSourceNode.disconnect();
      this.micSourceNode = undefined;
    }
    if (this.systemSourceNode) {
      this.systemSourceNode.disconnect();
      this.systemSourceNode = undefined;
    }
    if (this.micGainNode) {
      this.micGainNode.disconnect();
      this.micGainNode = undefined;
    }
    if (this.systemGainNode) {
      this.systemGainNode.disconnect();
      this.systemGainNode = undefined;
    }
    if (this.audioContext && this.audioContext.state !== 'closed') {
      try {
        this.audioContext.close();
      } catch {
        // Ignore close errors
      }
      this.audioContext = undefined;
    }
  }
}
