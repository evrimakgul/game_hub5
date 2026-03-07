# Current Notes

This file tracks active reminders and implementation notes for the current branch state.

## Current Implementation Block
- Persist created and updated characters locally.
- Hydrate saved characters into the latest sheet shape when loading local data.
- Store character ownership (`player` vs `dm`) so player sheets and DM-created sheets stay separated.
- Keep active player-sheet selection and active DM-sheet selection separated so DM creation/edit flows never replace the player's currently selected character.
- Keep these flows intact:
  - player hub and player character sheet
  - DM dashboard
  - DM-side player character access
  - DM NPC creator and DM-owned character sheets
  - combat dashboard as the encounter staging page
- The pseudo NPC quick-add path has been removed from the combat dashboard.
- The new combat rebuild starts with encounter start, initiative ordering, and the first DM combat encounter page.
- The combat encounter uses a floating roll-helper popover instead of a static helper panel.
- Movement is shown in the character sheet combat summary as `20 + 5`.
  - `20` from standard-action conversion
  - `5` from move action
- Named next implementation block: `Cast Power Mechanism`.
- First `Cast Power Mechanism` slice is now active on the DM combat encounter page.
  - Supported active casts:
    - `Body Reinforcement`
    - `Light Support`
    - `Shadow Control` cloak
  - Active power effects are now stored on locally persisted character records.
  - Character sheet and combat encounter both read the same post-effect runtime values.
  - `currentMana` now defaults to derived max mana until the character spends mana for the first time.
  - Encounter instances themselves are still not persisted locally yet.
- Authoritative source files are now:
  - `references/originals/Basic_Rules5.txt`
  - `references/originals/T1_Supernatural_Powers5.txt`
- Power data normalization is now partially completed for runtime use:
  - Awareness identification costs are explicitly free.
  - Necrotic Touch damage and healing now scale from the acting power level instead of hard-coded flat bonuses.
  - Shadow Manipulation damage now scales from `MAN + Shadow Control level`.
  - Summon templates now use structured stat formulas, structured attack definitions, and numeric resistance levels.
  - Resistance data is aligned with the character-sheet model (`-2` to `+2`) and the `cold` damage-type naming.
- Combat rules now separate attack delivery from mitigation so future magical attacks can still deal physical damage and be reduced by DR.
- The current branch does not use Supabase at runtime.
- Old Supabase schema and realtime reference documents have been removed from this branch.
