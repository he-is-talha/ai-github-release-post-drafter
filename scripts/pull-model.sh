#!/usr/bin/env bash
# Pull gemma3:4b into the local (host) Ollama. Do not require Docker Ollama.
set -euo pipefail

MODEL="${OLLAMA_MODEL:-gemma3:4b}"
HOST="${OLLAMA_HOST:-http://127.0.0.1:11434}"

echo "Pulling ${MODEL} via local ollama (OLLAMA_HOST=${HOST})..."
if command -v ollama >/dev/null 2>&1; then
  ollama pull "${MODEL}"
else
  echo "ollama CLI not found; trying HTTP pull is not supported — install Ollama first." >&2
  exit 1
fi

echo "Done. Model ${MODEL} ready."
