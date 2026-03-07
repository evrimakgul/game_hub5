# Roadmap Reset v4 (Engine Removed)

This roadmap is the active implementation source of truth for this branch.

## Ground Rule
- Keep the current player flow, DM flow, character sheets, local character persistence, and DM-side NPC creation intact.
- Keep the combat dashboard as a roster/setup page only.
- Remove the current combat engine, combat encounter UI, and all current engine-plan documents from this branch.
- Remove dormant Supabase/backend artifacts from this branch. If backend work returns later, it will be redesigned from scratch.
- Preserve the source reference files under `references/originals/` and the derived JSON files.

## Phase 0 - Engine Reset
0.1 Remove the current combat engine files, tests, and engine-specific reference documents.
0.2 Keep the combat dashboard, remove the pseudo NPC quick-add path, and leave the combat encounter button inactive.
0.3 Keep player-created and DM-created characters working locally through the current sheet flows.
0.4 Remove Supabase schema docs, local migration artifacts, and unused client wiring from this branch.
0.5 Keep only the reference documents that still support the current local-only branch state.

## Branch State Target
- No combat engine remains on this branch.
- No combat encounter page remains on this branch.
- The combat dashboard remains available as a non-engine roster page.
- No active Supabase/backend implementation remains on this branch.
- A new combat engine can be introduced later from this clean baseline.
