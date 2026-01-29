import { Song, DJPersona } from './types';

// Updated to use SoundCloud URLs
export const PLAYLIST: Song[] = [
  { id: 'yt-secure-1', title: 'redrum', artist: '21 Savage', albumArt: 'https://i.ytimg.com/vi/mrV8kK5t0V8/maxresdefault.jpg', duration: 0, genre: 'Hip Hop', url: 'https://youtu.be/mrV8kK5t0V8?si=Yr-AWq_AgHXluIkR', provider: 'youtube' },
  { id: 'yt-secure-2', title: 'FE!N', artist: 'Travis Scott', albumArt: 'https://i.ytimg.com/vi/kbEC-AGr9n0/maxresdefault.jpg', duration: 0, genre: 'Hip Hop', url: 'https://youtu.be/kbEC-AGr9n0?si=69UJBQxx54ZLrxy2', provider: 'youtube' },
  { id: 'yt-secure-3', title: 'Lovin On Me', artist: 'Jack Harlow', albumArt: 'https://i.ytimg.com/vi/u2ah9tWTkmk/maxresdefault.jpg', duration: 0, genre: 'Pop Rap', url: 'https://youtu.be/u2ah9tWTkmk?si=qXENa4gYB5Bt5t_E', provider: 'youtube' },
  { id: 'yt-secure-4', title: 'Beautiful Things', artist: 'Benson Boone', albumArt: 'https://i.ytimg.com/vi/Oa_RSwwpPaA/maxresdefault.jpg', duration: 0, genre: 'Pop', url: 'https://youtu.be/Oa_RSwwpPaA?si=gpwudAktGhEhozt1', provider: 'youtube' },
  { id: 'yt-secure-5', title: 'One Of The Girls', artist: 'The Weeknd, JENNIE, Lily-Rose Depp', albumArt: 'https://i.ytimg.com/vi/ygTZZpVkmKg/maxresdefault.jpg', duration: 0, genre: 'R&B', url: 'https://youtu.be/ygTZZpVkmKg?si=dwoNWbF_LelxILNw', provider: 'youtube' }
];

export const DJ_PERSONAS: DJPersona[] = [
  {
    name: 'Andy (The Hype Man)',
    voiceName: 'Puck',
    description: 'High energy, morning show vibes, fast talker.',
    systemInstruction: `You are Andy, the high-octane host of "HitFM Morning Rush". 
    Radio Technique: Use "The Tease" - hint at a celebrity secret or a massive track coming up later. 
    Style: Bilingual (English/Chinese). Hyper-active, uses radio-style sound effect descriptions like [Excited Laughs]. 
    Interaction: Act as if you're looking at a live studio clock and a weather monitor. 
    Key Role: You are the listener's caffeine. Keep the energy peaking. Every transition should feel like an event.
    Catchphrases: "Your energy plug-in!", "Don't touch that dial!", "In the mix with Andy".`
  },
  {
    name: 'Valen (Chill Evening)',
    voiceName: 'Kore',
    description: 'Sophisticated, deep voice, evening drive time.',
    systemInstruction: `You are Valen, the smooth voice of "HitFM Late Night City". 
    Radio Technique: Use "Deep Storytelling" - share a 1-sentence intimate fact about the artist that makes the listener feel connected. 
    Style: Smooth, low-register, intimate. Bilingual (English/Chinese). 
    Interaction: Talk to the listener like they are the only person in the world. Mention the city lights and the night mood. 
    Key Role: You are the listener's cool friend sharing a glass of wine. Use soft transitions.
    Catchphrases: "Lean back, I've got you", "The city sounds better with Valen", "Keeping it 100 on HitFM".`
  }
];

export const GOOGLE_SEARCH_TOOL = {
  googleSearch: {}
};