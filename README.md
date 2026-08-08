# ai-github-release-post-drafter

Turns a GitHub **release** webhook into a schema-locked LinkedIn + X draft markdown file (and optionally an approval PR). Nothing is auto-published.

Requires **Node 24+** and local **Ollama** (`gemma3:4b`).

## Quick start

```bash
cp .env.example .env   # or create .env — see below
ollama pull gemma3:4b
npm install
npm test
npm run dev
```

Server: `http://0.0.0.0:3000`  
Webhook: `POST /hooks/github`

Local demo without GitHub:

```bash
npm run replay -- --fixture fixtures/github/release.published.json
```

Writes one file under `drafts/` with `tier` + `ruleId` in the front-matter.

## Env

| Variable | Purpose |
|----------|---------|
| `GITHUB_WEBHOOK_SECRET` | HMAC secret (required) |
| `OLLAMA_HOST` / `OLLAMA_MODEL` | Default `gemma3:4b` |
| `IDEMPOTENCY_BACKEND` | `memory` (default) or `redis` |
| `REDIS_URL` | Needed if backend is `redis` |
| `OPEN_PR` | `true` to open an approval PR (default `false`) |
| `GITHUB_TOKEN` | Token with contents + pull-requests write |
| `GITHUB_REPO` | `owner/name` for the PR target |

## GitHub webhook

1. Expose local port 3000 (ngrok/smee).
2. Repo → Settings → Webhooks → Payload URL `https://<tunnel>/hooks/github`.
3. Content type: `application/json`.
4. Secret: same as `GITHUB_WEBHOOK_SECRET`.
5. Subscribe to **Release** events (Publish).

**Push / tag push is not enough.** A git tag fires `push`; this app only drafts on a published **Release** event.

## Flow

HMAC verify → claim `X-GitHub-Delivery` (idempotent) → ack 200 → classify (`tiering.yaml`) → enrich → draft with style guide → write `drafts/YYYY-MM-DD-slug.md` → optional PR (`OPEN_PR=true`).
