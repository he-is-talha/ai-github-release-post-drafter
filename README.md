# ai-github-release-post-drafter

Turns a GitHub **release** webhook into a schema-locked LinkedIn + X draft markdown file (and optionally an approval PR). Nothing is auto-published.

Requires **Node 24+** and **Ollama** with `gemma3:4b` (use your local install).

## Quick start

```bash
cp .env.example .env
ollama pull gemma3:4b
npm install
npm test
npm run dev
```

Server: `http://0.0.0.0:3000` · Webhook: `POST /hooks/github`

### Local fixture demo (no GitHub)

```bash
./scripts/pull-model.sh   # host ollama pull gemma3:4b
./scripts/demo.sh         # replay published fixture → drafts/*.md
```

Or:

```bash
npm run replay -- --fixture fixtures/github/release.published.json
```

### Docker (Redis + app; host Ollama)

Default compose **does not** start Ollama — it expects Ollama on the host.

```bash
cp .env.example .env
docker compose up -d --build    # redis + app
./scripts/demo.sh               # uses host Ollama + writes ./drafts
```

Optional in-compose Ollama (not needed if you already run Ollama locally):

```bash
docker compose --profile with-ollama up -d
```

## Env

| Variable | Purpose |
|----------|---------|
| `GITHUB_WEBHOOK_SECRET` | HMAC secret (required) |
| `OLLAMA_HOST` / `OLLAMA_MODEL` | Default model `gemma3:4b` |
| `IDEMPOTENCY_BACKEND` | `memory` (default) or `redis` |
| `REDIS_URL` | Needed if backend is `redis` |
| `OPEN_PR` | `true` to open an approval PR (default `false`) |
| `GITHUB_TOKEN` / `GITHUB_REPO` | PR open (contents + pull-requests write) |

## GitHub webhook

1. Expose port 3000 (ngrok/smee).
2. Payload URL: `https://<tunnel>/hooks/github`
3. Secret = `GITHUB_WEBHOOK_SECRET`; content type JSON.
4. Subscribe to **Release** events.

**Push / tag push is not enough** — publish a GitHub **Release**.

## Flow

HMAC verify → claim `X-GitHub-Delivery` → ack 200 → classify (`tiering.yaml`) → enrich → draft → `drafts/YYYY-MM-DD-slug.md` → optional PR.
