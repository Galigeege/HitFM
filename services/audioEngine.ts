import { getAudioStreamUrl, extractYTId } from './pipedService';

declare global {
  interface Window {
    SC: any;
    YT: any;
  }
}

export class RadioAudioEngine {
  private audioContext: AudioContext;

  // Mixers
  private masterGain: GainNode;
  private voiceGainNode: GainNode;
  private musicGainNode: GainNode;
  private analyser: AnalyserNode;

  // Sources
  private nativeAudio: HTMLAudioElement;
  private musicSourceNode: MediaElementAudioSourceNode | null = null;
  private voiceSource: AudioBufferSourceNode | null = null;

  // External Widgets
  private scWidget: any;
  private ytPlayer: any; // Fallback player

  private onSongEndedCallback: ((error?: string) => void) | null = null;

  constructor(scIframeId: string, ytElementId: string) {
    this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();

    // 1. Create Nodes
    this.masterGain = this.audioContext.createGain();
    this.voiceGainNode = this.audioContext.createGain();
    this.musicGainNode = this.audioContext.createGain();
    this.analyser = this.audioContext.createAnalyser();

    // 2. Configure Nodes
    this.masterGain.gain.value = 1.0;
    this.voiceGainNode.gain.value = 1.0;
    this.musicGainNode.gain.value = 1.0;
    this.analyser.fftSize = 256;

    // 3. Connect Graph:
    // [Voice] -> [VoiceGain] -> [Analyser]
    // [Music] -> [MusicGain] -> [Analyser] -> [Master] -> [Destination]

    this.voiceGainNode.connect(this.analyser);
    this.musicGainNode.connect(this.analyser);
    this.analyser.connect(this.masterGain);
    this.masterGain.connect(this.audioContext.destination);

    // 4. Native Audio Element Setup (The Music Player)
    this.nativeAudio = new Audio();
    this.nativeAudio.crossOrigin = "anonymous";

    // Connect Native Audio element to Web Audio Graph
    try {
      this.musicSourceNode = this.audioContext.createMediaElementSource(this.nativeAudio);
      this.musicSourceNode.connect(this.musicGainNode);
    } catch (e) {
      console.warn("MediaElementSource error:", e);
    }

    this.nativeAudio.onended = () => {
      if (this.onSongEndedCallback) this.onSongEndedCallback();
    };
    this.nativeAudio.onerror = (e) => {
      console.error("Native Playback Error", e);
      // Do not fail here, let the playback logic decide if fallback is needed
    };

    // Initialize External Players
    this.initSoundCloud(scIframeId);
    this.initYouTube(ytElementId);
  }

  private initSoundCloud(iframeId: string) {
    const iframeElement = document.getElementById(iframeId);
    if (!iframeElement || !window.SC) return;

    this.scWidget = window.SC.Widget(iframeElement);
    this.scWidget.bind(window.SC.Widget.Events.FINISH, () => {
      if (this.onSongEndedCallback) this.onSongEndedCallback();
    });
  }

  private initYouTube(elementId: string) {
    // Load YouTube IFrame API if not loaded
    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = "https://www.youtube.com/iframe_api";
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
    }

    // Initialize Player when API is ready
    const checkYT = () => {
      if (window.YT && window.YT.Player) {
        this.ytPlayer = new window.YT.Player(elementId, {
          height: '0', // Hidden
          width: '0',
          playerVars: {
            'autoplay': 0,
            'controls': 0,
            'disablekb': 1,
            'modestbranding': 1,
            'rel': 0,
            'showinfo': 0,
            'origin': window.location.origin
          },
          events: {
            'onStateChange': (event: any) => {
              // @ts-ignore
              if (event.data === 0) { // ENDED
                if (this.onSongEndedCallback) this.onSongEndedCallback();
              }
            },
            'onError': (e: any) => {
              console.error("YouTube Embed Error:", e.data);
              // Only trigger error callback if native audio is NOT playing
              // preventing double error reporting
              if (this.nativeAudio.paused) {
                if (this.onSongEndedCallback) this.onSongEndedCallback("YouTube Embed Error");
              }
            }
          }
        });
      } else {
        setTimeout(checkYT, 500);
      }
    };
    checkYT();
  }

  public getContext() { return this.audioContext; }
  public getAnalyser() { return this.analyser; }

  public async resume() {
    if (this.audioContext.state === 'suspended') await this.audioContext.resume();
  }

  public setOnEnded(callback: (error?: string) => void) { this.onSongEndedCallback = callback; }

  public stopAll() {
    if (this.scWidget) this.scWidget.pause();
    if (this.ytPlayer && this.ytPlayer.pauseVideo) this.ytPlayer.pauseVideo();
    this.nativeAudio.pause();
    this.nativeAudio.currentTime = 0; // Reset position
    if (this.voiceSource) {
      try { this.voiceSource.stop(); } catch (e) { }
      this.voiceSource = null;
    }
  }

  public async playMusic(song: any) {
    this.stopAll();
    const { url, provider } = song;

    // Reset Gains
    this.musicGainNode.gain.setValueAtTime(1.0, this.audioContext.currentTime);

    if (provider === 'youtube') {
      const videoId = extractYTId(url);
      console.log(`[AudioEngine] Processing YouTube ID: ${videoId}`);

      if (videoId) {
        // STRATEGY 1: Try Piped First (Superior quality + Visualizer)
        const streamUrl = await getAudioStreamUrl(videoId);

        if (streamUrl) {
          console.log(`[AudioEngine] Playing via Piped Stream`);
          this.nativeAudio.src = streamUrl;
          try {
            await this.nativeAudio.play();
            return; // Success! Exit function.
          } catch (e) {
            console.warn("Piped playback failed, falling back to Embed...", e);
            // Fall through to embed strategy
          }
        } else {
          console.warn("Piped resolution failed, falling back to Embed...");
        }

        // STRATEGY 2: Fallback to YouTube Embed (No Visualizer, but reliable audio)
        console.log(`[AudioEngine] Falling back to YouTube Embed`);
        if (this.ytPlayer && this.ytPlayer.loadVideoById) {
          this.ytPlayer.loadVideoById(videoId);
          this.ytPlayer.setVolume(100);
          this.ytPlayer.playVideo();
        } else {
          console.error("YouTube Player not ready for fallback.");
          if (this.onSongEndedCallback) this.onSongEndedCallback("All playback methods failed");
        }
      } else {
        console.error("Invalid YouTube URL");
      }
    } else if (provider === 'native') {
      this.nativeAudio.src = url;
      this.nativeAudio.volume = 1.0;
      this.nativeAudio.play().catch(e => console.error("Native Playback Error:", e));
    } else if (provider === 'suno') {
      // SUNO provides direct audio URLs - use native audio for full Web Audio API support
      console.log(`[AudioEngine] Playing SUNO generated audio`);
      this.nativeAudio.src = url;
      try {
        await this.nativeAudio.play();
      } catch (e) {
        console.error("SUNO Playback Error:", e);
        if (this.onSongEndedCallback) this.onSongEndedCallback("SUNO Playback Failed");
      }
    } else {
      // Default to SoundCloud
      if (this.scWidget) {
        this.scWidget.load(url, {
          auto_play: true,
          callback: () => this.scWidget.setVolume(100)
        });
      }
    }
  }

  public playDJVoice(buffer: AudioBuffer) {
    if (this.voiceSource) {
      try { this.voiceSource.stop(); } catch (e) { }
    }

    this.voiceSource = this.audioContext.createBufferSource();
    this.voiceSource.buffer = buffer;
    this.voiceSource.connect(this.voiceGainNode);
    this.voiceSource.start();
  }

  /**
   * Ducking Transition:
   * 1. Music volume drops (Duck)
   * 2. DJ Voice plays
   * 3. Music volume rises (Restore)
   */
  public async playTransition(song: any, voiceBuffer: AudioBuffer, onVoiceEnded: () => void) {
    // 1. Prepare Next Song (using await to ensure stream is ready/fetched)
    await this.playMusic(song);

    // 2. Duck Music Immediately
    const now = this.audioContext.currentTime;

    // We modify the gain node for Native Audio
    this.musicGainNode.gain.cancelScheduledValues(now);
    this.musicGainNode.gain.setValueAtTime(1.0, now);
    this.musicGainNode.gain.linearRampToValueAtTime(0.2, now + 0.5); // Duck down in 0.5s

    // Also duck Embed if that's what ended up playing
    // Check if nativeAudio is paused (implies Embed is active or nothing is playing)
    if (this.nativeAudio.paused && this.ytPlayer && this.ytPlayer.setVolume) {
      this.ytPlayer.setVolume(20);
    }

    // 3. Play Voice
    this.playDJVoice(voiceBuffer);

    // 4. Schedule Restore
    // Note: buffer.duration gives voice length in seconds
    const voiceDuration = voiceBuffer.duration;

    // Fire callback when voice visually ends
    setTimeout(() => {
      onVoiceEnded();
      // Restore Gain (Native)
      const restoreTime = this.audioContext.currentTime;
      this.musicGainNode.gain.linearRampToValueAtTime(1.0, restoreTime + 1.5);

      // Restore Embed Volume
      if (this.nativeAudio.paused && this.ytPlayer) {
        this.ytPlayer.setVolume(100);
      }
    }, voiceDuration * 1000);
  }
}