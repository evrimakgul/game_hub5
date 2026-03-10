# Roadmap Reset v5 (New Combat Rebuild)

This roadmap is the active implementation source of truth for this branch.

## Ground Rule
- Keep the current player flow, DM flow, character sheets, local character persistence, and DM-side NPC creation intact.
- Build the new combat system locally from scratch.
- Start with a narrow first slice: encounter start, initiative order scheduler, and the first DM combat encounter page.
- Preserve the source reference files under `references/originals/` and the derived JSON files.
- Use `Basic_Rules5.txt` and `T1_Supernatural_Powers5.txt` as the current authoritative rule sources.

## Phase 0 - Clean Slate Baseline
0.1 Keep the branch local-only.
0.2 Keep current player and DM sheet flows intact.
0.3 Keep the combat dashboard as the encounter staging page.

## Phase 1 - First Combat Encounter Slice
1.1 Add a new local combat encounter state and initiative order scheduler.
    - Combat start rolls initiative for every selected combatant.
    - Initiative results determine the encounter order automatically.
1.2 Add a new DM `Combat Encounter Page`.
    - Tie the `Combat Encounter` button on the combat dashboard to this page.
1.3 Build the `Combatants Block`.
    - Show all combatants in initiative order.
    - Render each combatant as an accordion / expandable section.
    - Expanded section must show:
      - all combat summary fields
      - resistances only when not `Normal`
      - inspiration
      - all stats fields
      - intimidation, stealth, alertness
      - a button to open the full character sheet in a pop-up window
1.4 Build the `Roll Helper` popover.
    - Use a popover window interaction similar to the character sheet roll helper.
    - Show one combatant at a time, with a selector to switch the active combatant.
    - Include real dice rolling behavior.
    - Show the same combatant fields except HP, Mana, AC, DR, Soak, and resistances.

## Power Data Prep
P.1 Keep `json_refs/powers.json` normalized for runtime work before implementing the `Cast Power Mechanism`.
    - Use structured scaling for powers that depend on current power level.
    - Use numeric resistance levels (`-2` to `+2`) instead of prose-only summon defenses.
    - Use `cold` as the damage-type name across rules, JSON, and UI.
P.2 Keep attack delivery and mitigation separate in the rules model.
    - Magical attacks may still deal Physical damage and therefore be reduced by DR.

## Phase 2 - Cast Power Mechanism (First Slice)
2.1 Add shared runtime character-value helpers driven by active power effects.
    - Character sheet and combat encounter must read from the same derived runtime values.
2.2 Store active power effects locally on character records.
    - Power activations must survive sheet refresh because characters are persisted locally.
2.3 Add the first DM-side casting loop on the combat encounter page.
    - Support `Body Reinforcement`, `Light Support`, and `Shadow Control` cloak effects first.
    - Allow target selection and stat selection where required.
    - Allow removing an applied effect from the target.
2.4 Reflect active effects automatically in:
    - stats
    - highlighted skills
    - combat summary values
    - current mana after spending
2.5 Keep this slice local-only and intentionally narrow.
    - No summon casting yet.
    - No player-side combat panel casting yet.
    - No encounter persistence yet.

## Current State on This Branch
- Phase 1 is implemented locally.
- Phase 2 first-slice casting is implemented for `Body Reinforcement`, `Light Support`, and `Shadow Control` cloak.
- Combat dashboard staging now includes party assignment and bulk-add actions.
- Combat encounter now includes party views and aura-source target sharing for `LS` and `SC`.
- DM runtime editing and aura target controls are implemented locally on the combat encounter page.

## Phase 3 - Direct Damage and Healing
3.1 Add local combat-side HP resolution helpers.
    - Damage and healing must update persisted character runtime values.
    - The same runtime values must be reflected on character sheets and combat encounter cards.
    - Keep damage delivery separate from mitigation.
3.2 Add the first healing implementation.
    - Start with `Healing`.
    - Support combat-side HP healing, including level 2 split-heal allocation.
    - Defer status removal, limb regrowth, and overheal to later rule slices.
3.3 Add the first direct damage implementations.
    - Start with `Shadow Manipulation`.
    - Then add `Necrotic Touch`.
    - Then add `Elementalist` damage options.
3.4 Keep this slice local-only and DM-side only.
    - No summon casting yet.
    - No player-side combat panel yet.
    - No encounter persistence or realtime sync yet.

## Future Spec - DM Editing
D.1 Use `references/dm_editing_spec.md` as the implementation spec for DM-side character edits.
    - Split DM edits into `Runtime Adjustments`, `Sheet Administration`, and `Admin Override`.
    - Keep combat-side edits focused on runtime values.
    - Keep progression-sensitive permanent edits behind reason + confirmation.
    - Add a DM audit log when implemented.
