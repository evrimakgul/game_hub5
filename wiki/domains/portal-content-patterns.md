---
title: Portal Content Patterns
topic: domains
kind: domain
status: active
updated: 2026-04-19
confidence: medium
---

## Summary

The user-provided Grey Portal source is a strong content reference for how this game's portals are actually authored: portal scenarios are not abstract dungeon maps, but themed incident dossiers with staged encounters, environmental framing, loot, and closing rewards.

## Current State

- Current live code already supports:
  - local-first character and DM flows
  - encounter runtime and combat execution
  - shared items and loot-capable item records
  - DM NPC creation/editing
- Current live code now also supports:
  - standalone mob templates
  - explicit mob CR and derived-combat summary review
  - reusable mob groups
  - group target / party-mean CR controls
  - portal templates with nested staged composition
  - portal-level party-mean CR plus per-stage target CR controls
  - portal-first `portal_bundle` request/import flow
  - combat-dashboard export of saved groups or portal stages into encounter-owned mobs
- The Grey Portal source shows repeated authored content structure:
  - real-world location and incident report
  - portal depth/tier marker such as `D:1`, `D:2`, `D:3`
  - environment/scene setup with traversal constraints
  - ordered mob groups or packs
  - optional traps, chests, rescues, and stealth reveals
  - boss pack near the end
  - portal-closing reward
- Mob entries in the source consistently include:
  - stats
  - skills
  - combat values such as attack, damage, AC, HP, DR, and sometimes mana
  - powers or supernatural capabilities when relevant
  - special rules like vulnerabilities, resistances, ambush logic, support logic, poison/disease, or auto-join timing
  - loot tables
- Portal content is strongly theme-linked:
  - sewer
  - botanic/plant
  - undead dungeon
  - infernal/fire
  - swamp
  - aquatic
  - school
  - social/horror/pub
  - gym
  - glass/mirror

## Intended Direction

- Future mob and portal authoring should stay aligned with this authored scenario format instead of drifting toward a purely abstract random-dungeon generator.
- Portal authoring now supports fast creation of:
  - theme
  - staged encounter sequence
  - stage-by-stage difficulty budgets
  - boss gate
  - loot/reward structure
  - optional side-objectives or branching scene elements
- Mob authoring now preserves character-like sheet structure while allowing content-specific behavior tags and special rules.
- The current AI bridge remains manual import/export through Codex request packets rather than a live website-to-LLM connection.

## Key Decisions

- Treat the Grey Portal source as content-design evidence, not as current runtime implementation.
- Keep the distinction between:
  - reusable mob definitions
  - encounter packs/groups
  - portal-stage composition
- Theme is a first-class authoring dimension, not a cosmetic label layered on later.

## Deferred / Open

- Full portal-run state is not live yet.
- Portal boss-clear reward automation and exit unlocking are not live yet.
- The long-term live-LLM integration path remains open; only the manual import/export bridge is implemented.

## Sources

- [references/current_notes.md](../../references/current_notes.md)
- [references/npc_template_reference.md](../../references/npc_template_reference.md)

## Raw

- [USER-GREY-PORTALS-2026-04-19](../../raw/user-provided/2026-04-19-grey-portals.txt)
