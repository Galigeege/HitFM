import React, { useState, useRef } from 'react';
import { transcribeUserRequest } from '../services/geminiService';

interface RequestLineProps {
  onTranscription: (text: string) => void;
}

const RequestLine: React.FC<RequestLineProps> = ({ onTranscription }) => {
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
        
        const text = await transcribeUserRequest(blob);
        onTranscription(text);
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
    <div className="flex flex-col items-center gap-2 mt-4">
      <p className="text-xs text-gray-400 uppercase tracking-widest mb-1">Live Request Line</p>
      <button
        onMouseDown={startRecording}
        onMouseUp={stopRecording}
        onTouchStart={startRecording}
        onTouchEnd={stopRecording}
        disabled={isProcessing}
        className={`
          relative w-16 h-16 rounded-full flex items-center justify-center transition-all duration-200
          ${isRecording ? 'bg-red-600 scale-110 shadow-[0_0_20px_rgba(220,38,38,0.7)]' : 'bg-gray-700 hover:bg-gray-600'}
          ${isProcessing ? 'animate-pulse cursor-wait' : 'cursor-pointer'}
        `}
      >
        {isProcessing ? (
           <svg className="w-8 h-8 text-white animate-spin" fill="none" viewBox="0 0 24 24">
             <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
             <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
           </svg>
        ) : (
          <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
          </svg>
        )}
      </button>
      <span className="text-xs text-gray-500">
        {isRecording ? "Listening..." : isProcessing ? "Connecting to DJ..." : "Hold to Request"}
      </span>
    </div>
  );
};

export default RequestLine;