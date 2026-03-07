# Project Objective

## Goal
Maintain a frontend-heavy web application that serves as a digital hub for a custom TTRPG, while preserving the current local-only player flow, DM flow, character sheets, and DM NPC creation tools.

## Current Branch State
- Tech stack in active use: React and TypeScript on the frontend.
- Persistence in active use: browser-local storage only.
- Current gameplay scope: character creation/editing flows, player and DM sheet access, DM-owned NPC creation, and a combat dashboard that currently acts as a roster/setup page only.
- The previous combat engine, combat encounter UI, and backend/Supabase integration are intentionally absent from this branch.
- A new combat engine and any future backend integration will be redesigned from scratch later.

## Objective Anchors
- Keep current sheet and hub behavior stable while the branch stays local-only.
- Preserve source references under `references/originals/` and the derived JSON files.
- Keep derived/stat formulas in frontend code where they are needed for the current sheet UI.
- Do not reintroduce backend or combat-engine assumptions until a new design is explicitly defined.

## Key Features

### Character Management System
- Create and edit player characters locally.
- Create and edit DM-owned characters locally.
- Auto-calculate current sheet summaries on the client.

### Inventory and Item System
- Preserve inventory and equipment display on the character sheet.
- Keep item and auction-house references available for later work.

### Supernatural Power System
- Preserve the authored power JSON and character-sheet power displays.
- Do not treat the current branch as having an active power runtime or combat power system.

### Combat Preparation Surface
- Preserve the DM combat dashboard as a staging/roster page.
- Leave combat encounter execution inactive until a new engine is defined.

## Reference Pipeline
- Authoritative text references: `json_refs/basic_rules.json`, `json_refs/item_rules.json`, `json_refs/powers.json`
- Current frontend formulas and helpers: `src/config/*.ts`
- Active planning references: `references/plan.md`, `references/current_notes.md`, and the remaining active reference docs
