# iris-apps

Standalone workspace for Iris web apps.

Source: <https://git.iris.to/#/npub1xdhnr9mrv47kkrn95k6cwecearydeh8e895990n3acntwvmgk2dsdeeycm/iris-apps>

It contains the extracted portable Iris apps that used to live under
`hashtree/apps/`.

## Workspace

- `apps/iris-audio`: standalone audio catalog/player app for published hashtree manifests
- `apps/iris-files`: the main Svelte/Vite workspace for files, git, video, docs, maps, and boards
- `apps/iris-sites`: the isolated browser runtime for portable `htree://` sites
- `packages/hashtree`: local `@hashtree/core`
- `packages/hashtree-index`: local `@hashtree/index`
- `packages/hashtree-tree-root`: local `@hashtree/tree-root`
- `packages/hashtree-nostr`: local WebRTC/Nostr package kept in sync with the app
- `packages/ndk`: local NDK fork used by the app and worker stack
- `packages/ndk-cache`: local IndexedDB cache adapter for that NDK fork

## Usage

```bash
pnpm install
pnpm build
pnpm test
pnpm run test:audio
pnpm run test:sites:portable
```

## Install git-remote-htree

```bash
curl -fsSL https://upload.iris.to/npub1xdhnr9mrv47kkrn95k6cwecearydeh8e895990n3acntwvmgk2dsdeeycm/releases%2Fhashtree/latest/install.sh | sh
```

Cross-language E2E and release helpers look for sibling repos automatically:

- `../hashtree/rust`
- `../hashtree-ci`

You can override those with `HASHTREE_RUST_DIR`, `HASHTREE_REPO_ROOT`, and
`HASHTREE_CI_DIR`.
