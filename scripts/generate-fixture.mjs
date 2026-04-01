import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const outDir = '/tmp/iris-audio-fixture';
const trackDir = join(outDir, 'tracks');

const demoCatalogSeed = [
  ['tidal-dawn', 'Tidal Dawn', 'Open Meridian', 'Coastline Cache', 'Ambient Electronica', 'uplift', 2026, 158, 108, 18234, '#ff784f', '#ffd166', 'TD', ['synth', 'guitar'], ['sunrise', 'coastal', 'warm'], { baseFrequency: 220, pulseFrequency: 440, padFrequency: 330, wobble: 2 }],
  ['cinder-loop', 'Cinder Loop', 'Public Static', 'Night Transit', 'Indie Electronic', 'night', 2025, 172, 114, 14392, '#fb7185', '#7c3aed', 'CL', ['drum machine', 'bass'], ['late-night', 'city', 'repeat'], { baseFrequency: 196, pulseFrequency: 392, padFrequency: 261.63, wobble: 4 }],
  ['glass-harbor', 'Glass Harbor', 'North Arcade', 'Soft Signals', 'Downtempo', 'drift', 2026, 206, 95, 9282, '#22c55e', '#06b6d4', 'GH', ['pads', 'keys'], ['water', 'reflective', 'calm'], { baseFrequency: 174.61, pulseFrequency: 349.23, padFrequency: 261.63, wobble: 1 }],
  ['relay-runner', 'Relay Runner', 'Mesh Theory', 'Packet Bloom', 'Synth Pop', 'uplift', 2026, 184, 122, 25740, '#38bdf8', '#f59e0b', 'RR', ['synth', 'claps'], ['motion', 'demo', 'momentum'], { baseFrequency: 246.94, pulseFrequency: 493.88, padFrequency: 329.63, wobble: 3 }],
  ['cedar-room', 'Cedar Room', 'Library Motel', 'Quiet Mirrors', 'Lo-fi House', 'focus', 2025, 191, 116, 12084, '#84cc16', '#facc15', 'CR', ['vinyl texture', 'bass'], ['study', 'desk', 'warm'], { baseFrequency: 207.65, pulseFrequency: 415.3, padFrequency: 311.13, wobble: 2 }],
  ['afterglow-index', 'Afterglow Index', 'Btree Hearts', 'Sorted Feelings', 'Dream Pop', 'drift', 2026, 214, 102, 18811, '#a78bfa', '#f472b6', 'AI', ['pads', 'lead synth'], ['search', 'romantic', 'mist'], { baseFrequency: 233.08, pulseFrequency: 466.16, padFrequency: 349.23, wobble: 1 }],
  ['paper-comet', 'Paper Comet', 'August Relay', 'Open Skies', 'Indie Pop', 'uplift', 2024, 165, 126, 16429, '#f97316', '#60a5fa', 'PC', ['guitar', 'snaps'], ['roadtrip', 'bright', 'chorus'], { baseFrequency: 261.63, pulseFrequency: 523.25, padFrequency: 392, wobble: 2 }],
  ['blue-hour-protocol', 'Blue Hour Protocol', 'Signal Bloom', 'Undercurrent', 'Chillwave', 'night', 2025, 201, 98, 11190, '#0ea5e9', '#6366f1', 'BP', ['pads', 'sub bass'], ['night-drive', 'cool', 'neon'], { baseFrequency: 185, pulseFrequency: 370, padFrequency: 277.18, wobble: 3 }],
  ['lantern-cache', 'Lantern Cache', 'Threadsafe', 'Harbor Memory', 'Acoustic Electronica', 'focus', 2026, 177, 110, 9731, '#f59e0b', '#10b981', 'LC', ['picked guitar', 'shaker'], ['fireside', 'acoustic', 'steady'], { baseFrequency: 220, pulseFrequency: 330, padFrequency: 293.66, wobble: 2 }],
  ['zero-knowledge-kiss', 'Zero-Knowledge Kiss', 'Cipher Season', 'Private Summer', 'Electro R&B', 'club', 2026, 188, 118, 22103, '#ec4899', '#8b5cf6', 'ZK', ['bass', 'vocal chops'], ['flirt', 'glossy', 'dance'], { baseFrequency: 164.81, pulseFrequency: 329.63, padFrequency: 246.94, wobble: 5 }],
  ['monarch-cacheline', 'Monarch Cacheline', 'Parallel Safari', 'Silk Compiler', 'Nu Disco', 'club', 2025, 196, 124, 20342, '#f43f5e', '#f59e0b', 'MC', ['disco bass', 'strings'], ['groove', 'festival', 'sparkle'], { baseFrequency: 196, pulseFrequency: 392, padFrequency: 293.66, wobble: 4 }],
  ['quiet-commit', 'Quiet Commit', 'Branch Motel', 'Review Window', 'Neo Soul', 'focus', 2026, 203, 90, 8840, '#14b8a6', '#f97316', 'QC', ['keys', 'soft bass'], ['review', 'slow', 'warm'], { baseFrequency: 174.61, pulseFrequency: 261.63, padFrequency: 220, wobble: 1 }],
  ['sapphire-echo', 'Sapphire Echo', 'Mirrored Lake', 'Elsewhere Club', 'Progressive House', 'club', 2026, 220, 128, 27412, '#06b6d4', '#38bdf8', 'SE', ['plucks', 'kick'], ['peak-time', 'festival', 'skyline'], { baseFrequency: 220, pulseFrequency: 440, padFrequency: 349.23, wobble: 5 }],
  ['porchlight-bloom', 'Porchlight Bloom', 'Open Meridian', 'Coastline Cache', 'Folk Pop', 'uplift', 2024, 169, 104, 15020, '#fb923c', '#34d399', 'PB', ['acoustic guitar', 'handclaps'], ['home', 'golden-hour', 'friendly'], { baseFrequency: 196, pulseFrequency: 293.66, padFrequency: 246.94, wobble: 1 }],
  ['memory-rain', 'Memory Rain', 'North Arcade', 'Soft Signals', 'Ambient', 'drift', 2025, 240, 78, 7640, '#60a5fa', '#a78bfa', 'MR', ['texture', 'pads'], ['rain', 'slow', 'sleep'], { baseFrequency: 155.56, pulseFrequency: 311.13, padFrequency: 233.08, wobble: 1 }],
  ['neon-thicket', 'Neon Thicket', 'Public Static', 'Night Transit', 'Electroclash', 'night', 2026, 179, 121, 19073, '#e879f9', '#22c55e', 'NT', ['drums', 'synth stab'], ['edgy', 'night', 'club'], { baseFrequency: 246.94, pulseFrequency: 493.88, padFrequency: 369.99, wobble: 4 }],
  ['soft-fork', 'Soft Fork', 'Mesh Theory', 'Packet Bloom', 'Minimal Techno', 'focus', 2026, 187, 120, 17002, '#94a3b8', '#22d3ee', 'SF', ['kick', 'pulse'], ['minimal', 'code', 'steady'], { baseFrequency: 130.81, pulseFrequency: 261.63, padFrequency: 196, wobble: 3 }],
  ['sundial-bus', 'Sundial Bus', 'August Relay', 'Open Skies', 'Alt Dance', 'uplift', 2025, 176, 119, 14658, '#fde047', '#fb7185', 'SB', ['bass', 'lead'], ['summer', 'movement', 'hook'], { baseFrequency: 233.08, pulseFrequency: 466.16, padFrequency: 349.23, wobble: 2 }],
].map(([id, title, artist, album, genre, mood, year, duration, bpm, plays, accent, secondaryAccent, coverSeed, instruments, tags, audio]) => ({
  id,
  title,
  artist,
  album,
  genre,
  mood,
  year,
  duration,
  bpm,
  plays,
  accent,
  secondaryAccent,
  coverSeed,
  instruments,
  tags,
  license: 'CC0 procedural demo track',
  audio,
}));

function encodeWav(samples, sampleRate) {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const writeString = (offset, value) => {
    for (let index = 0; index < value.length; index += 1) {
      view.setUint8(offset + index, value.charCodeAt(index));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, samples.length * 2, true);

  let offset = 44;
  for (const sample of samples) {
    const clamped = Math.max(-1, Math.min(1, sample));
    view.setInt16(offset, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
    offset += 2;
  }

  return Buffer.from(buffer);
}

function synthesize(song) {
  const sampleRate = 24_000;
  const seconds = Math.min(24, Math.max(14, Math.round(song.duration / 10)));
  const total = sampleRate * seconds;
  const samples = new Float32Array(total);
  const beat = 60 / song.bpm;

  for (let index = 0; index < total; index += 1) {
    const time = index / sampleRate;
    const beatPhase = (time % beat) / beat;
    const pulseEnvelope = Math.exp(-6 * beatPhase);
    const slowEnvelope = 0.55 + 0.45 * Math.sin((2 * Math.PI * time) / (seconds / 2));
    const wobble = Math.sin((2 * Math.PI * song.audio.wobble * time) / seconds);
    const bass = Math.sin(2 * Math.PI * song.audio.baseFrequency * time) * 0.26;
    const pulse = Math.sin(2 * Math.PI * song.audio.pulseFrequency * time) * pulseEnvelope * 0.18;
    const pad = Math.sin(2 * Math.PI * (song.audio.padFrequency + wobble * 3) * time) * 0.12 * slowEnvelope;
    const shimmer = Math.sin(2 * Math.PI * (song.audio.pulseFrequency / 2) * time * 1.01) * 0.05;
    samples[index] = bass + pulse + pad + shimmer;
  }

  return encodeWav(samples, sampleRate);
}

await rm(outDir, { recursive: true, force: true });
await mkdir(trackDir, { recursive: true });

const manifestSongs = [];

for (const song of demoCatalogSeed) {
  const filename = `${song.id}.wav`;
  await writeFile(join(trackDir, filename), synthesize(song));
  manifestSongs.push({
    ...song,
    audioUrl: `./tracks/${filename}`,
  });
}

await writeFile(
  join(outDir, 'manifest.json'),
  `${JSON.stringify({ generatedAt: new Date().toISOString(), songs: manifestSongs }, null, 2)}\n`,
);

console.log(outDir);
