---
title: Realtime Sessions
topic: domains
kind: domain
status: active
updated: 2026-04-24
confidence: medium
---

## Summary

Live DM/player coordination now has an optional Supabase-backed session layer. Local-only play remains available, but configured live sessions use Supabase Auth, Postgres, RLS, realtime subscriptions, persistent events, secret rolls, sharing, and reward packets.

## Current State

- Supabase client wiring lives in `src/lib/supabaseClient.ts` and `src/state/onlineSession.tsx`.
- Environment gates are `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
- The migration `supabase/migrations/202604240001_realtime_dm_screen.sql` defines profiles, campaigns, campaign members, game sessions, session characters, session events, pins, and knowledge session tables.
- Repository helpers live in `src/lib/realtimeSessionRepository.ts`.
- Session event/reward/share logic lives in `src/lib/realtimeSession.ts`.
- DM route `/dm/screen` supports campaign/session creation, participant linking, character sync, secret/global rolls, event feed, sharing, reward packets, pins, notes, and combat shortcuts.
- The DM Screen lists only campaigns where the signed-in account has `campaign_members.role = 'dm'`.
- Player route `/player/session` supports character publishing, hidden rolls for DM, public/limited sharing, owned-card sharing, event feed, and shortcuts back to character/combat surfaces.
- Player session campaign access remains membership-based, so the same account can be a DM in one campaign and a player/member in another.
- Session event visibility supports `public`, `limited`, `dm_only`, and `dm_and_actor`.
- Reward packets update character sheets, history, DM audit log, session character rows, optional card grants, and persistent reward events.

## Intended Direction

- Treat Supabase sessions as the authoritative path for live DM/player coordination.
- Keep browser-local state as the offline/dev path.
- Continue reusing the existing knowledge ownership model for card sharing instead of adding a parallel card-share system.
- Verify RLS policies against a real Supabase local/project environment before relying on them for production privacy.

## Key Decisions

- Email/password and Discord OAuth are V1 auth targets.
- DM private rolls are persisted as `dm_only` events.
- Player hidden rolls are persisted as `dm_and_actor` events.
- Player shares are immediate, not DM-approved.
- Rewards use deltas and clamp nonnegative tracked resources.
- Campaign membership is currently managed by Supabase user UUID.
- Profile bootstrap tolerates both the current `profiles.id` schema and older `profiles.user_id` schemas.

## Deferred / Open

- Manual Supabase RLS verification remains required.
- Adding campaign members by email/display-name lookup is not implemented yet.
- Richer session lifecycle controls beyond active-session creation are future work.
- Manual Supabase SQL migration `202604240002_account_access_hardening.sql` should be run on projects that already created a legacy `profiles` table.

## Sources

- [src/lib/supabaseClient.ts](../../src/lib/supabaseClient.ts)
- [src/state/onlineSession.tsx](../../src/state/onlineSession.tsx)
- [src/lib/realtimeSession.ts](../../src/lib/realtimeSession.ts)
- [src/lib/realtimeSessionRepository.ts](../../src/lib/realtimeSessionRepository.ts)
- [src/routes/DmScreenPage.tsx](../../src/routes/DmScreenPage.tsx)
- [src/routes/PlayerSessionPage.tsx](../../src/routes/PlayerSessionPage.tsx)
- [supabase/migrations/202604240001_realtime_dm_screen.sql](../../supabase/migrations/202604240001_realtime_dm_screen.sql)

## Raw

- [USER-REALTIME-SESSION-2026-04-24](../../raw/user-approved/2026-04-24-realtime-dm-screen-session.md)
