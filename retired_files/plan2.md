# Plan 2

## Part 1: How will I implement this?
Instead of building layers horizontally (All DB -> All Logic -> All UI), you should build a **"Vertical Slice" (Tracer Bullet)** first.

### Recommended Order
1. **Phase 0: The Data Structure (TypeScript Interfaces)**
   - *Why:* You cannot build a database or a logic engine until you decide exactly what a "Character" looks like in code.
   - *Action:* Create types for your data. E.g., `interface Character { baseStats: ... }`.

2. **Phase 3 (Moved Up): The Logic Engine (Core Rules)**
   - *Why:* Since you are doing "Client-Side Calculation," your logic is the most important part. If the math is wrong, the UI is useless.
   - *Action:* Write the `calculateDerivedStats()` function in pure JavaScript/TypeScript. Test it with a fake JSON object. Ensure `Base Str 5` + `Weapon` actually equals the correct Damage.

3. **Phase 1 & 2: Project Init & Database Setup**
   - *Why:* Now that you have your Logic/Types from the previous steps, you know exactly what columns you need in Supabase.
   - *Action:* Set up the React app and create the Supabase tables to match the interfaces you designed in Phase 0.

4. **Phase 4: The Read-Only UI (The Character Sheet)**
   - *Action:* Fetch data from Supabase, run it through your Logic Engine, and display the result. Don't worry about editing yet. Just make it display correctly.

5. **Phase 5: The Interactive UI (The "Write" Actions)**
   - *Action:* Make the buttons work. When I click "Equip," update Supabase. When I click "Take Damage," update Supabase.

6. **Phase 6: Realtime & Combat**
   - *Action:* This is the final layer. Hook up the live listeners so the DM sees what the Player does.

## Part 2: What preparations do I need?
Before writing a single line of code, you need to "Digitize your Rules." Computers cannot read `.txt` files effectively. You need to convert your game design into structured data.

### 1. "JSON-ify" Your Rules (The Critical Step)
You listed `item_rules_v2.1.txt` and `Basic_Rules4.txt`. You need to manually translate these into JSON reference files.

#### Example Preparation
Instead of a rule that says "Iron Sword gives +2 Str," create a JSON file:

```json
[
  {
    "id": "wpn_iron_sword",
    "name": "Iron Sword",
    "slot": "hand_main",
    "cost_pp": 0,
    "effects": [
      { "target": "derived_damage", "value": 2, "type": "flat" }
    ]
  }
]
```

Do this for your Base Stats list, Skills list, and Base Items.

### 2. Define the "State" vs. "Derived" Split
This is the most common mistake in RPG apps. You must decide exactly what gets saved to the database and what gets calculated on the fly. Write this down on a piece of paper.

- **Database (State):** `base_strength`, `xp_spent`, `inventory_ids`, `current_hp`.
- **Calculated (Derived - DO NOT STORE IN DB):** `total_strength` (Base + Item), `max_hp` (Derived from Stamina), `armor_class`.

### 3. UX Wireframing
TTRPG apps get cluttered very fast. Sketch the layout for:
- **Mobile View:** Can a player click "Attack" easily on a phone?
- **Desktop View:** Does the DM see the Initiative list *and* the map *and* the chat?

### 4. Tech Stack Accounts & API Keys
- **GitHub:** Create a repository.
- **Supabase:** Create a new project. Save the `API URL` and `ANON KEY`.
- **Vercel:** Link your GitHub account so you can deploy easily later.

### 5. Logic "Unit Tests" (Mental or Written)
Prepare a few "Test Cases" based on your rules to verify your code later.
- *Example:* "If a Level 1 character has 3 Strength and picks up a +1 Sword, the damage MUST be 4. If the code says 3 or 5, it is wrong."
- Having these specific math examples ready will save you hours of debugging.

## Summary Checklist to Start
1. [ ] Translate text rules into JSON data structures.
2. [ ] Write down the list of Database Fields vs. Calculated Fields.
3. [ ] Sketch the Character Sheet layout.
4. [ ] **Then** run `npm create vite@latest`.
