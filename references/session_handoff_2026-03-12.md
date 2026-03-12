# Session Handoff — 2026-03-12

## Current Repo State
- Repo path: `C:\Users\Evrim\Desktop\FRP\Convergence\game_hub5`
- Current branch: `codex/refactor-tech-debt-split`
- Working tree: clean
- HEAD: `6447899` `break character type cycle`

## Latest Validation
- `npm run typecheck` passed
- `npm test` passed
- `npm run build` passed

## Branch / Git History
- Earlier structural route refactor lives on `codex/engine_development` at `ea212b7`
  - `refactor route decomposition and shared view models`
- Technical-debt follow-up was done on `codex/refactor-tech-debt-split`
- Main commits on current branch:
  - `3679ff8` `move rule modules into src/rules`
  - `55ebd09` `split combatant power controls`
  - `5956635` `extract player character mutations`
  - `2f7aa87` `split app stylesheet into modules`
  - `6447899` `break character type cycle`
- Rollback tags:
  - `rollback/phase-3-pre-page-refactor` -> `f6c6ae6`
  - `rollback/phase-3-page-refactor-complete` -> `b0279c9`
  - `rollback/phase-tech-debt-refactor-complete` -> `2f7aa87`
  - `rollback/phase-5-tech-debt-refactor-verified` -> `6447899`

## Refactor Outcome
- The earlier large route decomposition was completed for:
  - `src/routes/CombatEncounterPage.tsx`
  - `src/routes/PlayerCharacterPage.tsx`
- The technical-debt follow-up completed:
  - rule modules moved to `src/rules`
  - `CombatantPowerControls` split into orchestration + cast/effect modules
  - `PlayerCharacterPage` mutation logic extracted into pure mutations + hook
  - monolithic `src/app.css` split into `src/styles/*`
  - pre-existing type cycle removed in `src/types/character.ts`

## Important Structure

### Rules
- `src/rules/combat.ts`
- `src/rules/combatEncounter.ts`
- `src/rules/combatResolution.ts`
- `src/rules/powerData.ts`
- `src/rules/powerEffects.ts`
- `src/rules/resistances.ts`
- `src/rules/stats.ts`
- `src/rules/xpTables.ts`

### Combat Encounter Components
- `src/components/combat-encounter/AuraTargetPopover.tsx`
- `src/components/combat-encounter/CombatantActiveEffectsPanel.tsx`
- `src/components/combat-encounter/CombatantCastForm.tsx`
- `src/components/combat-encounter/CombatantPowerControls.tsx`
- `src/components/combat-encounter/CombatantRuntimeAdjustments.tsx`
- `src/components/combat-encounter/EncounterCastConfirmationDialog.tsx`
- `src/components/combat-encounter/EncounterCombatantCard.tsx`
- `src/components/combat-encounter/EncounterInitiativePanel.tsx`
- `src/components/combat-encounter/EncounterPartiesPanel.tsx`
- `src/components/combat-encounter/EncounterRollHelper.tsx`
- `src/components/combat-encounter/EncounterTopbar.tsx`

### Player Character Components
- `src/components/player-character/CharacterCombatSummary.tsx`
- `src/components/player-character/CharacterHeader.tsx`
- `src/components/player-character/CharacterHistorySection.tsx`
- `src/components/player-character/CharacterIdentitySection.tsx`
- `src/components/player-character/CharacterInventorySection.tsx`
- `src/components/player-character/CharacterPowersSection.tsx`
- `src/components/player-character/CharacterResources.tsx`
- `src/components/player-character/CharacterSkillsSection.tsx`
- `src/components/player-character/CharacterStatsSection.tsx`
- `src/components/player-character/RollHelperPopover.tsx`

### Hooks
- `src/hooks/useAuraEffectManager.ts`
- `src/hooks/useCombatantCastState.ts`
- `src/hooks/usePlayerCharacterMutations.ts`

### Pure Mutation Layer
- `src/mutations/characterSheetMutations.ts`

### Styles
- `src/app.css` is now an import hub
- `src/styles/base.css`
- `src/styles/layout.css`
- `src/styles/responsive.css`
- `src/styles/components/combat-encounter.css`
- `src/styles/components/controls.css`
- `src/styles/components/dice-popover.css`
- `src/styles/pages/dm.css`
- `src/styles/pages/player-character.css`

## Behavior / Validation Notes
- A browser-driven smoke pass was completed earlier for:
  - login -> player flow
  - DM character flow
  - DM NPC creator
  - combat dashboard -> encounter start
  - runtime HP edit
  - direct damage cast
  - healing cast
  - aura target add/remove
  - outside-click / Escape close
  - active effect removal
- Note:
  - `Healing Lv 1` behaved as self-targeted in that setup, so healing validation was performed as self-heal

## Roadmap Starting Point
- Authoritative roadmap: `references/plan.md`
- Earliest unfinished item is `3.1 Update the shared data/runtime model before the remaining powers`
- Next work should start with:
  - split inspiration into permanent + temporary
  - add temporary HP runtime value
  - keep negative HP visible
  - extend game history for typed intel snapshots
  - add item-identification state
  - add encounter-visible status tags

## MCP Status After This Session
- Working:
  - `filesystem`
  - `github`
  - `supabase`
  - `linear`
  - `notion`
  - `figma`
  - `playwright`
- Filesystem MCP is currently scoped to:
  - `C:\Users\Evrim\Desktop\FRP\Convergence\game_hub5`
- Important limitation:
  - filesystem MCP cannot read outside the repo root
  - paths under `C:\Users\Evrim\.codex\...` are not accessible through filesystem MCP
  - shell access can still read them

## MCP Config Changes Made

### Filesystem
```toml
[mcp_servers.filesystem]
command = "npx"
args = [
  "-y",
  "@modelcontextprotocol/server-filesystem",
  "C:\\Users\\Evrim\\Desktop\\FRP\\Convergence\\game_hub5"
]
```

### Supabase
```toml
[mcp_servers.supabase]
url = "https://mcp.supabase.com/mcp?project_ref=ffbigglwkeusfsrdrxsy"
bearer_token_env_var = "SUPABASE_ACCESS_TOKEN"
enabled = true
```

Additional note:
- `SUPABASE_ACCESS_TOKEN` was added at the Windows user environment level
- the actual token value is intentionally not stored here

### Playwright
```toml
[mcp_servers.playwright]
command = "npx"
args = ["-y", "@playwright/mcp@latest"]
```

## Operational Notes For The Next Thread
- Do not assume old rule imports under `src/config/*`; use `src/rules/*`
- Do not assume `PlayerCharacterPage` still owns all mutations; use the hook + mutation layer
- Do not assume `CombatantPowerControls` still contains all cast/effect logic; it is split
- Do not assume `src/app.css` contains all styles; it is now an import hub
- Current repo state is green and ready for implementation from roadmap item `3.1`
