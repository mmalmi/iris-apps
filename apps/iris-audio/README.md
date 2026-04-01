# Iris Audio

Spotify-like responsive audio demo app for Hashtree.

This app now lives inside the `iris-apps` workspace at `apps/iris-audio`.

## What is here

- Standalone Svelte + Vite app in its own repo
- Seed metadata plus an external fixture generator/publisher flow
- B-tree-backed search over titles, artists, albums, genres, moods, instruments, and tags
- Responsive desktop/mobile layout with a persistent player

## Development

```bash
pnpm install
pnpm --filter iris-audio dev
```

## Verification

```bash
pnpm --filter iris-audio build
pnpm --filter iris-audio test
```

## Fixture Publishing

Generate the demo catalog outside the repo and publish from `/tmp`:

```bash
pnpm --filter iris-audio fixture:generate
htree add /tmp/iris-audio-fixture --publish iris-audio-demo
```

Load a published manifest at runtime without rebuilding:

```bash
pnpm dev
# then open:
# http://127.0.0.1:4178/?catalog=htree://.../manifest.json
```

## Notes

- The repo does not need checked-in audio blobs.
- When no external manifest URL is configured, the app falls back to synthesized local demo audio.
