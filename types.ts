export interface Song {
  id: string;
  title: string;
  artist: string;
  albumArt: string;
  duration: number;
  url: string;
  genre: string;
  provider?: 'soundcloud' | 'youtube' | 'native';
}

export enum BroadcastState {
  IDLE = 'IDLE',
  LOADING_INTRO = 'LOADING_INTRO',
  PLAYING_MUSIC = 'PLAYING_MUSIC',
  GENERATING_DJ = 'GENERATING_DJ',
  PLAYING_DJ = 'PLAYING_DJ',
  CHITCHAT = 'CHITCHAT', // New: Standalone gossip/news segment
}

export interface DJPersona {
  name: string;
  voiceName: string;
  description: string;
  systemInstruction: string;
}

export interface LogEntry {
  id: string;
  timestamp: string;
  type: 'info' | 'dj' | 'error' | 'music';
  message: string;
}

export type ScriptType = 'intro' | 'transition' | 'chitchat';