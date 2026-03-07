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
