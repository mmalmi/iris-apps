# iris-apps

Standalone workspace for Iris web apps.

Right now it contains `apps/iris-files`, extracted from the main `hashtree`
repo without deleting the original copy there yet.

## Workspace

- `apps/iris-files`: the Svelte/Vite app
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
