---
title: Realtime Sessions
topic: domains
kind: domain
status: active
updated: 2026-05-13
confidence: high
---

## Summary

Live DM/player coordination now has an optional Supabase-backed session layer. Local-only play remains available, but configured live sessions use Supabase Auth, Postgres, RLS, realtime subscriptions, persistent events, secret rolls, sharing, and reward packets.

## Current State

- Supabase client wiring lives in `src/lib/supabaseClient.ts` and `src/state/onlineSession.tsx`.
- Environment gates are `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
- The base migration `supabase/migrations/202604240001_realtime_dm_screen.sql` defines profiles, campaigns, campaign members, game sessions, session characters, session events, pins, and knowledge session tables.
- Follow-up migrations harden account access and campaign ownership behavior:
  - `202604240002_account_access_hardening.sql` tolerates both `profiles.id` and older `profiles.user_id` schemas and adds safer session-character insert policy coverage.
  - `202604250001_campaign_owner_membership_policy.sql` restores owner-only campaign-member insertion through `public.is_campaign_owner(campaign_id)`.
  - `202604250002_backfill_campaign_owner_memberships.sql` backfills campaign-owner DM memberships for existing campaigns.
  - `202605120001_campaign_character_realtime.sql` adds `public.campaign_characters` to the Supabase realtime publication when the publication exists.
- Repository helpers live in `src/lib/realtimeSessionRepository.ts`.
- Session event/reward/share logic lives in `src/lib/realtimeSession.ts`.
- DM route `/dm/screen` supports campaign/session creation, participant linking, character sync, secret/global rolls, event feed, sharing, reward packets, pins, notes, and combat shortcuts.
- DM route `/dm/screen` also exposes UUID-based player addition to the selected campaign before session add/remove.
- The DM Screen lists only campaigns where the signed-in account has `campaign_members.role = 'dm'`.
- Player route `/player/session` supports character publishing, hidden rolls for DM, public/limited sharing, owned-card sharing, event feed, and shortcuts back to character/combat surfaces.
- Player campaign self-join refreshes campaign members and active sessions immediately after the join succeeds.
- Player route `/player/session` now also shows a live combat follow panel when the DM encounter page publishes combat to the selected live session.
- Live combat publishing writes a DM-only full encounter snapshot and per-player masked combat views, so players subscribe only to their character's safe view.
- Player session campaign access remains membership-based, so the same account can be a DM in one campaign and a player/member in another.
- Session event visibility supports `public`, `limited`, `dm_only`, and `dm_and_actor`.
- Reward packets update character sheets, history, DM audit log, session character rows, optional card grants, and persistent reward events.
- Campaign character snapshots are now updated when the DM rewards a campaign character, not only when the player publishes.
- Player-owned local character sheets hydrate from matching Supabase campaign/session snapshots through both initial fetch and realtime `campaign_characters` subscriptions, so reward deltas applied by the DM appear on the player's own character sheet.
- DM campaign character views can hydrate a selected non-owned campaign sheet through the same visible campaign-character path, while player flow still filters visible player characters by signed-in account owner.

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
- Player character ownership is keyed by Supabase user id in live-session contexts; legacy local-only player characters without an owner id remain visible to avoid deleting old offline work.

## Deferred / Open

- Manual Supabase RLS verification remains required.
- Adding campaign members by email/display-name lookup is not implemented yet.
- Richer session lifecycle controls beyond active-session creation are future work.
- Player-side Supabase combat action submission is not implemented yet; DM encounter execution remains authoritative.
- Existing Supabase projects may need the follow-up hardening, owner-membership, and campaign-character realtime publication migrations applied after the base realtime migration.

## Sources

- [src/lib/supabaseClient.ts](../../src/lib/supabaseClient.ts)
- [src/state/onlineSession.tsx](../../src/state/onlineSession.tsx)
- [src/lib/realtimeSession.ts](../../src/lib/realtimeSession.ts)
- [src/lib/realtimeSessionRepository.ts](../../src/lib/realtimeSessionRepository.ts)
- [src/lib/onlineCharacterSync.ts](../../src/lib/onlineCharacterSync.ts)
- [tests/onlineCharacterSync.test.ts](../../tests/onlineCharacterSync.test.ts)
- [src/routes/DmScreenPage.tsx](../../src/routes/DmScreenPage.tsx)
- [src/routes/PlayerSessionPage.tsx](../../src/routes/PlayerSessionPage.tsx)
- [src/routes/PlayerHubPage.tsx](../../src/routes/PlayerHubPage.tsx)
- [src/routes/PlayerCharacterPage.tsx](../../src/routes/PlayerCharacterPage.tsx)
- [supabase/migrations/202604240001_realtime_dm_screen.sql](../../supabase/migrations/202604240001_realtime_dm_screen.sql)
- [supabase/migrations/202604240002_account_access_hardening.sql](../../supabase/migrations/202604240002_account_access_hardening.sql)
- [supabase/migrations/202604250001_campaign_owner_membership_policy.sql](../../supabase/migrations/202604250001_campaign_owner_membership_policy.sql)
- [supabase/migrations/202604250002_backfill_campaign_owner_memberships.sql](../../supabase/migrations/202604250002_backfill_campaign_owner_memberships.sql)
- [supabase/migrations/202605120001_campaign_character_realtime.sql](../../supabase/migrations/202605120001_campaign_character_realtime.sql)

## Raw

- [USER-REALTIME-SESSION-2026-04-24](../../raw/user-approved/2026-04-24-realtime-dm-screen-session.md)
