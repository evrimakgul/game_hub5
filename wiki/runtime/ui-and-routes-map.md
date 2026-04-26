---
title: UI And Routes Map
topic: runtime
kind: map
status: active
updated: 2026-04-24
confidence: high
---

## Summary

The route map is already decomposed enough that future work should extend the existing player/DM pages instead of recreating larger monolithic page ownership. `App.tsx` is the route registry, and auction, combat, and live session workflows now have explicit DM-side and player-side surfaces instead of one shared role-unsafe page.

## Current State

Current route surface from `src/App.tsx`:

- `/` -> login
- `/role` -> role selection
- `/player` -> player hub
- `/player/session` -> player live session surface
- `/player/character` -> player character sheet
- `/player/auction-house` -> player auction shopping route tied to a selected character
- `/player/combat` -> player combat mode tied to a selected combatant character
- `/dm` -> DM hub
- `/dm/screen` -> DM live session screen
- `/dm/characters` -> DM character hub
- `/dm/character` -> DM readonly character view
- `/dm/npc-creator` -> DM NPC creator
- `/dm/npc-character` -> DM editable character view
- `/dm/mobs` -> DM mob template library and editor
- `/dm/mob-groups` -> DM reusable mob-group library and editor
- `/dm/portals` -> DM portal workshop
- `/dm/auction-house` -> DM auction catalog browser and item-seeding flow
- `/dm/items` -> DM items list
- `/dm/items/edit` -> DM item edit
- `/dm/items/blueprints` -> DM blueprint management
- `/dm/items/definitions` -> DM item definition management
- `/dm/items/interactions` -> DM item interactions and item knowledge
- `/dm/knowledge` -> DM knowledge hub for place/faction/story/custom subjects
- `/dm/combat` -> combat dashboard
- `/dm/combat/encounter` -> combat encounter runtime

Supporting component clusters:

- `src/components/player-character/*` owns character-sheet sections, knowledge UI, history, powers, inventory, and the player-sheet auction-house entry button.
- `src/routes/PlayerCombatPage.tsx` owns the player-facing masked combat view, own-turn player action surface, and shared encounter-state wiring instead of inventing a second combat system.
- `src/routes/DmScreenPage.tsx` and `src/routes/PlayerSessionPage.tsx` own Supabase-backed live session operations.
- `src/components/combat-encounter/*` owns encounter runtime interaction surfaces.
- `src/routes/DmKnowledgePage.tsx` owns DM-only authoring for non-character/item knowledge subjects.
- `src/routes/DmMobsPage.tsx`, `src/routes/DmMobGroupsPage.tsx`, and `src/routes/DmPortalsPage.tsx` now own the manual mob/group/portal authoring workshop, including CR controls and the portal-first `portal_bundle` request/import flow.
- `src/routes/PlayerAuctionHousePage.tsx` owns completed player-side bid/buyout shopping, while `src/routes/DmAuctionHousePage.tsx` remains the DM-side catalog/import/item-seeding surface.
- View personalization is planned as cross-route behavior, not a replacement route. It should attach to existing player and DM surfaces through an Appearance/Layout drawer and page section registries.

## Intended Direction

- Preserve route decomposition and section-based component ownership.
- Extend item, knowledge, world-casting, and new authoring-lane UX by adding focused page/component behavior instead of re-centralizing logic.
- Keep shared read-only/editable character flows on the existing `PlayerCharacterPage` view-mode split unless there is a strong reason to fork them.
- Add personalization progressively, starting with the player character sheet before extending to combat, auction house, DM dashboard, and DM authoring routes.

## Key Decisions

- Route registration is centralized in `App.tsx`.
- DM item flows are intentionally split into auction-house, list, edit, blueprint, definitions, and interactions pages.
- The auction house now has two distinct routes by responsibility:
  - `/dm/auction-house` for catalog seeding/import and item-draft creation
  - `/player/auction-house` for character-bound shopping transactions
- The combat system now has three distinct surfaces by responsibility:
  - `/dm/combat` for encounter staging and start
  - `/dm/combat/encounter` for DM-side action execution
  - `/player/combat` for masked player visibility, own-turn action controls, and AE-based reveal
- Live table communication now has two distinct surfaces by responsibility:
  - `/dm/screen` for DM session control, secret rolls, sharing, rewards, pins, notes, and combat shortcuts
  - `/player/session` for player character publishing, hidden rolls, limited sharing, card sharing, and event feed access
- The DM dashboard now also acts as the entry point for the mob library, mob-group library, and portal workshop.
- `/dm/portals` is now the preferred portal-theme-first Codex generation entrypoint.
- The combat dashboard is now the place where saved mob groups or saved portal stages get exported into encounter-owned combatants.
- The technical-debt refactor from thread `2.1` should not be reversed.
- Personalized layouts should use registered sections on existing routes, preserving route ownership and hidden-information boundaries.

## Deferred / Open

- Future domain growth may warrant more focused sub-pages, but current decomposition is good enough.
- `VIEW-PERSONALIZATION-01` needs a cross-route Appearance/Layout control surface and per-page section registry.
- Supabase member linking currently uses user UUIDs; email lookup is future UX polish.

## Sources

- [src/App.tsx](../../src/App.tsx)
- [src/routes/PlayerCharacterPage.tsx](../../src/routes/PlayerCharacterPage.tsx)
- [src/routes/PlayerAuctionHousePage.tsx](../../src/routes/PlayerAuctionHousePage.tsx)
- [src/routes/PlayerCombatPage.tsx](../../src/routes/PlayerCombatPage.tsx)
- [src/routes/DmScreenPage.tsx](../../src/routes/DmScreenPage.tsx)
- [src/routes/PlayerSessionPage.tsx](../../src/routes/PlayerSessionPage.tsx)
- [src/components/player-character/CharacterInventorySection.tsx](../../src/components/player-character/CharacterInventorySection.tsx)
- [src/routes/DmItemInteractionsPage.tsx](../../src/routes/DmItemInteractionsPage.tsx)
- [src/routes/DmKnowledgePage.tsx](../../src/routes/DmKnowledgePage.tsx)
- [src/routes/CombatEncounterPage.tsx](../../src/routes/CombatEncounterPage.tsx)
- [references/session_handoff_2026-03-12.md](../../references/session_handoff_2026-03-12.md)
- [wiki/domains/view-personalization.md](../domains/view-personalization.md)
- [wiki/domains/realtime-sessions.md](../domains/realtime-sessions.md)

## Raw

- [THREAD-2.1](../../raw/codex-threads/thread-2.1-019cdf06-a91b-7df2-82ee-50051261f7f4.md)
- [THREAD-5](../../raw/codex-threads/thread-5-019d6ae9-438c-7f83-8f48-fdb6648938ef.md)
- [THREAD-6](../../raw/codex-threads/thread-6-019d7a11-3487-7f20-b7a1-a00b828942d7.md)
- [USER-AUCTION-PLAYER-2026-04-20](../../raw/user-approved/2026-04-20-player-auction-house-shopping.md)
- [USER-COMBAT-PLAYER-2026-04-20](../../raw/user-approved/2026-04-20-player-combat-mode.md)
- [USER-VIEW-PERSONALIZATION-2026-04-24](../../raw/user-approved/2026-04-24-view-personalization-roadmap.md)
- [USER-REALTIME-SESSION-2026-04-24](../../raw/user-approved/2026-04-24-realtime-dm-screen-session.md)

