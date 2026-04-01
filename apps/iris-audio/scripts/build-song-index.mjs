import fs from 'node:fs/promises';
import path from 'node:path';
import { finalizeEvent, generateSecretKey } from 'nostr-tools/pure';
import { BlossomStore, HashTree, LinkType, MemoryStore, nhashEncode, toHex } from '@hashtree/core';
import { SearchIndex } from '@hashtree/index';

const SONGS_DIR = process.env.SONGS_DIR ?? '/tmp/songs';
const AUDIO_URLS_FILE = process.env.AUDIO_URLS_FILE ?? '/tmp/songs-file-nhashes.json';
const LOG_FILE = process.env.LOG_FILE ?? '/tmp/iris-audio-index.log';
const RESULT_FILE = process.env.RESULT_FILE ?? '/tmp/iris-audio-index-result.json';
const STATE_FILE = process.env.STATE_FILE ?? '/tmp/iris-audio-index-state.json';
const BLOSSOM_SERVERS = (process.env.BLOSSOM_SERVERS ?? 'https://upload.iris.to,https://cdn.iris.to,https://hashtree.iris.to')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean)
  .map((url) => ({
    url,
    write: url.includes('upload.'),
    read: !url.includes('upload.'),
  }));
const PUSH_CONCURRENCY = Number(process.env.PUSH_CONCURRENCY ?? 16);
const INDEX_PROGRESS_EVERY = Number(process.env.INDEX_PROGRESS_EVERY ?? 50);
const DISCOVER_PROGRESS_EVERY = Number(process.env.DISCOVER_PROGRESS_EVERY ?? 100);
const PUSH_PROGRESS_EVERY = Number(process.env.PUSH_PROGRESS_EVERY ?? 100);

async function log(message, data) {
  const line = `[${new Date().toISOString()}] ${message}${data === undefined ? '' : ` ${JSON.stringify(data)}`}\n`;
  process.stderr.write(line);
  if (LOG_FILE) {
    await fs.appendFile(LOG_FILE, line, 'utf8');
  }
}

async function loadResumeState(rootNhash) {
  if (!STATE_FILE) {
    return new Set();
  }
  try {
    const raw = JSON.parse(await fs.readFile(STATE_FILE, 'utf8'));
    if (raw?.rootNhash !== rootNhash || !Array.isArray(raw.completedHashes)) {
      return new Set();
    }
    return new Set(raw.completedHashes);
  } catch {
    return new Set();
  }
}

async function saveResumeState(rootNhash, completedHashes) {
  if (!STATE_FILE) {
    return;
  }
  await fs.writeFile(STATE_FILE, `${JSON.stringify({
    rootNhash,
    completedHashes: [...completedHashes].sort(),
    updatedAt: new Date().toISOString(),
  }, null, 2)}\n`, 'utf8');
}

async function collectBlocks(tree, rootCid) {
  const blocks = [];
  let discovered = 0;
  for await (const block of tree.walkBlocks(rootCid)) {
    blocks.push(block);
    discovered += 1;
    if (discovered % DISCOVER_PROGRESS_EVERY === 0) {
      await log('discovered blocks', { completed: discovered });
    }
  }
  await log('discovered blocks', { completed: discovered });
  return blocks;
}

async function uploadBlocks(targetStore, blocks, rootNhash) {
  const completedHashes = await loadResumeState(rootNhash);
  let pushed = 0;
  let skipped = 0;
  let failed = 0;
  let bytes = 0;
  let processed = 0;
  const errors = [];

  let nextIndex = 0;
  let lastLoggedProgress = -1;

  async function flushState() {
    await saveResumeState(rootNhash, completedHashes);
  }

  async function processBlock(block) {
    const hashHex = toHex(block.hash);
    if (completedHashes.has(hashHex)) {
      skipped += 1;
      processed += 1;
      return;
    }

    try {
      if (await targetStore.has(block.hash)) {
        skipped += 1;
      } else {
        const stored = await targetStore.put(block.hash, block.data, 'application/octet-stream');
        if (stored === false) {
          skipped += 1;
        } else {
          pushed += 1;
          bytes += block.data.length;
        }
      }
      completedHashes.add(hashHex);
      processed += 1;
      if (processed === blocks.length || processed - lastLoggedProgress >= PUSH_PROGRESS_EVERY) {
        lastLoggedProgress = processed;
        await log('push progress', {
          processed,
          total: blocks.length,
          pushed,
          skipped,
          failed,
        });
        await flushState();
      }
    } catch (error) {
      failed += 1;
      processed += 1;
      const message = error instanceof Error ? error.message : String(error);
      errors.push({ hash: hashHex, error: message });
      await log('push block error', { hash: hashHex, error: message });
      await flushState();
    }
  }

  async function worker() {
    while (nextIndex < blocks.length) {
      const currentIndex = nextIndex++;
      if (currentIndex >= blocks.length) {
        return;
      }
      await processBlock(blocks[currentIndex]);
    }
  }

  const workers = Array.from({ length: Math.max(1, PUSH_CONCURRENCY) }, () => worker());
  await Promise.all(workers);
  await flushState();

  return {
    pushed,
    skipped,
    failed,
    bytes,
    cancelled: false,
    errors,
  };
}

async function loadSongs() {
  const audioUrls = JSON.parse(await fs.readFile(AUDIO_URLS_FILE, 'utf8'));
  const entries = await fs.readdir(SONGS_DIR, { withFileTypes: true });
  const songs = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const songDir = path.join(SONGS_DIR, entry.name);
    const metadataPath = path.join(songDir, 'metadata.json');
    const raw = await fs.readFile(metadataPath, 'utf8');
    const metadata = JSON.parse(raw);
    const sourceTrackId = Number(metadata.sourceTrackId ?? 0);
    songs.push({
      id: `fma-${String(sourceTrackId).padStart(6, '0')}`,
      title: metadata.title,
      artist: metadata.artist,
      album: metadata.album,
      genre: metadata.genre,
      mood: metadata.mood,
      year: metadata.year,
      duration: metadata.duration,
      bpm: 80 + (sourceTrackId % 80),
      plays: metadata.plays,
      accent: metadata.accent,
      secondaryAccent: metadata.secondaryAccent,
      coverSeed: metadata.coverSeed,
      license: metadata.license,
      instruments: Array.isArray(metadata.instruments) ? metadata.instruments : [],
      tags: Array.isArray(metadata.tags) ? metadata.tags : [],
      audio: metadata.audio,
      audioUrl: audioUrls[entry.name],
    });
  }
  songs.sort((left, right) => right.plays - left.plays || right.year - left.year);
  return songs;
}

function acceptSong(song, genreFilter) {
  if (genreFilter === 'All') return true;
  const acceptedGenre = genreFilter.toLowerCase();
  if (acceptedGenre === 'club') return song.mood === 'club';
  if (acceptedGenre === 'focus') return song.mood === 'focus';
  return `${song.genre}`.toLowerCase().includes(acceptedGenre);
}

async function build() {
  if (LOG_FILE) {
    await fs.writeFile(LOG_FILE, '', 'utf8');
  }
  await log('starting build', {
    songsDir: SONGS_DIR,
    audioUrlsFile: AUDIO_URLS_FILE,
    pushConcurrency: PUSH_CONCURRENCY,
  });

  const store = new MemoryStore();
  const tree = new HashTree({ store });
  const searchIndex = new SearchIndex(store, { order: 64 });
  const songs = await loadSongs();
  await log('loaded songs', { count: songs.length });

  let root = null;
  const encoder = new TextEncoder();
  for (const [index, song] of songs.entries()) {
    const terms = searchIndex.parseKeywords([song.title, song.artist].join(' '));
    const metadataCid = (await tree.putFile(encoder.encode(JSON.stringify(song)))).cid;
    root = await searchIndex.indexLink(root, 's:', terms, song.id, metadataCid);
    if ((index + 1) % INDEX_PROGRESS_EVERY === 0 || index === songs.length - 1) {
      await log('indexed songs', { completed: index + 1, total: songs.length });
    }
  }

  const featuredSongs = songs.slice(0, 24);
  const librarySongs = [...songs].slice(0, 18);
  const recentSongs = [...songs].sort((left, right) => right.year - left.year || right.plays - left.plays).slice(0, 12);
  const chips = ['All', 'Electronic', 'Rock', 'Hip-Hop', 'Instrumental', 'Club', 'Focus'];
  const shelves = Object.fromEntries(chips.map((chip) => [chip, songs.filter((song) => acceptSong(song, chip)).slice(0, 12)]));

  const payload = {
    version: 1,
    prefix: 's:',
    songCount: songs.length,
    generatedAt: new Date().toISOString(),
    searchRoot: root ? { hash: toHex(root.hash), key: root.key ? toHex(root.key) : undefined } : null,
    featuredSongs,
    librarySongs,
    recentSongs,
    shelves,
  };

  const rootJson = new TextEncoder().encode(`${JSON.stringify(payload, null, 2)}\n`);
  const rootJsonCid = (await tree.putFile(rootJson)).cid;
  let bootstrapRoot = (await tree.putDirectory([])).cid;
  bootstrapRoot = await tree.setEntry(bootstrapRoot, [], 'root.json', rootJsonCid, rootJson.byteLength, LinkType.Blob);
  if (root) {
    bootstrapRoot = await tree.setEntry(bootstrapRoot, [], '.search', root, 0, LinkType.Dir);
  }
  const bootstrapNhash = nhashEncode(bootstrapRoot);
  await log('built bootstrap root', {
    nhash: bootstrapNhash,
    searchRoot: root ? { hash: toHex(root.hash), key: root.key ? toHex(root.key) : undefined } : null,
  });

  const signerSecret = generateSecretKey();
  const targetStore = new BlossomStore({
    servers: BLOSSOM_SERVERS,
    signer: async (template) => {
      const event = finalizeEvent({
        ...template,
        kind: template.kind,
        created_at: template.created_at,
        content: template.content,
        tags: template.tags,
      }, signerSecret);
      return {
        kind: event.kind,
        created_at: event.created_at,
        content: event.content,
        tags: event.tags,
        pubkey: event.pubkey,
        id: event.id,
        sig: event.sig,
      };
    },
  });

  const blocks = await collectBlocks(tree, bootstrapRoot);
  await log('starting resumable push', {
    rootNhash: bootstrapNhash,
    totalBlocks: blocks.length,
    stateFile: STATE_FILE,
  });
  const stats = await uploadBlocks(targetStore, blocks, bootstrapNhash);
  const rootUrl = `htree://${bootstrapNhash}/root.json`;
  const result = {
    songs: songs.length,
    root: {
      nhash: bootstrapNhash,
      url: rootUrl,
    },
    searchRoot: root ? { hash: toHex(root.hash), key: root.key ? toHex(root.key) : undefined } : null,
    push: {
      pushed: stats.pushed,
      skipped: stats.skipped,
      failed: stats.failed,
      bytes: stats.bytes,
      cancelled: stats.cancelled,
      errors: stats.errors.length,
    },
  };
  if (RESULT_FILE) {
    await fs.writeFile(RESULT_FILE, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  }
  await log('build complete', result);
  console.log(JSON.stringify(result, null, 2));
}

await build();
