# Repository Instructions

## Execution Workflow
- Treat `references/plan.md` as the authoritative implementation plan.
- Always start with the earliest unfinished plan item.
- Break that item into concrete tasks, complete them one at a time, verify each one, and only then move to the next task.
- Update `references/plan.md` only when implementation reality requires a change.

## Remote Sync
- After completing a substantial plan item such as `0.2`, `0.3`, `1.1`, or `3.2`, create a focused commit and push it to `origin` so the remote repository reflects major progress checkpoints.

## Phase Checkpoints
- When an entire phase is complete, create a clearly named GitHub checkpoint for that phase so there is a stable recovery marker for later reference.
- Prefer a GitHub milestone for tracking visibility, and use a git-native checkpoint such as a tag or equivalent marker when an actual rollback point is required.
- Use rollback tags in the format `rollback/phase-<n>-<short-name>` so phase checkpoints are easy to identify and reuse.

## Operating Principles
- Think before coding. State assumptions, surface ambiguity, and prefer explicit tradeoffs over silent guesses.
- Simplicity first. Solve the requested problem with the minimum durable change.
- Surgical changes. Touch only the files and lines required for the task.
- Goal-driven execution. Define what will be verified before declaring a task complete.

## LLM Wiki Rules
- Treat `raw/` as the immutable source-capture layer and `wiki/` as the compiled knowledge layer.
- Keep `wiki/index.md` as the content index and `wiki/log.md` as the append-only operations log.
- Use this source precedence when compiling wiki pages:
  1. current code plus active repo docs for current state
  2. latest user-approved conversation for intended direction
  3. older threads and chats for provenance and rationale
- When current state and intended direction differ, keep both. Record the divergence in `wiki/history/split-decisions.md`.
- After end-to-end tasks that change rules, architecture, roadmap, or workflow, update the touched wiki pages, refresh the index/log if needed, and report unresolved split decisions to the user.
- Query the wiki first, then verify against code and canonical repo docs before presenting answers as current fact.
- Keep wiki automation and large wiki-refresh work on `codex/llm-wiki`. Wiki maintenance may write only `raw/`, `wiki/`, `.agents/skills/llm-wiki-maintainer/`, and wiki-specific rules in this file.
