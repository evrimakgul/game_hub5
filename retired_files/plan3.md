# Plan 3

## PHASE 0 - Preparations (before coding)
### 0.1 Convert rule .txt -> JSON references (authoritative text layer)
- `json_refs/basic_rules.json` (done)
- `json_refs/item_rules.json`
- `json_refs/powers.json`

### 0.2 Decide "State vs Derived"
- State (DB): base stats, skill/power levels, inventory ids, current hp/mana, action state
- Derived (calc): max hp, AC, initiative, dice pools, bonuses

### 0.3 Write a few test cases (numbers you can verify)

### 0.4 Sketch UI (player sheet + DM dashboard)

## PHASE 1 - Types and engine core (prove math first)
### 1.1 Create TypeScript types/interfaces (Character, Item, Effects, etc.)

### 1.2 Engine-owned lookups (`src/config`)
- `xpTables.ts` (done)

### 1.3 Engine logic (pure functions)
- `stats.ts` (done)
- `combat.ts` (done)
- (later) items/effects application

## PHASE 2 - Project initialization
### 2.1 Create Vite React TS app

### 2.2 Install deps: `supabase-js`, `react-router-dom`, `zustand`

### 2.3 Create supabase client file and env vars

## PHASE 3 - Database setup (Supabase) guided by types
### 3.1 `profiles` (auth link)

### 3.2 `characters` (STATE only)

### 3.3 `items` (PP + effects; `equipped_by` or join table)

### 3.4 `combat_tracker` (+ `combatants` table if needed)

### 3.5 `chat_logs`

### 3.6 Enable Realtime on needed tables

## PHASE 4 - Read-only UI (vertical slice)
### 4.1 Login

### 4.2 Player sheet: fetch STATE -> run engine -> display derived

### 4.3 DM dashboard: view campaigns/characters/combat list (read-only)

## PHASE 5 - Write actions (still not realtime-critical)
### 5.1 Equip/unequip updates DB state

### 5.2 Apply damage updates `current_hp`

### 5.3 Action toggles update `action_state`

## PHASE 6 - Realtime + playtest
### 6.1 Subscribe to `postgres_changes` (`characters`, combat tables, `chat_logs`)

### 6.2 Combat log writes on resolver results

### 6.3 Playtest end-to-end

## PHASE 7 - Deployment
### 7.1 Push to GitHub

### 7.2 Deploy to Vercel + set env vars

### 7.3 Verify auth + realtime + core flows
