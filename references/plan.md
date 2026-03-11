# Roadmap Reset v6 (Power Completion + Awareness Reset)

This roadmap is the active implementation source of truth for this branch.

## Ground Rule
- Keep the current player flow, DM flow, character sheets, local character persistence, and DM-side NPC creation intact.
- Keep the branch local-only.
- Preserve the source reference files under `references/originals/` and the derived JSON files.
- Use `Basic_Rules5.txt` and `T1_Supernatural_Powers5.txt` as the authoritative rule sources.
- Damage resolution must not clamp HP at `0`; negative HP is allowed and must remain visible.

## Current State
- Combat dashboard staging, parties, initiative ordering, and the DM combat encounter page are implemented.
- Roll helper, aura-source sharing for `Light Support` and `Shadow Control`, and DM runtime editing are implemented.
- First direct-combat slice is implemented for:
  - `Body Reinforcement`
  - `Light Support`
  - `Shadow Control` cloak
  - `Healing`
  - `Shadow Manipulation`
  - `Necrotic Touch`

## Phase 3 - Power Completion
3.1 Update the shared data/runtime model before the remaining powers.
  - Split inspiration into permanent and temporary.
  - Add temporary HP as a separate runtime value.
  - Keep HP capable of going negative.
  - Extend character-sheet game history to support typed intel snapshots.
  - Add item-identification state to inventory/loadout items.
  - Add encounter-visible status tags such as `Paralyzed` and `Controlled by <caster>`.

3.2 Replace Awareness with the new `AS / AI / AC / AA` model.
  - `AS` passive alertness bonus.
  - `AI` passive temporary inspiration per session.
  - `AC` active character assessment with CR-limit and CR-cap rules.
  - `AA` active item identification from owned items.

3.3 Finish the remaining direct damage and healing work.
  - Finalize `Necrotic Touch` with corrected higher-level mana rules.
  - Implement `Elementalist` damage variants and manual allocation.
  - Finish the remaining healing rule slice:
    - cantrip heal / stop bleeding
    - poison, disease, curse removal
    - limb-regrowth flag
    - overheal as temporary HP

3.4 Finish the remaining passive / utility power backlog.
  - `Light Support` cantrip mana bonus and nightvision.
  - `Light Support` mana restore and `Expose Darkness`.
  - `Body Reinforcement` cantrip stand-up behavior.
  - `Necromancy` cantrip undead-aggro / melee bonus behavior.
  - `Crowd Control` cantrip skill bonuses.
  - `Shadow Control` cosmetic cantrips.

3.5 Implement `Crowd Control`.
  - Contest-based cast flow.
  - Paralyze / control status application.
  - Maintenance mana per turn / per target.
  - Controlled targets stay in their party; show a control tag instead of party switching.
  - Defer a full command UI.

3.6 Implement summons.
  - `Necromancy` summons and `Resurrection`.
  - `Shadow Control` shadow soldier.
  - Summons are temporary encounter units built from templates.
  - `Resurrection` returns the target alive at `1 HP`.

## Deferred
- Add the combat encounter `History` block only after the remaining powers are complete.
  - 3 lines visible by default
  - newest first
  - vertical scrollbar
  - bottom-right resize handle
  - short summaries only
- `AC` snapshots belong in the caster’s character-sheet `Game History`, not in the encounter history block.
- Session-counter automation, realtime sync, encounter persistence, and player-side combat UI remain out of scope.
