#!/usr/bin/env bash
# Fixture demo against local Ollama. Redis is optional (compose brings it up for the app).
# Does NOT start Docker Ollama — use host Ollama.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

MODEL="${OLLAMA_MODEL:-gemma3:4b}"
OLLAMA_HOST="${OLLAMA_HOST:-http://127.0.0.1:11434}"
DELIVERY_ID="demo-$(date +%s)"
DRAFTS_DIR="${DRAFTS_DIR:-$ROOT/drafts}"

echo "==> Checking local Ollama at ${OLLAMA_HOST}"
for i in $(seq 1 30); do
  if curl -sf "${OLLAMA_HOST}/api/tags" >/dev/null; then
    break
  fi
  if [[ "$i" -eq 30 ]]; then
    echo "Ollama not reachable at ${OLLAMA_HOST}. Start it locally, then re-run." >&2
    exit 1
  fi
  sleep 1
done

if command -v ollama >/dev/null 2>&1; then
  ollama pull "${MODEL}" >/dev/null
fi

mkdir -p "${DRAFTS_DIR}"
BEFORE="$(find "${DRAFTS_DIR}" -maxdepth 1 -name '*.md' | wc -l | tr -d ' ')"

echo "==> Replaying published release fixture (model=${MODEL})"
export OLLAMA_HOST OLLAMA_MODEL="${MODEL}"
npm run replay -- \
  --fixture fixtures/github/release.published.json \
  --delivery-id "${DELIVERY_ID}" \
  --drafts-dir "${DRAFTS_DIR}"

AFTER="$(find "${DRAFTS_DIR}" -maxdepth 1 -name '*.md' | wc -l | tr -d ' ')"
if [[ "${AFTER}" -le "${BEFORE}" ]]; then
  echo "Expected a new drafts/*.md file; none appeared." >&2
  exit 1
fi

NEW_FILE="$(ls -t "${DRAFTS_DIR}"/*.md | head -1)"
echo "==> Wrote ${NEW_FILE}"
grep -q 'tier:' "${NEW_FILE}"
grep -q 'ruleId:' "${NEW_FILE}"
echo "==> Demo OK (gemma3:4b / local Ollama)"
