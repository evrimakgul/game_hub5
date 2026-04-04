# Knowledge Card Design

This note records the concrete implementation direction for revisioned knowledge cards.

## Purpose
- Keep `History` as an event log.
- Store actual knowledge as standalone records that can be owned, copied, edited, shared, and re-acquired in later versions.
- Let a character own multiple revisions of the same subject at once.

## Terminology
- `KnowledgeEntity`: the subject of the knowledge, such as a character, item, place, faction, or story topic.
- `KnowledgeRevision`: one immutable snapshot/version of knowledge for a single entity.
- `KnowledgeOwnership`: the relation that says a character currently possesses a specific revision.
- `KnowledgeLink`: a reference from another record, such as a history entry, to an exact revision.

## Core Rules
- `History` is never the source of truth for knowledge content.
- A revision is immutable after creation.
- New information, edits, or copies create a new revision instead of overwriting the old one.
- A character may own many revisions of the same entity.
- Two different characters may own the same revision.
- An edited copy still points back to its source revision through lineage metadata.

## Data Model Direction

### KnowledgeEntity
- `id`
- `type`: `character` | `item` | `place` | `faction` | `story` | `custom`
- `subjectKey`
  - stable subject identity when known
  - example: a character id for `Ali`
- `displayName`
- `createdAt`
- `updatedAt`

### KnowledgeRevision
- `id`
- `entityId`
- `revisionNumber`
- `title`
- `summary`
- `content`
  - structured card sections, not a single flat text blob
- `tags`
- `createdAt`
- `createdByCharacterId`
- `sourceType`
  - `spell`
  - `share`
  - `manual_edit`
  - `story_reward`
  - `dm_grant`
- `sourceSpellName`
- `sourceHistoryEntryId`
- `parentRevisionId`
  - the revision this one was copied or derived from
- `lineageMode`
  - `observed`
  - `copied`
  - `edited_copy`
  - `updated_scan`
- `isCanonical`
  - true when the revision is meant to reflect the current known state of the subject
  - false for altered or intentionally edited copies

### KnowledgeOwnership
- `id`
- `ownerCharacterId`
- `revisionId`
- `acquiredAt`
- `acquiredFromCharacterId`
- `localLabel`
  - lets the owner rename the card locally without changing the shared revision
- `isArchived`
- `isPinned`

### History Link Extension
- History entries that grant, mention, or share knowledge should store:
  - `knowledgeRevisionId`
  - optional `knowledgeEntityId`
- This keeps history tied to the exact revision used in that event.

## Card Content Shape
Each `KnowledgeRevision` should store structured sections so cards render consistently and can support hover previews.

Suggested section model:
- `id`
- `title`
- `kind`
  - `summary`
  - `stats`
  - `skills`
  - `powers`
  - `specials`
  - `resistances`
  - `biography`
  - `notes`
  - `custom`
- `entries`

Examples:
- character card
  - summary
  - stats
  - skills
  - powers
  - specials
  - notes
- item card
  - summary
  - visible properties
  - identified bonuses
  - notes
- story card
  - summary
  - discovered facts
  - rumors
  - notes

## Main Flows

### 1. `Assess Character`
- Cast spell.
- Resolve target and build a structured character knowledge payload.
- Find or create the target `KnowledgeEntity`.
- Create a new immutable `KnowledgeRevision`.
- Create `KnowledgeOwnership` for the caster.
- Write a history entry that links to that exact revision.

### 2. Re-acquiring Later Knowledge
- The same target is scanned again later after character growth or state change.
- Reuse the same `KnowledgeEntity`.
- Create a new `KnowledgeRevision` with `lineageMode = updated_scan`.
- Add new ownership for the acquiring character.
- Do not remove or mutate older owned revisions.

### 3. Copy and Edit
- Owner selects an existing revision.
- System creates a new revision with `parentRevisionId` pointing to the source.
- New revision uses `lineageMode = edited_copy`.
- New revision gets its own ownership record.
- Source revision remains unchanged.

### 4. Share
- Owner shares a chosen revision with another character.
- Default share reuses the same revision and creates another ownership record.
- If the owner wants to alter before sharing, create an edited copy first, then share that revision.

## Character Sheet UI

### History
- Keep `History` as a chronological log.
- If a history row has `knowledgeRevisionId`, the subject text should be interactive.
- Hover behavior:
  - open a small preview with card title, revision label, and key summary fields
- Click behavior:
  - open the full revision in a modal or side panel

### Knowledge Area
- Add a dedicated `Knowledge` section or tab on the character sheet.
- Group the list by `KnowledgeEntity`.
- Expanding an entity shows owned revisions for that subject.
- Opening a revision shows full card content.

Recommended layout:
- left: subject/entity list
- middle: owned revisions for selected subject
- right: selected revision content

Recommended actions:
- open
- duplicate
- share
- archive
- pin
- compare with another revision
- rename local label

## Rendering Rules
- Show revision labels clearly, such as:
  - `Ali v1`
  - `Ali v2 - edited copy`
  - `Ali v3 - updated scan`
- Mark altered copies so players can distinguish canonical scans from edited versions.
- Show provenance on each revision:
  - source spell
  - obtained from whom
  - created by whom
  - parent revision, when relevant

## Persistence Direction
- Store entities, revisions, and ownership in standalone local-first collections.
- Character sheets should store ownership references, not embed full card content.
- History entries may embed a small summary for resilience, but the linked revision remains the main source of truth.

## Suggested Implementation Order
1. Add domain types:
   - `KnowledgeEntity`
   - `KnowledgeRevision`
   - `KnowledgeOwnership`
2. Add storage, normalization, and migration support for the new collections.
3. Change `Assess Character` so it creates knowledge revisions plus a linked history row.
4. Add history-row hover preview and click-to-open behavior for linked revisions.
5. Add the `Knowledge` area to the character sheet.
6. Add duplicate/share/archive/pin flows.
7. Add revision comparison and owner-local labeling.

## Scope Notes
- This design should also support future `Artifact Appraisal`, item knowledge sharing, lore/story cards, and DM-granted intel.
- This note records direction only; it does not change the current `CS-HIST-01` scope by itself.
