# User-Approved Direction: Personalized View Design

Collected: 2026-04-24
Authority: intended direction

## Source

The user asked to track automatic, personalized page design so players and DMs can design their web views to their own tastes. The user wants this addressed soon and asked for a TODO list plus wiki reconciliation.

## Intended Scope

- Per-role and per-character visual personalization for player and DM views.
- Manual customization for themes, density, font scale, layout order, collapse state, and allowed section visibility.
- Page-specific layout support, starting with the character sheet before expanding to combat, auction house, DM dashboard, and DM authoring pages.
- Smart presets such as combat-focused, story-focused, caster, inventory-heavy, DM operations, and minimal.
- Auto-design that recommends a safe preset and layout from role, page, character powers, inventory emphasis, and later usage patterns.

## Boundaries

- Customization must never reveal hidden combat information, hidden item information, or masked opponent identity.
- Required combat state must remain visible during live combat.
- No arbitrary user JavaScript or unrestricted CSS in the first implementation.
- Mobile layouts need stricter constraints than desktop layouts.
- Personalization remains browser-local until backend/user accounts are reopened.
