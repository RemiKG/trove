---
name: trove-memory
version: 1.0.0
description: >
  Trove's persistent oral-history life-memory as a reusable Qwen Skill. Give any Qwen agent a
  first-class memory of a person's life that survives closed sessions and a cold model context:
  write typed life-records, recall the critical ones under a hard token budget (gilded canon
  first — not a transcript scan), reconcile contradictory tellings, decide the next best
  interview question, gild what matters, and forget the noise on purpose. One real engine, shared
  with the Trove app and MCP server.
triggers:
  - when the agent is interviewing or recording a person's life story across multiple sessions
  - when the agent must remember facts about a person and recall the right one later under a budget
  - when two tellings conflict and the truth must be reconciled, not silently overwritten
  - when the agent should decide what to ask next to fill the biggest gap in what it knows
license: MIT
---

# trove-memory — a life, kept

Trove owns a structured, vector-indexed life-store (typed records: `person · place · event · date ·
object · saying · value · relationship`, each with salience, valence, corroboration, a `canonical`
gilded flag, and links). This Skill exposes that store so **any** agent can use it. All scripts are
stdlib-only Node and call the running Trove app's tool endpoints (`/api/mcp/*`) — one real engine,
one source of truth. Set `TROVE_URL` (default `http://localhost:3000`) and `TROVE_ID` (the person's
trove id).

## The two rules Trove never breaks
- **Only what they actually said.** Never invent a memory to fill a gap — mark the gap and ask.
- **No voice-fabrication.** Voice capture is real ASR; voice-cloning is withheld / consent-gated.

## Tools (scripts/)

| Script | What it does |
|---|---|
| `recall.mjs "<question>"` | Embed the question, pull + rerank candidates, admit the top-K under a hard token budget (gilded canon first). Prints the memories + tokens spent vs a full-transcript replay. |
| `remember.mjs '<json records>'` | Write typed life-records (create or corroborate). `[{"type","name","detail","quote?","subject?","value?","canonical?"}]`. |
| `reconcile.mjs [<contradictionId> <value>]` | List open contradictions, or resolve one to the true version (gild the truth, dust the slip). |
| `next-question.mjs` | Decide the next best question — the biggest hole in the life. |
| `gild.mjs "<name or id>"` | Lock a memory as canon (never forgotten). |
| `forget.mjs [<tesseraId>]` | Lift one memory to dust, or run the decay pass. Reversible — nothing is destroyed. |

## Example loop (a Biographer turn)

```sh
export TROVE_URL=http://localhost:3000 TROVE_ID=nana-example
node scripts/recall.mjs "what was the dog's name?"          # → Biscuit, 38 tok, 0 transcripts replayed
node scripts/next-question.mjs                               # → biggest gap: mother (0 records)
node scripts/remember.mjs '[{"type":"relationship","name":"Her mother","detail":"Her mother had hands always floured to the wrist."}]'
node scripts/reconcile.mjs c_bakery Oak                      # → gilds Oak, dusts the Elm slip
```

The Trove app must be running (`npm run dev`). Under the hood every core inference (extraction,
reconciliation, embed+rerank recall) runs on **Qwen Cloud** (`dashscope-intl`) when a key is set,
and on Trove's local brain otherwise — the store and the tool surface are identical either way.
