import { GoogleGenAI, Modality, Type } from "@google/genai";
import { DJPersona, Song, ScriptType } from "../types";
import { GOOGLE_SEARCH_TOOL } from "../constants";

const decodePCMData = (base64Data: string, audioContext: AudioContext): AudioBuffer => {
  const binaryString = atob(base64Data);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  const int16Data = new Int16Array(bytes.buffer);
  const float32Data = new Float32Array(int16Data.length);
  for (let i = 0; i < int16Data.length; i++) {
    float32Data[i] = int16Data[i] / 32768.0;
  }
  const buffer = audioContext.createBuffer(1, float32Data.length, 24000);
  buffer.copyToChannel(float32Data, 0);
  return buffer;
};

/**
 * Dynamically find a trending song based on current trends.
 * Optimized to avoid "Not available in your country" errors.
 */
export const fetchNextTrendingSong = async (currentArtist: string): Promise<Song> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const prompt = `Identify a currently trending Western pop song that matches the vibe of ${currentArtist}. 
    Search for a SoundCloud URL for this track. 
    CRITICAL: To avoid "Not available in your country" errors, prioritize searching for links from the artist's official SoundCloud page, or a verified/popular 'repost' channel that is known for global accessibility. 
    Avoid region-locked album tracks if possible.
    Provide the response in JSON format: { "title": "...", "artist": "...", "genre": "...", "sc_url": "..." }.`;

    try {
        const result = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
            config: {
                tools: [GOOGLE_SEARCH_TOOL],
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        title: { type: Type.STRING },
                        artist: { type: Type.STRING },
                        genre: { type: Type.STRING },
                        sc_url: { type: Type.STRING }
                    },
                    required: ["title", "artist", "sc_url"]
                }
            }
        });
        const data = JSON.parse(result.text);
        return {
            id: `dynamic-${Date.now()}`,
            title: data.title,
            artist: data.artist,
            genre: data.genre || "Pop",
            url: data.sc_url,
            albumArt: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500",
            duration: 0
        };
    } catch (e: any) {
        if (e.message?.includes('429')) {
            throw new Error("QUOTA_EXCEEDED");
        }
        // General fallback to a high-availability track
        return {
            id: 'fallback-stay',
            title: 'Stay (Global Mirror)',
            artist: 'The Kid LAROI & Justin Bieber',
            genre: 'Pop',
            url: 'https://soundcloud.com/thekidlaroi/stay-with-justin-bieber',
            albumArt: '',
            duration: 0
        };
    }
};

export const generateDJScript = async (
  persona: DJPersona,
  previousSong: Song | null,
  nextSong: Song,
  listenerName: string,
  type: ScriptType = 'transition',
  location: string = "the city"
): Promise<string> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const hour = new Date().getHours();
    const timeCtx = hour < 12 ? "Morning Rush" : hour < 18 ? "Afternoon Vibes" : "Late Night City";
    
    let mission = "";
    if (type === 'intro') {
        mission = `Opening set. Welcome ${listenerName} to HitFM. Intro ${nextSong.title} by ${nextSong.artist}. Share an anecdote. Review it. Use [Laughs].`;
    } else if (type === 'chitchat') {
        mission = `Talk about the world. Find ONE trending topic from today in ${location}. Chat naturally. Use Chinglish. Use [Laughs].`;
    } else {
        mission = `Bridge ${previousSong?.title} into ${nextSong.title}. Mention news about ${nextSong.artist}. Under 60 words.`;
    }

    const prompt = `You are ${persona.name}. System: ${persona.systemInstruction}. Scene: ${timeCtx} in ${location}. Task: ${mission}. Output ONLY spoken words.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        tools: [GOOGLE_SEARCH_TOOL],
        maxOutputTokens: 400,
      }
    });

    return response.text || "HitFM, keeping the vibe alive.";
  } catch (error: any) {
    if (error.message?.includes('429')) throw new Error("QUOTA_EXCEEDED");
    return `Alright HitFM fans, coming up next is some fire from ${nextSong.artist}. Stay tuned!`;
  }
};

export const generateDJAudio = async (text: string, voiceName: string, audioContext: AudioContext): Promise<AudioBuffer | null> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const cleanText = text.replace(/\[.*?\]/g, "");
    
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: cleanText }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voiceName } } },
      },
    });
    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    return base64Audio ? decodePCMData(base64Audio, audioContext) : null;
  } catch (error: any) {
    if (error.message?.includes('429')) throw new Error("QUOTA_EXCEEDED");
    return null;
  }
};

export const transcribeUserRequest = async (audioBlob: Blob): Promise<string> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const reader = new FileReader();
    reader.readAsDataURL(audioBlob);
    return new Promise((resolve, reject) => {
        reader.onloadend = async () => {
            const base64data = (reader.result as string).split(',')[1];
            try {
                const response = await ai.models.generateContent({
                    model: 'gemini-3-flash-preview',
                    contents: { parts: [{ inlineData: { mimeType: audioBlob.type || 'audio/webm', data: base64data } }, { text: "Transcribe this radio request." }] }
                });
                resolve(response.text || "");
            } catch (e) { reject(e); }
        };
        reader.onerror = reject;
    });
};