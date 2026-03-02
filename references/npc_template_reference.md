# NPC Template Reference

Source workbook: `references/originals/NPC_Template5.xlsx`

## Purpose
- Character sheet layout reference for the future app UI.
- Formula reference for relationships between stats, skills, powers, equipment bonuses, and combat summaries.
- Lookup-table source for XP progression used by the sheet.

## Sheets
- `CharacterSheet`
- `References`

## CharacterSheet Sections

### Identity
- Name
- Age
- Date
- Biography 1
- Biography 2
- XP Used
- CR
- Rank
- Positive Karma
- Negative Karma
- Money
- Inspiration

### Combat Summary Block
- HP
- HP Regen
- Mana
- Mana Regen / per hour
- Initiative
- AC
- DR
- Soak
- Melee Attack
- Range Attack
- Melee Damage
- Range Damage
- Cantrip Damage
- Spell Damage (Single)
- Healing
- Cantrip Healing
- Necrotic Touch

### Equipment Slots
- Head
- Neck
- Body
- Right Hand
- Left Hand
- Ring Right
- Ring Left

### Equipment Bonus Columns
- Melee Attack
- Ranged Attack
- Melee Damage
- Ranged Damage
- Melee Skill
- Ranged Skill
- Athletics
- Stealth
- Alertness
- Intimidation
- Social
- Medicine
- Technology
- Academics
- Mechanics
- Occult
- Initiative
- AC
- DR
- Soak
- HP
- Mana
- Awareness
- Body Reinforcement
- Crowd Control
- Elementalist
- Healing
- Light Support
- Necromancy
- Shadow Control
- STR
- DEX
- STAM
- CHA
- MAN
- APP
- INT
- PER
- WITS

### Stat Groups
- `Physical`: Strength, Dexterity, Stamina
- `Social`: Charisma, Manipulation, Appearance
- `Mental`: Intelligence, Perception, Wits

### T1 Supernatural Powers
- Awareness
- Body Reinforcement
- Crowd Control
- Elementalist
- Healing
- Light Support
- Necromancy
- Shadow Control
- Plus placeholder rows for additional powers

### T1 Skills
- Melee
- Ranged
- Athletics
- Stealth
- Alertness
- Intimidation
- Social
- Medicine
- Technology
- Academics
- Mechanics
- Occultism
- Archery / Guns
- Energy Weapons

## Key Sheet Formulas

### Progression
- `CR = ROUNDDOWN(XP Used / 33, 0)`
- `Rank` is derived from `XP Used` through a lookup or threshold formula.

### Stat Totals
- Each stat row has `Current`, `Base`, `XP Buy`, `Equipment`, `Buff`, `XP Spent`, and `Roll`.
- Current stat values are aggregated from the component columns.
- Equipment-driven stat bonuses are pulled from the equipment totals row.

### Derived Combat Values
- `HP = 2 + STAM * 2 + equipment HP bonuses`
- `Mana` is derived from supernatural power totals plus an occult-related bonus
- `Initiative = DEX + WITS + equipment initiative bonuses`
- `AC = DEX + equipment AC bonuses`
- `Soak = STAM + equipment soak bonuses`
- `Melee Damage = STR + equipment melee damage bonuses`
- `Ranged Attack = Ranged skill + DEX + floor((PER - 1) / 2)`

### T1 Power Matchups
- Each T1 power row has a matchup formula based on `power level + governing stat`
- Observed governing stats:
  - Awareness -> PER
  - Body Reinforcement -> STAM
  - Crowd Control -> CHA
  - Elementalist -> INT
  - Healing -> INT
  - Light Support -> APP
  - Necromancy -> APP
  - Shadow Control -> MAN

### Skill Roll Formulas
- Melee roll uses `Melee + DEX`
- Ranged roll uses `Ranged + DEX + floor((PER - 1) / 2)`
- Stealth uses `Stealth + DEX`
- Alertness uses `Alertness + PER`
- Intimidation uses `Intimidation + CHA`
- Social attack rows split into:
  - Persuasion -> CHA + Social
  - Deception -> MAN + Social
  - Seduction -> APP + Social
- Social defense rows split into:
  - Persuasion defense -> INT + Social
  - Deception defense -> PER + Social
  - Seduction defense -> WITS + Social
- Medicine uses `Medicine + INT`
- Technology uses `Technology + INT`
- Mechanics uses `Mechanics + DEX`
- Occultism uses `Occultism + INT`

## References Sheet
- Contains lookup tables for:
  - T1 skill XP progression
  - Stat XP progression
  - T1 supernatural power XP progression
  - Special power XP progression
  - T2 skill XP progression
  - T2 supernatural power XP progression
- These values match the engine tables already implemented in `src/config/xpTables.ts`.

## Implementation Notes
- The workbook confirms that stat groups are a real mechanical grouping, not just a visual concept.
- The workbook confirms that powers have governing stats and that the sheet uses `power level + governing stat` as a core derived value.
- Equipment bonuses are modeled as additive contributions to both stats and derived combat values.
- The future character sheet UI should preserve the distinction between:
  - stored inputs
  - equipment bonuses
  - power bonuses
  - derived roll values
