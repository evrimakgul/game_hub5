# Roadmap Reset v10 (Phase 1 Combat Encounter Completion)

This roadmap is the active implementation source of truth for this branch.

## Ground Rules
- Keep the current player flow, DM flow, character sheets, local persistence, and DM NPC creation intact.
- Preserve working encounter behavior unless a change is required by an identified defect or this roadmap.
- Use `Basic_Rules5.txt`, `T1_Supernatural_Powers5.txt`, `json_refs/powers.json`, and `json_refs/item_rules.json` as rule inputs.
- Damage resolution must not clamp HP at `0`; negative HP stays visible.
- Keep the current `Action` / `Effect` spell runtime, power registry, and passive provider registry as the internal direction for future power work.
- Treat combat, powers, turn upkeep, summons, aura effects, and items as one aligned system.

## Baseline Already Present
- Combat dashboard staging, parties, initiative ordering, and DM combat encounter page.
- Player and DM character sheets with local character persistence.
- DM runtime editing, roll helper, active power effects, temporary inspiration, temporary HP, negative HP, typed intel snapshots, and encounter-visible status tags.
- Shared T1 runtime already present for:
  - Awareness `AS` / `AI` / `AC`
  - `Body Reinforcement`
  - `Healing`
  - `Light Support`
  - `Necromancy`
  - `Shadow Control`
  - `Crowd Control`
  - `Elementalist`
- Encounter-only transient summons and ongoing maintained states already exist, but need correction in this phase.

## Completed Phase 1: Combat Encounter Completion

### 1.1 Completed Fixes
- Encounter log labels for generic buff casts now use the real power or action name.
- `Shadow Soldier` summon actions now consume mana correctly.
- `Crowd Control` casting now auto-resolves in-system using `CHA + INT` for caster levels `1-3`, `CHA + INT + CC level` for caster levels `4-5`, and `CHA + WITS` for each target.
- Undead handling now inverts healing and necrotic effects: healing damages undead and necrotic heals undead.

### 1.2 Completed Aura and Summon Rules
- If `Cloak of Shadow` aura is already active, newly created allied `Shadow Soldier` summons inherit it automatically.
- `Light Support` level `5` enemy debuffing is now the enemy-side portion of `Light Aura`, not a separate `Expose Darkness` cast.
- Aura target management can add or remove both ally buffs and enemy debuffs from the same aura source.

### 1.3 Completed Encounter UI Fixes
- Encounter displays now show only one visible `Crowd Control` status tag: `Controlled by <caster>`.
- Inline `Physical Attacks` and `Cast Power Mechanism` sections were replaced with a single `Actions` popover/button.
- Encounter history now opens at `3` visible rows minimum, can be resized taller, and caps at `18` rows.

## Completed Phase 2: Shared Item Model Basics

### 2.1 Shared Item Entities
- Move items to standalone records outside character sheets.
- Character sheets store references instead of embedded full item objects.
- Keep ownership, possession, and active use / equipped state separate.

### 2.2 Item Domain Model
- Implement an extensible TypeScript item model with inheritance for categories:
  - `Item`
  - `Weapon`
  - `Armor`
  - `Jewel`
  - `Mystic`
- Add concrete subtype classes for at least the currently needed weapon and armor categories.
- Keep base visible properties on the item class hierarchy.

### 2.3 Bonus Composition
- Use a compositional `BonusProfile` on every item.
- Base stats are always visible.
- Bonus stats may be hidden but still apply mechanically when the item is equipped or used.

### 2.4 Item Knowledge and `AA`
- Track item bonus knowledge per character, not globally.
- Model identify, mask, and share knowledge state now at the data/rules level.
- Keep inventory `Identify` as the sheet-facing `Artifact Appraisal` shortcut.
- Reuse the standalone item-card revision and sharing infrastructure instead of creating a parallel `AA` system.

### 2.5 Engine Alignment
- Item bonuses must apply based on the character currently using / equipping the item, not the owner.
- Keep the model aligned with combat, sheet rendering, and future persistence.

## Completed Follow-Up: Character Sheet and Encounter Action Flow

### 3.1 Derived Summary Consolidation
- `Active Effects`, `Utility Traits`, `Combat Flags`, and `Power Tracking` now live under `Derived Summary`.
- `CharacterResources` is reduced back to stored resource state only.

### 3.2 Automatic Physical Attacks
- Encounter physical attacks now infer the active profile from equipped weapon hand slots.
- If both weapon hands are empty, use `unarmed`.
- If at least one equipped hand item is explicitly typed as `brawl` and no non-brawl hand item occupies either hand, use the brawl profile.
- Physical attacks now auto-resolve hit, marginal, damage, DR mitigation, and encounter activity logging in-system.

### 3.3 Manual Brute Defiance Trigger
- `Brute Defiance` is no longer scheduled automatically on turn advance.
- The encounter UI now exposes a manual trigger with visible eligibility text.
- The trigger is available only when:
  - `Body Reinforcement` is at least level `2`
  - current HP is between `0` and `-5`
  - the daily revive use is still unspent

### 3.4 Power Runtime Refactor
- Spell preparation now resolves through a light class-based `Action` / `Effect` runtime under `src/engine/`.
- Power-specific spell dispatch now lives in `src/powers/` modules plus a central power registry instead of the old monolithic `prepareCastRequest` spell switch.
- Passive power-derived skill bonuses, mana bonuses, and utility traits now come from a passive provider registry instead of hardcoded branches in `characterRuntime.ts`.
- External UI request shapes, local save compatibility, current powers and spells, and `powers.json` metadata remain intact.

### 3.5 Encounter Execution Engine Refactor
- Encounter request execution, turn advance, upkeep spending, aura cleanup, summon lifecycle merges, and encounter log generation now run through a dedicated `EncounterExecutionEngine`.
- `CombatEncounterPage.tsx` now stays focused on UI orchestration:
  - build requests
  - handle confirmation UI
  - call the engine
  - commit returned state
- The stable `PreparedCastRequest` boundary remains intact.
- Aura-builder redesign remains deferred; this refactor only moved post-prepare execution out of the route.

## Completed Follow-Up: Knowledge System V1

### 4.1 Standalone Knowledge Storage
- Knowledge now lives in standalone local-first collections:
  - `KnowledgeEntity`
  - `KnowledgeRevision`
  - `KnowledgeOwnership`
- These collections persist alongside characters and items.
- Old embedded `intel_snapshot` history rows are discarded during hydration instead of being treated as real long-term storage.

### 4.2 Spell Integration
- `Assess Entity` now creates immutable linked character-card revisions during encounter resolution.
- The caster receives ownership of the new revision.
- `History` remains a log, but linked intel rows now point to the exact revision involved.

### 4.3 Character Sheet UI
- `Game History` now supports linked knowledge rows with hover preview and click/open dialog behavior.
- Character sheets now expose a full-width inline `Knowledge` section.
- The Knowledge section supports:
  - subject grouping
  - revision browsing
  - duplicate
  - edited copy
  - share
  - archive
  - pin
  - compare
  - DM snapshot/manual character-card authoring and grant flows

### 4.4 Current V1 Boundary
- V1 ships character cards only.
- The architecture remains generic enough for future item, place, faction, story, and custom knowledge cards, but those creation flows remain deferred.

## Completed Follow-Up: Remaining Power TODO Pass

### 5.1 `Body Reinforcement`
- `Brute Defiance` is passive again.
- It now auto-schedules when HP is between `0` and `-5`, resolves after one turn, remains `1/day`, and restores `1 / 2 / 4 / 8 / 16` HP by `Body Reinforcement` level.
- Manual encounter-trigger UI for `Brute Defiance` has been removed.

### 5.2 `Crowd Control`
- `Control Entity (CE)` is now the only user-facing spell.
- Controlled-target release is now a contextual encounter action instead of a second spell option.
- Passive replacement is complete:
  - `Crowd Management (CM)` adds `Social` equal to `Crowd Control` level.
  - `Compulsion Guard (CG)` appears at level `5`.

### 5.3 `Elementalist`
- `Elemental Bolt`, `Elemental Cantrip`, and `Elemental Split` are now explicit separate spells.
- The old branchy single-class runtime was replaced with one action class per spell.
- Split-style multi-target behavior now lives on `Elemental Split` instead of being folded into `Elemental Bolt`.

### 5.4 `Healing`
- `Healing` now exposes:
  - `Heal Living (HL)`
  - `Holy Purge (HP)`
  - `Healing Touch (HT)`
- Each spell now resolves through its own action class.
- `Holy Purge` now costs `2` mana.

### 5.5 `Light Support`
- `Light Support` now exposes:
  - `Let There Be Light (LTBL)`
  - `Luminous Restoration (LR)`
  - `Lessen Darkness (LD)`
- Passive `Lunar Bless (LB)` behavior is now reflected through passive mana and utility-trait output.
- `Lessen Darkness` is now an explicit linked level-five cast instead of being folded into the default aura cast.

### 5.6 `Necromancy`
- `Necromancy` now exposes:
  - `Non-Living Warriors` as the parent summon spell, with `Non-Living Skeleton`, `Non-Living Skeleton King`, and `Non-Living Zombie` selected through the `Summon` field.
  - `Necrotic Touch`
  - `Necromancer's Bless`
- Passive `Necromancer's Deception` progression is now reflected in the passive provider.
- Summon replacement now respects subtype replacement for the new visible necromancy summon variants.

### 5.7 `Shadow Control`
- `Shadow Control` now exposes:
  - `Smoldering Shadow`
  - `Shadow Walk`
  - `Shadow Walk and Attack`
  - `Shadow Manipulation`
  - `Shadow Fighter`
- Passive `Sleek Visage` cosmetic behavior is reflected through the passive provider.
- `Smoldering Shadow` now drops the old intimidation bonus and uses the newer stealth + AC progression.

## Completed Follow-Up: Encounter Cast UI, Aura Lifecycle, And Summon Dismiss

### 6.1 Cast Form Standardization
- Active cast forms now consistently expose the `Spell` step, including powers that currently have only one visible spell.
- Spell-specific fields remain conditional after the spell step, such as target, stat, mode, damage type, summon, attack resolution, extra mana, and healing allocation.
- `Necromancy` summon casting now uses `Power > Spell: Non-Living Warriors > Summon subtype`.

### 6.2 Aura Lifecycle
- Aura spells remain dedicated aura spells.
- Aura beneficiary selection is explicit where the aura can affect other combatants.
- Linked aura effects remain tied to the caster-owned source aura, so removing the source aura clears beneficiary effects.
- `Lessen Darkness` updates the source aura target list so its linked debuffs are cleaned up with the source.

### 6.3 Summon Dismiss UI
- `Necromancy` and `Shadow Control` summons now expose contextual `Dismiss Summon` actions in the caster action menu.
- Dismiss remains summon-management behavior, not a normal cast-form spell.

### 6.4 Ingestion Reference Sync
- The reverse-engineered ingestion reference files now describe the updated cast UI, aura lifecycle, and summon dismiss behavior:
  - `references/power_spell_ingestion_normalized_current.json`
  - `references/power_spell_ingestion_decisions_current.json`
  - `references/power_spell_mechanics_current.json`
  - `references/power_spell_ui_current.json`

## Completed Follow-Up: Item Equip Core And Classic Range Cleanup

### 7.1 Anchor-Slot Equip State
- Character equipment entries now persist explicit `anchorSlot` values on canonical slots.
- Multi-slot items still write their `itemId` into every occupied canonical slot, but all occupied follower entries share the same anchor.
- Hydration and live state updates normalize old slot-only saves into the anchor-aware shape.

### 7.2 Multi-Slot Equip Behavior
- Equip and unequip mutations now operate on anchor groups instead of raw duplicate slot ids.
- Unequipping from a follower slot clears the whole anchored item group.
- Player loadout rendering now distinguishes anchor slots from occupied follower slots.

### 7.3 Hand-State Combat Rules
- `unarmed` now means both `weapon_primary` and `weapon_secondary` are empty.
- `brawl` now means at least one equipped `melee:brawl` item is present and no non-brawl hand item occupies either hand.
- `melee:unarmed` remains readable for compatibility but is deprecated for normal new-item authoring flows.

### 7.4 Classic Ranged Split
- `Short Bow` and `Light Crossbow` are now separate blueprint identities.
- Legacy alias `weapon:ranged_light` now migrates to `range:light_crossbow`.
- Older persisted item catalogs now backfill missing seeded blueprints and item definitions during hydration without overwriting same-id custom edits.
- Crossbow armor penetration now reduces DR during physical attack resolution.
- Unsupported classic bow / crossbow timing and movement rules remain represented as visible notes until the later combat-action extension exists.

## Completed Follow-Up: Supplementary Slots And Item Knowledge UX

### 8.1 Per-Character Supplementary Slot Activation
- Character sheets now persist explicit enabled supplementary slot ids for `orbital`, `earring`, and `charm`.
- Supplementary slots stay hidden on player and DM sheets until enabled for that specific character.
- Disabling a supplementary slot clears that slot's equipped item entry without deleting the shared item itself.

### 8.2 Item-Focused DM Interaction Hub
- The DM dashboard now links to a dedicated item interaction page.
- The hub supports:
  - selecting one or more recipient characters
  - enabling or disabling supplementary slots for those selected characters
  - selecting one shared item
  - generating or refreshing that item's canonical knowledge card
  - inspecting item revisions
  - sharing one selected item revision to multiple characters at once

### 8.3 Item Knowledge Cards
- Item knowledge now uses the existing standalone knowledge collections with `KnowledgeEntity.type = "item"`.
- Item knowledge subjects are item-instance specific, keyed by the shared item id.
- Canonical item-card generation now builds revisioned cards containing:
  - summary / identity
  - visible properties
  - identified bonuses
  - requirements
  - visible notes
  - base description
- Regenerating an item card creates a later canonical revision on the same knowledge entity.

### 8.4 Item Knowledge Sync
- Sharing an item card grants knowledge ownerships to all selected recipients without cloning the revision.
- Item-card sharing now also marks the shared item as learned and visible for those recipients.
- Existing identify / mask item behavior remains intact.
- Successful `Artifact Appraisal` now grants ownership of the current canonical item-card revision for the viewer.
- If the shared item has changed since the latest canonical revision, `Artifact Appraisal` refreshes the canonical revision first and then grants that later revision.
- Successful `Artifact Appraisal` also appends linked history rows to the exact granted item-card revision.
- Hidden item bonus visibility now keys off ownership of the current item-card revision rather than any stale older revision.

## Completed Follow-Up: World Casting V1

### 9.1 `Known Powers` World Cast Surface
- Character sheets now expose out-of-combat `Use` actions inline in `Known Powers`.
- Clicking `Use` opens a small inline cast panel for that specific power row.
- The world-cast panel only exposes fields required by the selected supported variant, such as target and stat choice.
- Variants that remain encounter-only are shown as unavailable outside combat with explicit copy.

### 9.2 Shared Casting Core
- Casting now declares an explicit environment: `world` or `encounter`.
- Shared cast-form state and shared prepared-cast request execution now sit under both character-sheet and encounter casting.
- Encounter casting remains the specialized adapter for initiative, turn state, combat-only validation, and other encounter semantics.

### 9.3 World Execution Backend
- A dedicated world execution path now applies supported prepared cast results directly to app state.
- World execution currently supports:
  - mana spend
  - healing and resource changes
  - persistent sheet-level active effects
  - status tags
  - usage counters
  - history rows
  - knowledge updates
- World execution rejects encounter-only payloads such as damage applications, summon changes, ongoing encounter state changes, and encounter activity log entries.

### 9.4 Current World-Supported Variant Scope
- World casting V1 currently supports:
  - `Assess Entity`
  - `Body Reinforcement`
  - `Healing Touch`
  - `Luminous Restoration`
- Hostile, summon, aura, multi-target, and timing-sensitive variants remain encounter-only in this pass.

### 9.5 `Artifact Appraisal` Backend Unification
- Inventory `Identify` remains the user-facing shortcut for `Artifact Appraisal`.
- The shortcut now executes through the shared world-casting backend and item-knowledge plumbing instead of a separate item-only implementation path.
- `Artifact Appraisal` now grants the viewer the current canonical item-card revision, refreshing canonical content first when the shared item no longer matches the latest revision.
- Successful `Artifact Appraisal` writes linked history rows to the granted revision.
- General multi-recipient distribution continues to reuse the DM item interactions hub and the existing knowledge share flow instead of introducing a second AA-specific sharing surface.

### 9.6 `KNOW-V2-01` Knowledge Subject Expansion
- The standalone knowledge model now covers `place`, `faction`, `story`, and `custom` subjects in addition to character and item cards.
- DM-only authoring now lives on a dedicated `/dm/knowledge` route instead of overloading the player-sheet character-card editor.
- New non-character/item subjects create stable reusable subject entities with generated `subjectKey` values, and later canonical revisions attach to the same entity.
- Saving with recipients grants the same revision to multiple characters through the existing ownership/share model; saving without recipients persists the canonical revision without creating ownerships.
- The existing player-side Knowledge Library continues to browse, compare, pin, archive, duplicate, share, and open owned revisions across mixed subject types.

### 9.7 `ITEM-VAL-01` Persisted Item Value
- Shared items now persist `baseStrength`, computed `anchorValue`, and optional `anchorValueOverride` as item-instance fields.
- `bonusStrength` for anchor-value math remains identical to PP.
- Computed anchor value now uses `max(1, (((bonusStrength * 49_977) + 1) * (1 + baseStrength)))`.
- `baseStrength` defaults to `0`, is DM-authored per item, and does not auto-derive from blueprint/base stats in V1.
- Anchor values now recompute automatically on item create, hydrate, update, retype, and blueprint-sync flows, while `anchorValueOverride` remains the effective displayed value until cleared.
- DM item edit and list surfaces now expose computed and effective value without surfacing value fields on player item views.

### 9.8 `UNARMORED-BASELINE-01`
- Characters now persist `apparelMode: humanoid | none` as sheet state.
- `clothing / robes` remain the existing body-slot item baseline at `Initiative +2, DR +0`.
- Humanoid characters with no chest/body item equipped now gain a separate naked-state baseline of `+3 Initiative`.
- Characters using `apparelMode: none` opt out of that naked-state initiative bonus, which keeps beasts/mobs/creatures from inheriting humanoid clothing assumptions by default.

### 9.9 Mob, Group, And Portal Authoring Workshop V1
- DM tooling now includes three dedicated routes:
  - `/dm/mobs`
  - `/dm/mob-groups`
  - `/dm/portals`
- Mobs now exist as standalone DM-authored `MobTemplate` records instead of living only in the DM character library.
- Mob templates persist a character-like sheet core plus mob-only metadata:
  - challenge rating
  - theme tags
  - role
  - behavior tags
  - loot
  - designer notes
- Mob groups now exist as first-class reusable `MobGroup` records with quantity and member-level override support, plus editable target total CR and party mean CR fields.
- Portal templates now exist as standalone `PortalTemplate` records with nested `PortalStage` arrays.
- Portal stages currently support:
  - scene text
  - environment tags
  - target total CR
  - referenced mob groups with quantity multipliers
  - traps
  - chests
  - objective notes
  - final-stage boss flag
- The Codex/manual workflow is now a strict import/export bridge:
  - `/dm/portals` is now the preferred portal-first entrypoint
  - the website can now build `portal_bundle` request packets that start from portal concept/theme and carry portal -> stage -> difficulty context
  - Codex returns strict JSON payloads
  - the website imports and validates those payloads
  - `portal_bundle` import now creates linked mobs, groups, and the portal in one pass
- Authoring difficulty controls now exist across mobs, groups, and portals:
  - mob CR
  - group target total CR
  - group party mean CR
  - portal party mean CR
  - per-stage target total CR
- The mob editor now shows live derived combat summary values using the same character runtime math used elsewhere in the app.
- Encounter integration now exports saved mob groups or saved portal stages into encounter-owned mob instances for the current combat only.
- Encounter-owned mob instances now reuse the combat sheet/runtime path without polluting the normal persistent character library.
- Portal progression remains manual in V1:
  - author the portal
  - export one stage into combat
  - resolve combat
  - export the next stage later if needed

## Completed Follow-Up: Item Creation And Auction House V1

### 10.1 Auction Entry Model And Import Surface
- Add local-first auction-entry records sourced from the `Action House` workbook vocabulary and rows.
- First pass may use pasted/exported row data from the workbook instead of in-browser `.xlsx` parsing.
- Preserve raw `Bonus`, `Remarks`, `Item Labels`, `Bid`, `Buyout`, and stock text for later rule-complete parsing rather than discarding them.

### 10.2 Auto Item Creation Mechanism
- DM tooling must create shared item draft records directly from auction entries.
- Auto-created drafts should infer the closest existing blueprint/category from auction-house vocabulary using current item-definition helpers.
- Raw imported bonus/effect text should land as draft item notes/provenance in V1 instead of pretending to be fully parsed mechanical bonuses.
- Auto-created items must retain a stable source link back to the originating auction entry.

### 10.3 Item Creation Workflow Expansion
- Expand the DM item workflow so item creation is faster than a blank `New Item` flow:
  - create from auction entry
  - duplicate an existing shared item
  - jump directly into detailed item editing after creation
- Keep item creation, editing, deletion, and assignment DM-only; player/NPC sheet surfaces remain consumers of assigned shared items.

### 10.4 Auction House Route
- Add a dedicated `/dm/auction-house` route as the catalog-browsing and item-seeding entrypoint.
- The route should support:
  - search/filter/select across auction entries
  - row detail review
  - create-one / create-many item draft actions
  - quick navigation into the shared item editor/list after creation
- Auction pricing/stock are descriptive in V1 only; do not build live bidding, sales, or economy-state automation in this pass.

## Completed Follow-Up: Player Auction Shopping And Stock Transactions

### 10.5 Player Auction Access
- The auction house is now a player-facing shopping surface rather than a DM-only catalog destination.
- Player character sheets now expose a direct navigation action into `/player/auction-house`.
- The player route stays character-specific so purchases resolve against the selected character's money and inventory.

### 10.6 Completed Buyout And Bid Transactions
- Auction entries now expose live `Buyout` and `Bid` actions to players when the listed price is available.
- In this pass, the player-side `Bid` action resolves as an immediate completed winning bid rather than a delayed pending-bid system.
- Completing either action now:
  - spends character money
  - creates a new shared item instance from the auction entry
  - links that item to the purchasing character
  - appends a character history row for the transaction

### 10.7 Live Stock Enforcement
- Auction entries now persist live stock counts alongside the original source stock text.
- Each completed player transaction decrements stock by one.
- Transactions are blocked when stock is `0`, the price is unavailable, or the character lacks sufficient money.
- Purchased items now appear in the related character sheet `Items` section through the normal shared-item assignment flow.

## Completed Follow-Up: Player Combat Mode V1

### 11.1 DM Start Combat Trigger
- The combat dashboard now uses an explicit `Start Combat` trigger from the combat-encounter setup card.
- Starting combat still rolls initiative and opens the DM encounter runtime, but it now also seeds the shared player-facing combat surface from the same live encounter state.

### 11.2 Player Combat Route
- Players now have a dedicated `/player/combat` route.
- Player Hub rows and player character sheets now expose `Combat Mode` navigation when that character is part of the active encounter.
- The player combat route is character-specific so masking and `Assess Entity` reveal rules resolve against the selected player character.

### 11.3 Masked Encounter Presentation
- Player combat mode now shows:
  - initiative order
  - encounter parties
  - encounter activity history
- Opponents are masked as pseudo labels such as `Opponent 1`, `Opponent 2`, and opposing party labels are also generalized.
- Party cards expose health bars only; raw HP numbers are not shown on the player surface.
- Real opponent names stay hidden unless the viewing character owns knowledge for that target through `Assess Entity`.

### 11.4 AE Reveal And Current V1 Boundary
- Assessed opponents now expose an inline expand/collapse knowledge-card preview directly inside player combat mode.
- Encounter activity log output is sanitized on the player route so hidden opponent names are replaced by the same masked labels used elsewhere on the page.
- Player combat mode now exposes own-turn action controls for the selected viewing character, but it is not a full timing/action-budget engine.

### 11.5 Local Encounter Sharing
- Active combat encounter state now persists in the local-first app state payload.
- This local persistence keeps DM and player browser windows aligned on the same live encounter without introducing backend sync.

## Completed Follow-Up: Realtime DM Screen And Session Layer

### 12.1 Supabase Auth And Session Schema
- Added optional Supabase wiring through `@supabase/supabase-js`, `VITE_SUPABASE_URL`, and `VITE_SUPABASE_ANON_KEY`.
- Existing local-only play remains available when Supabase is not configured.
- Added SQL migration coverage for profiles, campaigns, campaign members, game sessions, session characters, session events, pins, and session knowledge records.
- RLS policies are campaign/session membership based, with DM management access and player-limited row access.

### 12.2 DM Screen
- Added `/dm/screen` as the live table control surface.
- The DM Screen supports campaign/session creation, member linking by Supabase user id, local character sync, secret/global rolls, event feed, sharing, rewards, pins, session notes, participant status, and combat shortcuts.
- DM rolls can be public or DM-only and are persisted as session events.

### 12.3 Player Session
- Added `/player/session` for players to join live sessions.
- Players can publish their active character, send hidden rolls to DM, share text or owned cards publicly or to selected characters, and follow filtered session events.
- Character sheets, player hub, combat pages, DM dashboard, and combat pages now link into the live session surfaces.

### 12.4 Sharing And Rewards
- Session events now support `message`, `roll`, `share`, `reward`, `note`, and `pin` kinds with public, limited, DM-only, and DM-and-actor visibility.
- Card sharing reuses the existing knowledge ownership model and can write matching realtime knowledge rows when Supabase is configured.
- DM reward packets update XP earned, inspiration, temporary inspiration, money, positive karma, negative karma, notes, optional card grants, character history, DM audit log, session characters, and persistent reward events.

### 12.5 Current V1 Boundary
- Supabase campaign members are currently added by user UUID, not by email lookup.
- RLS policies are implemented in SQL and still need manual Supabase local/project verification beyond repository unit tests.
- Existing local app state remains the offline/dev truth; live DM/player coordination is authoritative only inside configured Supabase sessions.

## Planned Follow-Up: Personalized Page Design And Auto-Design

### 13.1 View Profile Foundation
- Add a persisted `ViewProfile` model for browser-local personalization.
- Scope profiles by role, route/page, and optionally character id where the page is character-specific.
- Include schema versioning, defaults, reset behavior, and migration-safe hydration.
- Store only safe design tokens and layout preferences, not arbitrary user CSS or JavaScript.
- Define a shared CSS-variable contract for:
  - theme palette
  - accent color
  - density
  - font scale
  - panel style
  - spacing
  - motion level

### 13.2 Safe Manual Customization
- Add an Appearance/Layout drawer reachable from player and DM surfaces.
- Support live preview, save, reset, and profile switching.
- Manual controls should include:
  - theme
  - density
  - font scale
  - section collapse state
  - section pinning
  - allowed section hiding
  - allowed section ordering
- Keep customization constrained by the page section registry.

### 13.3 Page Layout Registry
- Add a per-page registry of customizable sections.
- Each section should declare whether it is:
  - required
  - optional
  - hideable
  - reorderable
  - collapsible
  - required during active combat
- Implement pages in this order:
  - player character sheet
  - player combat mode
  - player auction house
  - DM dashboard
  - DM combat encounter
  - DM authoring pages

### 13.4 Presets
- Add reversible presets before full auto-design.
- Initial presets:
  - combat-focused
  - story-focused
  - caster
  - inventory-heavy
  - DM operations
  - minimal
- Presets should explain what they changed and allow returning to the previous profile.

### 13.5 Auto-Design Recommendations
- Auto-design should recommend a preset plus layout rather than generating unconstrained UI.
- Recommendation inputs can include:
  - role
  - current page
  - character powers
  - inventory/equipment emphasis
  - active combat participation
  - later usage patterns after usage tracking exists
- Auto-design must preview changes and require confirmation before saving.

### 13.6 Guardrails And Limits
- Customization must never reveal hidden combat identity, hidden item bonuses, hidden knowledge, or raw opponent HP.
- Required combat state cannot be hidden during live combat.
- Mobile layouts should use stricter allowed layout changes than desktop layouts.
- V1 remains browser-local until backend/user accounts are reopened.
- Do not add arbitrary user JavaScript or unrestricted CSS in V1.

## Validation
- After each meaningful task group run:
  - `npm run typecheck`
  - `npm test`
  - `npm run build`
- Do not mark a task complete until all three pass after that change group.
- If a pre-existing test failure appears, log and isolate it before continuing.
- Keep tracking files current after every task.
- Update this roadmap when implementation reality changes.

## Deferred
- Future knowledge/intel work should continue building on the standalone revisioned card model rather than inventing parallel subject-specific systems.
- Aura-builder redesign remains deferred:
  - current implementation still uses `buildActivePowerEffect(...)` for both targeted buff spells and aura-source spells
  - the recorded alternative is a dedicated aura builder such as `buildAuraSourceEffect(...)` or `buildAuraSpellEffect(...)`
- Full item-authoring workflow polish beyond the live DM edit/list/interactions/knowledge/value surfaces.
- Richer encounter persistence beyond the current local browser-storage surface for offline/dev mode; live sessions now use the Supabase-backed session layer.
- `python.ipynb` cleanup remains deferred to the literal last cleanup step.
