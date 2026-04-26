import { useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";

import {
  buildEncounterOwnedMobParticipantInputs,
  buildEncounterOwnedMobsFromGroup,
  buildEncounterOwnedMobsFromPortalStage,
} from "../lib/authoring.ts";
import { buildItemIndex } from "../lib/items.ts";
import {
  buildEncounterParticipantInput,
  createCombatEncounter,
} from "../rules/combatEncounter";
import { useAppFlow } from "../state/appFlow";
import type { CharacterRecord } from "../types/character";
import type { EncounterOwnedMobInstance, PortalTemplate } from "../types/authoring.ts";
import type { CombatEncounterParty } from "../types/combatEncounter";

const DEFAULT_PARTIES: CombatEncounterParty[] = [
  { partyId: "party-1", label: "Party 1", kind: "players" },
  { partyId: "party-2", label: "Party 2", kind: "npcs" },
];

type StagedAssignments = Record<string, string | null>;

type StagedOwnedMob = EncounterOwnedMobInstance & {
  stagedPartyId: string | null;
};

function getCharacterName(character: CharacterRecord | undefined): string {
  return character?.sheet.name.trim() || "Unnamed Character";
}

function getNextPartyLabel(parties: CombatEncounterParty[]): string {
  const highestPartyNumber = parties.reduce((highest, party) => {
    const matchedNumber = /^Party (\d+)$/.exec(party.label);
    if (!matchedNumber) {
      return highest;
    }

    return Math.max(highest, Number.parseInt(matchedNumber[1], 10));
  }, 0);

  return `Party ${highestPartyNumber + 1}`;
}

function buildInitialPendingAssignments(
  characters: CharacterRecord[],
  currentAssignments: StagedAssignments
): Record<string, string> {
  return Object.fromEntries(
    characters.map((character) => [character.id, currentAssignments[character.id] ?? ""])
  );
}

function buildPortalStageLabel(portal: PortalTemplate, stageIndex: number): string {
  const stage = portal.stages[stageIndex];
  if (!stage) {
    return `${portal.name} / Stage ${stageIndex + 1}`;
  }

  return `${portal.name} / ${stage.title || `Stage ${stageIndex + 1}`}`;
}

function getStagedMobSummary(mob: StagedOwnedMob): string {
  const sourceBits = [
    mob.sourcePortalId ? "Portal" : null,
    mob.sourceGroupId ? "Group" : null,
    mob.role,
  ].filter((entry): entry is string => Boolean(entry));

  return sourceBits.join(" | ");
}

export function CombatDashboardPage() {
  const navigate = useNavigate();
  const {
    roleChoice,
    characters,
    items,
    mobTemplates,
    mobGroups,
    portalTemplates,
    beginCombatEncounter,
  } = useAppFlow();
  const itemsById = buildItemIndex(items);
  const mobTemplatesById = useMemo(
    () => new Map(mobTemplates.map((template) => [template.id, template])),
    [mobTemplates]
  );
  const mobGroupsById = useMemo(
    () => new Map(mobGroups.map((group) => [group.id, group])),
    [mobGroups]
  );
  const [encounterLabel, setEncounterLabel] = useState("Combat Encounter");
  const [parties, setParties] = useState<CombatEncounterParty[]>(DEFAULT_PARTIES);
  const [stagedAssignments, setStagedAssignments] = useState<StagedAssignments>({});
  const [pendingAssignments, setPendingAssignments] = useState<Record<string, string>>({});
  const [stagedOwnedMobs, setStagedOwnedMobs] = useState<StagedOwnedMob[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [selectedGroupPartyId, setSelectedGroupPartyId] = useState("party-2");
  const [selectedPortalId, setSelectedPortalId] = useState("");
  const [selectedPortalStageIndex, setSelectedPortalStageIndex] = useState("0");
  const [selectedPortalPartyId, setSelectedPortalPartyId] = useState("party-2");
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  const playerCharacters = characters.filter((character) => character.ownerRole === "player");
  const dmCharacters = characters.filter((character) => character.ownerRole === "dm");
  const selectedPortal =
    portalTemplates.find((portal) => portal.id === selectedPortalId) ?? portalTemplates[0] ?? null;
  const selectedPortalStage =
    selectedPortal?.stages[Number.parseInt(selectedPortalStageIndex, 10)] ??
    selectedPortal?.stages[0] ??
    null;

  const encounterMembersByParty = useMemo(
    () =>
      Object.fromEntries(
        parties.map((party) => [
          party.partyId,
          characters.filter((character) => stagedAssignments[character.id] === party.partyId),
        ])
      ) as Record<string, CharacterRecord[]>,
    [characters, parties, stagedAssignments]
  );
  const stagedOwnedMobsByParty = useMemo(
    () =>
      Object.fromEntries(
        parties.map((party) => [
          party.partyId,
          stagedOwnedMobs.filter((mob) => mob.stagedPartyId === party.partyId),
        ])
      ) as Record<string, StagedOwnedMob[]>,
    [parties, stagedOwnedMobs]
  );
  const assignedCharacterIds = Object.entries(stagedAssignments)
    .filter(([, partyId]) => partyId !== null)
    .map(([characterId]) => characterId);

  if (roleChoice !== "dm") {
    return <Navigate to="/role" replace />;
  }

  function getPendingAssignment(characterId: string): string {
    return pendingAssignments[characterId] ?? stagedAssignments[characterId] ?? "";
  }

  function syncPendingAssignments(nextAssignments: StagedAssignments): void {
    setPendingAssignments((currentPendingAssignments) => {
      const hydratedPendingAssignments =
        Object.keys(currentPendingAssignments).length === 0
          ? buildInitialPendingAssignments(characters, nextAssignments)
          : currentPendingAssignments;

      return Object.fromEntries(
        characters.map((character) => [
          character.id,
          hydratedPendingAssignments[character.id] ?? nextAssignments[character.id] ?? "",
        ])
      );
    });
  }

  function assignCharacterToParty(characterId: string, partyId: string): void {
    setStagedAssignments((currentAssignments) => {
      const nextAssignments = {
        ...currentAssignments,
        [characterId]: partyId,
      };
      syncPendingAssignments(nextAssignments);
      return nextAssignments;
    });
  }

  function removeCharacterFromCombat(characterId: string): void {
    setStagedAssignments((currentAssignments) => {
      const nextAssignments = {
        ...currentAssignments,
        [characterId]: null,
      };
      syncPendingAssignments(nextAssignments);
      return nextAssignments;
    });
  }

  function addAllCharactersToParty(ownerRole: "player" | "dm", partyId: string): void {
    setStagedAssignments((currentAssignments) => {
      const nextAssignments = { ...currentAssignments };
      characters.forEach((character) => {
        if (
          character.ownerRole !== ownerRole ||
          (nextAssignments[character.id] !== undefined && nextAssignments[character.id] !== null)
        ) {
          return;
        }

        nextAssignments[character.id] = partyId;
      });

      syncPendingAssignments(nextAssignments);
      return nextAssignments;
    });
  }

  function createParty(): void {
    setParties((currentParties) => {
      const nextPartyNumber = currentParties.length + 1;
      return [
        ...currentParties,
        {
          partyId: `party-${nextPartyNumber}`,
          label: getNextPartyLabel(currentParties),
          kind: "custom",
        },
      ];
    });
  }

  function addMobGroupToParty(): void {
    const group = mobGroupsById.get(selectedGroupId);
    if (!group) {
      setDashboardError("Select a saved mob group first.");
      return;
    }
    if (!selectedGroupPartyId) {
      setDashboardError("Choose a party for the selected mob group.");
      return;
    }

    const nextMobs = buildEncounterOwnedMobsFromGroup({
      group,
      mobTemplatesById,
    }).map((mob) => ({
      ...mob,
      stagedPartyId: selectedGroupPartyId,
    }));

    if (nextMobs.length === 0) {
      setDashboardError("That group does not resolve to any valid mob templates.");
      return;
    }

    setStagedOwnedMobs((currentMobs) => [...currentMobs, ...nextMobs]);
    setDashboardError(null);
  }

  function addPortalStageToParty(): void {
    if (!selectedPortal || !selectedPortalStage) {
      setDashboardError("Select a saved portal stage first.");
      return;
    }
    if (!selectedPortalPartyId) {
      setDashboardError("Choose a party for the selected portal stage.");
      return;
    }

    const nextMobs = buildEncounterOwnedMobsFromPortalStage({
      portal: selectedPortal,
      stage: selectedPortalStage,
      mobGroupsById,
      mobTemplatesById,
    }).map((mob) => ({
      ...mob,
      stagedPartyId: selectedPortalPartyId,
    }));

    if (nextMobs.length === 0) {
      setDashboardError("That portal stage does not resolve to any valid mob groups.");
      return;
    }

    setStagedOwnedMobs((currentMobs) => [...currentMobs, ...nextMobs]);
    setDashboardError(null);
  }

  function moveStagedMobToParty(mobId: string, partyId: string): void {
    setStagedOwnedMobs((currentMobs) =>
      currentMobs.map((mob) =>
        mob.id === mobId
          ? {
              ...mob,
              stagedPartyId: partyId,
            }
          : mob
      )
    );
  }

  function removeStagedMob(mobId: string): void {
    setStagedOwnedMobs((currentMobs) => currentMobs.filter((mob) => mob.id !== mobId));
  }

  function handleStartEncounter(): void {
    try {
      const selectedCharacters = characters.filter(
        (character) =>
          stagedAssignments[character.id] !== null && stagedAssignments[character.id] !== undefined
      );
      const selectedOwnedMobs = stagedOwnedMobs.filter((mob) => mob.stagedPartyId !== null);

      if (selectedCharacters.length === 0 && selectedOwnedMobs.length === 0) {
        throw new RangeError("Add at least one combatant before starting the encounter.");
      }

      const encounter = createCombatEncounter(
        encounterLabel,
        [
          ...selectedCharacters.map((character) =>
            buildEncounterParticipantInput(
              character.id,
              character.ownerRole,
              character.sheet,
              stagedAssignments[character.id] ?? null,
              itemsById
            )
          ),
          ...buildEncounterOwnedMobParticipantInputs(
            selectedOwnedMobs.map(({ stagedPartyId: _ignoredPartyId, ...mob }) => mob),
            null,
            itemsById
          ).map((participant, index) => ({
            ...participant,
            partyId: selectedOwnedMobs[index]?.stagedPartyId ?? null,
          })),
        ],
        parties,
        selectedOwnedMobs.map(({ stagedPartyId: _ignoredPartyId, ...mob }) => mob)
      );

      beginCombatEncounter(encounter);
      setDashboardError(null);
      navigate("/dm/combat/encounter");
    } catch (error) {
      setDashboardError(
        error instanceof Error ? error.message : "Combat encounter could not be started."
      );
    }
  }

  function renderCharacterSelectionRow(character: CharacterRecord) {
    const selectedPartyId = getPendingAssignment(character.id);
    const isAssigned = (stagedAssignments[character.id] ?? null) !== null;

    return (
      <div key={character.id} className="dm-selection-row dm-selection-row-complex">
        <span>{getCharacterName(character)}</span>
        <div className="dm-selection-controls">
          <select
            value={selectedPartyId}
            onChange={(event) =>
              setPendingAssignments((currentPendingAssignments) => ({
                ...currentPendingAssignments,
                [character.id]: event.target.value,
              }))
            }
          >
            <option value="">Choose party</option>
            {parties.map((party) => (
              <option key={party.partyId} value={party.partyId}>
                {party.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => assignCharacterToParty(character.id, selectedPartyId)}
            disabled={selectedPartyId === ""}
          >
            {isAssigned ? "Move" : "Assign"}
          </button>
          <button type="button" onClick={() => removeCharacterFromCombat(character.id)}>
            Remove
          </button>
        </div>
      </div>
    );
  }

  return (
    <main className="dm-page">
      <section className="dm-shell">
        <header className="dm-topbar">
          <div>
            <p className="section-kicker">Dungeon Master</p>
            <h1>Combat Dashboard</h1>
          </div>
          <div className="dm-nav-actions">
            <button type="button" className="sheet-nav-button" onClick={() => navigate("/dm/screen")}>
              DM Screen
            </button>
            <button type="button" className="sheet-nav-button" onClick={() => navigate("/dm")}>
              DM Dashboard
            </button>
            <button type="button" className="sheet-nav-button" onClick={() => navigate("/")}>
              Main Menu
            </button>
          </div>
        </header>

        <section className="dm-setup-grid">
          <article className="sheet-card">
            <p className="section-kicker">Player Character Block</p>
            <h2>Player Characters</h2>
            <div className="dm-control-row dm-control-row-wrap">
              <button
                type="button"
                className="flow-secondary"
                onClick={() => navigate("/dm/characters")}
              >
                Open Player Character Sheets
              </button>
              <button
                type="button"
                className="flow-secondary"
                onClick={() => addAllCharactersToParty("player", "party-1")}
              >
                Add All Players
              </button>
            </div>
            <div className="dm-list">
              {playerCharacters.length === 0 ? (
                <p className="empty-block-copy">No player characters created yet.</p>
              ) : (
                playerCharacters.map(renderCharacterSelectionRow)
              )}
            </div>
          </article>

          <article className="sheet-card">
            <p className="section-kicker">NPC Creator Block</p>
            <h2>NPC Creator</h2>
            <p className="dm-summary-line">
              Open the DM character creator and add DM-created characters to the combat roster.
            </p>
            <div className="dm-control-row dm-control-row-wrap">
              <button
                type="button"
                className="flow-secondary"
                onClick={() => navigate("/dm/npc-creator")}
              >
                Open NPC Creator
              </button>
              <button
                type="button"
                className="flow-secondary"
                onClick={() => addAllCharactersToParty("dm", "party-2")}
              >
                Add All NPCs
              </button>
            </div>
            <div className="dm-list">
              {dmCharacters.length === 0 ? (
                <p className="empty-block-copy">No DM-created characters saved yet.</p>
              ) : (
                dmCharacters.map(renderCharacterSelectionRow)
              )}
            </div>
          </article>

          <article className="sheet-card">
            <p className="section-kicker">Mob Group Export</p>
            <h2>Saved Mob Groups</h2>
            <p className="dm-summary-line">
              Add reusable saved mob groups as encounter-owned combatants.
            </p>
            <div className="dm-inline-controls dm-inline-controls-two-up">
              <label>
                <span>Mob Group</span>
                <select value={selectedGroupId} onChange={(event) => setSelectedGroupId(event.target.value)}>
                  <option value="">Choose group</option>
                  {mobGroups.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Party</span>
                <select
                  value={selectedGroupPartyId}
                  onChange={(event) => setSelectedGroupPartyId(event.target.value)}
                >
                  {parties.map((party) => (
                    <option key={party.partyId} value={party.partyId}>
                      {party.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="dm-control-row dm-control-row-wrap">
              <button type="button" className="flow-secondary" onClick={() => navigate("/dm/mob-groups")}>
                Open Mob Groups
              </button>
              <button type="button" className="flow-primary" onClick={addMobGroupToParty}>
                Add Group To Combat
              </button>
            </div>
          </article>

          <article className="sheet-card">
            <p className="section-kicker">Portal Stage Export</p>
            <h2>Saved Portal Stages</h2>
            <p className="dm-summary-line">
              Export one saved portal stage into the combat roster.
            </p>
            <div className="dm-inline-controls">
              <label>
                <span>Portal</span>
                <select
                  value={selectedPortal?.id ?? ""}
                  onChange={(event) => {
                    setSelectedPortalId(event.target.value);
                    setSelectedPortalStageIndex("0");
                  }}
                >
                  <option value="">Choose portal</option>
                  {portalTemplates.map((portal) => (
                    <option key={portal.id} value={portal.id}>
                      {portal.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Stage</span>
                <select
                  value={selectedPortalStageIndex}
                  onChange={(event) => setSelectedPortalStageIndex(event.target.value)}
                  disabled={!selectedPortal}
                >
                  {(selectedPortal?.stages ?? []).map((stage, index) => (
                    <option key={stage.id} value={String(index)}>
                      {buildPortalStageLabel(selectedPortal, index)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Party</span>
                <select
                  value={selectedPortalPartyId}
                  onChange={(event) => setSelectedPortalPartyId(event.target.value)}
                >
                  {parties.map((party) => (
                    <option key={party.partyId} value={party.partyId}>
                      {party.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="dm-control-row dm-control-row-wrap">
              <button type="button" className="flow-secondary" onClick={() => navigate("/dm/portals")}>
                Open Portal Workshop
              </button>
              <button type="button" className="flow-primary" onClick={addPortalStageToParty}>
                Add Stage To Combat
              </button>
            </div>
          </article>

          <article className="sheet-card">
            <p className="section-kicker">Party Staging</p>
            <h2>Parties</h2>
            <div className="dm-control-row">
              <button type="button" className="flow-secondary" onClick={createParty}>
                Create Party
              </button>
            </div>
            <div className="dm-party-grid">
              {parties.map((party) => (
                <section key={party.partyId} className="dm-party-card">
                  <div className="dm-party-card-head">
                    <strong>{party.label}</strong>
                    <small>
                      {party.kind === "players"
                        ? "Player Party"
                        : party.kind === "npcs"
                          ? "NPC Party"
                          : "Custom Party"}
                    </small>
                  </div>
                  <div className="dm-list">
                    {encounterMembersByParty[party.partyId]?.map((character) => (
                      <div key={character.id} className="dm-selection-row dm-selection-row-complex">
                        <span>{getCharacterName(character)}</span>
                        <div className="dm-selection-controls">
                          <select
                            value={getPendingAssignment(character.id)}
                            onChange={(event) =>
                              setPendingAssignments((currentPendingAssignments) => ({
                                ...currentPendingAssignments,
                                [character.id]: event.target.value,
                              }))
                            }
                          >
                            {parties.map((destinationParty) => (
                              <option key={destinationParty.partyId} value={destinationParty.partyId}>
                                {destinationParty.label}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={() =>
                              assignCharacterToParty(character.id, getPendingAssignment(character.id))
                            }
                          >
                            Move
                          </button>
                          <button
                            type="button"
                            onClick={() => removeCharacterFromCombat(character.id)}
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}

                    {stagedOwnedMobsByParty[party.partyId]?.map((mob) => (
                      <div key={mob.id} className="dm-selection-row dm-selection-row-complex">
                        <span>
                          {mob.displayName}
                          <small>{getStagedMobSummary(mob)}</small>
                        </span>
                        <div className="dm-selection-controls">
                          <select
                            value={mob.stagedPartyId ?? ""}
                            onChange={(event) => moveStagedMobToParty(mob.id, event.target.value)}
                          >
                            {parties.map((destinationParty) => (
                              <option key={destinationParty.partyId} value={destinationParty.partyId}>
                                {destinationParty.label}
                              </option>
                            ))}
                          </select>
                          <button type="button" onClick={() => removeStagedMob(mob.id)}>
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}

                    {(encounterMembersByParty[party.partyId]?.length ?? 0) === 0 &&
                    (stagedOwnedMobsByParty[party.partyId]?.length ?? 0) === 0 ? (
                      <p className="empty-block-copy">No combatants assigned.</p>
                    ) : null}
                  </div>
                </section>
              ))}
            </div>
            <p className="dm-summary-line">
              Assigned combatants: {assignedCharacterIds.length + stagedOwnedMobs.length}
            </p>
          </article>

          <article className="sheet-card">
            <p className="section-kicker">Combat Encounter</p>
            <h2>Start Combat</h2>
            <p className="dm-summary-line">
              Starting combat rolls initiative for the assigned combatants, opens the DM Combat
              Encounter, and enables player Combat Mode.
            </p>
            <div className="dm-field">
              <span>Encounter Label</span>
              <input
                value={encounterLabel}
                onChange={(event) => setEncounterLabel(event.target.value)}
              />
            </div>
            <div className="dm-control-row">
              <button type="button" className="flow-primary" onClick={handleStartEncounter}>
                Start Combat
              </button>
            </div>
          </article>
        </section>
        {dashboardError ? <p className="dm-error">{dashboardError}</p> : null}
      </section>
    </main>
  );
}
