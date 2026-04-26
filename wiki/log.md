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

## [2026-04-17] refresh | workflow branch policy reconciliation
- Added the missing `CHATGPT-3` raw source for the branch/worktree cleanup conversation and indexed it in `raw/source-index.md`.
- Revalidated all tracked external workflow snapshot URLs against their live upstream sources and kept their existing raw captures active.
- Updated the repo wiki-maintenance rule plus workflow/history pages so wiki refresh work now tracks `codex/powers-implementation` instead of a separate `codex/llm-wiki` lane.
- Updated: `workflow/codex-operating-rules`
- Updated: `workflow/wiki-maintenance`
- Updated: `history/thread-chronology`

## [2026-04-17] refresh | automation rule alignment and provenance revalidation
- Revalidated the tracked external workflow snapshot URLs again during the automation pass and found no material upstream workflow drift.
- Aligned the repo-local `llm-wiki-maintainer` skill with the repo/wiki branch policy so automation and local wiki instructions both point at `codex/powers-implementation`.
- Fixed a minor encoding artifact in `history/thread-chronology`.
- `DOC-OBJECTIVE-01` remains open: `references/project_objective.md` still lags the passive `Brute Defiance` behavior already reflected in code, roadmap, and notes.
- Updated: `history/thread-chronology`

## [2026-04-17] refresh | know-v2 and item-value completion reconciliation
- Reconciled the wiki, roadmap, and tracker pages with the completed `KNOW-V2-01` and `ITEM-VAL-01` implementation.
- Recorded the new DM Knowledge Hub route, mixed-type knowledge-card coverage, and persisted shared-item value fields as live current-state behavior.
- Updated: `project/current-objective-and-roadmap`
- Updated: `project/implemented-vs-deferred`
- Updated: `project/game-hub5-overview`
- Updated: `runtime/ui-and-routes-map`
- Updated: `domains/knowledge-cards`
- Updated: `domains/items-and-equipment`
- Updated: `history/split-decisions`

## [2026-04-18] refresh | unarmored baseline implementation reconciliation
- Reconciled the roadmap, tracker, and wiki with the implemented naked-state initiative rule for humanoid characters.
- Recorded that clothing / robes remain real `Initiative +2, DR +0` chest items, while `apparelMode: humanoid | none` now controls the separate `+3 Initiative` no-chest baseline.
- Marked `python.ipynb` cleanup as the literal last cleanup step instead of a current milestone item.
- Updated: `project/current-objective-and-roadmap`
- Updated: `project/implemented-vs-deferred`
- Updated: `project/game-hub5-overview`
- Updated: `domains/items-and-equipment`
- Updated: `history/split-decisions`

## [2026-04-19] ingest | grey portal content reference
- Captured the user-provided Grey Portal source into the repo raw layer for future mob/portal authoring work.
- Added a domain page summarizing the recurring content structure found in the source: real-world portal incidents, theme-linked mob packs, traps, bosses, loot, and closing rewards.
- Updated: `domains/portal-content-patterns`

## [2026-04-19] refresh | authoring workshop v1 reconciliation
- Reconciled the roadmap, tracker, and wiki with the shipped mob/group/portal authoring workshop.
- Recorded the new DM routes, local-first authored-content persistence boundary, manual Codex import/export bridge, and combat-dashboard stage/group export into encounter-owned mobs.
- Updated: `project/current-objective-and-roadmap`
- Updated: `project/game-hub5-overview`
- Updated: `project/implemented-vs-deferred`
- Updated: `runtime/state-and-persistence`
- Updated: `runtime/ui-and-routes-map`
- Updated: `domains/portal-content-patterns`

## [2026-04-19] refresh | portal-first authoring and CR controls
- Reconciled the repo docs and wiki with the portal-first `portal_bundle` workflow, explicit CR controls across mobs/groups/portals, and the new live derived-combat summary on mob templates.
- Recorded that `/dm/portals` is now the preferred Codex generation entrypoint and that bundle imports normalize linked mob/group/portal ids on ingest.
- Updated: `project/current-objective-and-roadmap`
- Updated: `project/game-hub5-overview`
- Updated: `project/implemented-vs-deferred`
- Updated: `runtime/state-and-persistence`
- Updated: `runtime/ui-and-routes-map`
- Updated: `domains/portal-content-patterns`

## [2026-04-19] refresh | auction-house item creation reconciliation
- Reconciled the roadmap, tracker, and wiki with the new auction-house catalog flow and DM item-creation shortcuts.
- Recorded the seeded/persisted auction-entry collection, `/dm/auction-house` route, auction-linked shared item source ids, and the V1 rule that auction bonus text is preserved as draft notes rather than mechanically parsed.
- Updated: `project/current-objective-and-roadmap`
- Updated: `runtime/state-and-persistence`
- Updated: `runtime/ui-and-routes-map`
- Updated: `domains/items-and-equipment`

## [2026-04-20] ingest | player auction shopping direction
- Captured the user-approved shift that defines auction house as a player shopping surface rather than a DM-only destination.
- Added a raw source for the decision and indexed it in `raw/source-index.md`.
- Updated: `raw/source-index.md`

## [2026-04-20] refresh | player auction shopping reconciliation
- Reconciled the roadmap, tracker, and wiki with the new player-facing auction-house route, completed bid/buyout transactions, live stock persistence, and direct shared-item assignment into character inventories.
- Recorded the deliberate current boundary that player-side `Bid` resolves as an immediate winning-bid completion rather than a delayed pending-bid lifecycle.
- Updated: `project/current-objective-and-roadmap`
- Updated: `runtime/state-and-persistence`
- Updated: `runtime/ui-and-routes-map`
- Updated: `domains/items-and-equipment`

## [2026-04-20] ingest | player combat mode direction
- Captured the user-approved direction that DM-started combat must also expose a player-facing combat mode with masked opponents, visible initiative order, visible encounter activities, and AE-based reveal.
- Added a raw source for the decision and indexed it in `raw/source-index.md`.
- Updated: `raw/source-index.md`

## [2026-04-20] refresh | player combat mode reconciliation
- Reconciled the roadmap, tracker, and wiki with the new `/player/combat` route, local active-encounter persistence, masked player combat presentation, and the explicit V1 boundary that player combat remains read-only.
- Updated: `project/game-hub5-overview`
- Updated: `project/current-objective-and-roadmap`
- Updated: `project/implemented-vs-deferred`
- Updated: `runtime/state-and-persistence`
- Updated: `runtime/ui-and-routes-map`
- Updated: `domains/combat-encounter`

## [2026-04-20] refresh | player combat action-surface correction
- Reconciled the combat wiki with the shipped player-side action controls on the viewing character's active turn.
- Recorded that `/player/combat` is no longer purely read-only: it now exposes masked own-turn attack/cast/control-release/summon-dismiss actions while broader timing enforcement still remains deferred.
- Updated: `project/implemented-vs-deferred`
- Updated: `runtime/ui-and-routes-map`
- Updated: `domains/combat-encounter`

## [2026-04-24] ingest | view personalization roadmap
- Captured the user-approved direction for personalized player/DM page design and auto-design recommendations.
- Added `VIEW-PERSONALIZATION-01` as an open roadmap split and created the `domains/view-personalization` wiki page.
- Updated: `raw/source-index.md`
- Updated: `project/game-hub5-overview`
- Updated: `project/current-objective-and-roadmap`
- Updated: `project/implemented-vs-deferred`
- Updated: `runtime/state-and-persistence`
- Updated: `runtime/ui-and-routes-map`
- Updated: `domains/view-personalization`
- Updated: `history/split-decisions`

## [2026-04-24] refresh | realtime dm/player session implementation
- Captured the user-approved realtime DM Screen/session plan and reconciled docs with the implemented Supabase-backed session layer.
- Added the `domains/realtime-sessions` wiki page for Auth, migrations, RLS, session events, secret rolls, sharing, rewards, and current V1 boundaries.
- Updated: `raw/source-index.md`
- Updated: `project/current-objective-and-roadmap`
- Updated: `project/implemented-vs-deferred`
- Updated: `runtime/state-and-persistence`
- Updated: `runtime/ui-and-routes-map`
- Updated: `domains/knowledge-cards`
- Updated: `domains/realtime-sessions`
- Updated: `history/split-decisions`
