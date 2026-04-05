# Current Notes

This file tracks active reminders for the current implementation block.

## Active Implementation Block
- The focused Phase 1 combat encounter completion pass is complete.
- The follow-up character-sheet and encounter action-flow pass is also complete.
- Knowledge System V1 is now implemented for character cards.
- Validation passed at the end of the pass: `npm run typecheck`, `npm test`, and `npm run build`.

## Confirmed Rules For This Block
- HP must stay capable of going negative.
- `Heal` mana cost is always `2`.
- `Cure` unlocks at level `3` and mana cost is always `3`.
- Healing cantrip stays at `2 uses per target per day`.
- `Crowd Control` initial cast costs `0`; upkeep only spends mana.
- `Crowd Control` auto-resolves in-system using caster `CHA + INT` vs target `CHA + WITS`, and ties fail.
- Encounter-visible `Crowd Control` status display should show only `Controlled by <caster>`.
- `Shadow Walk` is an encounter mobility action with no direct numeric damage effect.
- Healing damages undead; necrotic heals undead.
- `Expose Darkness` is no longer treated as a separate encounter cast at Light Support level `5`; enemy debuffing is part of `Light Aura`.
- Items will move to shared standalone records outside character sheets.
- Encounter physical attacks now resolve automatically from equipped loadout state.
- `Brute Defiance` is now a manual encounter action instead of a turn-advance auto trigger.

## Known Structural Gaps
- Encounter action resolution is split across cast prep, route execution, and effect builders.
- Encounter upkeep and cast execution still live mostly in the route layer.
- Shared item editing is intentionally minimal and does not yet cover full authoring or knowledge-sharing UX.
- Aura construction has an unresolved architecture dilemma:
  - current implementation uses `buildActivePowerEffect(...)` for both targeted buff spells and aura-source spells
  - alternative direction is to split aura construction into a dedicated helper such as `buildAuraSourceEffect(...)` or `buildAuraSpellEffect(...)`
  - this is recorded for discussion, not implementation

## Knowledge System V1
- Keep `History` as an event log.
- Knowledge now uses standalone revisioned records rather than history-only storage.
- Detailed implementation notes now live in `references/knowledge_card_design.md`.
- Working terminology:
  - `KnowledgeEntity` = the subject, such as a character, item, place, faction, or story topic.
  - `KnowledgeRevision` = one immutable version/snapshot of that subject's known information.
  - character ownership stores which revisions a character currently possesses.
- A character may own multiple revisions of the same subject at once.
- Edited/shared copies should create descendant revisions rather than overwriting the prior one.
- History entries now reference exact revisions so the UI can preview or open the specific version involved in the event.
- Character sheets now expose a dedicated inline `Knowledge` area for browsing owned subjects and revisions separately from `History`.
- V1 implementation scope:
  - character cards only
  - duplicate / edited copy / share / archive / pin / compare
  - DM snapshot creation, manual creation, edit-before-save, and grant flows
  - legacy embedded intel history rows are intentionally removed during hydration

## Deferred But Recorded
- `ARCH-REM-01` remains as a reminder to extract an encounter controller/engine layer later.
- `Brute Defiance` is still using the temporary manual-trigger implementation; the recorded follow-up is to restore it as a passive delayed stand-up with HP scaling `1 / 2 / 4 / 8 / 16` by `Body Reinforcement` level.
- `Crowd Control` follow-up direction is recorded:
  - `Control Entity (CE)` should remain the user-facing spell
  - releasing a controlled target should become a contextual control-management action, not a separate spell
- `Crowd Control` passive follow-up is recorded:
  - replace the current cantrip-style passive bonuses with `Crowd Management (CM)` scaling `Social +1 / +2 / +3 / +4 / +5` by `Crowd Control` level
  - add `Compulsion Guard (CG)` at `Crowd Control` level `5` so `Social` is added while defending against control effects
- `Elementalist` follow-up is recorded:
  - current runtime merges split-style behavior into `Elemental Bolt`
  - future direction under discussion is a cleaner separation into `Elemental Bolt`, `Elemental Cantrip`, and `Elemental Split` as separate spells with explicit rules
- `Healing` follow-up is recorded:
  - current runtime still mixes `Heal`, `Cure`, and `Wound Mend` inside one `HealingSpellAction`
  - future direction is a cleaner explicit three-spell model:
    - `Heal Living (HL)` as the healing spell
    - `Holy Purge (HP)` as the separate cleanse spell
    - `Healing Touch (HT)` as the separate wound-mending spell
  - the intended replacement also changes `Holy Purge` mana to `2` and keeps `Healing Touch` as a separate `2/day` per-target spell derived from `HL`
- `Light Support` follow-up is recorded:
  - current runtime compresses the power into `Light Aura` plus `Mana Restore`, with level `5` darkness debuffing folded into the aura flow
  - future direction is a clearer explicit model:
    - `Let There Be Light (LTBL)` as the aura spell
    - `Lunar Bless (LB)` as the passive mana / night-vision line
    - `Lessen Darkness (LD)` as a separate level `5` linked darkness-reduction effect
    - `Luminous Restoration (LR)` as the separate mana-restore spell
  - intended rule changes include `LTBL` level `1` becoming `+1 hit, +1 DR`, stronger passive mana scaling, `LD` allowing `RL0 -> RL-1`, and `LR` scaling from level `3`
- `Necromancy` follow-up is recorded:
  - current runtime uses `Summon Undead` with selectable summon options plus a separate `dismiss_summon` variant id, all handled inside one summon action class
  - future direction is a clearer explicit model:
    - `Non-Living Warriors (NW)` as the parent summon power
    - `Non-Living Skeleton (NS)`, `Non-Living Skeleton King (NSK)`, and `Non-Living Zombie (NZ)` as the child summon types
    - `Necrotic Touch (NT)` as the damage spell
    - `Necromancer's Bless (NB)` as resurrection
    - `Necromancer's Deception (ND)` as the passive line
  - intended rule changes include the newer summon subtype limits, explicit summon formulas, revised resistances, and the newer passive progression
- `Shadow Control` follow-up is recorded:
  - current runtime uses `Cloak of Shadow`, `Shadow Walk`, `Shadow Manipulation`, and `Shadow Soldier`, with a separate `dismiss_summon` variant id for summon removal
  - future direction is a clearer explicit model:
    - `Smoldering Shadow (SS)` as the cloak/aura spell
    - `Shadow Walk (SW)` as the movement spell
    - `Shadow Walk and Attack (SWaA)` as a separate ambush spell
    - `Shadow Manipulation (SM)` as the damage spell
    - `Sleek Visage (SV)` as the cosmetic passive line
    - `Shadow Fighter (SF)` as the summon spell
  - intended rule changes include removing the current intimidation bonus from the cloak spell, adding `SWaA`, shifting to the newer duration ladder, and moving the summon to the newer explicit `Shadow Fighter` spec
- Full item-authoring UX and multi-target `AA` knowledge-sharing UI remain deferred.
- Expansion of the knowledge system beyond character cards remains deferred.
- Backend sync and encounter persistence remain out of scope.
