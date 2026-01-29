import React, { useState, useRef } from 'react';
import { transcribeUserRequest } from '../services/geminiService';
import { useApiKey } from '../context/ApiKeyContext';

interface RequestLineProps {
  onTranscription: (text: string) => void;
}

const RequestLine: React.FC<RequestLineProps> = ({ onTranscription }) => {
  const { apiKey } = useApiKey();
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);

      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorderRef.current.onstop = async () => {
        setIsProcessing(true);
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        chunksRef.current = [];

        try {
          const text = await transcribeUserRequest(blob, apiKey);
          onTranscription(text);
        } catch (e) {
          console.error(e);
          alert("Transcription failed. Check console/API key.");
        }
        setIsProcessing(false);
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Mic access denied", err);
      alert("Microphone access needed to make a request.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);

      // Stop all tracks to release mic
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
  };

  return (
    <div className="flex flex-col items-center gap-3 mt-6">
      <p className="text-[10px] text-slate-400/60 uppercase tracking-[0.25em] font-bold">Live Request Line</p>
      <button
        onMouseDown={startRecording}
        onMouseUp={stopRecording}
        onTouchStart={startRecording}
        onTouchEnd={stopRecording}
        disabled={isProcessing}
        className={`
          group relative w-16 h-16 rounded-full flex items-center justify-center transition-all duration-300
          ${isRecording
            ? 'bg-gradient-to-br from-rose-600 to-red-600 scale-110 shadow-[0_0_30px_rgba(225,29,72,0.6)] ring-4 ring-rose-500/20'
            : 'bg-gradient-to-br from-slate-800 to-slate-900 hover:from-slate-700 hover:to-slate-800 shadow-[0_10px_20px_rgba(0,0,0,0.5)] border border-white/5 hover:border-white/10 active:scale-95'}
          ${isProcessing ? 'cursor-wait animate-pulse' : 'cursor-pointer'}
        `}
      >
        {isProcessing ? (
          <svg className="w-6 h-6 text-white animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        ) : (
          <div className={`transition-transform duration-300 ${isRecording ? 'scale-110' : 'group-hover:scale-110'}`}>
            <svg className={`w-6 h-6 ${isRecording ? 'text-white' : 'text-slate-400 group-hover:text-white transition-colors'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
          </div>
        )}

        {/* Glow effect that appears on hover when not recording */}
        {!isRecording && !isProcessing && (
          <div className="absolute inset-0 rounded-full bg-amber-500/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"></div>
        )}
      </button>
      <span className="text-[10px] text-slate-500 font-medium h-4">
        {isRecording ? <span className="text-rose-400 animate-pulse font-bold tracking-widest">LISTENING...</span> : isProcessing ? "Uplinking..." : "Hold to Talk"}
      </span>
    </div>
  );
};

export default RequestLine;