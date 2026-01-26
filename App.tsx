import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Song, BroadcastState, DJPersona, LogEntry } from './types';
import { PLAYLIST, DJ_PERSONAS } from './constants';
import { generateDJScript, generateDJAudio, fetchNextTrendingSong } from './services/geminiService';
import { RadioAudioEngine } from './services/audioEngine';
import Visualizer from './components/Visualizer';
import RequestLine from './components/RequestLine';
import DebugPanel from './components/DebugPanel';

const App: React.FC = () => {
  const [broadcastState, setBroadcastState] = useState<BroadcastState>(BroadcastState.IDLE);
  const [currentSong, setCurrentSong] = useState<Song>(PLAYLIST[0]);
  const [currentPersona, setCurrentPersona] = useState<DJPersona>(DJ_PERSONAS[0]);
  const [listenerName, setListenerName] = useState<string>("Listener");
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const [locationName] = useState<string>("San Francisco");

  const engineRef = useRef<RadioAudioEngine | null>(null);
  const nextDJBufferRef = useRef<AudioBuffer | null>(null);
  const nextSongRef = useRef<Song | null>(null);
  const songCounter = useRef(0);
  const hasInitialized = useRef(false);

  const addLog = (type: LogEntry['type'], message: string) => {
    setLogs(prev => [{
      id: Date.now().toString(),
      timestamp: new Date().toLocaleTimeString(),
      type,
      message
    }, ...prev.slice(0, 50)]);
  };

  const prepareNextContent = async (prevSong: Song) => {
    songCounter.current += 1;
    const isChitchatTime = songCounter.current % 3 === 0;
    
    addLog('info', isChitchatTime ? `SYSTEM: Planning Chitchat break...` : `SYSTEM: Fetching next track metadata...`);
    
    try {
        const startTime = Date.now();
        const next = await fetchNextTrendingSong(prevSong.artist);
        addLog('info', `GEMINI: Found "${next.title}" by ${next.artist} (${Date.now() - startTime}ms)`);
        nextSongRef.current = next;

        const scriptType = isChitchatTime ? 'chitchat' : 'transition';
        const scriptStartTime = Date.now();
        const script = await generateDJScript(currentPersona, prevSong, next, listenerName, scriptType, locationName);
        addLog('dj', `GEMINI [${scriptType}]: ${script.substring(0, 100)}... (${Date.now() - scriptStartTime}ms)`);

        if (engineRef.current) {
            const ttsStartTime = Date.now();
            const buffer = await generateDJAudio(script, currentPersona.voiceName, engineRef.current.getContext());
            if (buffer) {
                nextDJBufferRef.current = buffer;
                addLog('info', `AUDIO: TTS Buffer ready (${Date.now() - ttsStartTime}ms)`);
            } else {
                addLog('error', `AUDIO: TTS Generation returned null buffer.`);
            }
        }
    } catch (e: any) {
        if (e.message === "QUOTA_EXCEEDED") {
          addLog('error', "QUOTA EXCEEDED: Gemini API limit reached. Entering Low-Power Jukebox Mode...");
        } else {
          addLog('error', `PRODUCTION ERROR: ${e.message}`);
        }
        // If dynamic song fetch failed or script failed, ensure we have a next song from local playlist
        if (!nextSongRef.current) {
          const fallbackIdx = Math.floor(Math.random() * PLAYLIST.length);
          nextSongRef.current = PLAYLIST[fallbackIdx];
          addLog('info', `SYSTEM: Fallback to local playlist track: ${nextSongRef.current.title}`);
        }
    }
  };

  const initEngine = useCallback(async () => {
    if (hasInitialized.current) return;
    addLog('info', `SYSTEM: Initializing Radio Engine (Region: ${locationName})...`);
    const engine = new RadioAudioEngine("sc-widget");
    await engine.resume();
    engineRef.current = engine;
    setAnalyser(engine.getAnalyser());
    engine.setOnEnded(handleSongEnded);
    hasInitialized.current = true;
    
    setBroadcastState(BroadcastState.LOADING_INTRO);
    addLog('info', `SYSTEM: Handshaking with satellite for ${listenerName}...`);
    
    try {
        const firstSong = PLAYLIST[Math.floor(Math.random() * PLAYLIST.length)];
        setCurrentSong(firstSong);

        let audioBuffer: AudioBuffer | null = null;
        try {
          const script = await generateDJScript(currentPersona, null, firstSong, listenerName, 'intro', locationName);
          addLog('dj', `INTRO SCRIPT: ${script}`);
          audioBuffer = await generateDJAudio(script, currentPersona.voiceName, engine.getContext());
        } catch (apiErr: any) {
          addLog('error', "API Error during intro. Skipping DJ talk.");
        }
        
        if (audioBuffer) {
            setBroadcastState(BroadcastState.PLAYING_DJ);
            addLog('info', "SYSTEM: Transitioning to LIVE DJ...");
            engine.playTransition(firstSong.url, audioBuffer, () => {
                setBroadcastState(BroadcastState.PLAYING_MUSIC);
                addLog('music', `NOW PLAYING: ${firstSong.title} - ${firstSong.artist}`);
                prepareNextContent(firstSong);
            });
        } else {
            addLog('error', "AUDIO: DJ Intro failed/blocked. Starting with Music.");
            engine.playMusic(firstSong.url);
            setBroadcastState(BroadcastState.PLAYING_MUSIC);
            prepareNextContent(firstSong);
        }
    } catch (e: any) {
        addLog('error', `INIT ERROR: ${e.message}`);
    }
  }, [listenerName, currentPersona, locationName]);

  const handleSongEnded = () => {
    addLog('info', "WIDGET: Track finished event received.");
    
    // Check if we have dynamic content ready
    if (nextSongRef.current && engineRef.current) {
        const next = nextSongRef.current;
        const buffer = nextDJBufferRef.current;
        
        setCurrentSong(next);
        nextSongRef.current = null; // Clear it for the next round
        
        if (buffer) {
            setBroadcastState(BroadcastState.PLAYING_DJ);
            nextDJBufferRef.current = null;
            addLog('info', `SYSTEM: Mixing transition to ${next.title}...`);
            engineRef.current.playTransition(next.url, buffer, () => {
                setBroadcastState(BroadcastState.PLAYING_MUSIC);
                addLog('music', `NOW PLAYING: ${next.title} - ${next.artist}`);
                prepareNextContent(next);
            });
        } else {
            // Song is ready but no DJ voice (API failure or quota)
            addLog('info', `SYSTEM: DJ voice missing. Playing "${next.title}" directly.`);
            setBroadcastState(BroadcastState.PLAYING_MUSIC);
            engineRef.current.playMusic(next.url);
            prepareNextContent(next);
        }
    } else {
        addLog('error', "SYSTEM: No dynamic track queued. Engaging emergency playlist fallback.");
        const fallback = PLAYLIST[Math.floor(Math.random() * PLAYLIST.length)];
        setCurrentSong(fallback);
        engineRef.current?.playMusic(fallback.url);
        prepareNextContent(fallback);
    }
  };

  const handleTranscription = (text: string) => {
    addLog('info', `REQUEST: "${text}"`);
    if (text.toLowerCase().includes("chill") || text.toLowerCase().includes("night")) {
        setCurrentPersona(DJ_PERSONAS[1]);
        addLog('info', "SYSTEM: Switching to Night Mode (Valen)");
    } else if (text.toLowerCase().includes("hype") || text.toLowerCase().includes("party")) {
        setCurrentPersona(DJ_PERSONAS[0]);
        addLog('info', "SYSTEM: Switching to Hype Mode (Andy)");
    }
  };

  const skipTrack = () => {
    addLog('info', "USER: Manual skip requested.");
    handleSongEnded();
  };

  const clearLogs = () => setLogs([]);

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col lg:flex-row items-center lg:items-start justify-center p-4 lg:p-12 gap-8 selection:bg-yellow-500/30">
      
      {/* Main Radio Card */}
      <div className="max-w-md w-full bg-slate-800 rounded-[2.5rem] shadow-2xl border border-slate-700 overflow-hidden relative shrink-0">
        <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-yellow-400 via-red-500 to-pink-500"></div>
        
        <div className="p-7 flex justify-between items-center border-b border-slate-700 bg-slate-800/80 backdrop-blur-xl z-10 relative">
          <div>
            <h1 className="text-3xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-red-500 brand-font italic uppercase leading-none">HitFM</h1>
            <div className="flex items-center gap-2 mt-1">
                <span className={`w-2.5 h-2.5 rounded-full ${broadcastState !== BroadcastState.IDLE ? 'bg-red-500 animate-pulse' : 'bg-slate-500'}`}></span>
                <span className="text-[10px] font-black tracking-[0.2em] text-slate-400 uppercase">{locationName} | 88.7</span>
            </div>
          </div>
          <div className="text-right">
             <div className="text-[10px] text-slate-500 font-black mb-0.5 uppercase tracking-wider">On Air Now</div>
             <div className="font-bold text-sm text-yellow-400 leading-none">{currentPersona.name.split(' ')[0]}</div>
          </div>
        </div>

        <div className="p-7">
            <div className="relative w-full aspect-square mb-7 rounded-3xl overflow-hidden bg-black shadow-[0_20px_50px_rgba(0,0,0,0.5)] border border-slate-700 group">
                <iframe 
                  id="sc-widget"
                  width="100%" height="100%" scrolling="no" frameBorder="no" allow="autoplay"
                  src={`https://w.soundcloud.com/player/?url=${encodeURIComponent(currentSong.url)}&color=%23fbbf24&auto_play=false&visual=true&show_comments=false&show_user=false`}
                  className={`w-full h-full transition-opacity duration-1000 ${broadcastState === BroadcastState.IDLE ? 'opacity-0' : 'opacity-100'}`}
                ></iframe>

                {broadcastState === BroadcastState.IDLE && (
                    <div className="absolute inset-0 bg-slate-800 flex flex-col items-center justify-center p-8 text-center z-20">
                        <div className="mb-6 text-6xl drop-shadow-lg">📻</div>
                        <h3 className="text-2xl font-black mb-2 brand-font leading-tight">HitFM Live <br/>Resurrection</h3>
                        <p className="text-slate-400 text-sm mb-8 leading-relaxed">Dynamic DJs, real-time gossip, and infinite trending pop.</p>
                        <div className="w-full space-y-4">
                            <input 
                                type="text" value={listenerName} onChange={e => setListenerName(e.target.value)}
                                className="w-full bg-slate-900 border-2 border-slate-700 rounded-2xl px-5 py-3 text-center text-yellow-400 font-bold focus:border-yellow-400 outline-none transition-all placeholder:text-slate-600"
                                placeholder="What's your name?"
                            />
                            <button onClick={initEngine} className="w-full py-4 bg-yellow-500 hover:bg-yellow-400 text-black font-black rounded-2xl transition-all active:scale-95 shadow-xl uppercase tracking-widest text-sm">Tune In Live</button>
                        </div>
                    </div>
                )}

                {broadcastState === BroadcastState.PLAYING_DJ && (
                    <div className="absolute top-5 left-5 z-30 flex items-center gap-2">
                        <div className="bg-red-600 text-[10px] font-black px-3 py-1.5 rounded-full shadow-2xl animate-pulse uppercase tracking-tighter">
                            DJ Is Talking
                        </div>
                    </div>
                )}
            </div>

            <div className="text-center mb-6 px-4">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <div className="h-[1px] w-8 bg-slate-700"></div>
                  <div className="text-[10px] text-yellow-500 font-black tracking-[0.3em] uppercase">
                      {broadcastState === BroadcastState.PLAYING_DJ ? "Special Segment" : "Streaming Now"}
                  </div>
                  <div className="h-[1px] w-8 bg-slate-700"></div>
                </div>
                <h2 className="text-3xl font-black truncate brand-font leading-tight mb-1">{currentSong.title}</h2>
                <p className="text-slate-400 font-bold tracking-wide uppercase text-xs opacity-80">{currentSong.artist}</p>
            </div>

            {broadcastState !== BroadcastState.IDLE && (
                <div className="flex justify-center mb-6">
                    <button 
                        onClick={skipTrack}
                        className="text-[10px] text-slate-500 hover:text-yellow-400 transition-colors uppercase font-black tracking-widest flex items-center gap-2 bg-slate-900/50 px-3 py-1 rounded-full border border-slate-700"
                    >
                        <span>Blocked or Bored? Skip Track</span>
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M4.555 5.168A1 1 0 003 6v8a1 1 0 001.555.832L10 11.202V14a1 1 0 001.555.832l7-5a1 1 0 000-1.664l-7-5A1 1 0 0010 4v2.798L4.555 5.168z"/></svg>
                    </button>
                </div>
            )}

            <div className="mb-8 px-2"><Visualizer analyser={analyser} /></div>
            
            {broadcastState !== BroadcastState.IDLE && (
              <div className="mt-4">
                <RequestLine onTranscription={handleTranscription} />
              </div>
            )}
        </div>
      </div>

      <div className="flex flex-col h-[500px] lg:h-[850px] w-full lg:w-[500px] bg-slate-900/50 rounded-[2rem] border border-slate-800 backdrop-blur-sm overflow-hidden shadow-inner">
         <DebugPanel logs={logs} onClear={clearLogs} />
      </div>

    </div>
  );
};

export default App;