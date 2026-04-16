---
title: Wiki Maintenance
topic: workflow
kind: workflow
status: active
updated: 2026-04-15
confidence: high
---

## Summary

The wiki uses the Karpathy-style raw/wiki/schema split. `raw/` stores immutable captures, `wiki/` stores compiled project knowledge, and `AGENTS.md` plus the repo-local skill define ingest/query/lint behavior.

## Current State

- `raw/` contains source captures for repo docs, code landmarks, Codex threads, ChatGPT chats, and external workflow references.
- `raw/source-index.md` is the provenance table for all tracked source inputs.
- `wiki/` uses one-level topic directories plus `wiki/index.md` and `wiki/log.md`.
- Wiki articles use fixed metadata and sections:
  - metadata: `title`, `topic`, `kind`, `status`, `updated`, `confidence`
  - sections: `Summary`, `Current State`, `Intended Direction`, `Key Decisions`, `Deferred / Open`, `Sources`, `Raw`
- There is no embedding store or separate RAG layer in V1.

## Intended Direction

- Ingest should always do both steps: capture the source into `raw/` and update the compiled knowledge in `wiki/`.
- Query should read `wiki/index.md` first, then the relevant pages, then verify against code/docs if a current-state answer is needed.
- Lint should keep index, links, raw references, and split tracking healthy.
- Automation should refresh the wiki hourly on `codex/llm-wiki` and never touch application runtime/source files.

## Key Decisions

- `raw/` is immutable source capture. New captures are added; source meaning is not rewritten.
- `wiki/` is editable compiled knowledge. It should be updated whenever project understanding changes materially.
- When sources disagree, annotate the disagreement and keep both current state and intended direction visible.
- External fetch failure behavior is non-destructive:
  - keep existing wiki content
  - append a failure note to `wiki/log.md`
  - mark the source stale in `raw/source-index.md`
  - continue with other sources
- Allowed wiki-maintenance writes are limited to `raw/`, `wiki/`, `.agents/skills/llm-wiki-maintainer/`, and wiki-specific rules in `AGENTS.md`.

## Deferred / Open

- Search still depends on index-first navigation rather than a dedicated local search tool.
- Future linting may add stronger automatic link or contradiction checks if scale demands it.

## Sources

- [AGENTS.md](../../AGENTS.md)
- [raw/source-index.md](../../raw/source-index.md)
- [wiki/index.md](../index.md)
- [wiki/log.md](../log.md)

## Raw

- [EXT-KARPATHY-GIST](../../raw/external/2026-04-15-karpathy-llm-wiki-gist.md)
- [EXT-WIKI-SKILL](../../raw/external/2026-04-15-karpathy-llm-wiki-skill.md)
- [EXT-WIKI-README](../../raw/external/2026-04-15-karpathy-llm-wiki-readme.md)
- [CHATGPT-2](../../raw/chatgpt/2026-04-15-best-llm-wiki-repo.md)

