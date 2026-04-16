---
name: llm-wiki-maintainer
description: "Use when ingesting sources into the game_hub5 LLM wiki, querying project knowledge from wiki pages, or linting wiki consistency."
---

# game_hub5 LLM Wiki Maintainer

Maintain the repo-tracked Karpathy-style wiki for `game_hub5`.

## Scope

- Immutable source captures live in `raw/`.
- Compiled project knowledge lives in `wiki/`.
- Repo rules live in `AGENTS.md`.
- Provenance inventory lives in `raw/source-index.md`.

## Source Precedence

1. Current code plus active repo docs for current state.
2. Latest user-approved conversation for intended direction.
3. Older threads and chats for provenance and rationale.

Never collapse a disagreement silently. If current state and intended direction differ, keep both and update `wiki/history/split-decisions.md`.

## Allowed Writes

Wiki maintenance may write only:

- `raw/`
- `wiki/`
- `.agents/skills/llm-wiki-maintainer/`
- wiki-specific operating rules in `AGENTS.md`

Do not modify application/runtime source files during wiki-only maintenance.

## Ingest

When adding a new source:

1. Capture it into `raw/` without rewriting source meaning.
2. Add or refresh its row in `raw/source-index.md`.
3. Update every materially affected wiki page.
4. Update `wiki/index.md`.
5. Append an entry to `wiki/log.md`.

Use the fixed article template already present in the wiki:

- metadata: `title`, `topic`, `kind`, `status`, `updated`, `confidence`
- sections: `Summary`, `Current State`, `Intended Direction`, `Key Decisions`, `Deferred / Open`, `Sources`, `Raw`

## Query

When answering from the wiki:

1. Read `wiki/index.md` first.
2. Read the relevant article pages.
3. Prefer wiki content over rediscovery.
4. Verify against code or repo docs before presenting current implementation facts.
5. If the answer creates durable project knowledge, file it back into `wiki/` when asked.

## Lint

Check for:

- missing or stale `raw/source-index.md` entries
- index entries missing from `wiki/index.md`
- broken wiki links
- domain pages that no longer match current code/docs
- open splits missing from `wiki/history/split-decisions.md`

Auto-fix structural issues when safe. Report semantic contradictions when judgment is required.

## Automation Rules

- Run wiki refresh work on branch `codex/llm-wiki`.
- Allowed refresh outputs are the same as the allowed-write set above.
- If an external fetch fails:
  - keep existing wiki content unchanged
  - append a failure note to `wiki/log.md`
  - mark the affected source stale in `raw/source-index.md`
  - continue processing the remaining sources
- If refresh work changes the wiki, use the commit message format:
  - `docs(wiki): auto-refresh YYYY-MM-DD HH:mm`

