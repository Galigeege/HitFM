import { DJPersona, Song, ScriptType } from "../types";
import { GOOGLE_SEARCH_TOOL } from "../constants";

/**
 * YunWu AI Proxy Integration
 * This service routes Gemini requests through the YunWu AI provider (https://yunwu.ai)
 * It supports native Gemini 2.0 features like Multimodal generation and TTS response modality.
 */

// Global callback for UI logging
export let onGeminiLog: ((type: 'input' | 'output', model: string, data: any) => void) | null = null;
export const setGeminiLogger = (fn: typeof onGeminiLog) => { onGeminiLog = fn; };

// Helper to prevent log spam from Base64 audio
const sanitizeLogData = (data: any): any => {
  if (!data) return data;
  try {
    const str = JSON.stringify(data, (key, value) => {
      if (key === 'data' && typeof value === 'string' && value.length > 500) {
        return `<Base64 Data Truncated: ${value.length} chars>`;
      }
      if (typeof value === 'string' && value.length > 1000) {
        return value.substring(0, 100) + `... <${value.length - 100} chars truncated>`;
      }
      return value;
    });
    return JSON.parse(str);
  } catch (e) {
    return data;
  }
};

/**
 * Removes AI reasoning, thinking blocks, and markdown titles (e.g. **Thinking**, (Self-Correction))
 * from the AI's output to ensure only the final spoken script remains.
 */
const cleanScript = (text: string): string => {
  return text
    .replace(/\*\*[\s\S]*?\*\*/g, "") // Remove bold blocks (including newlines)
    .replace(/\([\s\S]*?\)/g, "")     // Remove parentheses blocks
    .replace(/\[script\]/gi, "")      // Remove potential tags
    .replace(/Reasoning:?[\s\S]*?\n/gi, "")
    .replace(/Thinking:?[\s\S]*?\n/gi, "")
    .replace(/Drafting:?[\s\S]*?\n/gi, "")
    .replace(/Imagining:?[\s\S]*?\n/gi, "")
    .replace(/#{1,6}\s.*/g, "")       // Headers
    .replace(/```[\s\S]*?```/g, "")    // Code blocks
    .replace(/\n\s*\n/g, "\n")        // Collapse newlines
    .trim();
};

const SAFETY_SETTINGS = [
  { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
  { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
  { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
  { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
];

const safeJsonParse = (text: string) => {
  try {
    // Look for the last JSON object/array in the text to avoid preamble issues
    const lastOpenBrace = text.lastIndexOf('{');
    const firstOpenBrace = text.indexOf('{');
    const lastCloseBrace = text.lastIndexOf('}');

    if (firstOpenBrace !== -1 && lastCloseBrace !== -1) {
      const jsonCandidate = text.substring(firstOpenBrace, lastCloseBrace + 1);
      return JSON.parse(jsonCandidate);
    }

    return JSON.parse(text);
  } catch (e) {
    // If double JSON is returned, try to find the actual block
    const blocks = text.match(/\{[\s\S]*?\}/g);
    if (blocks && blocks.length > 0) {
      for (const b of blocks.reverse()) { // Try from the end
        try { return JSON.parse(b); } catch (e) { }
      }
    }
    throw new Error(`JSON Extraction Failed: ${text.substring(0, 150)}...`);
  }
};

const getBaseUrl = () => process.env.GEMINI_BASE_URL || "https://yunwu.ai";
const getApiKey = () => process.env.GEMINI_API_KEY || "";

/**
 * Generic fetcher for Gemini-compatible endpoints
 */
const callGemini = async (model: string, body: any) => {
  const url = `${getBaseUrl()}/v1beta/models/${model}:generateContent?key=${getApiKey()}`;

  // Set default stable config if not present
  if (!body.generationConfig) body.generationConfig = {};

  // Only force temperature 0 for logic tasks (when no audio modality is requested)
  if (body.generationConfig.temperature === undefined) {
    const isAudio = body.generationConfig.responseModalities?.includes("AUDIO");
    body.generationConfig.temperature = isAudio ? 1.0 : 0;
  }

  // Add safety settings to all requests to prevent "empty candidates"
  if (!body.safetySettings) {
    body.safetySettings = SAFETY_SETTINGS;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errorText = await response.text();
    if (response.status === 429) {
      console.error(`429 Quota Error [${model}] from Provider:`, errorText);
      throw new Error(`QUOTA_EXCEEDED [${model}]`);
    }
    throw new Error(`API_ERROR [${model}]: ${response.status} - ${errorText}`);
  }

  // Log output (Sanitized)
  if (onGeminiLog) {
    const sanitizedInput = sanitizeLogData(body);
    onGeminiLog('input', model, sanitizedInput);
  }

  const result = await response.json();

  // Log output (Sanitized)
  if (onGeminiLog) {
    const sanitizedOutput = sanitizeLogData(result);
    onGeminiLog('output', model, sanitizedOutput);
  }

  const fullText = result.candidates?.[0]?.content?.parts?.[0]?.text || "";
  if (fullText.length > 500) {
    console.log(`[Gemini API] Received large response (${fullText.length} chars). Cleaning...`);
  }
  return result;
};

const decodePCMData = (base64Data: string, audioContext: AudioContext): AudioBuffer => {
  const binaryString = atob(base64Data);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  // Gemini returns PCM 16-bit Little Endian at 24kHz
  const samples = new Int16Array(bytes.buffer);
  const float32Data = new Float32Array(samples.length);

  for (let i = 0; i < samples.length; i++) {
    // Normalize 16-bit integer (-32768 to 32767) to float (-1.0 to 1.0)
    float32Data[i] = samples[i] / 32768.0;
  }

  const buffer = audioContext.createBuffer(1, float32Data.length, 24000);
  buffer.copyToChannel(float32Data, 0);
  return buffer;
};

export const fetchNextTrendingSong = async (currentArtist: string, apiKey?: string): Promise<Song> => {
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

  const body = {
    contents: [{
      parts: [{
        text: `[SYSTEM: TASK-ORIENTED MODE. NO REASONING. ONLY JSON.]
      Identify a currently trending Western pop song that matches the vibe of ${currentArtist}. 
      
      CRITICAL: Output ONLY the JSON object. NO markdown, NO preamble.
      
      Requirements:
      1. Prioritize YouTube "Official Audio" or "Lyric Video".
      2. Ensure embeddable.
      3. Provider: 'soundcloud' | 'youtube'.
      
      Response Format: { "title": "...", "artist": "...", "genre": "...", "url": "...", "provider": "..." }` }]
    }],
    generationConfig: {
      temperature: 0.2, // Low temperature for song fetching stability
    },
    tools: [GOOGLE_SEARCH_TOOL]
  };

  try {
    const data = await callGemini(model, body);
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    const result = safeJsonParse(text);

    return {
      id: `dynamic-${Date.now()}`,
      title: result.title || "Unknown Title",
      artist: result.artist || "Unknown Artist",
      genre: result.genre || "Pop",
      url: result.url || "",
      provider: result.provider as any,
      albumArt: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500",
      duration: 0
    };
  } catch (e: any) {
    if (e.message?.includes('QUOTA_EXCEEDED')) throw e;
    console.error("Gemini API Error (fetchNextTrendingSong):", e);
    throw e;
  }
};

export const generateDJScript = async (
  persona: DJPersona,
  previousSong: Song | null,
  nextSong: Song,
  listenerName: string,
  type: ScriptType = 'transition',
  location: string = "the city",
  apiKey?: string
): Promise<string> => {
  try {
    const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
    const now = new Date();
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const dayName = days[now.getDay()];
    const preciseTime = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const timeCtx = now.getHours() < 12 ? "Morning Rush" : now.getHours() < 18 ? "Afternoon Vibes" : "Late Night City";

    let mission = "";
    if (type === 'intro') {
      mission = `Your dear friend ${listenerName} just walked into the room. It's ${dayName} at ${preciseTime}. Greet them personally and intimately. Smoothly intro the first track: ${nextSong.title} by ${nextSong.artist}. Use [Laughs].`;
    } else if (type === 'chitchat') {
      mission = `It's ${preciseTime} in ${location}. Talk about a trending local event. Use Chinglish naturally. TEASE a big track coming up.`;
    } else {
      mission = `Bridge ${previousSong?.title} into ${nextSong.title}. It's ${preciseTime}. Mention ${nextSong.artist}. Under 60 words.`;
    }

    const prompt = `You are ${persona.name}. System: ${persona.systemInstruction}. Scene: ${timeCtx} in ${location}. Clock: ${preciseTime}. Task: ${mission}. 
    
    CRITICAL: Output ONLY a JSON object. 
    DO NOT include any thinking, reasoning, or preamble inside or outside the JSON.
    Start your response directly with '{'.
    Format: { "script": "your final spoken words only" }`;

    const body = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        maxOutputTokens: 4000,
        temperature: 0.85
      } as any,
      tools: [GOOGLE_SEARCH_TOOL]
    };

    console.log(`[DJ Script Request] Model: ${model}`, body);
    const data = await callGemini(model, body);
    console.log(`[DJ Script Response]`, data);

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    const result = safeJsonParse(text);
    return cleanScript(result.script || "HitFM, keeping the vibe alive.");
  } catch (error: any) {
    console.error(`[DJ Script Error]`, error);
    if (error.message?.includes('QUOTA_EXCEEDED')) throw error;
    return `Alright HitFM fans, coming up next is some fire from ${nextSong.artist}. Stay tuned!`;
  }
};

export const generateDJAudio = async (text: string, voiceName: string, audioContext: AudioContext, apiKey?: string): Promise<AudioBuffer | null> => {
  try {
    const model = process.env.GEMINI_TTS_MODEL || 'gemini-2.5-flash-preview-tts';
    // Deep clean again before TTS to be safe
    let cleanText = cleanScript(text).replace(/\[.*?\]/g, "");

    // If text is still suspiciously long (leaked reasoning), take only the last paragraph
    if (cleanText.length > 500 && cleanText.includes('\n')) {
      const paragraphs = cleanText.split('\n').filter(p => p.trim().length > 10);
      cleanText = paragraphs[paragraphs.length - 1]; // Assume the last part is the actual script
    }

    if (!cleanText || cleanText.trim().length < 2) {
      console.warn("[DJ Audio] Cleaned text is empty, skipping TTS.");
      return null;
    }

    const body = {
      contents: [{
        role: "user",
        parts: [{ text: cleanText }]
      }],
      generationConfig: {
        responseModalities: ["AUDIO"],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voiceName } } },
        temperature: 1.0,
        maxOutputTokens: 2048,
      },
      safetySettings: SAFETY_SETTINGS
    };

    // Final sanity check: never send a part without initialized data
    if (!body.contents[0].parts[0].text) {
      console.warn("[DJ Audio] Found empty text part during body construction. Aborting.");
      return null;
    }

    console.log(`[DJ Audio Internal Request] Model: ${model}, Voice: ${voiceName}, Text: "${cleanText.substring(0, 50)}..."`);
    const data = await callGemini(model, body);
    console.log(`[DJ Audio Internal Response]`, data);

    const base64Audio = data.candidates?.[0]?.content?.parts?.find(p => p.inlineData)?.inlineData?.data;

    if (!base64Audio) {
      console.warn(`[DJ Audio] Response received but NO audio data (inlineData) found.`);
      if (data.candidates?.[0]?.finishReason) {
        console.warn(`Finish Reason: ${data.candidates[0].finishReason}`);
      }
    }

    return base64Audio ? decodePCMData(base64Audio, audioContext) : null;
  } catch (error: any) {
    console.error("[DJ Audio Error Details]:", error);
    if (error.message?.includes('QUOTA_EXCEEDED')) throw error;
    return null;
  }
};

export const transcribeUserRequest = async (audioBlob: Blob, apiKey?: string): Promise<string> => {
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  const reader = new FileReader();
  reader.readAsDataURL(audioBlob);

  return new Promise((resolve, reject) => {
    reader.onloadend = async () => {
      const base64data = (reader.result as string).split(',')[1];
      try {
        const body = {
          contents: [{
            parts: [
              { inlineData: { mimeType: audioBlob.type || 'audio/webm', data: base64data } },
              { text: "Transcribe this radio request." }
            ]
          }]
        };
        const data = await callGemini(model, body);
        resolve(data.candidates?.[0]?.content?.parts?.[0]?.text || "");
      } catch (e) { reject(e); }
    };
    reader.onerror = reject;
  });
};

export const fetchTrendingBatch = async (apiKey?: string): Promise<Song[]> => {
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  const body = {
    contents: [{
      parts: [{
        text: `Provide a list of 5 currently trending global pop songs. 
      Include reliable SoundCloud URLs for each. 
      Format as JSON array of objects: [{ "title": "...", "artist": "...", "genre": "...", "sc_url": "..." }].` }]
    }],
    generationConfig: {
      temperature: 0.1
    },
    tools: [GOOGLE_SEARCH_TOOL]
  };

  try {
    const data = await callGemini(model, body);
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "[]";
    const result = safeJsonParse(text);

    return result.map((s: any) => ({
      id: `dynamic-batch-${Math.random().toString(36).substr(2, 9)}`,
      title: s.title,
      artist: s.artist,
      genre: s.genre || "Pop",
      url: s.sc_url,
      albumArt: "",
      duration: 0
    }));
  } catch (e) {
    console.error("Batch fetch failed:", e);
    return [];
  }
};