import React, { useState, useRef, useEffect } from 'react';
import { LogEntry } from '../types';

interface DebugPanelProps {
  logs: LogEntry[];
  onClear: () => void;
}

const DebugPanel: React.FC<DebugPanelProps> = ({ logs, onClear }) => {
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
  ).reverse(); // Show newest at bottom like a terminal

  return (
    <div className="flex flex-col h-full font-mono text-sm overflow-hidden">
      {/* Header */}
      <div className="p-4 bg-slate-800 border-b border-slate-700 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
          <span className="font-bold text-slate-300 uppercase tracking-widest text-xs">Debug Terminal</span>
        </div>
        <div className="flex gap-2">
            <button 
                onClick={onClear}
                className="text-[10px] bg-slate-700 hover:bg-slate-600 px-2 py-1 rounded text-slate-300 transition-colors uppercase font-bold"
            >
                Clear
            </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="p-2 bg-slate-900 border-b border-slate-800">
        <input 
            type="text" 
            placeholder="Filter logs (e.g. GEMINI, AUDIO, ERROR)..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-full bg-black/40 border border-slate-700 rounded px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-yellow-600/50"
        />
      </div>

      {/* Log Feed */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-2 scroll-smooth bg-black/20"
      >
        {filteredLogs.length === 0 ? (
          <div className="h-full flex items-center justify-center text-slate-600 italic">
            No logs captured yet...
          </div>
        ) : (
          filteredLogs.map((log) => (
            <div key={log.id} className="group flex gap-3 animate-in fade-in duration-300">
              <span className="text-slate-600 shrink-0 select-none">[{log.timestamp}]</span>
              <span className={`
                ${log.type === 'error' ? 'text-red-400 font-bold' : 
                  log.type === 'dj' ? 'text-blue-400' : 
                  log.type === 'info' ? 'text-slate-300' : 
                  'text-green-400'}
              `}>
                <span className="opacity-50 mr-2 uppercase text-[10px] border border-current px-1 rounded inline-block h-4 leading-3">
                    {log.type}
                </span>
                {log.message.split(/(\[.*?\])/).map((part, i) => 
                    part.startsWith('[') ? <span key={i} className="text-yellow-500 font-bold">{part}</span> : part
                )}
              </span>
            </div>
          ))
        )}
      </div>

      {/* Footer Info */}
      <div className="p-2 bg-slate-800 text-[10px] text-slate-500 text-center uppercase tracking-tighter border-t border-slate-700">
        Engine: RadioAudioEngine v2.1 • Gemini 3 Flash Preview • Buffer Active
      </div>
    </div>
  );
};

export default DebugPanel;
