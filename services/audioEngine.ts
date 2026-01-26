declare global {
  interface Window {
    SC: any;
  }
}

export class RadioAudioEngine {
  private audioContext: AudioContext;
  
  // Voice Channel (Web Audio API)
  private voiceGainNode: GainNode;
  private voiceSource: AudioBufferSourceNode | null = null;
  private analyser: AnalyserNode;

  // Music Channel (SoundCloud Widget)
  private scWidget: any;
  private onSongEndedCallback: (() => void) | null = null;
  private isWidgetReady: boolean = false;

  constructor(iframeId: string) {
    this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    // Voice Channel Setup
    this.voiceGainNode = this.audioContext.createGain();
    this.voiceGainNode.gain.value = 1.0;

    // Visualizer (Only visualizes Voice now, as SC doesn't allow stream access via iframe)
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 256;
    
    this.voiceGainNode.connect(this.analyser);
    this.analyser.connect(this.audioContext.destination);

    // SoundCloud Widget Setup
    this.initSoundCloud(iframeId);
  }

  private initSoundCloud(iframeId: string) {
    const iframeElement = document.getElementById(iframeId);
    if (!iframeElement || !window.SC) {
      console.error("SoundCloud Widget API not found or iframe missing");
      return;
    }

    this.scWidget = window.SC.Widget(iframeElement);
    
    this.scWidget.bind(window.SC.Widget.Events.READY, () => {
      console.log("SoundCloud Widget Ready");
      this.isWidgetReady = true;
    });

    this.scWidget.bind(window.SC.Widget.Events.FINISH, () => {
      console.log("Song Finished");
      if (this.onSongEndedCallback) {
        this.onSongEndedCallback();
      }
    });

    this.scWidget.bind(window.SC.Widget.Events.ERROR, (e: any) => {
        console.error("SoundCloud Error", e);
        // Force skip if error
        if (this.onSongEndedCallback) this.onSongEndedCallback();
    });
  }

  public getContext() {
    return this.audioContext;
  }

  public getAnalyser() {
    return this.analyser;
  }

  public async resume() {
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }
  }

  public setOnEnded(callback: () => void) {
    this.onSongEndedCallback = callback;
  }

  /**
   * Loads a SoundCloud URL and plays it immediately.
   */
  public playMusic(scUrl: string) {
    if (!this.scWidget) return;

    this.scWidget.load(scUrl, {
      auto_play: true,
      visual: true, // Show album art in iframe
      show_artwork: true,
      callback: () => {
        this.scWidget.setVolume(80); // Default volume
        // Force play to ensure auto_play works even if policy is strict
        setTimeout(() => this.scWidget.play(), 100);
      }
    });
  }

  /**
   * 1. Loads the next song into the widget (stops current).
   * 2. Sets volume LOW (ducking).
   * 3. Starts playing song.
   * 4. Plays DJ Voice.
   * 5. When DJ Voice ends -> Fade music volume UP.
   */
  public playTransition(nextSongUrl: string, voiceBuffer: AudioBuffer, onVoiceEnded: () => void) {
    if (!this.scWidget) return;

    const ctx = this.audioContext;
    const now = ctx.currentTime;

    // 1. Prepare Music (Start low for ducking)
    this.scWidget.load(nextSongUrl, {
      auto_play: true,
      visual: true,
      callback: () => {
        // Start "Ducked"
        this.scWidget.setVolume(20); 
        // Force play
        setTimeout(() => this.scWidget.play(), 100);
      }
    });

    // 2. Play DJ Voice (Standard Web Audio)
    if (this.voiceSource) {
      try { this.voiceSource.stop(); } catch(e) {}
    }
    this.voiceSource = ctx.createBufferSource();
    this.voiceSource.buffer = voiceBuffer;
    this.voiceSource.connect(this.voiceGainNode);

    // 3. Handle Voice End -> Fade In Music
    this.voiceSource.onended = () => {
        // Ramp up volume logic (Simulated via intervals since Widget doesn't have linearRamp)
        this.fadeWidgetVolume(20, 100, 2000); // Fade from 20 to 100 over 2000ms
        onVoiceEnded();
    };

    // 4. Start Voice with a tiny delay to ensure widget is loading
    this.voiceSource.start(now + 0.8);
  }

  private fadeWidgetVolume(start: number, end: number, duration: number) {
      if (!this.scWidget) return;
      
      const steps = 20;
      const stepTime = duration / steps;
      const volStep = (end - start) / steps;
      let currentVol = start;
      let stepCount = 0;

      const interval = setInterval(() => {
          currentVol += volStep;
          stepCount++;
          
          this.scWidget.setVolume(Math.min(100, Math.max(0, currentVol)));

          if (stepCount >= steps) {
              clearInterval(interval);
          }
      }, stepTime);
  }
}