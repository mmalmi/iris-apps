#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
REPO_ROOT="$(cd "${APP_DIR}/../.." && pwd)"
DOCKERFILE="${SCRIPT_DIR}/Dockerfile.e2e-linux"
IMAGE_NAME="${IRIS_FILES_E2E_DOCKER_IMAGE:-hashtree/iris-files-e2e}"
SHM_SIZE="${IRIS_FILES_E2E_DOCKER_SHM_SIZE:-2g}"
DEFAULT_WORKERS="${PW_MAX_WORKERS:-4}"
DOCKER_ENV_ARGS=()
RUN_COMMAND="pnpm run test:e2e"

case "${IRIS_FILES_E2E_DOCKER_PLATFORM:-}" in
  "")
    case "$(uname -m)" in
      arm64|aarch64)
        PLATFORM="linux/arm64"
        ;;
      x86_64|amd64)
        PLATFORM="linux/amd64"
        ;;
      *)
        PLATFORM="linux/amd64"
        ;;
    esac
    ;;
  *)
    PLATFORM="${IRIS_FILES_E2E_DOCKER_PLATFORM}"
    ;;
esac

while IFS='=' read -r name _; do
  case "${name}" in
    HTREE_*|IRIS_*|PLAYWRIGHT_*|PW_*|RUST_*|CARGO_*|VITE_*)
      DOCKER_ENV_ARGS+=(-e "${name}")
      ;;
  esac
done < <(env)

if [[ "${1:-}" == "--" ]]; then
  shift
fi

if [[ "$#" -gt 0 ]]; then
  printf -v RUN_COMMAND '%q ' "$@"
  RUN_COMMAND="${RUN_COMMAND% }"
fi

RUN_COMMAND="PW_MAX_WORKERS=${DEFAULT_WORKERS} ${RUN_COMMAND}"

HASHTREE_REPO_ROOT_HOST="${HASHTREE_REPO_ROOT:-}"

HASHTREE_CI_DIR_HOST="${HASHTREE_CI_DIR:-}"

docker build \
  --platform "${PLATFORM}" \
  -f "${DOCKERFILE}" \
  -t "${IMAGE_NAME}" \
  "${SCRIPT_DIR}"

docker_run_args=(
  docker run --rm
  --platform "${PLATFORM}"
  --ipc=host
  --shm-size "${SHM_SIZE}"
)

if ((${#DOCKER_ENV_ARGS[@]})); then
  docker_run_args+=("${DOCKER_ENV_ARGS[@]}")
fi

if [[ -n "${HASHTREE_REPO_ROOT_HOST}" ]]; then
  docker_run_args+=(
    -v "${HASHTREE_REPO_ROOT_HOST}:/workspace/external/hashtree"
    -e "HASHTREE_REPO_ROOT=/workspace/external/hashtree"
    -e "HASHTREE_RUST_DIR=/workspace/external/hashtree/rust"
  )
fi

if [[ -n "${HASHTREE_CI_DIR_HOST}" ]]; then
  docker_run_args+=(
    -v "${HASHTREE_CI_DIR_HOST}:/workspace/external/hashtree-ci"
    -e "HASHTREE_CI_DIR=/workspace/external/hashtree-ci"
  )
fi

docker_run_args+=(
  -e "IRIS_FILES_DOCKER_COMMAND=${RUN_COMMAND}"
  -v "${REPO_ROOT}:/workspace"
  -v iris-apps-node-modules:/workspace/node_modules
  -v iris-apps-iris-files-node-modules:/workspace/apps/iris-files/node_modules
  -v iris-apps-hashtree-node-modules:/workspace/packages/hashtree/node_modules
  -v iris-apps-hashtree-index-node-modules:/workspace/packages/hashtree-index/node_modules
  -v iris-apps-hashtree-tree-root-node-modules:/workspace/packages/hashtree-tree-root/node_modules
  -v iris-apps-hashtree-nostr-node-modules:/workspace/packages/hashtree-nostr/node_modules
  -v iris-apps-ndk-node-modules:/workspace/packages/ndk/node_modules
  -v iris-apps-ndk-cache-node-modules:/workspace/packages/ndk-cache/node_modules
  -v iris-apps-pnpm-store:/pnpm/store
  -v iris-apps-cargo-registry:/root/.cargo/registry
  -v iris-apps-cargo-git:/root/.cargo/git
  -w /workspace/apps/iris-files
  "${IMAGE_NAME}"
  bash -lc '
    set -euo pipefail
    pnpm config set store-dir /pnpm/store
    pnpm install --no-frozen-lockfile
    eval "${IRIS_FILES_DOCKER_COMMAND}"
  '
)

"${docker_run_args[@]}"
