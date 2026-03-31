#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
IMAGE="electronuserland/builder:wine"

if ! command -v docker >/dev/null 2>&1; then
  echo "[build-win-docker] Docker nao encontrado no PATH"
  exit 1
fi

mkdir -p "$HOME/.cache/electron" "$HOME/.cache/electron-builder"

echo "[build-win-docker] Usando imagem: $IMAGE"
echo "[build-win-docker] Projeto: $ROOT_DIR"

docker run --rm \
  -e CSC_IDENTITY_AUTO_DISCOVERY=false \
  -e ELECTRON_CACHE=/root/.cache/electron \
  -e ELECTRON_BUILDER_CACHE=/root/.cache/electron-builder \
  -v "$ROOT_DIR:/project" \
  -v "$HOME/.cache/electron:/root/.cache/electron" \
  -v "$HOME/.cache/electron-builder:/root/.cache/electron-builder" \
  -w /project \
  "$IMAGE" \
  /bin/bash -lc "npm ci --include=optional && npm run build:win"

echo "[build-win-docker] Build finalizado. Verifique a pasta dist/."
