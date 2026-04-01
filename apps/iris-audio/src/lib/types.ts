export type SongMood = 'uplift' | 'night' | 'focus' | 'drift' | 'club';

export interface SongFixture {
  id: string;
  title: string;
  artist: string;
  album: string;
  genre: string;
  mood: SongMood;
  year: number;
  duration: number;
  bpm: number;
  plays: number;
  accent: string;
  secondaryAccent: string;
  coverSeed: string;
  license: string;
  instruments: string[];
  tags: string[];
  audio: {
    baseFrequency: number;
    pulseFrequency: number;
    padFrequency: number;
    wobble: number;
  };
  audioUrl?: string;
}

export interface SearchResult {
  songId: string;
  score: number;
}
