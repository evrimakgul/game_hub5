import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import {
  calculateArmorClass,
  calculateInitiative,
  calculateMaxHP,
  calculateOccultManaBonus,
  calculateRangedBonusDice,
} from "../config/stats";
import { getCrAndRankFromXpUsed } from "../config/xpTables";
import { isSupabaseConfigured } from "../lib/env";
import { loadPlayerSheetForProfile, type PlayerSheetData } from "../lib/playerSheet";
import { useAuthStore } from "../state/authStore";
import { CORE_STAT_IDS } from "../types";

type LoadState = "idle" | "loading" | "ready" | "empty" | "error";

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
  }, [authUser, configured]);

  const character = sheetData?.character ?? null;
  const progression = character ? getCrAndRankFromXpUsed(character.xpUsed) : null;
  const derived = character
    ? {
        maxHp: calculateMaxHP(character.coreStats.STAM),
        initiative: calculateInitiative(character.coreStats.DEX, character.coreStats.WITS),
        armorClass: calculateArmorClass(
          character.coreStats.DEX,
          character.skillLevels.athletics
        ),
        rangedBonus: calculateRangedBonusDice(character.coreStats.PER),
        manaBonus: calculateOccultManaBonus(character.skillLevels.occultism, character.xpUsed),
      }
    : null;

  const equippedItems = sheetData?.equippedItems ?? [];
  const knownPowers = character?.knownPowers ?? [];
  const statusEffects = character?.statusEffects ?? [];

  return (
    <main className="app-shell">
      <section className="hero-card">
        <div className="hero-topline">
          <p className="eyebrow">Convergence Player Sheet</p>
          <span className={`status-pill ${configured ? "ok" : "warn"}`}>
            {configured ? "Supabase Env Ready" : "Supabase Env Missing"}
          </span>
        </div>

        <h1>Read-Only Player View</h1>
        <p className="hero-copy">
          This route now reads stored character state from Supabase, then derives sheet values in
          the client engine. No write actions are enabled here yet.
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
        </section>
      )}
    </main>
  );
}
