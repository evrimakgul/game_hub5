# Wiki Log

## [2026-04-15] ingest | game_hub5 llm wiki bootstrap
- Captured repo docs, tracking docs, current code landmarks, seven Codex threads, two ChatGPT share threads, one ChatGPT follow-up supplement, and external workflow references into `raw/`.
- Updated: `project/game-hub5-overview`
- Updated: `project/current-objective-and-roadmap`
- Updated: `project/implemented-vs-deferred`
- Updated: `runtime/state-and-persistence`
- Updated: `runtime/ui-and-routes-map`
- Updated: `domains/combat-encounter`
- Updated: `domains/powers-and-casting`
- Updated: `domains/items-and-equipment`
- Updated: `domains/knowledge-cards`
- Updated: `domains/world-casting`
- Updated: `workflow/codex-operating-rules`
- Updated: `workflow/wiki-maintenance`
- Updated: `history/thread-chronology`
- Updated: `history/split-decisions`

## [2026-04-16] refresh | external snapshot fetch blocked
- Attempted to re-fetch external workflow snapshot sources but the environment has no outbound network access.
- Marked stale in `raw/source-index.md`: `EXT-KARPATHY-GIST`, `EXT-SKILLS-CLAUDE`, `EXT-SKILLS-README`, `EXT-WIKI-SKILL`, `EXT-WIKI-README`.

## [2026-04-16] refresh | wiki provenance and drift reconciliation
- Revalidated the tracked external workflow snapshots against their live upstream URLs and marked them active again in `raw/source-index.md`.
- Revalidated current code landmarks against the wiki's combat, items, powers, and world-casting domain pages.
- Recorded repo-doc drift in the wiki: `references/project_objective.md` still mentions the older manual `Brute Defiance` trigger while current code, roadmap, and notes reflect the passive version.
- Updated: `project/current-objective-and-roadmap`
- Updated: `history/split-decisions`

## [2026-04-16] refresh | aa-01 completion reconciliation
- Reconciled the wiki with the completed `AA-01` implementation so item, knowledge, and roadmap pages no longer describe full Artifact Appraisal integration as pending.
- Reconciled roadmap drift by updating the authoritative plan and supporting docs to match the implemented `AA-01` state.
- Updated: `project/current-objective-and-roadmap`
- Updated: `project/game-hub5-overview`
- Updated: `project/implemented-vs-deferred`
- Updated: `domains/world-casting`
- Updated: `history/split-decisions`
- Updated: `domains/items-and-equipment`
- Updated: `domains/knowledge-cards`

## [2026-04-17] refresh | provenance revalidation
- Revalidated current repo docs and live code landmarks; `references/project_objective.md` remains the only tracked stale current-state doc because it still describes the older manual `Brute Defiance` trigger.
- Revalidated all tracked external workflow snapshot URLs against their live upstream sources and kept the existing raw captures active in `raw/source-index.md`.
- Updated: `history/split-decisions`
