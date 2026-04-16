---
title: Codex Operating Rules
topic: workflow
kind: workflow
status: active
updated: 2026-04-15
confidence: high
---

## Summary

This repo now has an explicit Codex operating policy: follow the project roadmap, keep changes surgical, and maintain the wiki as the durable synthesis layer. The four external behavior principles are adopted here as hard repo policy, not loose advice.

## Current State

- `AGENTS.md` already defines:
  - roadmap-first execution
  - checkpoint expectations
  - Think Before Coding
  - Simplicity First
  - Surgical Changes
  - Goal-Driven Execution
  - wiki source precedence and split-reporting rules
- The wiki is now part of normal repo maintenance rather than a side artifact.
- Future Codex sessions should query the wiki first and then verify against code/docs when answering current-state questions.

## Intended Direction

- Keep future Codex behavior aligned to the repo instructions even when old thread context suggests different assumptions.
- Use the wiki to reduce rediscovery and plan drift.
- Make changes only where the request or the wiki-maintenance workflow requires them.

## Key Decisions

- `references/plan.md` stays authoritative for roadmap order.
- Latest current-state truth comes from live code plus active repo docs.
- Latest approved conversation defines intended direction when it differs from current implementation.
- Unresolved current-vs-intended gaps must be surfaced to the user instead of being silently flattened.
- Wiki-only refresh work belongs on `codex/llm-wiki`.

## Deferred / Open

- The schema can evolve if future wiki usage shows missing conventions.
- Any expansion of the allowed-write set for wiki automation should require explicit user approval.

## Sources

- [AGENTS.md](../../AGENTS.md)
- [raw/source-index.md](../../raw/source-index.md)
- [wiki/history/split-decisions.md](../history/split-decisions.md)

## Raw

- [EXT-SKILLS-CLAUDE](../../raw/external/2026-04-15-andrej-karpathy-skills-claude-md.md)
- [EXT-SKILLS-README](../../raw/external/2026-04-15-andrej-karpathy-skills-readme.md)
- [CHATGPT-1](../../raw/chatgpt/2026-04-15-second-brain-for-codex.md)
- [CHATGPT-1A](../../raw/chatgpt/2026-04-15-second-brain-followup-supplement.md)

