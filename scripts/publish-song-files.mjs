import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const SONGS_DIR = process.env.SONGS_DIR ?? '/tmp/songs';
const OUT_FILE = process.env.OUT_FILE ?? '/tmp/songs-file-nhashes.json';
const CONCURRENCY = Number(process.env.CONCURRENCY ?? 6);

function parseUrl(stdout) {
  const match = stdout.match(/^\s*url:\s+(nhash1[^\s]+)$/m);
  if (!match) {
    throw new Error(`Failed to parse htree add output:\n${stdout}`);
  }
  return match[1];
}

async function listSongDirs() {
  const entries = await fs.readdir(SONGS_DIR, { withFileTypes: true });
  return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
}

async function loadExisting() {
  try {
    const raw = await fs.readFile(OUT_FILE, 'utf8');
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function publishSong(songDir, existing) {
  if (existing[songDir]) {
    return { songDir, url: existing[songDir], cached: true };
  }

  const filePath = path.join(SONGS_DIR, songDir, 'song.mp3');
  const { stdout } = await execFileAsync('htree', ['add', filePath], {
    maxBuffer: 1024 * 1024 * 8,
  });
  return { songDir, url: parseUrl(stdout), cached: false };
}

async function main() {
  const songDirs = await listSongDirs();
  const existing = await loadExisting();
  const result = { ...existing };
  let cursor = 0;
  let completed = 0;

  async function worker() {
    while (cursor < songDirs.length) {
      const songDir = songDirs[cursor++];
      const published = await publishSong(songDir, result);
      result[published.songDir] = published.url;
      completed += 1;
      if (completed % 25 === 0 || completed === songDirs.length) {
        await fs.writeFile(OUT_FILE, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
        console.log(`${completed}/${songDirs.length}`);
      }
    }
  }

  const workers = Array.from({ length: Math.max(1, CONCURRENCY) }, () => worker());
  await Promise.all(workers);
  await fs.writeFile(OUT_FILE, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  console.log(OUT_FILE);
}

await main();
