import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Song, BroadcastState, DJPersona, LogEntry } from './types';
import { PLAYLIST, DJ_PERSONAS } from './constants';
import { generateDJScript, generateDJAudio, generateSongLyrics, setGeminiLogger } from './services/geminiService';
import { submitMusicGeneration, waitForCompletion } from './services/sunoService';
import { RadioAudioEngine } from './services/audioEngine';
import Visualizer from './components/Visualizer';
import RequestLine from './components/RequestLine';
import DebugPanel from './components/DebugPanel';
import WaveOverlay from './components/WaveOverlay';

import { useApiKey } from './context/ApiKeyContext';

const App: React.FC = () => {
  const { apiKey } = useApiKey();
  const [broadcastState, setBroadcastState] = useState<BroadcastState>(BroadcastState.IDLE);
  const [currentSong, setCurrentSong] = useState<Song>(PLAYLIST[0]);
  const currentSongRef = useRef<Song>(PLAYLIST[0]); // Source of truth sync

  const [currentPersona, setCurrentPersona] = useState<DJPersona>(DJ_PERSONAS[0]);
  const [listenerName, setListenerName] = useState<string>("Listener");
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const [locationName] = useState<string>("San Francisco");

  const engineRef = useRef<RadioAudioEngine | null>(null);
  const nextDJBufferRef = useRef<AudioBuffer | null>(null);
  const nextSongRef = useRef<Song | null>(null);
  const [songsPool, setSongsPool] = useState<Song[]>(PLAYLIST);
  const [isQuotaExceeded, setIsQuotaExceeded] = useState(false);
  const [isAIEnabled, setIsAIEnabled] = useState(true);
  const [isTTSEnabled, setIsTTSEnabled] = useState(true);

  const songCounter = useRef(0);
  const lastQuotaTime = useRef<number>(0);
  const hasInitialized = useRef(false);
  const lastSongEndTime = useRef<number>(0);

  // Set up global Gemini logger to feed the UI Debug Panel
  useEffect(() => {
    setGeminiLogger((type, model, data) => {
      const label = type === 'input' ? 'AI_REQ' : 'AI_RES';
      addLog('info', `${label} [${model}]: ${JSON.stringify(data)}`);
    });
    return () => setGeminiLogger(null);
  }, []);

  const addLog = (type: LogEntry['type'], message: string) => {
    setLogs(prev => [{
      id: Date.now().toString(),
      timestamp: new Date().toLocaleTimeString(),
      type,
      message
    }, ...prev.slice(0, 50)]);
  };

  const updateCurrentSong = (song: Song) => {
    setCurrentSong(song);
    currentSongRef.current = song;
  };

  const prepareNextContent = async (prevSong: Song) => {
    if (!isAIEnabled) {
      const fallbackIdx = Math.floor(Math.random() * songsPool.length);
      nextSongRef.current = songsPool[fallbackIdx];
      return;
    }

    if (isQuotaExceeded && Date.now() - lastQuotaTime.current < 60000) {
      const fallbackIdx = Math.floor(Math.random() * songsPool.length);
      nextSongRef.current = songsPool[fallbackIdx];
      return;
    } else if (isQuotaExceeded) {
      setIsQuotaExceeded(false);
    }

    songCounter.current += 1;
    const isChitchatTime = songCounter.current % 3 === 0;
    addLog('info', isChitchatTime ? `SYSTEM: Planning Chitchat...` : `SYSTEM: Fetching next track...`);

    let next: Song;
    try {
      // === SUNO AI MUSIC GENERATION ===
      setBroadcastState(BroadcastState.GENERATING_MUSIC);
      addLog('info', `SUNO: Generating original track...`);

      // 1. Generate lyrics via Gemini
      const genres = ['Pop', 'Electronic', 'R&B', 'Indie', 'Dance'];
      const moods = ['upbeat', 'chill', 'energetic', 'romantic', 'dreamy'];
      const randomGenre = genres[Math.floor(Math.random() * genres.length)];
      const randomMood = moods[Math.floor(Math.random() * moods.length)];

      const lyrics = await generateSongLyrics(randomGenre, randomMood);
      addLog('info', `LYRICS: "${lyrics.title}" [${lyrics.tags}]`);

      // 2. Submit to SUNO for music generation
      const taskId = await submitMusicGeneration({
        prompt: lyrics.lyrics,
        title: lyrics.title,
        tags: lyrics.tags
      });
      addLog('info', `SUNO: Task submitted (ID: ${taskId})`);

      // 3. Poll for completion (this can take 30-90 seconds)
      const result = await waitForCompletion(taskId);

      if (!result.audio_url) {
        throw new Error('SUNO returned no audio URL');
      }

      next = {
        id: `suno-${taskId}`,
        title: lyrics.title,
        artist: 'HitFM AI',
        albumArt: result.image_url || 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500',
        duration: 0,
        genre: lyrics.genre,
        url: result.audio_url,
        provider: 'suno'
      };

      addLog('info', `SUNO: Track ready! "${next.title}"`);

    } catch (e: any) {
      console.error("SUNO Generation Error:", e);
      if (e.message.includes("QUOTA_EXCEEDED")) {
        setIsQuotaExceeded(true);
        lastQuotaTime.current = Date.now();
        addLog('error', `QUOTA EXCEEDED: ${e.message}`);
      } else {
        addLog('error', `SUNO ERROR: ${e.message || "Unknown"}`);
      }
      // Fallback to pre-loaded playlist
      const fallbackIdx = Math.floor(Math.random() * songsPool.length);
      next = songsPool[fallbackIdx];
      addLog('info', `SYSTEM: Fallback to playlist: "${next.title}"`);
    }

    nextSongRef.current = next;

    try {
      const scriptType = isChitchatTime ? 'chitchat' : 'transition';
      addLog('info', `GEMINI: Generating ${scriptType} script...`);
      const script = await generateDJScript(currentPersona, prevSong, next, listenerName, scriptType, locationName, apiKey);
      addLog('dj', `SCRIPT: "${script}"`);

      if (engineRef.current && isTTSEnabled) {
        addLog('info', `AUDIO: Synthesizing voice [${currentPersona.voiceName}]...`);
        const buffer = await generateDJAudio(script, currentPersona.voiceName, engineRef.current.getContext(), apiKey);
        if (buffer) {
          nextDJBufferRef.current = buffer;
          addLog('info', `SUCCESS: DJ Audio prepared.`);
        } else {
          addLog('error', `FAILURE: DJ Audio generation returned empty.`);
        }
      }
    } catch (e: any) {
      console.error("DJ Script/Audio Error:", e);
      if (e.message.includes("QUOTA_EXCEEDED")) {
        setIsQuotaExceeded(true);
        lastQuotaTime.current = Date.now();
      }
      addLog('error', `AI SCRIPT ERROR: ${e.message || "Unknown error during script gen"}`);
    }
  };

  const handleSongEnded = useCallback((errorMsg?: string) => {
    const now = Date.now();
    if (now - lastSongEndTime.current < 2000) return;
    lastSongEndTime.current = now;

    if (errorMsg) {
      addLog('error', `ENGINE ERROR: ${errorMsg}`);

      // CRITICAL FIX: If we are midway through a DJ transition, IGNORE music errors.
      // Let the DJ finish speaking. The music player might be broken, but the show must go on.
      if (broadcastState === BroadcastState.PLAYING_DJ) {
        console.warn("Error during DJ transition - ignoring to prevent cut-off.");
        return;
      }
    } else {
      addLog('info', "WIDGET: Track finished gracefully.");
    }

    if (nextSongRef.current && engineRef.current) {
      const next = nextSongRef.current;
      const buffer = nextDJBufferRef.current;

      updateCurrentSong(next);
      nextSongRef.current = null;

      if (buffer) {
        setBroadcastState(BroadcastState.PLAYING_DJ);
        nextDJBufferRef.current = null;
        addLog('info', `SYSTEM: Mixing transition to ${next.title}...`);
        addLog('info', `SOURCE: [${next.provider || 'soundcloud'}] ${next.url}`);

        engineRef.current.playTransition(next, buffer, () => {
          if (currentSongRef.current.url === next.url) {
            setBroadcastState(BroadcastState.PLAYING_MUSIC);
            addLog('music', `LIVE: ${next.title} - ${next.artist}`);
            prepareNextContent(next);
          }
        });
      } else {
        addLog('info', `SYSTEM: DJ missing. Playing "${next.title}" [${next.provider}]`);
        addLog('info', `SOURCE: ${next.url}`);
        setBroadcastState(BroadcastState.PLAYING_MUSIC);
        engineRef.current.playMusic(next);
        prepareNextContent(next);
      }
    } else {
      const fallback = songsPool[Math.floor(Math.random() * songsPool.length)];
      addLog('error', "SYSTEM: No dynamic track queued. Using emergency fallback.");
      addLog('info', `SYSTEM: Playing "${fallback.title}" [${fallback.provider}]`);
      addLog('info', `SOURCE: ${fallback.url}`);

      updateCurrentSong(fallback);
      engineRef.current?.playMusic(fallback);
      prepareNextContent(fallback);
    }
  }, [songsPool, isAIEnabled, isTTSEnabled]);

  const initEngine = useCallback(async () => {
    if (hasInitialized.current) return;
    const engine = new RadioAudioEngine("sc-widget", "yt-player");
    await engine.resume();
    engineRef.current = engine;
    setAnalyser(engine.getAnalyser());
    engine.setOnEnded(handleSongEnded);
    hasInitialized.current = true;

    setBroadcastState(BroadcastState.LOADING_INTRO);
    addLog('info', `SYSTEM: Handshaking satellite...`);

    const firstSong = songsPool[Math.floor(Math.random() * songsPool.length)];
    updateCurrentSong(firstSong);

    let audioBuffer: AudioBuffer | null = null;
    if (isAIEnabled && (!isQuotaExceeded || Date.now() - lastQuotaTime.current > 60000)) {
      try {
        const script = await generateDJScript(currentPersona, null, firstSong, listenerName, 'intro', locationName, apiKey);
        if (isTTSEnabled) {
          audioBuffer = await generateDJAudio(script, currentPersona.voiceName, engine.getContext(), apiKey);
        }
      } catch (e: any) {
        if (e.message === "QUOTA_EXCEEDED") { setIsQuotaExceeded(true); lastQuotaTime.current = Date.now(); }
      }
    }

    if (audioBuffer) {
      setBroadcastState(BroadcastState.PLAYING_DJ);
      engine.playTransition(firstSong, audioBuffer, () => {
        // Validation check to avoid UI mismatch if an error-skip happened
        if (currentSongRef.current.url === firstSong.url) {
          setBroadcastState(BroadcastState.PLAYING_MUSIC);
          addLog('music', `LIVE: ${firstSong.title} - ${firstSong.artist}`);
          prepareNextContent(firstSong);
        }
      });
    } else {
      engine.playMusic(firstSong);
      setBroadcastState(BroadcastState.PLAYING_MUSIC);
      prepareNextContent(firstSong);
    }
  }, [listenerName, currentPersona, locationName, apiKey, isAIEnabled, isTTSEnabled, handleSongEnded, songsPool, isQuotaExceeded]);

  const handleTranscription = (text: string) => {
    addLog('info', `REQUEST: "${text}"`);
    if (text.toLowerCase().includes("chill") || text.toLowerCase().includes("night")) {
      setCurrentPersona(DJ_PERSONAS[1]);
    } else if (text.toLowerCase().includes("hype") || text.toLowerCase().includes("party")) {
      setCurrentPersona(DJ_PERSONAS[0]);
    }
  };

  const skipTrack = () => { addLog('info', "USER: Skip requested."); handleSongEnded(); };
  const clearLogs = () => setLogs([]);

  // Pool expansion is no longer needed with SUNO generation
  // Each track is generated on-demand

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col lg:flex-row items-center lg:items-start justify-center p-4 lg:p-12 gap-8 selection:bg-rose-500/30 overflow-x-hidden relative text-sm lg:text-base">

      {/* Background Ambient Glow */}
      <div className="fixed top-0 left-1/4 w-96 h-96 bg-rose-600/10 rounded-full blur-[128px] pointer-events-none" />
      <div className="fixed bottom-0 right-1/4 w-96 h-96 bg-amber-500/5 rounded-full blur-[128px] pointer-events-none" />

      {/* Main Radio Card */}
      <div className="max-w-md w-full bg-white/5 backdrop-blur-2xl rounded-[2.5rem] shadow-2xl border border-white/10 overflow-hidden relative shrink-0 z-10">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-400 via-rose-500 to-purple-600"></div>

        {/* Header */}
        <div className="p-8 flex justify-between items-center bg-black/20">
          <div>
            <h1 className="text-4xl font-black tracking-tighter text-white italic uppercase leading-none">HitFM</h1>
            <div className="flex items-center gap-2 mt-2">
              <span className={`w-2 h-2 rounded-full ${broadcastState !== BroadcastState.IDLE ? 'bg-rose-500 animate-pulse' : 'bg-slate-700'}`}></span>
              <span className="text-[10px] font-bold text-slate-400/80 uppercase tracking-widest">{locationName} / 88.7</span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-[9px] text-slate-500 font-bold uppercase">Host</div>
            <div className="font-bold text-sm text-amber-400 uppercase">{currentPersona.name.split(' ')[0]}</div>
          </div>
        </div>

        {/* Content Area */}
        <div className="p-8 relative">
          <div className="relative w-full aspect-square mb-8 rounded-[2rem] overflow-hidden bg-black/50 border border-white/10 shadow-2xl group">
            <iframe
              id="sc-widget"
              width="100%" height="100%" scrolling="no" frameBorder="no" allow="autoplay"
              src={`https://w.soundcloud.com/player/?url=${encodeURIComponent(currentSong.url)}&color=%23fbbf24&auto_play=false&visual=true&show_comments=false&show_user=false`}
              className={`absolute inset-0 transition-opacity duration-1000 ${(currentSong.provider === 'soundcloud' || !currentSong.provider) && broadcastState !== BroadcastState.IDLE ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
            ></iframe>

            <div id="yt-player" className={`absolute inset-0 transition-opacity duration-1000 ${currentSong.provider === 'youtube' && broadcastState !== BroadcastState.IDLE ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}></div>

            {currentSong.provider === 'native' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-900">
                <img src={currentSong.albumArt} className="w-1/2 h-1/2 rounded-full animate-[spin_10s_linear_infinite]" alt="Vinyl" />
              </div>
            )}

            {broadcastState === BroadcastState.IDLE && (
              <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center p-8 text-center z-20 backdrop-blur-md">
                <h3 className="text-2xl font-bold mb-2 text-white italic uppercase tracking-tighter">AI Resurrection</h3>
                <p className="text-slate-400 text-xs mb-6 max-w-[220px]">Real-time AI DJs. Trending pop. Infinite vibe.</p>
                <div className="w-full space-y-3">
                  <input
                    type="text" value={listenerName} onChange={e => setListenerName(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-3 text-center text-white font-bold text-xs"
                    placeholder="ENTER NAME"
                  />
                  <button onClick={initEngine} className="w-full py-3 bg-amber-400 text-black font-black rounded-xl uppercase tracking-widest text-xs hover:bg-amber-300 transition-colors shadow-lg shadow-amber-500/20">Tune In Live</button>
                </div>
              </div>
            )}

            {broadcastState !== BroadcastState.IDLE && <WaveOverlay analyser={analyser} />}
            {broadcastState === BroadcastState.PLAYING_DJ && (
              <div className="absolute top-4 left-4 z-30">
                <div className="bg-rose-600 text-[10px] text-white font-black px-3 py-1 rounded-full animate-pulse uppercase tracking-wider">DJ On Air</div>
              </div>
            )}
          </div>

          <div className="text-center mb-6 px-2">
            <h2 className="text-2xl font-bold truncate text-white mb-1 uppercase tracking-tight">{currentSong.title}</h2>
            <p className="text-slate-400 text-[10px] font-bold tracking-[0.2em] uppercase">{currentSong.artist}</p>
          </div>

          {broadcastState !== BroadcastState.IDLE && (
            <div className="flex justify-center mb-6">
              <button onClick={skipTrack} className="group px-4 py-2 rounded-full bg-white/5 hover:bg-white/10 border border-white/5 flex items-center gap-3 transition-colors">
                <span className="text-[10px] text-slate-400 group-hover:text-white uppercase font-bold tracking-widest">Skip Track</span>
                <svg className="w-3 h-3 text-slate-500 group-hover:text-white" fill="currentColor" viewBox="0 0 20 20"><path d="M4.555 5.168A1 1 0 003 6v8a1 1 0 001.555.832L10 11.202V14a1 1 0 001.555.832l7-5a1 1 0 000-1.664l-7-5A1 1 0 0010 4v2.798L4.555 5.168z" /></svg>
              </button>
            </div>
          )}

          <Visualizer analyser={analyser} />
          {broadcastState !== BroadcastState.IDLE && <div className="mt-4"><RequestLine onTranscription={handleTranscription} /></div>}
        </div>
      </div>

      <div className="flex flex-col h-[600px] lg:h-[800px] w-full lg:w-[480px] bg-black/40 backdrop-blur-xl rounded-[2.5rem] border border-white/5 shadow-2xl overflow-hidden z-10">
        <DebugPanel logs={logs} onClear={clearLogs} isAIEnabled={isAIEnabled} setIsAIEnabled={setIsAIEnabled} isTTSEnabled={isTTSEnabled} setIsTTSEnabled={setIsTTSEnabled} />
      </div>

    </div>
  );
};

export default App;