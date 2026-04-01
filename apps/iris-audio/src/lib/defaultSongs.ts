import type { SongFixture } from './types';

function hash(input: string): number {
  let value = 0;
  for (let index = 0; index < input.length; index += 1) {
    value = (value * 31 + input.charCodeAt(index)) >>> 0;
  }
  return value;
}

export function pickDefaultSongs(songs: SongFixture[], count = 12): SongFixture[] {
  if (songs.length <= count) return songs;
  const seed = new Date().toISOString().slice(0, 10);
  const sorted = [...songs].sort((left, right) => {
    const leftScore = hash(`${seed}:${left.id}`);
    const rightScore = hash(`${seed}:${right.id}`);
    return leftScore - rightScore;
  });
  return sorted.slice(0, count);
}
