import React, { useState, useRef, useEffect } from 'react';
import { LogEntry } from '../types';

interface DebugPanelProps {
  logs: LogEntry[];
  onClear: () => void;
  isAIEnabled: boolean;
  setIsAIEnabled: (v: boolean) => void;
  isTTSEnabled: boolean;
  setIsTTSEnabled: (v: boolean) => void;
}

const DebugPanel: React.FC<DebugPanelProps> = ({
  logs, onClear,
  isAIEnabled, setIsAIEnabled,
  isTTSEnabled, setIsTTSEnabled
}) => {
  const [filter, setFilter] = useState<string>('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  const filteredLogs = logs.filter(log =>
    log.message.toLowerCase().includes(filter.toLowerCase()) ||
    log.type.toLowerCase().includes(filter.toLowerCase())
  ).reverse();

  return (
    <div className="flex flex-col h-full font-mono text-sm overflow-hidden">
      {/* Header */}
      <div className="p-4 bg-white/5 border-b border-white/5 flex justify-between items-center backdrop-blur-md sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-rose-500/80 shadow-[0_0_8px_rgba(244,63,94,0.5)]"></div>
            <div className="w-2.5 h-2.5 rounded-full bg-amber-500/80"></div>
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/80"></div>
          </div>
          <span className="font-mono font-bold text-slate-400 uppercase tracking-widest text-[10px] ml-2">System Terminal</span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onClear}
            className="text-[10px] bg-white/5 hover:bg-white/10 hover:text-white px-3 py-1.5 rounded transition-all uppercase font-bold tracking-wider text-slate-400 border border-white/5"
          >
            Clear
          </button>
        </div>
      </div>

      {/* AI Controls Section */}
      <div className="p-4 bg-white/5 border-b border-white/5 grid grid-cols-2 gap-4">
        <label className="flex items-center justify-between cursor-pointer group">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider group-hover:text-white transition-colors">Gemini AI</span>
          <button
            onClick={() => setIsAIEnabled(!isAIEnabled)}
            className={`w-10 h-5 rounded-full transition-all relative ${isAIEnabled ? 'bg-emerald-500/50' : 'bg-slate-700'}`}
          >
            <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${isAIEnabled ? 'left-6' : 'left-1'}`} />
          </button>
        </label>
        <label className="flex items-center justify-between cursor-pointer group">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider group-hover:text-white transition-colors">DJ Voice (TTS)</span>
          <button
            onClick={() => setIsTTSEnabled(!isTTSEnabled)}
            className={`w-10 h-5 rounded-full transition-all relative ${isTTSEnabled ? 'bg-indigo-500/50' : 'bg-slate-700'}`}
          >
            <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${isTTSEnabled ? 'left-6' : 'left-1'}`} />
          </button>
        </label>
      </div>

      {/* Filter Bar */}
      <div className="p-3 bg-black/20 border-b border-white/5 backdrop-blur-sm">
        <input
          type="text"
          placeholder="Filter logs..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-[11px] text-slate-300 focus:outline-none focus:border-rose-500/50 focus:ring-1 focus:ring-rose-500/20 transition-all font-mono placeholder:text-slate-600"
        />
      </div>

      {/* Log Feed */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-3 scroll-smooth bg-transparent font-mono text-[11px]"
      >
        {filteredLogs.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-700 space-y-2">
            <div className="text-2xl opacity-20">_</div>
            <p className="uppercase tracking-widest text-[10px]">Awaiting Signal Input</p>
          </div>
        ) : (
          filteredLogs.map((log) => (
            <div key={log.id} className="group flex gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300 hover:bg-white/5 p-2 rounded-lg -mx-2 transition-colors">
              <span className="text-slate-600 shrink-0 select-none opacity-50 font-medium">[{log.timestamp}]</span>
              <div className="flex flex-col gap-1 w-full overflow-hidden">
                <div className="flex items-center gap-2">
                  <span className={`
                        uppercase text-[9px] font-black tracking-wider px-1.5 py-0.5 rounded border
                        ${log.type === 'error' ? 'text-red-400 border-red-500/30 bg-red-500/10' :
                      log.type === 'dj' ? 'text-indigo-400 border-indigo-500/30 bg-indigo-500/10' :
                        log.type === 'info' ? 'text-slate-400 border-slate-500/30 bg-slate-500/10' :
                          'text-emerald-400 border-emerald-500/30 bg-emerald-500/10'}
                    `}>
                    {log.type}
                  </span>
                </div>

                <span className={`break-words leading-relaxed ${log.type === 'error' ? 'text-red-300' : 'text-slate-300'}`}>
                  {log.message.split(/(\[.*?\])/).map((part, i) =>
                    part.startsWith('[') ? <span key={i} className="text-amber-400 font-bold">{part}</span> : part
                  )}
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer Info */}
      <div className="p-2 bg-black/30 text-[9px] text-slate-600 text-center uppercase tracking-[0.2em] border-t border-white/5 font-bold">
        Engine: Audio-Graph v2.1 • Gemini Pro • YouTube API • RapidAPI
      </div>
    </div>
  );
};

export default DebugPanel;
