import { toHttpHtreeUrl } from './htree';
import type { SongFixture } from './types';
import { RemoteSongIndex } from './remoteSongIndex';

const DEFAULT_AUDIO_INDEX_URL =
  'htree://nhash1qqsqj5tsnzshxz5e897ctr8zymt8w54xrldtwahcust72kpg82ceyvg9yrxf2m036mh64yszm4vd0gngt8tlmzz73w6y6tvpjz353qzufvkasj5mf0h/root.json';

export interface LoadedCatalog {
  featuredSongs: SongFixture[];
  librarySongs: SongFixture[];
  recentSongs: SongFixture[];
  shelves: Record<string, SongFixture[]>;
  searchIndex: RemoteSongIndex;
}

function currentIndexUrl(): string | null {
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    const runtime = params.get('index') ?? params.get('catalog');
    if (runtime) return runtime;
  }

  return import.meta.env.VITE_AUDIO_INDEX_URL ?? DEFAULT_AUDIO_INDEX_URL;
}

export async function loadCatalog(): Promise<LoadedCatalog> {
  const indexUrl = currentIndexUrl();
  if (!indexUrl) {
    throw new Error('Missing audio index URL.');
  }
  const response = await fetch(toHttpHtreeUrl(indexUrl));
  if (!response.ok) {
    throw new Error(`Failed to load audio index root: ${response.status}`);
  }

  const payload = (await response.json()) as {
    featuredSongs?: SongFixture[];
    librarySongs?: SongFixture[];
    recentSongs?: SongFixture[];
    shelves?: Record<string, SongFixture[]>;
    prefix?: string;
    searchRoot?: { hash: string; key?: string } | null;
  };
  if (!Array.isArray(payload.featuredSongs) || payload.featuredSongs.length === 0) {
    throw new Error('Audio index root is missing featured songs');
  }

  return {
    featuredSongs: payload.featuredSongs,
    librarySongs: Array.isArray(payload.librarySongs) ? payload.librarySongs : payload.featuredSongs.slice(0, 12),
    recentSongs: Array.isArray(payload.recentSongs) ? payload.recentSongs : payload.featuredSongs.slice(0, 6),
    shelves: payload.shelves ?? { All: payload.featuredSongs },
    searchIndex: new RemoteSongIndex(payload.searchRoot ?? null, payload.prefix ?? 's:'),
  };
}
