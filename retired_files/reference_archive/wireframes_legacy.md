# Wireframe Notes

## Mobile Player Sheet
Purpose: quick access to personal stats, resources, equipped items, and combat actions on a phone-sized screen.

```text
+--------------------------------------------------+
| Character Name                    Rank / CR      |
| Role Tag                          Current Turn?  |
+--------------------------------------------------+
| HP        Mana        Inspiration                |
| 12 / 12   8 / 10      2                          |
+--------------------------------------------------+
| Primary Stats                                     |
| STR  DEX  STA  PER  WIT  INT                     |
|  3    4    2    3    2    2                      |
+--------------------------------------------------+
| Derived Stats                                     |
| AC 8   Init 6   Ranged Bonus 1   Max HP 12       |
+--------------------------------------------------+
| Actions                                           |
| [Attack] [Power] [Move] [Reaction]               |
| Standard: Open  Bonus: Open  Move: Used          |
+--------------------------------------------------+
| Equipped                                           |
| Main Hand: Iron Sword                             |
| Armor: Leather Coat                               |
+--------------------------------------------------+
| Status / Effects                                  |
| - Guarded                                         |
| - Blessed                                         |
+--------------------------------------------------+
```

### Mobile Notes
- Keep combat actions fixed near the bottom of the viewport during encounters.
- Show current resources and action availability before inventory details.
- Derived values should be visually distinct from editable base state.

## Desktop DM Dashboard
Purpose: one-screen view of combat state, player summaries, and action history.

```text
+----------------------+------------------------------------------+
| Encounter Panel      | Active Combat                           |
| Encounter Name       | Initiative Order                        |
| Round / Turn         | 1. Mira      HP 12  Mana 8  Ready      |
| Start / End Buttons  | 2. Ghar      HP 20  Mana 3  Used Move  |
|                      | 3. Shade     HP 10  Mana 9  Ready      |
+----------------------+------------------------------------------+
| Character Summary    | Action Detail                           |
| Selected Character   | Attack Roll                             |
| Base Stats           | Damage Roll                             |
| Derived Stats        | Applied HP Change                       |
| Equipped Items       | Status Effect Changes                   |
+----------------------+------------------------------------------+
| Combat Log                                                      |
| [12:31] Mira attacks Shade and deals 3 damage.                 |
| [12:32] Shade uses Reaction: Fade Step.                        |
| [12:33] Turn advances to Ghar.                                 |
+----------------------------------------------------------------+
```

### Desktop Notes
- Initiative order and combat log should remain visible at all times.
- Character detail should update from selected combatant without leaving the page.
- DM-only actions should be visually separated from player-visible state.

## Shared UI Rules
- Editable fields represent stored state.
- Read-only calculated fields represent derived state.
- Action buttons should explain disabled reasons, such as no mana or action already spent.
- Realtime updates should highlight changed values briefly so users can track incoming state changes.
