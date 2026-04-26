# Realtime DM Screen, Secret Rolls, Sharing, And Rewards

Collected: 2026-04-24
Authority: user-approved intended direction
Status: implemented in current code pass

## User Direction

- Add a Supabase-backed realtime session layer while preserving existing local-only play.
- Use Supabase Auth with email/password and Discord OAuth.
- Add a DM Screen at `/dm/screen` and a player session surface at `/player/session`.
- Persist session events for messages, rolls, shares, rewards, notes, and pins with public, limited, DM-only, and DM-and-actor visibility.
- Support DM private rolls and player hidden rolls for DM eyes.
- Let DMs and players immediately share info and cards with all participants or selected recipients.
- Add DM reward controls for XP earned, inspiration, temporary inspiration, money, karma, notes, and optional card grants.
- Keep reward application auditable on character sheets and persistent in the session log.
- Use Supabase tables, RLS, and realtime subscriptions for campaigns, sessions, members, events, session characters, and knowledge ownership.

## Implemented Boundary

- Supabase configuration is environment-gated through `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
- Existing local-only play remains available when Supabase is not configured.
- Campaign membership is currently added by Supabase user UUID, not email lookup.
- RLS SQL is included as a migration, but final policy validation still requires a real Supabase project or local Supabase SQL checks.
