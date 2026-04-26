# Current Notes

This file tracks active reminders for the current implementation block.

## Active Implementation Block
- The focused Phase 1 combat encounter completion pass is complete.
- The follow-up character-sheet and encounter action-flow pass is also complete.
- Knowledge System V1 foundations are implemented for standalone character and item cards.
- The remaining power TODO rewrite pass is now complete.
- The encounter cast UI standardization, aura lifecycle cleanup, summon dismiss UI, and ingestion reference sync pass is now complete.
- The persisted item-definition refactor is now complete.
- The anchor-slot / multi-slot equipment pass is now complete.
- The hand-state combat cleanup and classic ranged split pass is now complete.
- The supplementary-slot and item-knowledge UX pass is now complete.
- The World Casting V1 pass is now complete.
- The `AA-01` Artifact Appraisal integration pass is now complete.
- `KNOW-V2-01` and `ITEM-VAL-01` are now complete.
- The Mob / Group / Portal Authoring Workshop V1 pass is now complete.
- Item Creation And Auction House V1 is now complete.
- Player Auction Shopping follow-up is now complete.
- Player Combat Mode V1 is now complete.
- Realtime DM/Player Session V1 is now complete.
- `VIEW-PERSONALIZATION-01` is now the planned next follow-up: personalized player/DM page design with safe manual controls, page layouts, presets, and automatic recommendations.
- Validation passed at the end of the pass: `npm run typecheck`, `npm test`, and `npm run build`.

## Confirmed Rules For This Block
- HP must stay capable of going negative.
- `Heal Living (HL)` mana cost is always `2`.
- `Holy Purge (HP)` unlocks at level `3` and mana cost is always `2`.
- `Healing Touch (HT)` stays at `2 uses per target per day`.
- `Crowd Control` initial cast costs `0`; upkeep only spends mana.
- `Crowd Control` auto-resolves in-system using caster `CHA + INT` at levels `1-3`, caster `CHA + INT + CC level` at levels `4-5`, vs target `CHA + WITS`; ties fail.
- Encounter-visible `Crowd Control` exposes `Control Entity (CE)` only; release is contextual.
- `Shadow Walk` is an encounter mobility action with no direct numeric damage effect.
- Healing damages undead; necrotic heals undead.
- `Lessen Darkness (LD)` is now a separate linked Light Support cast at level `5`.
- Items will move to shared standalone records outside character sheets.
- Encounter physical attacks now resolve automatically from equipped loadout state.
- `Brute Defiance` is passive again: 1/day, HP `0` to `-5`, resolves after one turn, and restores `1 / 2 / 4 / 8 / 16` HP by BR level.
- Item blueprints now resolve through persisted `ItemCategoryDefinition` and `ItemSubcategoryDefinition` records instead of hardcoded category/subtype branching.
- Equipment entries now persist explicit `anchorSlot` values, and multi-slot items occupy canonical follower slots through the anchor model.
- Shields still resolve to the secondary hand.
- One-handed hand items still prefer primary then secondary.
- Rings still resolve left then right.
- `unarmed` now means both weapon hands are empty.
- `brawl` now means at least one equipped `melee:brawl` item is present and no non-brawl hand item occupies either weapon hand.
- `melee:unarmed` remains readable for compatibility, but it is deprecated for normal new-item authoring.
- Classic ranged blueprints are now split so `Short Bow` and `Light Crossbow` are separate identities.
- Crossbow armor penetration now reduces DR during physical attack resolution.
- Older saves now backfill missing seeded item blueprints and item definitions during hydration without overwriting same-id persisted edits.
- Supplementary `orbital`, `earring`, and `charm/talisman` slots now use persisted per-character activation and stay hidden until enabled.
- Item knowledge cards now exist as standalone `KnowledgeEntity.type = "item"` revisions keyed by shared item id.
- Sharing an item card now also marks that shared item learned and visible for the recipients.
- Inventory `Identify` remains the user-facing `Artifact Appraisal` shortcut.
- Successful `Artifact Appraisal` now grants ownership of the current canonical item-card revision for the viewer.
- If the shared item has changed since the latest canonical revision, `Artifact Appraisal` refreshes the canonical revision first and then grants that later revision.
- Successful `Artifact Appraisal` appends a linked history row to the granted knowledge revision.
- Hidden item bonus rendering now keys off ownership of the current item-card revision for the viewer, not a separate raw identify flag or any stale older revision.
- Character sheets now support limited out-of-combat casting from `Known Powers`.
- World-cast V1 currently supports `Assess Entity`, `Body Reinforcement`, `Healing Touch`, and `Luminous Restoration`.
- World-unsupported variants stay visible but unavailable outside combat.
- Inventory `Identify` now routes through the shared world-casting backend for `Artifact Appraisal`.
- Knowledge cards now support DM-authored `place`, `faction`, `story`, and `custom` subjects through the dedicated DM Knowledge Hub.
- New non-character/item knowledge subjects use stable standalone entities plus canonical revisions; later revisions stay attached to the same subject entity instead of cloning a new subject.
- DM-authored `story` knowledge uses `story_reward`; DM-authored `place`, `faction`, and `custom` knowledge use `dm_grant`.
- Shared items now persist `baseStrength`, computed `anchorValue`, and optional `anchorValueOverride`.
- `bonusStrength` for item value remains identical to PP.
- Item anchor value now computes as `max(1, (((bonusStrength * 49_977) + 1) * (1 + baseStrength)))`.
- `baseStrength` is a DM-authored per-item field that defaults to `0`; item blueprints do not auto-contribute base economic strength in V1.
- Auction-house rows now persist as standalone local-first catalog entries.
- Auto-created auction items now infer the closest current blueprint, keep an `auctionEntryId` source link, and preserve raw auction bonus text as draft notes instead of pretending it was fully parsed into mechanics.
- The auction house is now player-facing through `/player/auction-house` and the player character-sheet `Items` section.
- Player-side `Buyout` and `Bid` transactions now spend character money, create/assign a shared item to the buying character, append a history row, and decrement live stock by one.
- Player-side `Bid` currently resolves as an immediate winning-bid completion rather than a delayed pending-bid lifecycle.
- Auction entries now persist live `stockQuantity` values alongside the original imported stock text.
- Active combat encounters now persist in the local-first app-state payload so DM and player browser windows can read the same live encounter.
- Player combat mode now lives at `/player/combat` and shows initiative order, masked party health bars, and encounter activities for the selected player combatant.
- Hidden opponents now stay masked as `Opponent N` on the player combat route unless the viewing character owns an `Assess Entity` knowledge card for that target.
- Supabase-backed live sessions now exist behind `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`; local-only play remains available when those env vars are absent.
- Live session routes are `/dm/screen` and `/player/session`.
- Session events persist rolls, shares, rewards, notes, and pins with public, limited, DM-only, and DM-and-actor visibility.
- DM private rolls are `dm_only`; player hidden rolls are `dm_and_actor`.
- Live card sharing and reward card grants reuse knowledge ownerships and can write matching Supabase knowledge rows.
- DM reward packets update XP earned, inspiration, temporary inspiration, money, karma, character history, DM audit entries, session character rows, and a persistent reward event.
- `COMBAT-ACT-01` is intentionally pushed to the very end of the project and may be skipped entirely unless priorities change.
- Characters now persist `apparelMode: humanoid | none`.
- `clothing / robes` remain the existing chest-item baseline at `Initiative +2, DR +0`.
- Humanoid characters with no chest/body item equipped now gain a separate naked-state baseline of `+3 Initiative`.
- Characters with `apparelMode: none` opt out of that naked-state initiative bonus.
- DM tooling now includes dedicated `/dm/mobs`, `/dm/mob-groups`, and `/dm/portals` routes.
- Mobs now persist as standalone `MobTemplate` records with character-like sheet cores plus role / behavior / loot metadata.
- Mob templates now also persist explicit challenge ratings and show live derived combat summary values in the mob editor.
- Mob groups now persist as standalone `MobGroup` records with quantity and member-level override support plus editable target total CR and party mean CR fields.
- Portal templates now persist as standalone `PortalTemplate` records with nested `PortalStage` arrays, portal-level party mean CR, and per-stage target total CR fields.
- The preferred Codex authoring workflow is now portal-first on `/dm/portals`: the website can build `portal_bundle` request packets, Codex returns strict JSON payloads, and the website can import a full linked portal bundle of mobs, groups, and the portal in one pass.
- Combat setup can now add saved mob groups or saved portal stages as encounter-owned mob instances without saving those exported mobs into the normal character library.

## Known Structural Gaps
- Shared item editing is still not a full end-state authoring workflow, but item-card generation/share and supplementary-slot activation now exist in the DM item interactions hub.
- Auction-house imports still preserve raw bonus/effect text as draft notes; rule-complete parsing into structured mechanical bonuses remains future work.
- Player-side bidding does not yet model pending bids, auction timers, losing bids, or delayed settlement; the current UI resolves only completed winning bids.
- DM tooling now includes a dedicated Knowledge Hub route for non-character/item subject authoring.
- DM item tooling now includes dedicated definition management for item categories and subcategories.
- Mob templates currently use a focused mob editor rather than the full player-sheet UI.
- Portal progression/run-state automation is still manual; V1 exports one stage at a time into the existing combat dashboard instead of owning an end-to-end portal-run state machine.
- Player combat mode has own-turn action controls, but full timing/action-budget enforcement remains deferred.
- Personalized page design is not implemented yet; it is now tracked as the next planned follow-up.
- Supabase RLS policies are implemented in migration SQL, but still need manual verification against Supabase local/project roles.
- DM campaign members are currently added by Supabase user UUID rather than by email lookup.
- The DM Screen now lists only campaigns where the signed-in account has `campaign_members.role = 'dm'`; player session access remains membership-based so the same account can be a DM in one campaign and a player/member in another.
- Profile bootstrap tolerates both `profiles.id` and older `profiles.user_id` schemas so a malformed profile table no longer blocks sign-in.
- Encounter cast UI now uses a stable `Power > Spell > ...` flow for active casts.
- Aura behavior now uses explicit beneficiary selection where needed and keeps linked effects tied to the caster-owned aura source.
- `Necromancy` and `Shadow Control` summon dismissal is now exposed as contextual caster action UI.
- The four reverse-engineered power/spell ingestion reference JSON files now describe the updated cast UI / aura lifecycle / summon-dismiss behavior.
- Classic bow / crossbow action-cost and movement rules are still represented only as visible notes; runtime timing support remains deferred to the later combat-action pass.
- `Assess Entity` should keep card output totals-only for entities without exposing hidden item bonus details or item-card internals.
- General out-of-combat casting remains intentionally narrow in V1; hostile, summon, aura, multi-target, and timing-sensitive variants are still encounter-only.

## Knowledge System V1
- Keep `History` as an event log.
- Knowledge now uses standalone revisioned records rather than history-only storage.
- Detailed implementation notes now live in `references/knowledge_card_design.md`.
- Working terminology:
  - `KnowledgeEntity` = the subject, such as a character, item, place, faction, or story topic.
  - `KnowledgeRevision` = one immutable version/snapshot of that subject's known information.
  - character ownership stores which revisions a character currently possesses.
- A character may own multiple revisions of the same subject at once.
- Edited/shared copies should create descendant revisions rather than overwriting the prior one.
- History entries now reference exact revisions so the UI can preview or open the specific version involved in the event.
- Character sheets now expose a dedicated inline `Knowledge` area for browsing owned subjects and revisions separately from `History`.
- V1 implementation scope:
  - character cards
  - item cards
  - duplicate / edited copy / share / archive / pin / compare
  - DM character snapshot/manual creation and grant flows
  - DM item-card generation/refresh and one-to-many share flows
  - legacy embedded intel history rows are intentionally removed during hydration

## Deferred But Recorded
- Full item-authoring UX remains deferred.
- Full portal-run state, boss-clear reward automation, and exit unlocking remain deferred.
- Backend sync and richer encounter persistence beyond the current local browser-storage surface remain out of scope.

## Resolved Design Direction
- Aura spells should stay modeled as dedicated aura spells, not as normal targeted buffs.
- `AuraSpellAction` remains the right action category.
- The required follow-up is not a new spell-class introduction; it is a targeting and lifecycle cleanup so aura targets are explicit and source-linked.
