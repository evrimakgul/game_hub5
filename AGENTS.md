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
