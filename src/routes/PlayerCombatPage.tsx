import { useMemo, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";

import { EncounterCastConfirmationDialog } from "../components/combat-encounter/EncounterCastConfirmationDialog";
import { CombatantCastForm } from "../components/combat-encounter/CombatantCastForm.tsx";
import { CombatantPhysicalAttackForm } from "../components/combat-encounter/CombatantPhysicalAttackForm.tsx";
import { KnowledgeCardView } from "../components/player-character/KnowledgeCardView.tsx";
import { EncounterActivityLogPanel } from "../components/combat-encounter/EncounterActivityLogPanel";
import { useCombatantCastState } from "../hooks/useCombatantCastState.ts";
import { prepareCastRequest } from "../lib/combatEncounterCasting";
import { preparePhysicalAttackRequest } from "../lib/combatEncounterPhysicalAttacks";
import { buildItemIndex } from "../lib/items.ts";
import {
  buildPlayerCombatParticipantViews,
  buildPlayerFacingEncounterActivityLog,
  isCharacterInCombatEncounter,
  type PlayerCombatParticipantView,
} from "../lib/playerCombat.ts";
import { buildCharacterEncounterSnapshot } from "../rules/combatEncounter.ts";
import { isControlledByCaster } from "../powers/runtimeSupport.ts";
import { useAppFlow } from "../state/appFlow";
import { EncounterExecutionEngine, type EncounterExecutionResult } from "../engine/encounterExecutionEngine.ts";
import { CROWD_CONTROL_SPELL_NAME } from "../powers/spellLabels.ts";
import type { CharacterRecord } from "../types/character.ts";
import type { CharacterEncounterSnapshot } from "../types/combatEncounter.ts";
import type {
  CastRequestPayload,
  EncounterParticipantView,
  PreparedCastRequest,
} from "../types/combatEncounterView.ts";
import type {
  ItemBlueprintRecord,
  ItemCategoryDefinition,
  ItemSubcategoryDefinition,
  SharedItemRecord,
} from "../types/items.ts";

function getCharacterLabel(character: CharacterRecord): string {
  return character.sheet.name.trim() || "Unnamed Character";
}

type PendingCastConfirmation = {
  request: PreparedCastRequest;
  warnings: string[];
};

type PlayerCombatActionPanelProps = {
  view: EncounterParticipantView;
  encounterParticipants: EncounterParticipantView[];
  itemsById: Record<string, SharedItemRecord>;
  itemBlueprints: ItemBlueprintRecord[];
  itemCategoryDefinitions: ItemCategoryDefinition[];
  itemSubcategoryDefinitions: ItemSubcategoryDefinition[];
  requestCast: (payload: CastRequestPayload) => string | null;
  requestPhysicalAttack: (payload: {
    casterView: EncounterParticipantView;
    targetView: EncounterParticipantView;
  }) => string | null;
  requestControlRelease: (payload: {
    casterView: EncounterParticipantView;
    targetView: EncounterParticipantView;
  }) => string | null;
  requestSummonDismiss: (payload: {
    casterView: EncounterParticipantView;
    summonView: EncounterParticipantView;
  }) => string | null;
};

function PlayerCombatActionPanel({
  view,
  encounterParticipants,
  itemsById,
  itemBlueprints,
  itemCategoryDefinitions,
  itemSubcategoryDefinitions,
  requestCast,
  requestPhysicalAttack,
  requestControlRelease,
  requestSummonDismiss,
}: PlayerCombatActionPanelProps) {
  const castState = useCombatantCastState({
    view,
    encounterParticipants,
    requestCast,
  });
  const character = view.character;
  const [releaseControlError, setReleaseControlError] = useState<string | null>(null);
  const [summonDismissError, setSummonDismissError] = useState<string | null>(null);

  if (!character) {
    return null;
  }

  const crowdControlPower =
    character.sheet.powers.find((power) => power.id === "crowd_control" && power.level > 0) ?? null;
  const controlledTargets = crowdControlPower
    ? encounterParticipants.filter((targetView) => isControlledByCaster(targetView, character.id))
    : [];
  const dismissibleSummons = encounterParticipants.filter(
    (targetView) =>
      targetView.transientCombatant !== null &&
      targetView.transientCombatant.controllerCharacterId === character.id &&
      (
        targetView.transientCombatant.sourcePowerId === "necromancy" ||
        targetView.transientCombatant.sourcePowerId === "shadow_control"
      )
  );

  function handleReleaseControl(targetView: EncounterParticipantView): void {
    setReleaseControlError(
      requestControlRelease({
        casterView: view,
        targetView,
      })
    );
  }

  function handleDismissSummon(summonView: EncounterParticipantView): void {
    setSummonDismissError(
      requestSummonDismiss({
        casterView: view,
        summonView,
      })
    );
  }

  return (
    <div className="dm-combatant-section dm-combatant-section-full">
      <p className="section-kicker">Your Actions</p>
      <div className="dm-combatant-tools">
        <div className="dm-combatant-tool-section">
          <p className="section-kicker">Physical Attack</p>
          <CombatantPhysicalAttackForm
            embedded
            view={view}
            encounterParticipants={encounterParticipants}
            itemsById={itemsById}
            itemBlueprints={itemBlueprints}
            itemCategoryDefinitions={itemCategoryDefinitions}
            itemSubcategoryDefinitions={itemSubcategoryDefinitions}
            requestPhysicalAttack={requestPhysicalAttack}
          />
        </div>

        <div className="dm-combatant-tool-section">
          <p className="section-kicker">Cast Power</p>
          <CombatantCastForm embedded state={castState} />
        </div>
      </div>

      {controlledTargets.length > 0 ? (
        <div className="dm-combatant-section">
          <p className="section-kicker">{CROWD_CONTROL_SPELL_NAME}</p>
          <div className="dm-target-multi-grid">
            {controlledTargets.map((targetView) => (
              <button
                key={targetView.participant.characterId}
                type="button"
                className="dm-target-chip"
                onClick={() => handleReleaseControl(targetView)}
              >
                Release {targetView.participant.displayName}
              </button>
            ))}
          </div>
          {releaseControlError ? <p className="dm-error">{releaseControlError}</p> : null}
        </div>
      ) : null}

      {dismissibleSummons.length > 0 ? (
        <div className="dm-combatant-section">
          <p className="section-kicker">Summons</p>
          <div className="dm-target-multi-grid">
            {dismissibleSummons.map((summonView) => (
              <button
                key={summonView.participant.characterId}
                type="button"
                className="dm-target-chip"
                onClick={() => handleDismissSummon(summonView)}
              >
                Dismiss {summonView.participant.displayName}
              </button>
            ))}
          </div>
          {summonDismissError ? <p className="dm-error">{summonDismissError}</p> : null}
        </div>
      ) : null}
    </div>
  );
}

function PlayerCombatSnapshotPanel({
  snapshot,
  onOpenCharacterSheet,
  children,
}: {
  snapshot: CharacterEncounterSnapshot | null;
  onOpenCharacterSheet: () => void;
  children?: React.ReactNode;
}) {
  if (!snapshot) {
    return <p className="dm-summary-line">This combatant no longer resolves to a character sheet.</p>;
  }

  return (
    <>
      <div className="dm-entry-actions">
        <button type="button" className="flow-secondary" onClick={onOpenCharacterSheet}>
          Open Full Character Sheet
        </button>
      </div>

      <div className="dm-combatant-values">
        <div className="dm-combatant-section">
          <p className="section-kicker">Combat Summary</p>
          <div className="dm-action-grid">
            {snapshot.combatSummary.map((field) => (
              <div key={field.id}>
                <span>{field.label}</span>
                <strong>{field.value}</strong>
              </div>
            ))}
            <div>
              <span>Inspiration</span>
              <strong>{snapshot.inspiration}</strong>
              <small>{snapshot.inspirationDetail}</small>
            </div>
          </div>
        </div>

        <div className="dm-combatant-side-stack">
          <div className="dm-combatant-section">
            <p className="section-kicker">Stats</p>
            <div className="dm-detail-grid dm-detail-grid-compact">
              {snapshot.stats.map((field) => (
                <article key={field.id} className="dm-detail-card dm-detail-card-compact">
                  <span>{field.label}</span>
                  <strong>{field.value}</strong>
                </article>
              ))}
            </div>
          </div>

          <div className="dm-combatant-section">
            <p className="section-kicker">Highlighted Skills</p>
            <div className="dm-detail-grid-small dm-detail-grid-compact">
              {snapshot.highlightedSkills.map((field) => (
                <article key={field.id} className="dm-detail-card dm-detail-card-compact">
                  <span>{field.label}</span>
                  <strong>{field.value}</strong>
                </article>
              ))}
            </div>
          </div>
        </div>

        {snapshot.visibleResistances.length > 0 ? (
          <div className="dm-combatant-section dm-combatant-section-full">
            <p className="section-kicker">Resistances</p>
            <div className="dm-pill-list">
              {snapshot.visibleResistances.map((resistance) => (
                <div key={resistance.id} className="dm-pill">
                  <strong>{resistance.label}</strong>
                  <span>
                    {resistance.levelLabel} {resistance.multiplierLabel}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {snapshot.statusTags.length > 0 ? (
          <div className="dm-combatant-section dm-combatant-section-full">
            <p className="section-kicker">Status Tags</p>
            <div className="dm-pill-list">
              {snapshot.statusTags.map((tag) => (
                <div key={tag} className="dm-pill">
                  <strong>{tag}</strong>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {snapshot.utilityTraits.length > 0 ? (
          <div className="dm-combatant-section dm-combatant-section-full">
            <p className="section-kicker">Utility Traits</p>
            <div className="dm-pill-list">
              {snapshot.utilityTraits.map((trait) => (
                <div key={trait} className="dm-pill">
                  <strong>{trait}</strong>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {children}
      </div>
    </>
  );
}

function PlayerCombatExpandableCard({
  combatant,
  titlePrefix,
  isActive,
  onOpenCharacterSheet,
  children,
}: {
  combatant: PlayerCombatParticipantView;
  titlePrefix: string;
  isActive: boolean;
  onOpenCharacterSheet: () => void;
  children?: React.ReactNode;
}) {
  const canExpand =
    combatant.isViewer || (combatant.isOpponent && combatant.knowledgeRevision !== null);

  if (!canExpand) {
    return (
      <div className="dm-compact-row">
        <span>{isActive ? "Active Turn" : "Queued"}</span>
        <strong>{titlePrefix}</strong>
      </div>
    );
  }

  return (
    <details className="dm-accordion">
      <summary className="dm-accordion-summary">
        <div>
          <strong>{titlePrefix}</strong>
          <small>{isActive ? "Active Turn" : "Queued"}</small>
        </div>
      </summary>

      <div className="dm-accordion-body">
        {combatant.isViewer ? (
          <PlayerCombatSnapshotPanel
            snapshot={combatant.encounterView.snapshot}
            onOpenCharacterSheet={onOpenCharacterSheet}
          >
            {children}
          </PlayerCombatSnapshotPanel>
        ) : combatant.knowledgeEntity && combatant.knowledgeRevision ? (
          <KnowledgeCardView
            entity={combatant.knowledgeEntity}
            revision={combatant.knowledgeRevision}
            ownership={combatant.knowledgeOwnership}
            mode="preview"
          />
        ) : (
          <p className="dm-summary-line">No knowledge card is available for this combatant.</p>
        )}
      </div>
    </details>
  );
}

export function PlayerCombatPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    roleChoice,
    characters,
    items,
    knowledgeEntities,
    knowledgeRevisions,
    knowledgeOwnerships,
    activeCombatEncounter,
    activePlayerCharacter,
    selectCharacter,
    itemBlueprints,
    itemCategoryDefinitions,
    itemSubcategoryDefinitions,
    characters: allCharacters,
    updateCharacter,
    replaceCharacters,
    updateKnowledgeState,
    updateCombatEncounter,
  } = useAppFlow();
  const [pendingCastConfirmation, setPendingCastConfirmation] =
    useState<PendingCastConfirmation | null>(null);
  const [pendingCastError, setPendingCastError] = useState<string | null>(null);
  const itemsById = buildItemIndex(items);
  const characterIdFromQuery = new URLSearchParams(location.search).get("characterId");
  const encounterParticipants = useMemo<EncounterParticipantView[]>(() => {
    if (!activeCombatEncounter) {
      return [];
    }

    return activeCombatEncounter.participants.map((participant) => {
      const encounterOwnedMob =
        (activeCombatEncounter.encounterOwnedMobs ?? []).find(
          (entry) => entry.id === participant.characterId
        ) ?? null;
      const transientCombatant =
        activeCombatEncounter.transientCombatants.find(
          (entry) => entry.id === participant.characterId
        ) ?? null;
      const character =
        allCharacters.find((entry) => entry.id === participant.characterId) ??
        (encounterOwnedMob
          ? {
              id: encounterOwnedMob.id,
              ownerRole: encounterOwnedMob.ownerRole,
              sheet: encounterOwnedMob.sheet,
            }
          : null) ??
        (transientCombatant
          ? {
              id: transientCombatant.id,
              ownerRole: transientCombatant.ownerRole,
              sheet: transientCombatant.sheet,
            }
          : null);

      return {
        participant,
        character,
        encounterOwnedMob,
        transientCombatant,
        snapshot: character ? buildCharacterEncounterSnapshot(character.sheet, itemsById) : null,
      };
    });
  }, [activeCombatEncounter, characters, itemsById]);
  const playerCombatCharacters = useMemo(
    () =>
      allCharacters.filter(
        (character) =>
          character.ownerRole === "player" &&
          isCharacterInCombatEncounter(encounterParticipants, character.id)
      ),
    [allCharacters, encounterParticipants]
  );
  const activeCharacter =
    (characterIdFromQuery
      ? playerCombatCharacters.find((character) => character.id === characterIdFromQuery) ?? null
      : null) ??
    (activePlayerCharacter &&
    isCharacterInCombatEncounter(encounterParticipants, activePlayerCharacter.id)
      ? activePlayerCharacter
      : null) ??
    playerCombatCharacters[0] ??
    null;
  const knowledgeState = {
    knowledgeEntities,
    knowledgeRevisions,
    knowledgeOwnerships,
  };
  const combatants = useMemo(
    () =>
      activeCharacter && activeCombatEncounter
        ? buildPlayerCombatParticipantViews({
            viewerCharacterId: activeCharacter.id,
            encounterParticipants,
            encounterParties: activeCombatEncounter.parties,
            knowledgeState,
            itemsById,
          })
        : [],
    [
      activeCharacter,
      activeCombatEncounter,
      encounterParticipants,
      itemsById,
      knowledgeEntities,
      knowledgeOwnerships,
      knowledgeRevisions,
    ]
  );
  const activityLog = useMemo(
    () =>
      activeCombatEncounter
        ? buildPlayerFacingEncounterActivityLog({
            activityLog: activeCombatEncounter.activityLog,
            combatants,
          })
        : [],
    [activeCombatEncounter, combatants]
  );
  const partyGroups = useMemo(() => {
    const groups = new Map<
      string,
      { label: string; members: typeof combatants }
    >();

    combatants.forEach((combatant) => {
      const partyId = combatant.encounterView.participant.partyId ?? "__unassigned__";
      const currentGroup = groups.get(partyId) ?? {
        label: combatant.partyDisplayLabel,
        members: [],
      };
      currentGroup.members.push(combatant);
      groups.set(partyId, currentGroup);
    });

    return [...groups.values()];
  }, [combatants]);
  const activeParticipantId = activeCombatEncounter?.turnState.activeParticipantId ?? null;
  const activeCombatantLabel =
    combatants.find(
      (combatant) =>
        combatant.encounterView.participant.characterId === activeParticipantId
      )?.label ?? null;
  const playerFacingEncounterParticipants = useMemo(() => {
    const labelsById = new Map(
      combatants.map((combatant) => [
        combatant.encounterView.participant.characterId,
        combatant.label,
      ])
    );

    return encounterParticipants.map((view) => ({
      ...view,
      participant: {
        ...view.participant,
        displayName: labelsById.get(view.participant.characterId) ?? view.participant.displayName,
      },
    }));
  }, [combatants, encounterParticipants]);

  if (roleChoice !== "player") {
    return <Navigate to="/role" replace />;
  }

  if (!activeCombatEncounter) {
    return <Navigate to="/player" replace />;
  }

  if (!activeCharacter) {
    return <Navigate to="/player" replace />;
  }

  function navigateToCharacterSheet(character: CharacterRecord): void {
    selectCharacter(character.id);
    navigate(`/player/character?characterId=${encodeURIComponent(character.id)}`);
  }

  function handleCharacterChange(characterId: string): void {
    selectCharacter(characterId);
    navigate(`/player/combat?characterId=${encodeURIComponent(characterId)}`);
  }

  function buildExecutionEngine(): EncounterExecutionEngine | null {
    if (!activeCombatEncounter) {
      return null;
    }

    return new EncounterExecutionEngine({
      characters: allCharacters,
      encounter: activeCombatEncounter,
      knowledgeState,
      itemsById,
    });
  }

  function commitExecutionResult(result: EncounterExecutionResult): void {
    replaceCharacters(result.characters);
    updateKnowledgeState(result.knowledgeState);
    updateCombatEncounter(result.encounter);
  }

  function executePreparedCast(request: PreparedCastRequest): string | null {
    const engine = buildExecutionEngine();
    if (!engine) {
      return "The active encounter is no longer available.";
    }

    const execution = engine.executePreparedRequest(request);
    if ("error" in execution) {
      return execution.error;
    }

    commitExecutionResult(execution.result);
    return null;
  }

  function requestCast(payload: CastRequestPayload): string | null {
    const prepared = prepareCastRequest({
      ...payload,
      itemsById,
    });
    if ("error" in prepared) {
      return prepared.error;
    }

    setPendingCastError(null);
    if (prepared.warnings.length > 0) {
      setPendingCastConfirmation({
        request: prepared.request,
        warnings: prepared.warnings,
      });
      return null;
    }

    return executePreparedCast(prepared.request);
  }

  function requestPhysicalAttack(payload: {
    casterView: EncounterParticipantView;
    targetView: EncounterParticipantView;
  }): string | null {
    const casterCharacter = payload.casterView.character;
    const targetCharacter = payload.targetView.character;
    if (!casterCharacter || !targetCharacter) {
      return "The selected combatants no longer resolve to character sheets.";
    }

    const prepared = preparePhysicalAttackRequest({
      casterCharacter,
      targetCharacter,
      itemsById,
      itemBlueprints,
      itemCategoryDefinitions,
      itemSubcategoryDefinitions,
    });
    if ("error" in prepared) {
      return prepared.error;
    }

    return executePreparedCast(prepared.request);
  }

  function requestControlRelease(payload: {
    casterView: EncounterParticipantView;
    targetView: EncounterParticipantView;
  }): string | null {
    const casterCharacter = payload.casterView.character;
    const targetCharacter = payload.targetView.character;
    const selectedPower =
      casterCharacter?.sheet.powers.find((power) => power.id === "crowd_control") ?? null;

    if (!casterCharacter || !targetCharacter || !selectedPower) {
      return "Crowd Control release is no longer available for this combatant.";
    }

    if (!isControlledByCaster(payload.targetView, casterCharacter.id)) {
      return "That target is not currently controlled by this caster.";
    }

    return requestCast({
      casterCharacter,
      casterDisplayName: payload.casterView.participant.displayName,
      selectedPower,
      selectedVariantId: "release_control",
      attackOutcome: "unresolved",
      selectedTargetIds: [targetCharacter.id],
      fallbackTargetIds: [targetCharacter.id],
      healingAllocations: {},
      selectedStatId: null,
      castMode: "self",
      selectedDamageType: null,
      bonusManaSpend: 0,
      selectedSummonOptionId: null,
      encounterParticipants: playerFacingEncounterParticipants,
      itemsById,
    });
  }

  function requestSummonDismiss(payload: {
    casterView: EncounterParticipantView;
    summonView: EncounterParticipantView;
  }): string | null {
    const casterCharacter = payload.casterView.character;
    const summon = payload.summonView.transientCombatant;
    if (!casterCharacter || !summon) {
      return "Summon dismissal is no longer available for this combatant.";
    }

    if (summon.controllerCharacterId !== casterCharacter.id) {
      return "That summon is not controlled by this caster.";
    }

    const selectedPower =
      casterCharacter.sheet.powers.find((power) => power.id === summon.sourcePowerId) ?? null;
    if (
      !selectedPower ||
      (selectedPower.id !== "necromancy" && selectedPower.id !== "shadow_control")
    ) {
      return "That summon does not resolve to a dismissible power.";
    }

    return requestCast({
      casterCharacter,
      casterDisplayName: payload.casterView.participant.displayName,
      selectedPower,
      selectedVariantId: "dismiss_summon",
      attackOutcome: "unresolved",
      selectedTargetIds: [casterCharacter.id],
      fallbackTargetIds: [casterCharacter.id],
      healingAllocations: {},
      selectedStatId: null,
      castMode: "self",
      selectedDamageType: null,
      bonusManaSpend: 0,
      selectedSummonOptionId: summon.id,
      encounterParticipants: playerFacingEncounterParticipants,
      itemsById,
    });
  }

  function closePendingCastConfirmation(): void {
    setPendingCastConfirmation(null);
    setPendingCastError(null);
  }

  function confirmPendingCast(): void {
    if (!pendingCastConfirmation) {
      return;
    }

    const error = executePreparedCast(pendingCastConfirmation.request);
    if (error) {
      setPendingCastError(error);
      return;
    }

    setPendingCastConfirmation(null);
    setPendingCastError(null);
  }

  return (
    <main className="dm-page">
      <section className="dm-shell">
        <header className="dm-topbar">
          <div>
            <p className="section-kicker">Player</p>
            <h1>Combat Mode</h1>
            <p className="dm-summary-line">
              Viewing {activeCharacter.sheet.name.trim() || "Unnamed Character"} in{" "}
              {activeCombatEncounter.label}.
            </p>
          </div>
          <div className="dm-nav-actions dm-nav-actions-wrap">
            <button
              type="button"
              className="sheet-nav-button"
              onClick={() => navigateToCharacterSheet(activeCharacter)}
            >
              Character Sheet
            </button>
            <button
              type="button"
              className="sheet-nav-button"
              onClick={() => navigate("/player/session")}
            >
              Live Session
            </button>
            <button
              type="button"
              className="sheet-nav-button"
              onClick={() => navigate("/player")}
            >
              Player Hub
            </button>
          </div>
        </header>

        <section className="dm-encounter-layout">
          <article className="sheet-card">
            <p className="section-kicker">Combat Encounter</p>
            <h2>{activeCombatEncounter.label}</h2>
            <div className="dm-item-edit-grid dm-item-edit-grid-two-up">
              <label className="dm-field">
                <span>View As</span>
                <select
                  value={activeCharacter.id}
                  onChange={(event) => handleCharacterChange(event.target.value)}
                >
                  {playerCombatCharacters.map((character) => (
                    <option key={character.id} value={character.id}>
                      {getCharacterLabel(character)}
                    </option>
                  ))}
                </select>
              </label>
              <div className="dm-detail-card">
                <span>Round</span>
                <strong>{activeCombatEncounter.turnState.round}</strong>
              </div>
              <div className="dm-detail-card">
                <span>Turn</span>
                <strong>{activeCombatantLabel ?? "No active combatant"}</strong>
              </div>
              <div className="dm-detail-card">
                <span>Combatants</span>
                <strong>{combatants.length}</strong>
              </div>
            </div>
          </article>

          <article className="sheet-card dm-log-card">
            <p className="section-kicker">Parties</p>
            <h2>Encounter Parties</h2>
            <div className="dm-party-grid">
              {partyGroups.map((group) => (
                <section key={group.label} className="dm-party-card">
                  <div className="dm-party-card-head">
                    <strong>{group.label}</strong>
                    <small>
                      {group.members.some((member) => member.isViewer || member.isAllied)
                        ? "Allies"
                        : "Opponents"}
                    </small>
                  </div>
                  <div className="dm-party-member-list">
                    {group.members.map((member) => {
                      const canExpand =
                        member.isViewer ||
                        (member.isOpponent && member.knowledgeRevision !== null);

                      if (!canExpand) {
                        return (
                          <div
                            key={member.encounterView.participant.characterId}
                            className="dm-party-member-card"
                          >
                            <div className="dm-party-hp-row">
                              <span>{member.label}</span>
                            </div>
                            <div className="dm-party-hp-bar" aria-hidden="true">
                              <div
                                className="dm-party-hp-fill"
                                style={{ width: `${member.hpPercent}%` }}
                              />
                            </div>
                          </div>
                        );
                      }

                      return (
                        <details
                          key={member.encounterView.participant.characterId}
                          className="dm-accordion dm-party-member-card"
                        >
                          <summary className="dm-accordion-summary">
                            <div className="dm-party-hp-row">
                              <span>{member.label}</span>
                              <small>{member.isViewer ? "You" : "Assessed"}</small>
                            </div>
                            <div className="dm-party-hp-bar" aria-hidden="true">
                              <div
                                className="dm-party-hp-fill"
                                style={{ width: `${member.hpPercent}%` }}
                              />
                            </div>
                          </summary>
                          <div className="dm-accordion-body">
                            {member.isViewer ? (
                              <PlayerCombatSnapshotPanel
                                snapshot={member.encounterView.snapshot}
                                onOpenCharacterSheet={() => navigateToCharacterSheet(activeCharacter)}
                              />
                            ) : member.knowledgeEntity && member.knowledgeRevision ? (
                              <KnowledgeCardView
                                entity={member.knowledgeEntity}
                                revision={member.knowledgeRevision}
                                ownership={member.knowledgeOwnership}
                                mode="preview"
                              />
                            ) : null}
                          </div>
                        </details>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          </article>

          <EncounterActivityLogPanel activityLog={activityLog} />

          <article className="sheet-card dm-log-card">
            <p className="section-kicker">Combatants Block</p>
            <h2>Initiative Order</h2>
            <div className="dm-accordion-list">
              {combatants.map((combatant, index) => (
                <PlayerCombatExpandableCard
                  key={combatant.encounterView.participant.characterId}
                  combatant={combatant}
                  titlePrefix={`${index + 1}. ${combatant.label}`}
                  isActive={
                    combatant.encounterView.participant.characterId === activeParticipantId
                  }
                  onOpenCharacterSheet={() => navigateToCharacterSheet(activeCharacter)}
                >
                  {combatant.isViewer ? (
                    combatant.encounterView.participant.characterId === activeParticipantId ? (
                      <PlayerCombatActionPanel
                        view={playerFacingEncounterParticipants[index] ?? combatant.encounterView}
                        encounterParticipants={playerFacingEncounterParticipants}
                        itemsById={itemsById}
                        itemBlueprints={itemBlueprints}
                        itemCategoryDefinitions={itemCategoryDefinitions}
                        itemSubcategoryDefinitions={itemSubcategoryDefinitions}
                        requestCast={requestCast}
                        requestPhysicalAttack={requestPhysicalAttack}
                        requestControlRelease={requestControlRelease}
                        requestSummonDismiss={requestSummonDismiss}
                      />
                    ) : (
                      <div className="dm-combatant-section dm-combatant-section-full">
                        <p className="dm-summary-line">Action controls unlock on your active turn.</p>
                      </div>
                    )
                  ) : null}
                </PlayerCombatExpandableCard>
              ))}
            </div>
          </article>
        </section>
      </section>

      <EncounterCastConfirmationDialog
        pendingCastConfirmation={pendingCastConfirmation}
        pendingCastError={pendingCastError}
        onClose={closePendingCastConfirmation}
        onConfirm={confirmPendingCast}
      />
    </main>
  );
}
