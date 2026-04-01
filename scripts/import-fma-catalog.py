#!/usr/bin/env python3
import csv
import hashlib
import json
import os
import shutil
import zipfile
from pathlib import Path

SOURCE_DIR = Path('/tmp/iris-audio-source')
OUT_DIR = Path('/tmp/iris-audio-catalog')
META_ZIP = SOURCE_DIR / 'fma_metadata.zip'
SMALL_ZIP = SOURCE_DIR / 'fma_small.zip'
LIMIT = 1000


def parse_header(reader):
    level0 = next(reader)
    level1 = next(reader)
    next(reader)  # index row
    headers = []
    for left, right in zip(level0, level1):
        if not left:
            headers.append(right or 'track_id')
        else:
            headers.append(f'{left}.{right}')
    return headers


def parse_tags(value: str):
    value = value.strip()
    if not value or value == '[]':
        return []
    value = value.strip('[]')
    if not value:
        return []
    return [part.strip().strip("'").strip('"') for part in value.split(',') if part.strip()]


def int_or(value: str, default: int):
    try:
        return int(float(value))
    except Exception:
        return default


def derive_colors(seed: str):
    digest = hashlib.sha256(seed.encode('utf-8')).hexdigest()
    hue_a = int(digest[:2], 16) % 360
    hue_b = (hue_a + 48 + int(digest[2:4], 16) % 60) % 360
    return f'hsl({hue_a} 72% 54%)', f'hsl({hue_b} 68% 48%)'


def derive_cover_seed(title: str, artist: str):
    source = f'{artist} {title}'.strip()
    words = [token for token in source.replace('-', ' ').split() if token]
    if not words:
      return 'IA'
    if len(words) == 1:
      return words[0][:2].upper()
    return f'{words[0][0]}{words[1][0]}'.upper()


def derive_mood(genre: str):
    value = (genre or '').lower()
    if any(word in value for word in ['electronic', 'dance', 'house', 'techno']):
        return 'club'
    if any(word in value for word in ['ambient', 'experimental', 'soundtrack']):
        return 'drift'
    if any(word in value for word in ['folk', 'acoustic', 'country']):
        return 'uplift'
    if any(word in value for word in ['jazz', 'instrumental', 'classical']):
        return 'focus'
    if any(word in value for word in ['rock', 'punk', 'metal', 'hip-hop']):
        return 'night'
    return 'uplift'


def derive_audio_meta(track_id: int):
    base = 120 + (track_id % 180)
    return {
        'baseFrequency': base,
        'pulseFrequency': base * 2,
        'padFrequency': int(base * 1.5),
        'wobble': (track_id % 5) + 1,
    }


def choose_tracks():
    with zipfile.ZipFile(META_ZIP) as zf:
        with zf.open('fma_metadata/tracks.csv') as raw:
            reader = csv.reader((line.decode('utf-8', 'replace') for line in raw))
            headers = parse_header(reader)
            rows = []
            for row in reader:
                if not row:
                    continue
                record = dict(zip(headers, row))
                if record.get('set.subset') != 'small':
                    continue
                track_id = int_or(record.get('track_id', ''), 0)
                if not track_id:
                    continue
                rows.append({
                    'track_id': track_id,
                    'title': record.get('track.title') or f'Track {track_id}',
                    'artist': record.get('artist.name') or 'Unknown Artist',
                    'album': record.get('album.title') or 'Unknown Album',
                    'genre': record.get('track.genre_top') or 'Unknown',
                    'year': int_or((record.get('album.date_released') or record.get('track.date_created') or '2000')[:4], 2000),
                    'duration': int_or(record.get('track.duration', ''), 30),
                    'plays': int_or(record.get('track.listens', ''), 0),
                    'license': record.get('track.license') or 'Creative Commons',
                    'tags': parse_tags(record.get('track.tags', '')),
                })

    rows.sort(key=lambda item: (-item['plays'], item['track_id']))
    return rows[:LIMIT]


def extract_tracks(selected):
    tracks_dir = OUT_DIR / 'tracks'
    if OUT_DIR.exists():
        shutil.rmtree(OUT_DIR)
    tracks_dir.mkdir(parents=True, exist_ok=True)

    songs = []
    with zipfile.ZipFile(SMALL_ZIP) as zf:
        for item in selected:
            track_id = item['track_id']
            member = f"fma_small/{track_id // 1000:03d}/{track_id:06d}.mp3"
            target = tracks_dir / f'{track_id:06d}.mp3'
            with zf.open(member) as src, target.open('wb') as dst:
                shutil.copyfileobj(src, dst, 1024 * 1024)

            accent, secondary = derive_colors(f"{item['artist']} {item['title']}")
            songs.append({
                'id': f"fma-{track_id:06d}",
                'title': item['title'],
                'artist': item['artist'],
                'album': item['album'],
                'genre': item['genre'],
                'mood': derive_mood(item['genre']),
                'year': item['year'],
                'duration': item['duration'],
                'bpm': 80 + (track_id % 80),
                'plays': item['plays'],
                'accent': accent,
                'secondaryAccent': secondary,
                'coverSeed': derive_cover_seed(item['title'], item['artist']),
                'license': item['license'],
                'instruments': [],
                'tags': item['tags'],
                'audio': derive_audio_meta(track_id),
                'audioUrl': f'./tracks/{track_id:06d}.mp3',
            })
    return songs


def main():
    if not META_ZIP.exists():
        raise SystemExit(f'Missing {META_ZIP}')
    if not SMALL_ZIP.exists():
        raise SystemExit(f'Missing {SMALL_ZIP}')

    selected = choose_tracks()
    songs = extract_tracks(selected)
    payload = {
        'source': 'FMA small dataset',
        'license': 'Creative Commons licensed audio from Free Music Archive dataset',
        'songCount': len(songs),
        'songs': songs,
    }
    (OUT_DIR / 'manifest.json').write_text(json.dumps(payload, indent=2) + '\n', encoding='utf-8')
    print(str(OUT_DIR))
    print(f'songs={len(songs)}')


if __name__ == '__main__':
    main()
