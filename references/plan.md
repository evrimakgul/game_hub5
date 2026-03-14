# Roadmap Reset v8 (Implemented T1 Power Runtime)

This roadmap is the active implementation source of truth for this branch.

## Ground Rule
- Keep the current player flow, DM flow, character sheets, local character persistence, and DM-side NPC creation intact.
- Keep the branch local-only.
- Preserve the source reference files under `references/originals/` and the derived JSON files.
- Use `Basic_Rules5.txt` and `T1_Supernatural_Powers5.txt` as the authoritative rule sources.
- Damage resolution must not clamp HP at `0`; negative HP is allowed and must remain visible.
- `AA` is deferred until item-authoring design exists; do not invent item-generation rules in this phase.

## Current State
- Combat dashboard staging, parties, initiative ordering, and the DM combat encounter page are implemented.
- Roll helper, aura-source sharing for `Light Support` and `Shadow Control`, and DM runtime editing are implemented.
- Shared runtime scaffolding is implemented:
  - permanent + temporary inspiration
  - temporary HP
  - negative HP support
  - typed character-sheet intel snapshots
  - item-identification metadata fields
  - encounter-visible status tags
  - structured `powerUsageState`
  - manual daily and long-rest reset controls
  - encounter turn runtime
  - transient summon combatants
  - encounter-only ongoing maintained states
  - cast execution support for resource/status/usage/summon operations
  - temporary resistance modifiers on active effects
- Awareness implementation status:
  - `AS` complete
  - `AI` complete
  - `AC` complete
  - `AA` deferred
- Active/direct implementation status:
  - `Body Reinforcement` stat buff complete
  - `Body Reinforcement` delayed self-revive cantrip complete
  - `Crowd Control` complete for the current app surface
  - `Elementalist` main cast complete
  - `Elementalist` cantrip complete
  - `Healing` complete through Lv5
  - `Healing` cantrip complete
  - `Light Support` aura complete
  - `Light Support` mana restore complete
  - `Light Support` `Expose Darkness` complete
  - `Necromancy` summons complete
  - `Necrotic Touch` complete
  - `Resurrection` complete
  - `Shadow Control` cloak complete
  - `Shadow Manipulation` complete
  - `Shadow Soldier` complete
- Passive/utility implementation status:
  - `Light Support` passive mana bonus complete
  - `Crowd Control` cantrip skill bonuses complete
  - `Necromancy` cantrip melee / undead-aggro behavior complete
  - `Shadow Control` utility trait surfacing complete
  - derived utility traits surface on sheet and encounter views

## Completed Phase 3
3.1 Shared model/runtime upgrades completed.
3.2 Awareness completed except deferred `AA`.
3.3 Remaining direct damage and healing work completed.
3.4 Passive / utility backlog completed for the current app surface.
3.5 `Crowd Control` completed for the current app surface.
3.6 Summons and resurrection completed for the current app surface.

## Deferred
- Add `AA` only after item-authoring design is defined.
- Add the combat encounter `History` block only after the remaining powers are complete.
  - 3 lines visible by default
  - newest first
  - vertical scrollbar
  - bottom-right resize handle
  - short summaries only
- `AC` snapshots belong in the caster's character-sheet `Game History`, not in the encounter history block.
- Session-counter automation, realtime sync, encounter persistence, and player-side combat UI remain out of scope.
