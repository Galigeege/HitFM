import { Song, DJPersona } from './types';

// Updated to use SoundCloud URLs
export const PLAYLIST: Song[] = [
  {
    id: 'sc-1',
    title: 'As It Was (Slowed)',
    artist: 'Harry Styles',
    albumArt: 'https://i1.sndcdn.com/artworks-5E4caF7Qo08N-0-t500x500.jpg', // Placeholder or fetched
    duration: 0, // Will be determined by Widget
    genre: 'Pop / Slowed',
    url: 'https://soundcloud.com/itdubzti/harry-styles-as-it-was-slowed?si=7820d70bbbd74ccfab92b0cefbca8644'
  },
  {
    id: 'sc-2',
    title: 'Cruel Summer',
    artist: 'Taylor Swift',
    albumArt: 'https://i1.sndcdn.com/artworks-2l10X5Qz2z2e-0-t500x500.jpg',
    duration: 0,
    genre: 'Pop',
    url: 'https://soundcloud.com/user-969623351/cruel-summer-taylor-swift' 
  },
  {
    id: 'sc-3',
    title: 'Levitating',
    artist: 'Dua Lipa',
    albumArt: 'https://i1.sndcdn.com/artworks-000676449193-02s8w7-t500x500.jpg',
    duration: 0,
    genre: 'Disco Pop',
    url: 'https://soundcloud.com/dualipa/levitating-feat-dababy'
  },
  {
    id: 'sc-4',
    title: 'Midnight City',
    artist: 'M83',
    albumArt: 'https://i1.sndcdn.com/artworks-000014022793-138249-t500x500.jpg',
    duration: 0,
    genre: 'Indie Pop',
    url: 'https://soundcloud.com/m83/midnight-city'
  }
];

export const DJ_PERSONAS: DJPersona[] = [
  {
    name: 'Andy (The Hype Man)',
    voiceName: 'Puck', // Gemini voice mapping
    description: 'High energy, morning show vibes, fast talker.',
    systemInstruction: `You are Andy, the host of HitFM Morning Show. 
    Personality: Super high energy, chaotic good, very enthusiastic (E-type personality). 
    Language Style: Bilingual (English/Chinese) mix naturally. "Chinglish" is encouraged for vibe.
    Key Phrases: "Wake up wake up!", "Let's go!", "Check this banger out".
    Content Focus: You are obsessed with the Billboard Hot 100, viral TikTok trends, and breaking celebrity news. Hype up every song like it's a world premiere.`
  },
  {
    name: 'Valen (Chill Evening)',
    voiceName: 'Kore', // Gemini voice mapping
    description: 'Sophisticated, deep voice, evening drive time.',
    systemInstruction: `You are Valen, the host of HitFM Late Night.
    Personality: Cool, calm, knowledgeable about music history, witty but relaxed.
    Language Style: Smooth Bilingual (English/Chinese). Elegant transitions.
    Key Phrases: "Stay chill", "Vibing with you", "Music for the soul".
    Content Focus: You love sharing artist backstories, emotional context, and connecting the music to the city's weather or mood. Make the listener feel like they are in a movie.`
  }
];

export const GOOGLE_SEARCH_TOOL = {
  googleSearch: {}
};