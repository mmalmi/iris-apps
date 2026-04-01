import BTree from 'sorted-btree';
import type { SearchResult, SongFixture } from './types';

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(song: SongFixture): string[] {
  return normalize(
    [
      song.title,
      song.artist,
      song.album,
      song.genre,
      song.mood,
      ...song.instruments,
      ...song.tags,
    ].join(' '),
  )
    .split(' ')
    .filter(Boolean);
}

export class SongSearchIndex {
  private readonly tokens = new BTree<string, Map<string, number>>();
  private readonly songs = new Map<string, SongFixture>();

  constructor(songs: SongFixture[]) {
    for (const song of songs) {
      this.songs.set(song.id, song);
      this.insert(song);
    }
  }

  private insert(song: SongFixture): void {
    const tokenWeights = new Map<string, number>();
    for (const token of tokenize(song)) {
      tokenWeights.set(token, (tokenWeights.get(token) ?? 0) + 1);
    }

    for (const [token, weight] of tokenWeights) {
      const entry = this.tokens.get(token) ?? new Map<string, number>();
      entry.set(song.id, weight);
      this.tokens.set(token, entry);
    }
  }

  search(query: string, genreFilter = 'All'): SearchResult[] {
    const normalized = normalize(query);
    const scoreMap = new Map<string, number>();
    const acceptedGenre = genreFilter.toLowerCase();

    const acceptSong = (song: SongFixture): boolean => {
      if (genreFilter === 'All') return true;
      if (acceptedGenre === 'club') return song.mood === 'club';
      if (acceptedGenre === 'focus') return song.mood === 'focus';
      return normalize(song.genre).includes(acceptedGenre);
    };

    const addMatches = (token: string, exactBoost: number): void => {
      for (const [key, value] of this.tokens.entries(token)) {
        if (!key.startsWith(token)) continue;
        for (const [songId, weight] of value) {
          const song = this.songs.get(songId);
          if (!song || !acceptSong(song)) continue;
          const current = scoreMap.get(songId) ?? 0;
          const boost = key === token ? exactBoost : exactBoost * 0.6;
          scoreMap.set(songId, current + weight * boost);
        }
      }
    };

    if (!normalized) {
      return [...this.songs.values()]
        .filter(acceptSong)
        .sort((left, right) => right.plays - left.plays || right.year - left.year)
        .map((song, index) => ({ songId: song.id, score: 1000 - index }));
    }

    const queryTokens = normalized.split(' ').filter(Boolean);
    for (const token of queryTokens) {
      addMatches(token, 12);
    }

    return [...scoreMap.entries()]
      .sort((left, right) => {
        if (right[1] !== left[1]) return right[1] - left[1];
        const leftSong = this.songs.get(left[0])!;
        const rightSong = this.songs.get(right[0])!;
        return rightSong.plays - leftSong.plays;
      })
      .map(([songId, score]) => ({ songId, score }));
  }
}

export function makeSongSearchIndex(songs: SongFixture[]): SongSearchIndex {
  return new SongSearchIndex(songs);
}
