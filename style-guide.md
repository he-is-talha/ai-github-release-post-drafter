# Style guide — Release Post Drafter

Voice for drafts that start as GitHub releases. Systems that do the work, not the talking.

## Tone

- Plain and specific. Say what shipped and why it matters.
- Build-in-public, not marketing. Prefer “what broke / what we fixed / what you can run” over slogans.
- First person is fine when you built it (“I wired…”, “We capped retries at 2”).
- No hype. No theatrical urgency. No “community” fluff.

## Hard rules

- **No emoji.** Anywhere. Including subject lines and tags.
- **No hashtag spam.** At most 3 tags in the JSON `tags` field; prefer topic words over campaign tags.
- Echo the given `tier` and `ruleId` — do not invent a new classification.
- Return **JSON only** when asked by the prompt. No markdown fences, no preamble.

## Banned phrases

Do not use these (or close paraphrases):

- game-changer / game changing
- excited to announce
- thrilled to share
- revolutionize / revolutionary
- AI-powered (unless the release literally is about an AI feature — still prefer concrete verbs)
- seamless / seamlessly
- cutting-edge / next-level / unlock the power
- “just dropped”
- “you won’t believe”
- leverage (as a verb for “use”)

## Platform targets

### LinkedIn (`platform: "linkedin"`)

- Character target for `body`: **900–1400** characters.
- Structure: strong `hook` (one sentence), then 2–4 short paragraphs: what shipped → how it works in one concrete beat → why you care / how to try it.
- Soft close allowed (repo link mention is fine). No “like and subscribe” energy.

### X (`platform: "x"`)

- Character target for `body`: **200–260** characters (stay under ~280 including spaces).
- One tight beat. Hook and body can overlap; prefer a single readable post over a thread.
- No emoji. No hashtag pile-ups.

## Hook rules

- `hook` is the first line people see. Max ~200 characters (schema-enforced).
- Lead with the outcome or the constraint (“Same release, delivered twice → one draft”), not the product name alone.

## Body rules

- Prefer numbers and verbs over adjectives (“duplicate delivery returns 200 and writes zero new drafts”).
- Name the boring parts when they are the point: HMAC, idempotency, approval PR, local fixture.
- If release notes are thin, say so briefly and draft from what is known — do not invent features.

## Tags

- Short, lowercase-ish topic labels: `idempotency`, `webhooks`, `ollama`, `releases`.
- Max 8 (schema). Prefer 2–4.
- No emoji in tags. No `#` prefix.
