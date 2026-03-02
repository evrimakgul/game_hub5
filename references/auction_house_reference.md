# Auction House Reference

Source workbook: `references/originals/Auction House.xlsx`

## Purpose
- Support catalog of concrete items, pricing, stock levels, item categories, and bonus patterns.
- Useful as a seed dataset for inventory UI, item browsing, and example effect parsing.
- Not a substitute for authoritative item rules; it is a catalog built on top of them.

## Sheets
- `Action House`
- `Helper`

## Action House Main Columns
- `Bid`
- `Buyout`
- `Item Name`
- `Item Quantity`
- `Item Quality`
- `Body Part`
- `Spec`
- `Bonus`
- `Type`
- `Remarks`
- `Item Labels`

## Observed Metadata
- Price values are multiplied by `1000`.
- Stock rule note: `20+` means too many in stock and the auction house no longer buys that item type.
- Item availability is tied to game-session windows.

## Helper Sheet Vocabulary

### Quality Values
- `0. Common`
- `1. Uncommon`
- `2. Rare`
- `3. Epic`
- `4. Legendary`
- `5. Mythical`
- `6. Artifact`

### Body Part Values
- `Hands`
- `Head`
- `Neck`
- `Fingers`
- `Upper Body`
- `-`
- `Orbital`

### Spec Values
- blank or none
- `Single Use`
- `Permenant`

### Type Values
- `-`
- `1-Handed Weapon`
- `2-Handed Weapon`
- `Shield`
- `Brawl Item`
- `Amulet`
- `Ring`
- `Occult`
- `Armor`
- `Bow`
- `Crossbow`

### Item Label Examples
- `Mana`
- `HP`
- `DR`
- `Soak`
- `AC`
- `Hit`
- `Dmg`
- `Melee`
- `Range`
- `Strength`
- `Stamina`
- `Intelligence`
- `Wits`
- `Special`
- `T1`

## Example Item Patterns
- Consumables with temporary stat changes and later drawbacks
- Ammunition with special damage types or anti-creature bonuses
- Occult items with flat mana, HP, DR, or damage bonuses
- Utility items with special effects and no direct combat stat

## Implementation Notes
- This workbook is a strong candidate for future import into item templates or shop inventory.
- `Bonus`, `Remarks`, and `Item Labels` contain effect semantics that will eventually need structured parsing.
- `Body Part`, `Type`, and `Quality` should become enums or constrained values in the app model.
- The workbook provides many concrete examples of combined item effects that can guide future effect-schema design.
