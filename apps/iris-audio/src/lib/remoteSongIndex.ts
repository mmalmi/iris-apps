import { BTree, SearchIndex } from '@hashtree/index';
import { fromHex, HashTree, toHex, type CID, type Hash, type Store } from '@hashtree/core';
import type { SongFixture } from './types';
import { getWorkerClient } from './workerClient';

type SerializedCid = {
  hash: string;
  key?: string;
};

type RankedLink = {
  cid: CID;
  score: number;
  exactMatches: number;
  prefixDistance: number;
};

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function cidCacheKey(cid: CID): string {
  return `${toHex(cid.hash)}:${cid.key ? toHex(cid.key) : ''}`;
}

class RemoteBlockStore implements Store {
  private readonly cache = new Map<string, Uint8Array | null>();

  async get(hash: Hash): Promise<Uint8Array | null> {
    const hex = Array.from(hash, (value) => value.toString(16).padStart(2, '0')).join('');
    if (this.cache.has(hex)) {
      return this.cache.get(hex) ?? null;
    }

    try {
      const workerClient = await getWorkerClient();
      const { data } = await workerClient.getBlob(hex);
      this.cache.set(hex, data);
      return data;
    } catch {
      this.cache.set(hex, null);
      return null;
    }
  }

  async put(): Promise<boolean> {
    throw new Error('RemoteBlockStore is read-only');
  }

  async has(hash: Hash): Promise<boolean> {
    return (await this.get(hash)) !== null;
  }

  async delete(): Promise<boolean> {
    throw new Error('RemoteBlockStore is read-only');
  }
}

function acceptSong(song: SongFixture, genreFilter: string): boolean {
  if (genreFilter === 'All') return true;
  const acceptedGenre = genreFilter.toLowerCase();
  if (acceptedGenre === 'club') return song.mood === 'club';
  if (acceptedGenre === 'focus') return song.mood === 'focus';
  return normalize(song.genre).includes(acceptedGenre);
}

export class RemoteSongIndex {
  private readonly keywordIndex: SearchIndex;
  private readonly btree: BTree;
  private readonly tree: HashTree;
  private readonly root;
  private readonly prefix: string;
  private readonly metadataCache = new Map<string, SongFixture | null>();

  constructor(searchRoot: SerializedCid | null, prefix = 's:') {
    const store = new RemoteBlockStore();
    this.keywordIndex = new SearchIndex(store, { order: 64, minKeywordLength: 1 });
    this.btree = new BTree(store, { order: 64 });
    this.tree = new HashTree({ store });
    this.root = searchRoot
      ? {
          hash: fromHex(searchRoot.hash),
          key: searchRoot.key ? fromHex(searchRoot.key) : undefined,
        }
      : null;
    this.prefix = prefix;
  }

  async search(query: string, genreFilter = 'All', limit = 24): Promise<SongFixture[]> {
    if (!this.root || !query.trim()) return [];

    const queryTerms = this.keywordIndex.parseKeywords(query);
    if (queryTerms.length === 0) return [];
    const effectiveLimit = queryTerms.some((term) => term.length <= 1) ? Math.min(limit, 8) : limit;

    const rankedLinks = await this.collectRankedLinks(queryTerms, effectiveLimit);
    const songs = await Promise.all(rankedLinks.map(async ({ cid }) => this.readSong(cid)));

    return songs
      .filter((song): song is SongFixture => song !== null)
      .filter((song) => acceptSong(song, genreFilter))
      .slice(0, effectiveLimit);
  }

  private async collectRankedLinks(queryTerms: string[], limit: number): Promise<RankedLink[]> {
    const results = new Map<string, RankedLink>();

    for (const queryTerm of queryTerms) {
      const searchPrefix = `${this.prefix}${queryTerm}`;
      let scanned = 0;

      for await (const [key, cid] of this.btree.prefixLinks(this.root!, searchPrefix)) {
        if (scanned++ >= limit) break;

        const afterPrefix = key.slice(this.prefix.length);
        const colonIndex = afterPrefix.indexOf(':');
        if (colonIndex === -1) continue;

        const term = afterPrefix.slice(0, colonIndex);
        const id = afterPrefix.slice(colonIndex + 1);
        const exactMatch = term === queryTerm ? 1 : 0;
        const prefixDistance = Math.max(0, term.length - queryTerm.length);
        const existing = results.get(id);

        if (existing) {
          existing.score += 1;
          existing.exactMatches += exactMatch;
          existing.prefixDistance += prefixDistance;
        } else {
          results.set(id, {
            cid,
            score: 1,
            exactMatches: exactMatch,
            prefixDistance,
          });
        }
      }
    }

    return [...results.values()]
      .sort((left, right) => {
        if (right.score !== left.score) return right.score - left.score;
        if (right.exactMatches !== left.exactMatches) return right.exactMatches - left.exactMatches;
        if (left.prefixDistance !== right.prefixDistance) return left.prefixDistance - right.prefixDistance;
        return cidCacheKey(left.cid).localeCompare(cidCacheKey(right.cid));
      })
      .slice(0, limit);
  }

  private async readSong(cid: CID): Promise<SongFixture | null> {
    const cacheKey = cidCacheKey(cid);
    if (this.metadataCache.has(cacheKey)) {
      return this.metadataCache.get(cacheKey) ?? null;
    }

    try {
      const data = await this.tree.readFile(cid);
      if (!data) {
        this.metadataCache.set(cacheKey, null);
        return null;
      }

      const song = JSON.parse(new TextDecoder().decode(data)) as SongFixture;
      this.metadataCache.set(cacheKey, song);
      return song;
    } catch {
      this.metadataCache.set(cacheKey, null);
      return null;
    }
  }
}
