import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { getActionAvailability, type RequestedAction } from "../config/actions";
import {
  getDerivedModifierBonus,
  getEffectiveCoreStat,
  getEffectiveSkillLevel,
  hasModifierTag,
  resolveCharacterModifiers,
} from "../config/modifiers";
import { getCastablePowerOptions } from "../config/powers";
import {
  calculateArmorClass,
  calculateInitiative,
  calculateMaxHP,
  calculateOccultManaBonus,
  calculateRangedBonusDice,
} from "../config/stats";
import { getCrAndRankFromXpUsed } from "../config/xpTables";
import { isSupabaseConfigured } from "../lib/env";
import { castKnownPower } from "../lib/powerActions";
import {
  setCharacterResources,
  setInventoryItemSlot,
  spendCombatAction,
} from "../lib/playerActions";
import { subscribeToPlayerSheetState } from "../lib/realtime";
import { loadPlayerSheetForProfile, type PlayerSheetData } from "../lib/playerSheet";
import { useAuthStore } from "../state/authStore";
import { CORE_STAT_IDS, type EquipmentSlot, type PowerId } from "../types";

type LoadState = "idle" | "loading" | "ready" | "empty" | "error";
type MutationState = "idle" | "running";

const ACTION_BUTTONS: Array<{ requested: RequestedAction; label: string }> = [
  { requested: "standard", label: "Spend Standard" },
  { requested: "bonus", label: "Spend Bonus" },
  { requested: "move", label: "Spend Move" },
  { requested: "reaction", label: "Spend Reaction" },
  { requested: "prepare_reaction", label: "Prepare Reaction" },
];

function formatSlotLabel(slot: string): string {
  return slot.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function PlayerSheetPage() {
  const authStatus = useAuthStore((state) => state.status);
  const authUser = useAuthStore((state) => state.user);
  const configured = isSupabaseConfigured();

  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [sheetData, setSheetData] = useState<PlayerSheetData | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [mutationState, setMutationState] = useState<MutationState>("idle");
  const [mutationMessage, setMutationMessage] = useState<string | null>(null);
  const [hpAmount, setHpAmount] = useState(1);
  const [manaAmount, setManaAmount] = useState(1);

  useEffect(() => {
    if (!configured || !authUser) {
      setSheetData(null);
      setErrorMessage(null);
      setLoadState("idle");
      return;
    }

    let cancelled = false;
    setLoadState("loading");
    setErrorMessage(null);

    loadPlayerSheetForProfile(authUser.id)
      .then((data) => {
        if (cancelled) {
          return;
        }

        if (!data) {
          setSheetData(null);
          setLoadState("empty");
          return;
        }

        setSheetData(data);
        setLoadState("ready");
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }

        setSheetData(null);
        setLoadState("error");
        setErrorMessage(error instanceof Error ? error.message : "Unable to load the player sheet.");
      });

    return () => {
      cancelled = true;
    };
  }, [authUser, configured, reloadToken]);

  useEffect(() => {
    if (!configured || !authUser) {
      return;
    }

    return subscribeToPlayerSheetState(authUser.id, () => {
      setReloadToken((value) => value + 1);
    });
  }, [authUser, configured]);

  const character = sheetData?.character ?? null;
  const encounter = sheetData?.encounter ?? null;
  const equippedItems = sheetData?.equippedItems ?? [];
  const inventoryItems = sheetData?.inventoryItems ?? [];
  const itemTemplatesById = sheetData?.itemTemplatesById ?? {};
  const knownPowers = character?.knownPowers ?? [];
  const statusEffects = character?.statusEffects ?? [];
  const castablePowers = getCastablePowerOptions(knownPowers);
  const progression = character ? getCrAndRankFromXpUsed(character.xpUsed) : null;
  const modifierSummary = character
    ? resolveCharacterModifiers(
        character,
        equippedItems.map((equippedItem) => equippedItem.template)
      )
    : null;
  const derived =
    character && modifierSummary
      ? {
          maxHp: calculateMaxHP(
            getEffectiveCoreStat(character, modifierSummary, "STAM")
          ),
          initiative: calculateInitiative(
            getEffectiveCoreStat(character, modifierSummary, "DEX"),
            getEffectiveCoreStat(character, modifierSummary, "WITS")
          ),
          armorClass: calculateArmorClass(
            getEffectiveCoreStat(character, modifierSummary, "DEX"),
            getEffectiveSkillLevel(character, modifierSummary, "athletics"),
            getDerivedModifierBonus(modifierSummary, "armor_class")
          ),
          rangedBonus: calculateRangedBonusDice(
            getEffectiveCoreStat(character, modifierSummary, "PER")
          ),
          manaBonus:
            calculateOccultManaBonus(
              getEffectiveSkillLevel(character, modifierSummary, "occultism"),
              character.xpUsed
            ) + getDerivedModifierBonus(modifierSummary, "mana_bonus"),
          damageReduction: getDerivedModifierBonus(modifierSummary, "damage_reduction"),
          soak: getDerivedModifierBonus(modifierSummary, "soak"),
          hitBonus: getDerivedModifierBonus(modifierSummary, "attack_dice_pool_hit_bonus"),
          alertness: getEffectiveSkillLevel(character, modifierSummary, "alertness"),
          hasNightvision: hasModifierTag(modifierSummary, "nightvision"),
        }
      : null;

  async function refreshSheetWithMessage(message: string) {
    setMutationMessage(message);
    setReloadToken((value) => value + 1);
  }

  async function handleResourceChange(resource: "hp" | "mana", mode: "increase" | "decrease") {
    if (!character || mutationState === "running") {
      return;
    }

    const amount = resource === "hp" ? hpAmount : manaAmount;

    if (!Number.isInteger(amount) || amount <= 0) {
      setMutationMessage("Adjustment amount must be a positive whole number.");
      return;
    }

    const nextCurrentHp =
      resource === "hp"
        ? Math.max(0, character.currentHp + (mode === "increase" ? amount : -amount))
        : character.currentHp;
    const nextCurrentMana =
      resource === "mana"
        ? Math.max(0, character.currentMana + (mode === "increase" ? amount : -amount))
        : character.currentMana;

    setMutationState("running");
    setMutationMessage(null);

    try {
      await setCharacterResources(character.characterId, nextCurrentHp, nextCurrentMana);
      await refreshSheetWithMessage(
        resource === "hp"
          ? `${mode === "increase" ? "Healed" : "Applied damage"} for ${amount}.`
          : `${mode === "increase" ? "Restored" : "Spent"} ${amount} Mana.`
      );
    } catch (error) {
      setMutationMessage(error instanceof Error ? error.message : "Unable to update resources.");
    } finally {
      setMutationState("idle");
    }
  }

  async function handleEquipChange(itemInstanceId: string, slot: EquipmentSlot | null) {
    if (mutationState === "running") {
      return;
    }

    setMutationState("running");
    setMutationMessage(null);

    try {
      await setInventoryItemSlot(itemInstanceId, slot);
      await refreshSheetWithMessage(slot ? `Equipped item in ${formatSlotLabel(slot)}.` : "Item unequipped.");
    } catch (error) {
      setMutationMessage(error instanceof Error ? error.message : "Unable to update equipment.");
    } finally {
      setMutationState("idle");
    }
  }

  async function handleActionSpend(requestedAction: RequestedAction) {
    if (!encounter || mutationState === "running") {
      return;
    }

    setMutationState("running");
    setMutationMessage(null);

    try {
      const result = await spendCombatAction(encounter.encounterId, requestedAction, encounter.revision);
      await refreshSheetWithMessage(
        `Consumed ${result.consumed_from}${result.movement_meters > 0 ? ` for ${result.movement_meters}m movement` : ""}.`
      );
    } catch (error) {
      setMutationMessage(error instanceof Error ? error.message : "Unable to spend the selected action.");
    } finally {
      setMutationState("idle");
    }
  }

  async function handlePowerCast(powerId: PowerId) {
    if (!character || mutationState === "running") {
      return;
    }

    setMutationState("running");
    setMutationMessage(null);

    try {
      const result = await castKnownPower(
        character.characterId,
        powerId,
        encounter?.encounterId ?? null,
        encounter?.revision ?? null
      );
      await refreshSheetWithMessage(
        `Cast ${result.status_label}. Spent ${result.mana_spent} Mana${
          result.consumed_from ? ` and consumed ${result.consumed_from}.` : "."
        }`
      );
    } catch (error) {
      setMutationMessage(error instanceof Error ? error.message : "Unable to cast the selected power.");
    } finally {
      setMutationState("idle");
    }
  }

  return (
    <main className="app-shell">
      <section className="hero-card">
        <div className="hero-topline">
          <p className="eyebrow">Convergence Player Sheet</p>
          <span className={`status-pill ${configured ? "ok" : "warn"}`}>
            {configured ? "Supabase Env Ready" : "Supabase Env Missing"}
          </span>
        </div>

        <h1>Interactive Player View</h1>
        <p className="hero-copy">
          This route reads stored character state from Supabase, derives sheet values in the client
          engine, and supports live inventory, resource, and action-state writes.
        </p>
        <nav className="route-nav" aria-label="Primary routes">
          <Link to="/">Player Route</Link>
          <Link to="/dm">DM Route</Link>
          <Link to="/login">Login</Link>
        </nav>
      </section>

      {!configured && (
        <section className="section-card empty-state">
          <h2>Supabase is not connected yet.</h2>
          <p>
            Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to your local environment, then
            reload the app.
          </p>
        </section>
      )}

      {configured && authStatus === "loading" && (
        <section className="section-card empty-state">
          <h2>Checking session</h2>
          <p>The app is reading the current browser session before it loads player data.</p>
        </section>
      )}

      {configured && authStatus !== "loading" && !authUser && (
        <section className="section-card empty-state">
          <h2>No signed-in player</h2>
          <p>Sign in first so the app can load the character rows tied to your Supabase profile.</p>
          <Link className="inline-link" to="/login">
            Go to Login
          </Link>
        </section>
      )}

      {configured && authUser && loadState === "loading" && (
        <section className="section-card empty-state">
          <h2>Loading player sheet</h2>
          <p>The app is fetching your stored state tables from Supabase.</p>
        </section>
      )}

      {configured && authUser && loadState === "empty" && (
        <section className="section-card empty-state">
          <h2>No player character found</h2>
          <p>
            The current profile is authenticated, but there is no `characters` row yet with
            `is_player_character = true`.
          </p>
        </section>
      )}

      {configured && authUser && loadState === "error" && (
        <section className="section-card empty-state">
          <h2>Unable to load the player sheet</h2>
          <p>{errorMessage ?? "An unknown error occurred while reading Supabase state."}</p>
        </section>
      )}

      {character && derived && progression && (
        <section className="sheet-layout" aria-label="Player sheet">
          <article className="section-card player-sheet-header">
            <div>
              <p className="panel-label">Character</p>
              <h2>{character.displayName}</h2>
              <p className="sheet-subtitle">
                {character.biographyPrimary ?? "No primary biography note yet."}
              </p>
            </div>
            <div className="badge-stack">
              <span>Rank {progression.rank}</span>
              <span>CR {progression.cr}</span>
            </div>
          </article>

          <article className="section-card">
            <p className="panel-label">Resources</p>
            <div className="resource-row">
              <div>
                <span>HP</span>
                <strong>
                  {character.currentHp} / {derived.maxHp}
                </strong>
              </div>
              <div>
                <span>Mana</span>
                <strong>{character.currentMana}</strong>
              </div>
              <div>
                <span>Inspiration</span>
                <strong>{character.inspiration}</strong>
              </div>
              <div>
                <span>Money</span>
                <strong>{character.money}</strong>
              </div>
            </div>
            <div className="write-grid">
              <div className="write-card">
                <label className="auth-label" htmlFor="hp-adjustment">
                  HP Adjustment
                </label>
                <input
                  id="hp-adjustment"
                  className="auth-input"
                  type="number"
                  min={1}
                  step={1}
                  value={hpAmount}
                  onChange={(event) => setHpAmount(Math.max(1, Number(event.target.value) || 1))}
                  disabled={mutationState === "running"}
                />
                <div className="auth-actions">
                  <button
                    type="button"
                    disabled={mutationState === "running"}
                    onClick={() => {
                      void handleResourceChange("hp", "decrease");
                    }}
                  >
                    Damage
                  </button>
                  <button
                    type="button"
                    className="ghost-button"
                    disabled={mutationState === "running"}
                    onClick={() => {
                      void handleResourceChange("hp", "increase");
                    }}
                  >
                    Heal
                  </button>
                </div>
              </div>

              <div className="write-card">
                <label className="auth-label" htmlFor="mana-adjustment">
                  Mana Adjustment
                </label>
                <input
                  id="mana-adjustment"
                  className="auth-input"
                  type="number"
                  min={1}
                  step={1}
                  value={manaAmount}
                  onChange={(event) => setManaAmount(Math.max(1, Number(event.target.value) || 1))}
                  disabled={mutationState === "running"}
                />
                <div className="auth-actions">
                  <button
                    type="button"
                    disabled={mutationState === "running"}
                    onClick={() => {
                      void handleResourceChange("mana", "decrease");
                    }}
                  >
                    Spend
                  </button>
                  <button
                    type="button"
                    className="ghost-button"
                    disabled={mutationState === "running"}
                    onClick={() => {
                      void handleResourceChange("mana", "increase");
                    }}
                  >
                    Restore
                  </button>
                </div>
              </div>
            </div>
          </article>

          <article className="section-card">
            <p className="panel-label">Primary Stats</p>
            <div className="stat-strip">
              {CORE_STAT_IDS.map((statId) => (
                <div key={statId} className="stat-cell">
                  <span>{statId}</span>
                  <strong>{character.coreStats[statId]}</strong>
                </div>
              ))}
            </div>
          </article>

          <article className="section-card">
            <p className="panel-label">Derived Stats</p>
            <div className="stats-grid">
              <div>
                <span>Armor Class</span>
                <strong>{derived.armorClass}</strong>
              </div>
              <div>
                <span>Initiative</span>
                <strong>{derived.initiative}</strong>
              </div>
              <div>
                <span>Ranged Bonus</span>
                <strong>{derived.rangedBonus}</strong>
              </div>
              <div>
                <span>Occult Mana Bonus</span>
                <strong>{derived.manaBonus}</strong>
              </div>
              <div>
                <span>Damage Reduction</span>
                <strong>{derived.damageReduction}</strong>
              </div>
              <div>
                <span>Soak</span>
                <strong>{derived.soak}</strong>
              </div>
              <div>
                <span>Hit Bonus</span>
                <strong>{derived.hitBonus}</strong>
              </div>
              <div>
                <span>Alertness</span>
                <strong>{derived.alertness}</strong>
              </div>
            </div>
          </article>

          <article className="section-card">
            <p className="panel-label">Known Powers</p>
            <div className="tag-list">
              {knownPowers.length > 0 ? (
                knownPowers
                  .slice()
                  .sort((left, right) => left.powerId.localeCompare(right.powerId))
                  .map((power) => (
                    <span key={power.powerId} className="tag-chip">
                      {power.powerId} Lv {power.level}
                    </span>
                  ))
              ) : (
                <p className="muted-copy">No powers recorded on this character yet.</p>
              )}
            </div>
            {derived.hasNightvision && (
              <p className="muted-copy">Passive power effects currently grant Nightvision.</p>
            )}
          </article>

          <article className="section-card">
            <p className="panel-label">Power Actions</p>
            <div className="list-block">
              {castablePowers.length > 0 ? (
                castablePowers.map((power) => {
                  const actionAvailability =
                    power.actionType && encounter
                      ? getActionAvailability(encounter.actionState, power.actionType)
                      : null;
                  const disabled =
                    mutationState === "running" ||
                    character.currentMana < power.manaCost ||
                    Boolean(encounter && (!encounter.isActiveTurn || !actionAvailability?.allowed));
                  const title =
                    character.currentMana < power.manaCost
                      ? `Needs ${power.manaCost} Mana.`
                      : encounter && !encounter.isActiveTurn
                        ? "This power requires your active turn in combat."
                        : actionAvailability && !actionAvailability.allowed
                          ? actionAvailability.reason ?? power.description
                          : power.description;

                  return (
                    <div key={power.powerId} className="inventory-row">
                      <div>
                        <span>
                          {power.powerName} Lv {power.level}
                        </span>
                        <strong>
                          {power.manaCost} Mana
                          {power.actionType ? ` | ${formatSlotLabel(power.actionType)} Action` : ""}
                        </strong>
                      </div>
                      <div className="chip-actions">
                        <button
                          type="button"
                          className="chip-button"
                          title={title}
                          disabled={disabled}
                          onClick={() => {
                            void handlePowerCast(power.powerId);
                          }}
                        >
                          {power.label}
                        </button>
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="muted-copy">No live-cast power actions are supported for this build yet.</p>
              )}
            </div>
          </article>

          <article className="section-card">
            <p className="panel-label">Equipped Items</p>
            <div className="list-block">
              {equippedItems.length > 0 ? (
                equippedItems.map(({ slot, inventoryItem, template }) => (
                  <div key={inventoryItem.itemInstanceId} className="list-row">
                    <span>{formatSlotLabel(slot)}</span>
                    <strong>{inventoryItem.customName ?? template?.name ?? inventoryItem.templateId}</strong>
                  </div>
                ))
              ) : (
                <p className="muted-copy">No equipment is currently assigned to slots.</p>
              )}
            </div>
          </article>

          <article className="section-card">
            <p className="panel-label">Inventory Flow</p>
            <div className="list-block">
              {inventoryItems.length > 0 ? (
                inventoryItems.map((inventoryItem) => {
                  const template = itemTemplatesById[inventoryItem.templateId] ?? null;
                  const label = inventoryItem.customName ?? template?.name ?? inventoryItem.templateId;
                  const compatibleSlots = template?.slotCompatibility ?? [];

                  return (
                    <div key={inventoryItem.itemInstanceId} className="inventory-row">
                      <div>
                        <span>{label}</span>
                        <strong>
                          {inventoryItem.equippedSlot
                            ? `Equipped: ${formatSlotLabel(inventoryItem.equippedSlot)}`
                            : "Not equipped"}
                        </strong>
                      </div>
                      <div className="chip-actions">
                        {compatibleSlots.map((slot) => (
                          <button
                            key={`${inventoryItem.itemInstanceId}-${slot}`}
                            type="button"
                            className={inventoryItem.equippedSlot === slot ? "chip-button active" : "chip-button"}
                            disabled={mutationState === "running"}
                            onClick={() => {
                              void handleEquipChange(inventoryItem.itemInstanceId, slot);
                            }}
                          >
                            {formatSlotLabel(slot)}
                          </button>
                        ))}
                        <button
                          type="button"
                          className="chip-button"
                          disabled={mutationState === "running" || inventoryItem.equippedSlot === null}
                          onClick={() => {
                            void handleEquipChange(inventoryItem.itemInstanceId, null);
                          }}
                        >
                          Unequip
                        </button>
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="muted-copy">No inventory rows are stored for this character.</p>
              )}
            </div>
          </article>

          <article className="section-card">
            <p className="panel-label">Action Flow</p>
            {encounter ? (
              <div className="list-block">
                <div className="list-row">
                  <span>{encounter.label}</span>
                  <strong>
                    Round {encounter.roundNumber} | Revision {encounter.revision}
                  </strong>
                </div>
                <div className="resource-row">
                  <div>
                    <span>Standard</span>
                    <strong>
                      {encounter.actionState.available.standard} / {encounter.actionState.spent.standard}
                    </strong>
                  </div>
                  <div>
                    <span>Bonus</span>
                    <strong>
                      {encounter.actionState.available.bonus} / {encounter.actionState.spent.bonus}
                    </strong>
                  </div>
                  <div>
                    <span>Move</span>
                    <strong>
                      {encounter.actionState.available.move} / {encounter.actionState.spent.move}
                    </strong>
                  </div>
                  <div>
                    <span>Reaction</span>
                    <strong>
                      {encounter.actionState.available.reaction} / {encounter.actionState.spent.reaction}
                    </strong>
                  </div>
                </div>
                <p className="muted-copy">
                  {encounter.isActiveTurn
                    ? "It is currently your turn."
                    : "Action spending is disabled until this participant becomes the active turn."}
                </p>
                <div className="chip-actions">
                  {ACTION_BUTTONS.map(({ requested, label }) => {
                    const availability = getActionAvailability(encounter.actionState, requested);
                    const disabled =
                      mutationState === "running" || !encounter.isActiveTurn || !availability.allowed;

                    return (
                      <button
                        key={requested}
                        type="button"
                        className="chip-button"
                        title={disabled ? availability.reason ?? "Action is not currently available." : label}
                        disabled={disabled}
                        onClick={() => {
                          void handleActionSpend(requested);
                        }}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <p className="muted-copy">This character is not currently in an encounter.</p>
            )}
          </article>

          <article className="section-card">
            <p className="panel-label">Status Effects</p>
            <div className="list-block">
              {statusEffects.length > 0 ? (
                statusEffects.map((status) => (
                  <div key={status.statusEffectId} className="list-row">
                    <span>{status.label}</span>
                    <strong>{status.remainingRounds ? `${status.remainingRounds} rounds` : "Active"}</strong>
                  </div>
                ))
              ) : (
                <p className="muted-copy">No active status effects are stored for this character.</p>
              )}
            </div>
          </article>

          {mutationMessage && (
            <article className="section-card">
              <p className="panel-label">Write Result</p>
              <p className="muted-copy">{mutationMessage}</p>
            </article>
          )}
        </section>
      )}
    </main>
  );
}
