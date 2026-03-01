# Project Objective

## Goal
Design and develop a frontend-heavy web application that serves as a digital hub for a custom TTRPG. The application should automate game mechanics, track character progression, manage inventory, and facilitate real-time combat between players and the DM.

## Core Architecture
- Tech stack: React/TypeScript on the frontend, Supabase for database and realtime sync, Vercel for hosting.
- Logic handling: deterministic client-side calculation through a TypeScript logic engine in `src/config/`.
- Data integrity: Supabase is the single source of truth for core state only.
- Derived values such as Max HP, AC, Initiative, and dice pools are calculated on the client and not stored in the database.
- Postgres Realtime is used to sync state changes instantly across connected clients.

## Architecture Anchors
- Supabase stores core mutable state only and does not store derived stats.
- Derived stats are calculated on demand by the client from authoritative state plus engine rules.
- Authoritative rules JSON files are reference sources for authorship and display, not runtime execution sources.
- Engine-owned TypeScript modules in `src/config/` are the deterministic execution layer used by the application.
- Combat math, dice resolution, stat derivation, and similar rule calculations are handled client-side for zero-latency interaction.
- Realtime synchronization distributes state changes between clients, but does not replace the engine layer for derived calculations.

## Key Features

### Character Management System
- Track base stats, current HP, current Mana, and equipped items in the database.
- Auto-calculate derived stats on the client through the logic engine.
- Provide action economy tracking for Standard, Bonus, Move, and Reaction availability per turn.

### Inventory and Item System
- Implement the Item Point (PP) system.
- Use mundane item templates as the base item foundation.
- Support tiered magical properties that modify derived stats when equipped.

### Supernatural Power System
- Digitize powers into machine-readable JSON.
- Support passive powers that apply permanent buffs automatically.
- Support active powers as clickable actions that validate costs and execute effects.

### Real-Time Combat Tracker
- Auto-sort initiative based on `Dex + Wits`.
- Provide click-to-roll resolution for the D10 success system.
- Resolve attack, hit, damage, and HP updates in realtime.

## Reference Pipeline
- Authoritative text references: `json_refs/basic_rules.json`, `json_refs/item_rules.json`, `json_refs/powers.json`
- Execution engine: `src/config/*.ts`
- Data schemas: TypeScript interfaces and Supabase definitions for characters and items
